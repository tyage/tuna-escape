import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { credentialsFromEnv, deployBundle } from '../scripts/upload.mjs';

const folder = mkdtempSync(join(tmpdir(), 'tuna-upload-test-'));
const zipPath = join(folder, 'game.zip');
writeFileSync(zipPath, 'fake ZIP bytes for mocked HTTP requests');
after(() => rmSync(folder, { recursive: true, force: true }));
const options = { appId: '123456', uploadToken: 'EAA-test-only-user-token', appToken: '123456|fake-only-app-secret', zipPath };
const bundleId = '29493117460280231';
const ok = stdout => ({ status: 0, stdout });
const noWait = async () => {};

test('credentials keep the App Secret separate from access tokens, including empty Actions values', () => {
  assert.deepEqual(credentialsFromEnv({ APP_ID: '123', APP_SECRET: 'fake-secret', META_UPLOAD_TOKEN: '' }), { appId: '123', appSecret: 'fake-secret', uploadToken: undefined, appToken: undefined });
  assert.deepEqual(credentialsFromEnv({ META_APP_ID: '123', META_APP_SECRET: 'fake-secret', META_UPLOAD_TOKEN: 'EAA-user', META_APP_ACCESS_TOKEN: 'app-token' }), { appId: '123', appSecret: 'fake-secret', uploadToken: 'EAA-user', appToken: 'app-token' });
});

test('existing App ID and App Secret automatically issue an App Access Token through OAuth', async () => {
  const appSecret = 'fake-only-client-secret';
  const issuedToken = 'GG|123456|fake-only-issued-app-token';
  let calls = 0;
  const result = await deployBundle({ appId: '123456', appSecret, zipPath }, (command, args, config) => {
    calls++;
    assert.ok(!args.join(' ').includes(appSecret));
    assert.ok(!args.join(' ').includes('fake-only-issued-app-token'));
    assert.ok(!args.includes('--location'));
    if (calls === 1) {
      assert.equal(args.at(-1), 'https://graph.facebook.com/oauth/access_token');
      assert.ok(args.includes('@-'));
      assert.deepEqual(Object.fromEntries(new URLSearchParams(config.input)), { client_id: '123456', client_secret: appSecret, grant_type: 'client_credentials' });
      return ok(JSON.stringify({ access_token: issuedToken }));
    }
    assert.ok(!config.input.includes(appSecret));
    if (calls === 2) {
      assert.ok(config.input.includes('Bearer ' + issuedToken));
      return ok('{"id":"upload:app-session"}');
    }
    if (calls === 3) {
      assert.equal(args.at(-1), 'https://rupload.facebook.com/gg_graph_api/upload:app-session');
      assert.ok(config.input.includes('OAuth ' + issuedToken));
      return ok(JSON.stringify({ bundle_instance_id: bundleId }));
    }
    assert.equal(calls, 4);
    assert.ok(config.input.includes('OAuth 123456|fake-only-issued-app-token'));
    assert.ok(!config.input.includes('GG|'));
    return ok('{"success":true}');
  }, noWait);
  assert.equal(result.bundleInstanceId, bundleId);
  assert.equal(calls, 4);
});

test('OAuth failure stops before uploading and never logs its response or secret', async () => {
  let calls = 0;
  await assert.rejects(deployBundle({ appId: '123456', appSecret: 'private-client-secret', zipPath }, () => {
    calls++;
    return { status: 22, stdout: '{"error":{"message":"private-client-secret"}}' };
  }, noWait), error => /OAuth/.test(error.message) && !error.message.includes('private-client-secret'));
  assert.equal(calls, 1);
});

for (const [prefix, namespace] of [['EAA', 'fb_game_bundle'], ['GG', 'gg_graph_api']]) {
  test(`${prefix} upload automatically promotes the exact returned ID, preserving large integers`, async () => {
    const uploadToken = prefix + '-test-only-user-token';
    let calls = 0;
    const result = await deployBundle({ ...options, uploadToken }, (command, args, config) => {
      assert.equal(command, 'curl');
      assert.ok(!args.join(' ').includes(uploadToken));
      assert.ok(!args.join(' ').includes('fake-only-app-secret'));
      assert.ok(!args.includes('--location'));
      calls++;
      if (calls === 1) {
        assert.equal(args.at(-1), 'https://graph.facebook.com/v24.0/123456/uploads');
        assert.ok(config.input.includes('Bearer ' + uploadToken));
        assert.ok(args.includes('file_type=application/zip'));
        return ok('{"id":"upload:test-session"}');
      }
      if (calls === 2) {
        assert.equal(args.at(-1), `https://rupload.facebook.com/${namespace}/upload:test-session`);
        assert.ok(config.input.includes('OAuth ' + uploadToken));
        assert.ok(args.includes('@' + zipPath));
        assert.ok(args.includes('type: BUNDLE'));
        return ok('{"success":true,"bundle_instance_id":29493117460280231}');
      }
      assert.equal(calls, 3);
      assert.equal(args.at(-1), 'https://api.facebook.com/instant-games/assets/123456/push-to-production');
      assert.ok(config.input.includes('OAuth ' + options.appToken));
      assert.deepEqual(JSON.parse(args[args.indexOf('--data') + 1]), { bundle_instance_id: bundleId });
      assert.ok(args.includes('X-API-Version: 1.0.0'));
      return ok('{"success":true}');
    }, noWait);
    assert.deepEqual(result, { accepted: true, bundleInstanceId: bundleId });
    assert.equal(calls, 3);
  });
}

