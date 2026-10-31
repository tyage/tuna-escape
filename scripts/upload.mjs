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
    const zipPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'maguro-escape.zip');
    if (!statSync(zipPath).isFile()) throw new Error('npm run build を先に実行してください。');
    uploadBundle({ ...credentialsFromEnv(process.env), zipPath, version: process.env.META_GRAPH_VERSION, comment: process.env.META_BUILD_COMMENT || 'Maguro Escape development build' });
    console.log('Meta がアップロードを受理しました。管理画面で処理結果とテストビルドを確認してください。公開操作は行っていません。');
  } catch (error) {
    console.error(error.code === 'ENOENT' ? 'maguro-escape.zip がありません。npm run build を先に実行してください。' : error.message);
    process.exitCode = 1;
  }
}
