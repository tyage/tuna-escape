import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function credentialsFromEnv(env) {
  const appId = env.META_APP_ID || env.APP_ID;
  const appSecret = env.META_APP_SECRET || env.APP_SECRET;
  return {
    appId,
    appSecret,
    uploadToken: env.META_UPLOAD_TOKEN || undefined,
    appToken: env.META_APP_ACCESS_TOKEN || undefined,
  };
}

function issueAppToken(appId, appSecret, run) {
  if (!appSecret || /[\r\n\0]/.test(appSecret)) throw new Error('META_APP_SECRET または META_APP_ACCESS_TOKEN が必要です。');
  // Send the App Secret only to Meta's OAuth endpoint, in stdin rather than
  // argv, a URL, or a file. Never substitute the raw secret for an upload token.
  const result = run('curl', [
    '--silent', '--show-error', '--fail-with-body', '--proto', '=https',
    '--connect-timeout', '20', '--max-time', '120', '--request', 'POST',
    '--header', 'Content-Type: application/x-www-form-urlencoded',
    '--data-binary', '@-', 'https://graph.facebook.com/oauth/access_token',
  ], {
    input: new URLSearchParams({ client_id: appId, client_secret: appSecret, grant_type: 'client_credentials' }).toString(),
    encoding: 'utf8', timeout: 125000, maxBuffer: 1024 * 1024,
  });
  let payload;
  try { payload = JSON.parse(result.stdout || ''); } catch { /* Fail closed. */ }
  if (result.error || result.status !== 0 || payload?.error || typeof payload?.access_token !== 'string' || !payload.access_token || /[\r\n\0]/.test(payload.access_token)) {
    // OAuth responses can contain credentials; never include their body in logs.
    throw new Error('Meta OAuthでApp Access Tokenを発行できませんでした。App IDとApp Secretを確認してください。');
  }
  return payload.access_token;
}

function redact(message, token) {
  let text = String(message);
  for (const value of [token, encodeURIComponent(token), ...token.split('|').filter(part => part.length > 8)]) {
    text = text.replaceAll(value, '[REDACTED]');
  }
  return text.replace(/[\r\n]/g, ' ').slice(0, 400);
}

function post(url, token, scheme, args, operation, run) {
  const result = run('curl', [
    '--config', '-', '--silent', '--show-error', '--fail-with-body',
    '--proto', '=https', '--connect-timeout', '20', '--max-time', '120',
    '--request', 'POST', ...args, url,
  ], {
    input: `header = ${JSON.stringify(`Authorization: ${scheme} ${token}`)}\n`,
    encoding: 'utf8', timeout: 125000, maxBuffer: 1024 * 1024,
  });
  let payload;
  try {
    // Meta IDs can exceed Number.MAX_SAFE_INTEGER; preserve the exact decimal ID.
    const json = (result.stdout || '').replace(/("bundle_instance_id"\s*:\s*)(\d+)(?=\s*[,}])/g, '$1"$2"');
    payload = JSON.parse(json);
  } catch { /* Missing or malformed JSON must not be accepted as success. */ }
  if (result.error || result.status !== 0 || !payload || payload.error || payload.debug_info?.type || payload.success === false) {
    const code = payload?.error?.code || payload?.status;
    const message = payload?.error?.message || payload?.debug_info?.message || payload?.message || payload?.detail;
    const error = new Error(`${operation}に失敗しました。${Number.isInteger(code) ? `Meta code: ${code}。` : ''}${message ? redact(message, token) : '通信・API応答を確認してください。'}`);
    error.retryablePromotionFailure = operation === '本番切替' && payload?.success === false && [
      'Failed to productionize app asset',
      'Version must be finished processing in order to productionize',
    ].includes(payload?.message);
    throw error;
  }
  return payload;
}

