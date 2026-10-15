import assert from 'node:assert/strict';
import { test } from 'node:test';
import { whisperLanguageForLocale } from './speech-language.ts';

test('course dialects map to one local multilingual Whisper model', () => {
  assert.equal(whisperLanguageForLocale('es-MX'), 'es');
  assert.equal(whisperLanguageForLocale('es-ES'), 'es');
  assert.equal(whisperLanguageForLocale('fr-FR'), 'fr');
  assert.equal(whisperLanguageForLocale('zh-CN'), 'zh');
  assert.equal(whisperLanguageForLocale('ar'), 'ar');
  assert.equal(whisperLanguageForLocale('en-US'), 'en');
});

test('unknown and malformed hints do not become a guessed supported language', () => {
  assert.equal(whisperLanguageForLocale(), undefined);
  assert.equal(whisperLanguageForLocale(''), null);
  assert.equal(whisperLanguageForLocale('de-DE'), null);
  assert.equal(whisperLanguageForLocale('../x'), null);
  assert.equal(whisperLanguageForLocale('en-US-'), null);
});
