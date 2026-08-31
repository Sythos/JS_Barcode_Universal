import assert from 'node:assert/strict';
import test from 'node:test';
import { GF929 } from '../src/js/core/galois-field.js';
import {
  MICROPDF417_VARIANTS,
  microPdf417NextRap,
  microPdf417RapSequence,
  microPdf417RowAddress,
  microPdf417VariantByNumber,
  microPdf417VariantForCapacity,
  validateMicroPdf417Tables,
} from '../src/js/micropdf417/tables.js';
import {
  microPdf417CorrectErrors,
  microPdf417EccLength,
  microPdf417ErrorCorrection,
  microPdf417Generator,
} from '../src/js/micropdf417/error-correction.js';

test('MicroPDF417: every predefined format has coherent capacity and RAP geometry', () => {
  assert.deepEqual(validateMicroPdf417Tables(), []);
  assert.equal(MICROPDF417_VARIANTS.length, 34);
  assert.deepEqual(MICROPDF417_VARIANTS.map((entry) => entry.columns).reduce((counts, columns) => {
    counts[columns] = (counts[columns] || 0) + 1; return counts;
  }, {}), { 1: 6, 2: 7, 3: 10, 4: 11 });
  for (const entry of MICROPDF417_VARIANTS) {
    assert.equal(entry.totalCodewords, entry.columns * entry.rows, `variant ${entry.id} geometry`);
    assert.equal(entry.dataCodewords + entry.eccCodewords, entry.totalCodewords, `variant ${entry.id} capacity`);
    assert.equal(microPdf417VariantByNumber(entry.id), entry);
  }
});

test('MicroPDF417: RAP rotations cover every row and determine the cluster', () => {
  for (const entry of MICROPDF417_VARIANTS) for (let row = 0; row < entry.rows; row++) {
    const rap = microPdf417RowAddress(entry, row);
    assert.equal(rap.left, microPdf417NextRap(entry.rapStart, row), `variant ${entry.id}, row ${row}`);
    assert.equal(rap.cluster, ((rap.left - 1) % 3) * 3);
    if (entry.columns < 3) {
      assert.equal(rap.center, null);
      assert.equal(rap.right, microPdf417NextRap(rap.left, entry.rapRotation));
    } else {
      assert.equal(rap.center, microPdf417NextRap(rap.left, entry.rapRotation));
      assert.equal(rap.right, microPdf417NextRap(rap.center, entry.rapRotation));
    }
  }
  assert.deepEqual(microPdf417RowAddress(microPdf417VariantByNumber(24), 0), { left: 47, center: 19, right: 43, cluster: 3 });
  assert.deepEqual(microPdf417RowAddress(microPdf417VariantByNumber(24), 3), { left: 50, center: 22, right: 46, cluster: 3 });
});

