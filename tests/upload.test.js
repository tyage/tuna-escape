import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadBundle } from '../scripts/upload.mjs';

const options = { appId: '123456', token: 'test-only-token', zipPath: '/tmp/game.zip' };
test('multipart upload keeps credentials off argv and never promotes a build', () => {
  let calls = 0;
  const result = uploadBundle(options, (command, args, config) => {
    calls++;
    assert.equal(command, 'curl');
    assert.equal(args.at(-1), 'https://graph-video.facebook.com/123456/assets');
    assert.ok(args.includes('type=BUNDLE'));
    assert.ok(args.includes('asset=@"/tmp/game.zip";type=application/zip'));
    assert.ok(!args.join(' ').includes(options.token));
    assert.match(config.input, /Authorization: Bearer test-only-token/);
    assert.ok(!args.includes('--location'));
    return { status: 0, stdout: '{"success":true}' };
  });
  assert.deepEqual(result, { accepted: true });
  assert.equal(calls, 1);
});
test('invalid credentials or routing cause no network call', () => {
  const run = () => assert.fail('must not send a request');
  for (const override of [{ appId: '' }, { appId: '../other' }, { token: '' }, { token: 'a\nb' }, { version: '../release' }]) {
    assert.throws(() => uploadBundle({ ...options, ...override }, run));
  }
});
test('App ID and App Secret composite token is passed intact without leaking into argv', () => {
  const token = '123456|test-only-app-secret';
  uploadBundle({ ...options, token }, (command, args, config) => {
    assert.ok(!args.join(' ').includes('test-only-app-secret'));
    assert.match(config.input, /Authorization: Bearer 123456\|test-only-app-secret/);
    return { status: 0, stdout: '{"success":true}' };
  });
});
test('API/transport failures are rejected without exposing credentials', () => {
  for (const response of [
    { status: 22, stdout: '{"error":{"code":190,"message":"test-only-token"}}' },
    { status: 1, stderr: 'test-only-token', stdout: '' },
    { status: 0, stdout: 'unexpected' },
    { status: 0, stdout: '{}' },
  ]) assert.throws(() => uploadBundle(options, () => response), error => !error.message.includes(options.token));
});
