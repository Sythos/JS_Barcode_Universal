import assert from 'node:assert/strict';
import test from 'node:test';

import {
  dataBarGtinTransmission,
  decodeDataBar14GTIN,
  decodeDataBarLimitedGTIN,
  encodeDataBar14GTIN,
  encodeDataBarLimitedGTIN,
  gtinCheckDigit,
  makeGTIN14,
  normalizeGTIN,
} from '../src/js/databar/codec.js';

test('DataBar GTIN codec: GS1 modulo-10 normalization is exact', () => {
  assert.equal(gtinCheckDigit('2001234567890'), '9');
  assert.equal(makeGTIN14('2001234567890'), '20012345678909');
  assert.equal(normalizeGTIN('036000291452'), '00036000291452');
  assert.equal(normalizeGTIN('4006381333931'), '04006381333931');
  assert.throws(() => normalizeGTIN('4006381333932'), /check digit is invalid/);
  assert.throws(() => normalizeGTIN('40063813339'), /8, 12, 13, or 14/);
});

test('DataBar-14 GTIN compaction is lossless with and without linkage', () => {
  for (const gtin of ['00000000000000', '20012345678909', '99999999999997']) {
    const plain = encodeDataBar14GTIN(gtin);
    assert.equal(plain.physicalCharacters.length, 4);
    assert.deepEqual(decodeDataBar14GTIN(plain.logicalCharacters), {
      gtin, linkage: false, leftPair: plain.leftPair, rightPair: plain.rightPair,
    });
    const linked = encodeDataBar14GTIN(gtin, { linkage: true });
    assert.deepEqual(decodeDataBar14GTIN(linked.logicalCharacters), {
      gtin, linkage: true, leftPair: linked.leftPair, rightPair: linked.rightPair,
    });
  }
  const known = encodeDataBar14GTIN('20012345678909');
  assert.equal(known.symbolValue, 2001234567890n);
  assert.equal(dataBarGtinTransmission('20012345678909'), ']e00120012345678909');
});

test('DataBar Limited accepts only GTIN indicator digits 0 and 1', () => {
  const plain = encodeDataBarLimitedGTIN('00098765432105');
  assert.equal(plain.left, 4904);
  assert.equal(plain.right, 1991026);
  assert.deepEqual(decodeDataBarLimitedGTIN(plain), {
    gtin: '00098765432105', linkage: false, symbolValue: plain.symbolValue,
  });
  const linked = encodeDataBarLimitedGTIN('10098765432102', { linkage: true });
  assert.deepEqual(decodeDataBarLimitedGTIN(linked), {
    gtin: '10098765432102', linkage: true, symbolValue: linked.symbolValue,
  });
  assert.throws(() => encodeDataBarLimitedGTIN('20012345678909'), /indicator digit is 0 or 1/);
  assert.throws(() => decodeDataBarLimitedGTIN({ left: 993261, right: 0 }), /do not encode a permitted GTIN/);
});
