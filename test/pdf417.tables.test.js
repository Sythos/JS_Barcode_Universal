import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PDF417_PATTERN_TABLE,
  pdf417CodewordForPattern,
  pdf417PatternForCodeword,
} from '../src/js/pdf417/tables.js';

function widths(pattern) {
  const bits = pattern.toString(2).padStart(17, '0');
  const out = [];
  let previous = bits[0], count = 0;
  for (const bit of bits) {
    if (bit === previous) count++;
    else { out.push(count); previous = bit; count = 1; }
  }
  out.push(count);
  return out.join('');
}

test('PDF417 Annex H table is complete and structurally valid', () => {
  assert.deepEqual(PDF417_PATTERN_TABLE.map((cluster) => cluster.length), [929, 929, 929]);
  const all = new Set();
  for (const [index, cluster] of PDF417_PATTERN_TABLE.entries()) {
    for (const pattern of cluster) {
      all.add(pattern);
      assert.equal(widths(pattern).split('').reduce((sum, width) => sum + Number(width), 0), 17);
      const w = widths(pattern).split('').map(Number);
      assert.equal((w[0] - w[2] + w[4] - w[6] + 9) % 9, index * 3);
    }
  }
  assert.equal(all.size, 2787);
});

test('PDF417 Annex H normative sentinels and exact reverse lookup', () => {
  assert.deepEqual([0, 1, 2].map((codeword) => widths(pdf417PatternForCodeword(codeword, 0))), ['31111136', '41111144', '51111152']);
  assert.deepEqual([0, 1, 2].map((codeword) => widths(pdf417PatternForCodeword(codeword, 3))), ['51111125', '61111133', '41111216']);
  assert.deepEqual([0, 1, 2].map((codeword) => widths(pdf417PatternForCodeword(codeword, 6))), ['21111155', '31111163', '11111246']);
  const pattern = pdf417PatternForCodeword(928, 6);
  assert.deepEqual(pdf417CodewordForPattern(pattern), { codeword: 928, cluster: 6 });
});