test('MicroPDF417: externally derived RAP sentinels cover all 34 format transitions', () => {
  // First/last rows are independent format-table sentinels.  They catch a
  // wrong RAP family, rotation, wrap-around, or first-row cluster before a
  // symmetric encoder/decoder test could hide it.
  const sentinels = [
    [[1, null, 9, 0], [11, null, 19, 3]], [[8, null, 8, 3], [21, null, 21, 6]],
    [[36, null, 36, 6], [52, null, 52, 0]], [[19, null, 19, 0], [38, null, 38, 3]],
    [[9, null, 17, 6], [32, null, 40, 3]], [[25, null, 33, 0], [52, null, 8, 0]],
    [[1, null, 1, 0], [8, null, 8, 3]], [[1, null, 9, 0], [11, null, 19, 3]],
    [[8, null, 8, 3], [21, null, 21, 6]], [[36, null, 36, 6], [52, null, 52, 0]],
    [[19, null, 19, 0], [38, null, 38, 3]], [[9, null, 17, 6], [31, null, 39, 0]],
    [[27, null, 35, 6], [52, null, 8, 0]], [[1, 1, 1, 0], [6, 6, 6, 6]],
    [[7, 7, 7, 0], [14, 14, 14, 3]], [[15, 15, 15, 6], [24, 24, 24, 6]],
    [[25, 25, 25, 0], [36, 36, 36, 6]], [[37, 37, 37, 0], [51, 51, 51, 6]],
    [[1, 17, 33, 0], [20, 36, 52, 3]], [[1, 9, 17, 0], [26, 34, 42, 3]],
    [[21, 29, 37, 6], [52, 8, 16, 0]], [[15, 31, 47, 6], [52, 16, 32, 0]],
    [[1, 25, 49, 0], [44, 16, 40, 3]], [[47, 19, 43, 3], [50, 22, 46, 3]],
    [[1, 1, 1, 0], [6, 6, 6, 6]], [[7, 7, 7, 0], [14, 14, 14, 3]],
    [[15, 15, 15, 6], [24, 24, 24, 6]], [[25, 25, 25, 0], [36, 36, 36, 6]],
    [[37, 37, 37, 0], [51, 51, 51, 6]], [[1, 17, 33, 0], [20, 36, 52, 3]],
    [[1, 9, 17, 0], [26, 34, 42, 3]], [[21, 29, 37, 6], [52, 8, 16, 0]],
    [[15, 31, 47, 6], [52, 16, 32, 0]], [[1, 25, 49, 0], [44, 16, 40, 3]],
  ];
  assert.equal(sentinels.length, MICROPDF417_VARIANTS.length);
  for (const [index, entry] of MICROPDF417_VARIANTS.entries()) {
    const actual = [microPdf417RowAddress(entry, 0), microPdf417RowAddress(entry, entry.rows - 1)]
      .map(({ left, center, right, cluster }) => [left, center, right, cluster]);
    assert.deepEqual(actual, sentinels[index], `variant ${entry.id}`);
  }
});

test('MicroPDF417: RAP sequences are exact-width and reject invalid access', () => {
  for (let number = 1; number <= 52; number++) for (const kind of ['side', 'center']) {
    const sequence = microPdf417RapSequence(number, kind);
    assert.equal(sequence.length, 6);
    assert.equal([...sequence].reduce((sum, width) => sum + Number(width), 0), 10);
  }
  assert.equal(microPdf417RapSequence(10), '412111');
  assert.equal(microPdf417RapSequence(10, 'center'), '133111');
  assert.throws(() => microPdf417RapSequence(0), /1\.\.52/);
  assert.throws(() => microPdf417NextRap(1, 0.5), /integer/);
});

test('MicroPDF417: capacity selection is deterministic and refuses overflow', () => {
  assert.equal(microPdf417VariantForCapacity(1).id, 1);
  assert.equal(microPdf417VariantForCapacity(126).id, 34);
  assert.throws(() => microPdf417VariantForCapacity(127), /exceeds/);
});

test('MicroPDF417: every fixed ECC length has a GF(929) generator and systematic parity', () => {
  const checked = new Set();
  for (const entry of MICROPDF417_VARIANTS) {
    const eccLength = microPdf417EccLength(entry);
    assert.equal(eccLength, entry.eccCodewords);
    const generator = microPdf417Generator(entry);
    assert.equal(generator.length, eccLength + 1);
    assert.equal(generator[0], 1);
    for (let power = 1; power <= eccLength; power++) {
      let value = 0;
      for (const coefficient of generator) value = GF929.add(GF929.mul(value, GF929.exp(power)), coefficient);
      assert.equal(value, 0, `ECC ${eccLength} root ${power}`);
    }
    if (checked.has(eccLength)) continue;
    checked.add(eccLength);
    const data = Array.from({ length: entry.dataCodewords }, (_, index) => (index * 37 + 11) % 929);
    const parity = microPdf417ErrorCorrection(data, entry);
    assert.equal(parity.length, eccLength);
    assert.equal(microPdf417CorrectErrors(data.concat(parity), entry), 0);
    const damaged = data.concat(parity);
    damaged[0] = (damaged[0] + 1) % 929;
    assert.equal(microPdf417CorrectErrors(damaged, entry), 1);
  }
});
