import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decode, encode, listFormats, toImageData } from '../src/index.js';

const cases = [
  ['postnet', '12345'],
  ['planet', '12345678901'],
  ['rm4scc', 'HELLO1'],
  ['kix', '123ABC'],
  ['japanpost', '12ABC-9'],
  ['auspost', '5956439111ABC'],
  ['imb', '01234567094987654321'],
  ['imb', '0123456709498765432101234'],
  ['imb', '0123456709498765432112345678901'],
];

function rendered(text, format, options = {}) {
  return toImageData(encode(text, { format, ...options }), {
    scale: 2,
    margin: 8,
    barHeight: 48,
  });
}

test('postal family round-trips through the public image API', () => {
  for (const [format, text] of cases) {
    const results = decode(rendered(text, format), { formats: [format], binarizer: 'global' });
    assert.equal(results.length, 1, `${format} should decode exactly once`);
    assert.equal(results[0].format, format);
    assert.equal(results[0].text, text);
    assert.equal(results[0].checkDigit, format === 'kix' ? false : true);
  }
});

test('KIX remains a no-check-digit postal format and aliases resolve canonically', () => {
  const image = rendered('12ABZ9', 'kix');
  const results = decode(image, { formats: ['kix'] });
  assert.deepEqual(results, [{ format: 'kix', text: '12ABZ9', checkDigit: false }]);
  assert.equal(decode(rendered('12345', 'postnet'), { formats: ['usps-postnet'] })[0].format, 'postnet');
  assert.equal(decode(rendered('12345678901', 'planet'), { formats: ['usps-planet'] })[0].format, 'planet');
  assert.equal(decode(rendered('HELLO1', 'rm4scc'), { formats: ['royal-mail'] })[0].format, 'rm4scc');
  assert.equal(decode(rendered('5956439111ABC', 'auspost'), { formats: ['australia-post'] })[0].format, 'auspost');
  assert.equal(decode(rendered('12ABC-9', 'japanpost'), { formats: ['japan-post'] })[0].format, 'japanpost');
  assert.equal(decode(rendered('01234567094987654321', 'imb'), { formats: ['onecode'] })[0].format, 'imb');
});

test('Australia Post supports numeric customer data and strict payload guards', () => {
  const text = '595643911112345';
  const image = rendered(text, 'auspost', { customerEncoding: 'numeric' });
  const result = decode(image, { formats: ['auspost'], customerEncoding: 'numeric' });
  assert.deepEqual(result, [{ format: 'auspost', text, checkDigit: true }]);
  assert.throws(() => encode('5956439111ABC', { format: 'auspost', customerEncoding: 'numeric' }), /numeric customer data/);
  assert.throws(() => encode('1234', { format: 'postnet' }), /5, 9, 11/);
  assert.throws(() => encode('0123456789012345678', { format: 'imb' }), /20, 25, 29 or 31/);
  assert.throws(() => encode('hello!', { format: 'rm4scc' }), /capital letters and digits/);
});

test('postal camera reads require quiet zones and reject damaged symbols', () => {
  const text = '12345';
  const clean = rendered(text, 'postnet');
  assert.equal(decode(clean, { formats: ['postnet'], profile: 'camera' })[0].text, text);
  const noQuiet = toImageData(encode(text, { format: 'postnet' }), { scale: 2, margin: 0 });
  assert.deepEqual(decode(noQuiet, { formats: ['postnet'], profile: 'camera' }), []);

  const damaged = { ...clean, data: new Uint8ClampedArray(clean.data) };
  // Remove one complete bar, not just an arbitrary pixel that might land in
  // the white gap or leave the structural projection unchanged.
  const damagedX = 8 * 2 + 2 * 2;
  for (const x of [damagedX, damagedX + 1]) {
    for (let y = 0; y < damaged.height; y++) {
      const pixel = (y * damaged.width + x) * 4;
      damaged.data[pixel] = 255;
      damaged.data[pixel + 1] = 255;
      damaged.data[pixel + 2] = 255;
    }
  }
  assert.deepEqual(decode(damaged, { formats: ['postnet'], binarizer: 'global' }), []);
});

test('all seven postal formats are advertised as readable and writable', () => {
  const entries = listFormats().filter(({ id }) => ['postnet', 'planet', 'rm4scc', 'kix', 'auspost', 'japanpost', 'imb'].includes(id));
  assert.equal(entries.length, 7);
  assert.ok(entries.every((entry) => entry.canWrite && entry.canRead && entry.kind === '1D'));
});
