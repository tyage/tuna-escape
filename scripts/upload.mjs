import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function credentialsFromEnv(env) {
  const appId = env.META_APP_ID || env.APP_ID;
  const appSecret = env.META_APP_SECRET || env.APP_SECRET;
  const token = env.META_UPLOAD_TOKEN || (appId && appSecret ? `${appId}|${appSecret}` : undefined);
  return { appId, token };
}

export function productionCredentialsFromEnv(env) {
  const appId = env.META_APP_ID || env.APP_ID;
  const appSecret = env.META_APP_SECRET || env.APP_SECRET;
  const token = env.META_APP_ACCESS_TOKEN || (appId && appSecret ? `${appId}|${appSecret}` : undefined);
  return { appId, token };
}

export function promoteBundle({ appId, token, bundleInstanceId }, run = spawnSync) {
  if (!/^\d+$/.test(appId || '')) throw new Error('META_APP_ID に Meta アプリの数値 ID を設定してください。');
  if (!token || /[\r\n\0]/.test(token)) throw new Error('本番切替用の App Access Token または App Secret が必要です。');
  if (typeof bundleInstanceId !== 'string' || !/^[1-9]\d*$/.test(bundleInstanceId)) throw new Error('対象ビルドの bundle_instance_id を正の整数で指定してください。');
  const url = `https://api.facebook.com/instant-games/assets/${appId}/push-to-production`;
  const result = run('curl', [
    '--config', '-', '--silent', '--show-error', '--fail-with-body',
    '--proto', '=https', '--connect-timeout', '20', '--max-time', '120',
    '--request', 'POST', '--header', 'Content-Type: application/json',
    '--header', 'X-API-Version: 1.0.0',
    '--data', JSON.stringify({ bundle_instance_id: bundleInstanceId }), url,
  ], {
    input: `header = ${JSON.stringify(`Authorization: OAuth ${token}`)}\n`,
    encoding: 'utf8', timeout: 125000, maxBuffer: 1024 * 1024,
  });
  let payload;
  try { payload = JSON.parse(result.stdout || '{}'); } catch { /* Reject an ambiguous response. */ }
  if (result.error || result.status !== 0 || payload?.success !== true) {
    const code = payload?.error?.code || payload?.status;
    throw new Error(`本番切替の成功を確認できませんでした。${Number.isInteger(code) ? `Meta error code: ${code}。` : ''}対象ビルドのID・処理状況・アプリ権限を確認してください。`);
  }
  return { accepted: true, bundleInstanceId };
}

// Upload a bundle only. Never promote it to a live build automatically.
export function uploadBundle({ appId, token, zipPath, comment = 'Maguro Escape', version = '' }, run = spawnSync) {
  if (!/^\d+$/.test(appId || '')) throw new Error('META_APP_ID に Meta アプリの数値 ID を設定してください。');
  if (!token || /[\r\n\0]/.test(token)) throw new Error('META_UPLOAD_TOKEN にアップロード用トークンを設定してください。');
  if (version && !/^v\d+\.\d+$/.test(version)) throw new Error('META_GRAPH_VERSION は vXX.X 形式で指定してください。');
  if (!zipPath || /[\r\n\0";,]/.test(zipPath)) throw new Error('ZIP パスに使用できない文字があります。');
  const url = `https://graph-video.facebook.com/${version ? version + '/' : ''}${appId}/assets`;
  // Read the Authorization header from stdin, never from argv or the URL.
  // curl preserves the cloud environment's HTTPS proxy and CA verification.
  const input = `header = ${JSON.stringify(`Authorization: Bearer ${token}`)}\n`;
  const result = run('curl', [
    '--config', '-', '--silent', '--show-error', '--fail-with-body',
    '--proto', '=https', '--connect-timeout', '20', '--max-time', '120',
    '--request', 'POST', '--form-string', 'type=BUNDLE',
    '--form', `asset=@"${zipPath}";type=application/octet-stream`,
    '--form-string', `comment=${comment}`, url,
  ], { input, encoding: 'utf8', timeout: 125000, maxBuffer: 1024 * 1024 });
  if (result.status === 56 && /CONNECT tunnel failed, response 403/.test(result.stderr || '')) {
    throw new Error('HTTPS中継サーバーが接続を拒否しました（CONNECT 403）。Meta APIには到達していないため、実行環境の通信許可の適用状態を確認してください。');
  }
  // Never echo raw API errors/stderr, which could contain sensitive content.
  let payload;
  try { payload = JSON.parse(result.stdout || '{}'); } catch { /* checked below */ }
  if (result.error || result.status !== 0 || payload?.error) {
    const code = payload?.error?.code;
    throw new Error(`アップロードに失敗しました。${Number.isInteger(code) ? `Meta error code: ${code}。` : ''}アプリ権限・トークン・ネットワーク設定を確認してください。`);
  }
  if (!payload || !(payload.success === true || typeof payload.id === 'string' || typeof payload.asset_id === 'string')) {
    throw new Error('API の成功応答を確認できませんでした。Meta 管理画面でビルド状態を確認してください。');
  }
  return { accepted: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === '--promote' && process.argv.length === 4) {
      const bundleInstanceId = process.argv[3];
      promoteBundle({ ...productionCredentialsFromEnv(process.env), bundleInstanceId });
      console.log(`Meta がビルド ${bundleInstanceId} の本番切替要求を受理しました。配信版への反映を確認してください。`);
    } else if (process.argv.length > 2) {
      throw new Error('使い方: node scripts/upload.mjs [--promote bundle_instance_id]');
    } else {
      const zipPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'maguro-escape.zip');
      if (!statSync(zipPath).isFile()) throw new Error('npm run build を先に実行してください。');
      uploadBundle({ ...credentialsFromEnv(process.env), zipPath, version: process.env.META_GRAPH_VERSION, comment: process.env.META_BUILD_COMMENT || 'TUNA ESCAPE development build' });
      console.log('Meta がアップロードを受理しました。本番切替はまだ実行していません。');
    }
  } catch (error) {
    console.error(error.code === 'ENOENT' ? 'maguro-escape.zip がありません。npm run build を先に実行してください。' : error.message);
    process.exitCode = 1;
  }
}
