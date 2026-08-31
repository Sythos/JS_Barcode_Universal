import assert from 'node:assert/strict';
import test from 'node:test';

import { compactPdf417Bytes, compactPdf417Numeric, compactPdf417Text, decodePdf417Compaction } from '../src/js/pdf417/compaction.js';

test('PDF417 byte compaction uses the normative six-byte base-900 vector', () => {
  assert.deepEqual(compactPdf417Bytes(Uint8Array.from([1, 2, 3, 4, 5, 6])), [924, 1, 620, 89, 74, 846]);
});

test('PDF417 text and numeric compaction emit valid data codewords', () => {
  for (const codeword of compactPdf417Text('HELLO WORLD')) assert.ok(codeword >= 0 && codeword < 900);
  const numeric = compactPdf417Numeric('12345678901234567890');
  assert.equal(numeric[0], 902);
  assert.ok(numeric.slice(1).every((codeword) => codeword >= 0 && codeword < 900));
});

test('PDF417 Text Compaction handles Mixed punctuation and space', () => {
  // AIM USS PDF417 example is printed as "Ad: 102" but its listed character
  // sequence has no space: A, lower latch, d, Mixed latch, :, 1, 0, 2.
  assert.deepEqual(compactPdf417Text('Ad:102'), [27, 118, 421, 2]);
  assert.doesNotThrow(() => compactPdf417Text('Ad: 102'));
  assert.doesNotThrow(() => compactPdf417Text('1!'));
});

test('PDF417 Byte 901 preserves literal tails and Numeric splits 44-digit groups', () => {
  for (const length of [5, 11]) {
    const input = Uint8Array.from({ length }, (_, index) => index + 1);
    assert.equal(decodePdf417Compaction(compactPdf417Bytes(input)), new TextDecoder().decode(input));
  }
  const input = '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012';
  assert.equal(decodePdf417Compaction(compactPdf417Numeric(input)), input);
});

test('PDF417 mixed-mode parsing preserves segment order and UTF-8 shifts', () => {
  assert.equal(decodePdf417Compaction([927, 26, 1, 913, 195, 913, 169, 900, 1]), 'ABéAB');
  assert.equal(decodePdf417Compaction([927, 26, 913, 195, 913, 169]), 'é');
  assert.equal(decodePdf417Compaction([901, 233]), 'é');
  assert.equal(decodePdf417Compaction([901, 128]), '\u0080');
  assert.equal(decodePdf417Compaction(compactPdf417Bytes('')), '');
  assert.throws(() => decodePdf417Compaction([924, 429, 11, 71, 222, 856]), /exceeds six bytes/);
});