export async function deployBundle({ appId, appSecret, uploadToken, appToken, zipPath, comment = 'TUNA ESCAPE', version = 'v24.0' }, run = spawnSync, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  if (!/^\d+$/.test(appId || '')) throw new Error('META_APP_ID が必要です。');
  if (typeof uploadToken === 'string' && /^[a-f0-9]{32}$/i.test(uploadToken)) {
    throw new Error('META_UPLOAD_TOKEN の値はApp Secret形式です（値は非表示）。App SecretはMETA_APP_SECRETへ設定してください。App Access TokenはOAuthで発行します。');
  }
  if (uploadToken !== undefined && (!uploadToken || !/^(GG|EAA)/.test(uploadToken) || /[\r\n\0]/.test(uploadToken))) {
    throw new Error('META_UPLOAD_TOKEN に有効なAccess Tokenを設定してください。省略するとApp Access Tokenを使用します。');
  }
  if (appToken !== undefined && (!appToken || /[\r\n\0]/.test(appToken))) throw new Error('META_APP_ACCESS_TOKEN の形式が不正です。');
  if (!/^v\d+\.\d+$/.test(version)) throw new Error('META_GRAPH_VERSION は vXX.X 形式で指定してください。');
  if (!zipPath || /[\r\n\0]/.test(zipPath) || /[\r\n\0]/.test(comment)) throw new Error('ZIPパスまたはビルドコメントが不正です。');
  const file = statSync(zipPath);
  if (!file.isFile() || !file.size) throw new Error('ゲームZIPがありません。npm run build を実行してください。');
  const issuedToken = appToken || issueAppToken(appId, appSecret, run);
  uploadToken ||= issuedToken;
  // The production API expects appId|token; Meta OAuth can return GG|appId|token.
  appToken = issuedToken.startsWith(`GG|${appId}|`) ? issuedToken.slice(3) : issuedToken;

  const session = post(`https://graph.facebook.com/${version}/${appId}/uploads`, uploadToken, 'Bearer', [
    '--data-urlencode', `file_name=${basename(zipPath)}`,
    '--data-urlencode', `file_length=${file.size}`,
    '--data-urlencode', 'file_type=application/zip',
  ], 'アップロード準備', run);
  if (typeof session.id !== 'string' || !session.id.startsWith('upload:') || /[\r\n\0]/.test(session.id)) throw new Error('アップロードセッションを確認できませんでした。');
  const namespace = uploadToken.startsWith('GG') ? 'gg_graph_api' : 'fb_game_bundle';
  const uploadURL = new URL(`https://rupload.facebook.com/${namespace}/${session.id}`);
  if (uploadURL.hostname !== 'rupload.facebook.com' || !uploadURL.pathname.startsWith(`/${namespace}/upload:`)) throw new Error('アップロード先が不正です。');

  const upload = post(uploadURL.href, uploadToken, 'OAuth', [
    '--header', 'Offset: 0', '--header', `X-Entity-Length: ${file.size}`,
    '--header', `Content-Length: ${file.size}`, '--header', 'type: BUNDLE',
    '--header', `name: ${basename(zipPath)}`, '--header', `comment: ${comment}`,
    '--data-binary', '@' + zipPath,
  ], 'アップロード', run);
  const bundleInstanceId = upload.bundle_instance_id;
  if (typeof bundleInstanceId !== 'string' || !/^[1-9]\d*$/.test(bundleInstanceId)) throw new Error('アップロードしたビルドのIDを確認できないため、本番切替を停止しました。');

  // A new bundle may still be processing. Retry Meta's generic failure only,
  // with a strict limit and always for this same uploaded bundle ID.
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const promoted = post(`https://api.facebook.com/instant-games/assets/${appId}/push-to-production`, appToken, 'OAuth', [
        '--header', 'Content-Type: application/json', '--header', 'X-API-Version: 1.0.0',
        '--data', JSON.stringify({ bundle_instance_id: bundleInstanceId }),
      ], '本番切替', run);
      if (promoted.success !== true) throw new Error('本番切替の成功応答を確認できませんでした。');
      return { accepted: true, bundleInstanceId };
    } catch (error) {
      if (!error.retryablePromotionFailure || attempt === 5) {
        error.bundleInstanceId = bundleInstanceId;
        throw error;
      }
      await wait(20000);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw new Error('ビルドIDの手動指定は不要です。node scripts/upload.mjs でアップロードから本番切替まで実行します。');
    const zipPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'maguro-escape.zip');
    const result = await deployBundle({ ...credentialsFromEnv(process.env), zipPath, version: process.env.META_GRAPH_VERSION || 'v24.0', comment: process.env.META_BUILD_COMMENT || 'TUNA ESCAPE' });
    console.log(`Meta がアップロードしたビルド ${result.bundleInstanceId} の本番切替を受理しました。`);
  } catch (error) {
    if (error.bundleInstanceId) console.error(`対象ビルドID: ${error.bundleInstanceId}`);
    console.error(error.code === 'ENOENT' ? 'ゲームZIPがありません。npm run build を実行してください。' : error.message);
    process.exitCode = 1;
  }
}
