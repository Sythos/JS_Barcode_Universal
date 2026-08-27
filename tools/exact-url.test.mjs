import assert from 'node:assert/strict';
import test from 'node:test';

import { containsExactUrlReference } from './exact-url.mjs';

const pagesUrl = 'https://sythos.github.io/JS_Barcode_Universal/';

test('accepts the canonical URL in Markdown and plain text', () => {
  const samples = [
    `[GitHub Pages](${pagesUrl})`,
    `Documentation: ${pagesUrl}`,
    `Documentation: ${pagesUrl}.`,
    `<a href="${pagesUrl}">Documentation</a>`,
  ];

  for (const sample of samples) {
    assert.equal(containsExactUrlReference(sample, pagesUrl), true, sample);
  }
});

test('rejects URL substrings that identify another host or path', () => {
  const samples = [
    `https://evil.example/${pagesUrl}`,
    'https://sythos.github.io/JS_Barcode_Universal.evil/',
    'https://sythos.github.io/JS_Barcode_Universal/attacker/',
    'https://sythos.github.io@evil.example/JS_Barcode_Universal/',
    `${pagesUrl}?redirect=https://evil.example/`,
  ];

  for (const sample of samples) {
    assert.equal(containsExactUrlReference(sample, pagesUrl), false, sample);
  }
});

test('rejects malformed or unsupported URL references', () => {
  assert.equal(containsExactUrlReference('not a URL', pagesUrl), false);
  assert.equal(containsExactUrlReference('http://sythos.github.io/JS_Barcode_Universal/', pagesUrl), false);
  assert.equal(containsExactUrlReference(pagesUrl, 'not a URL'), false);
  assert.equal(containsExactUrlReference(null, pagesUrl), false);
});
