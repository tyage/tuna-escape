import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTranslator, messages, selectLanguage, stageNames } from '../src/i18n.js';

test('explicit language preference wins over Meta and browser settings', () => {
  assert.equal(selectLanguage({ preference: 'ja', metaLocale: 'en_US', browserLanguages: ['en'] }), 'ja');
  assert.equal(selectLanguage({ preference: 'en', metaLocale: 'ja_JP', browserLanguages: ['ja'] }), 'en');
});

test('Meta locales support underscores, regional tags, and an English fallback', () => {
  assert.equal(selectLanguage({ metaLocale: 'ja_JP', browserLanguages: ['en-US'] }), 'ja');
  assert.equal(selectLanguage({ metaLocale: 'EN-us', browserLanguages: ['ja'] }), 'en');
  assert.equal(selectLanguage({ metaLocale: 'fr_FR', browserLanguages: ['ja'] }), 'en');
  assert.equal(selectLanguage({ metaLocale: 'japanese', browserLanguages: ['ja'] }), 'en');
});

test('browser-only play respects preferred supported languages and defaults to English', () => {
  assert.equal(selectLanguage({ browserLanguages: ['fr-FR', 'ja-JP', 'en'] }), 'ja');
  assert.equal(selectLanguage({ browserLanguages: ['en-GB', 'ja'] }), 'en');
  assert.equal(selectLanguage({ preference: 'invalid', metaLocale: ' ', browserLanguages: ['ja'] }), 'ja');
  assert.equal(selectLanguage({ browserLanguages: ['de', 'fr'] }), 'en');
  assert.equal(selectLanguage(), 'en');
});

test('both catalogs cover every message, interpolation, direction, and stage', () => {
  assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages.ja).sort());
  for (const key of Object.keys(messages.en)) {
    const parameters = language => [...messages[language][key].matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    assert.deepEqual(parameters('ja'), parameters('en'), key);
    for (const language of ['ja', 'en']) assert.ok(messages[language][key].trim(), key);
  }
  for (const language of ['ja', 'en']) {
    assert.equal(stageNames[language].length, 16);
    assert.ok(stageNames[language].every(name => typeof name === 'string' && name.trim()));
    const t = createTranslator(language);
    for (const direction of ['right', 'down', 'left', 'up']) {
      const label = t('fish.label', { row: 2, column: 3, direction: t('direction.' + direction), length: 1 });
      assert.ok(!label.includes('{'));
      assert.ok(label.includes(t('direction.' + direction)));
    }
  }
});

test('HTML translation hooks and all status messages have translations', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-aria-label|-content)?="([^"]+)"/g)].map(match => match[1]);
  keys.push(...[...main.matchAll(/message\('([^']+)'\s*[,)]/g)].map(match => match[1]));
  for (const language of ['ja', 'en']) {
    const t = createTranslator(language);
    for (const key of keys) assert.doesNotThrow(() => t(key), key);
    for (let i = 0; i < 3; i++) assert.doesNotThrow(() => t('status.escape' + i));
  }
  assert.ok(!/content:\s*['"]未開放/.test(readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')));
});

test('translation rejects missing parameters and unknown keys instead of displaying undefined', () => {
  const t = createTranslator('en-US');
  assert.equal(t('progress.value', { escaped: 0, total: 20 }), '0 of 20 tuna escaped');
  assert.equal(t('progress.value', { escaped: 1, total: 20 }), '1 of 20 tuna escaped');
  assert.throws(() => t('progress.value', { total: 20 }), /Missing translation value/);
  assert.throws(() => t('missing.key'), /Unknown translation key/);
  assert.equal(createTranslator('fr-FR')('control.undo'), 'Undo');
});