test('invalid credentials and routing make no requests', async () => {
  for (const override of [{ appId: '../other' }, { uploadToken: options.appToken }, { uploadToken: 'EAA-bad\nheader' }, { appToken: undefined }, { version: '../route' }, { comment: 'bad\nheader' }]) {
    let calls = 0;
    await assert.rejects(deployBundle({ ...options, ...override }, () => { calls++; return ok('{}'); }, noWait));
    assert.equal(calls, 0);
  }
});

test('an app-secret-shaped value is diagnosed without printing or sending it', async () => {
  const uploadToken = '0123456789abcdef0123456789abcdef';
  await assert.rejects(deployBundle({ ...options, uploadToken }, () => assert.fail('must not send'), noWait), error => /App Secret形式/.test(error.message) && !error.message.includes(uploadToken));
});

test('upload refusal is reported without leaking either credential or promoting anything', async () => {
  let calls = 0;
  await assert.rejects(deployBundle(options, () => {
    calls++;
    if (calls === 1) return ok('{"id":"upload:test-session"}');
    return { status: 22, stdout: JSON.stringify({ debug_info: { type: 'ProcessingFailedError', message: 'User must be admin or developer of the app: ' + options.uploadToken } }) };
  }, noWait), error => /admin or developer/.test(error.message) && !error.message.includes(options.uploadToken));
  assert.equal(calls, 2);
});

test('upload without a valid returned bundle ID never promotes a build', async () => {
  for (const response of ['{"success":true}', '{"bundle_instance_id":0}', '{"bundle_instance_id":"not-an-id"}']) {
    let calls = 0;
    await assert.rejects(deployBundle(options, () => {
      calls++;
      assert.ok(calls <= 2);
      return ok(calls === 1 ? '{"id":"upload:test-session"}' : response);
    }, noWait), /ビルドのID/);
    assert.equal(calls, 2);
  }
});

test('HTTP 200 with success false is never reported as a successful production switch', async () => {
  let calls = 0;
  await assert.rejects(deployBundle(options, () => {
    calls++;
    if (calls === 1) return ok('{"id":"upload:test-session"}');
    if (calls === 2) return ok(JSON.stringify({ bundle_instance_id: bundleId }));
    return ok('{"success":false,"message":"Failed to productionize app asset"}');
  }, noWait), error => /Failed to productionize/.test(error.message) && error.bundleInstanceId === bundleId);
  assert.equal(calls, 8, 'six promotion attempts, no repeated upload');
});

test('processing retry keeps the same ID and does not upload a second bundle', async () => {
  let calls = 0;
  const waits = [];
  const result = await deployBundle(options, (command, args) => {
    calls++;
    if (calls === 1) return ok('{"id":"upload:test-session"}');
    if (calls === 2) return ok(JSON.stringify({ bundle_instance_id: bundleId }));
    assert.deepEqual(JSON.parse(args[args.indexOf('--data') + 1]), { bundle_instance_id: bundleId });
    return ok(calls === 3 ? '{"success":false,"message":"Failed to productionize app asset"}' : '{"success":true}');
  }, async ms => waits.push(ms));
  assert.equal(result.bundleInstanceId, bundleId);
  assert.equal(calls, 4);
  assert.deepEqual(waits, [20000]);
});

test('API errors redact the app secret and unknown responses cannot claim success', async () => {
  for (const response of [ok('{}'), { status: 22, stdout: '{"error":{"code":190,"message":"fake-only-app-secret"}}' }]) {
    let calls = 0;
    await assert.rejects(deployBundle(options, () => {
      calls++;
      if (calls === 1) return ok('{"id":"upload:test-session"}');
      if (calls === 2) return ok(JSON.stringify({ bundle_instance_id: bundleId }));
      return response;
    }, noWait), error => !error.message.includes('fake-only-app-secret'));
    assert.equal(calls, 3);
  }
});
