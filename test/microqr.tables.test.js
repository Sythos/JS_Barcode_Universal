import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MICROQR_FORMAT_MASK,
  MICROQR_SYMBOLS,
  MICROQR_VERSIONS,
  microQrBlockLayout,
  microQrDataCapacityBits,
  microQrDataModuleOrder,
  microQrDecodeFormatInfo,
  microQrFormatInfo,
  microQrFormatInfoPositions,
  microQrFreeModuleCount,
  microQrFunctionModules,
  microQrMaskBit,
  microQrReservedModules,
  microQrSymbolNumber,
  microQrVersionSize,
  validateMicroQrTables,
} from '../src/js/microqr/tables.js';

test('Micro QR tables: all versions and legal ECC combinations are coherent', () => {
  assert.deepEqual(validateMicroQrTables(), []);
  assert.deepEqual(MICROQR_VERSIONS, [1, 2, 3, 4]);
  assert.deepEqual(MICROQR_VERSIONS.map(microQrVersionSize), [11, 13, 15, 17]);
  assert.deepEqual(MICROQR_SYMBOLS.map(({ version, ecc, symbolNumber }) => [version, ecc, symbolNumber]), [
    ['M1', 'DETECT', 0], ['M2', 'L', 1], ['M2', 'M', 2], ['M3', 'L', 3],
    ['M3', 'M', 4], ['M4', 'L', 5], ['M4', 'M', 6], ['M4', 'Q', 7],
  ]);
  assert.equal(microQrSymbolNumber('M4', 'Q'), 7);
  assert.equal(microQrBlockLayout(1, null).ecc, 'DETECT');
  assert.equal(microQrDataCapacityBits('M3', 'L'), 84);
  assert.throws(() => microQrBlockLayout('M2', 'Q'), /not valid/);
  assert.throws(() => microQrVersionSize('M5'), /M1-M4/);
});

test('Micro QR tables: capacities include the M1/M3 four-bit final data codeword', () => {
  const expected = [
    ['M1', 'DETECT', 5, 3, 20, 2, 4, 36],
    ['M2', 'L', 10, 5, 40, 5, 8, 80], ['M2', 'M', 10, 4, 32, 6, 8, 80],
    ['M3', 'L', 17, 11, 84, 6, 4, 132], ['M3', 'M', 17, 9, 68, 8, 4, 132],
    ['M4', 'L', 24, 16, 128, 8, 8, 192], ['M4', 'M', 24, 14, 112, 10, 8, 192],
    ['M4', 'Q', 24, 10, 80, 14, 8, 192],
  ];
  for (const [version, ecc, total, data, dataBits, ec, shortBits, free] of expected) {
    const layout = microQrBlockLayout(version, ecc);
    assert.deepEqual(
      [layout.totalCodewords, layout.dataCodewords, layout.dataBits, layout.eccCodewords, layout.shortDataCodewordBits],
      [total, data, dataBits, ec, shortBits], `${version}-${ecc}`,
    );
    assert.equal(microQrFreeModuleCount(version), free, `${version} geometry`);
    assert.equal(dataBits + ec * 8, free, `${version}-${ecc} fills geometry`);
  }
});

test('Micro QR tables: reserved geometry and traversal cover every module exactly once', () => {
  for (const version of MICROQR_VERSIONS) {
    const size = microQrVersionSize(version);
    const reserved = microQrReservedModules(version);
    const functions = microQrFunctionModules(version);
    const format = microQrFormatInfoPositions(version);
    assert.equal(format.length, 15);
    assert.equal(new Set(format.map(([x, y]) => `${x},${y}`)).size, 15);
    for (let coordinate = 8; coordinate < size; coordinate++) {
      assert.equal(reserved.get(coordinate, 0), true, `${version} horizontal timing ${coordinate}`);
      assert.equal(reserved.get(0, coordinate), true, `${version} vertical timing ${coordinate}`);
      assert.equal(functions.get(coordinate, 0), (coordinate & 1) === 0, `${version} horizontal timing colour ${coordinate}`);
      assert.equal(functions.get(0, coordinate), (coordinate & 1) === 0, `${version} vertical timing colour ${coordinate}`);
    }
    const order = microQrDataModuleOrder(version);
    assert.equal(order.length, microQrFreeModuleCount(version) * 2);
    const visited = new Set();
    for (let i = 0; i < order.length; i += 2) {
      const key = `${order[i]},${order[i + 1]}`;
      assert.equal(reserved.get(order[i], order[i + 1]), false, `${version} ${key} is free`);
      assert.equal(visited.has(key), false, `${version} ${key} visited once`);
      visited.add(key);
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      assert.equal(reserved.get(x, y) || visited.has(`${x},${y}`), true, `${version} covers ${x},${y}`);
    }
  }
  const finder = microQrFunctionModules('M1');
  assert.equal(finder.get(0, 0), true);
  assert.equal(finder.get(1, 1), false);
  assert.equal(finder.get(3, 3), true);
  assert.equal(finder.get(7, 7), false);
  assert.deepEqual(Array.from(microQrDataModuleOrder('M1').slice(0, 12)), [10, 10, 9, 10, 10, 9, 9, 9, 10, 8, 9, 8]);
});

test('Micro QR tables: BCH format words match the published example and correct three bits', () => {
  assert.equal(MICROQR_FORMAT_MASK, 0x4445);
  assert.equal(microQrFormatInfo(0, 3), 0x4b1c);
  assert.equal(microQrFormatInfo(1, null, 3), 0x4b1c);
  const clean = microQrDecodeFormatInfo(0x4b1c);
  assert.deepEqual(clean, { version: 'M1', ecc: 'DETECT', symbolNumber: 0, mask: 3, correctedBits: 0, bits: 0x4b1c });
  for (const entry of MICROQR_SYMBOLS) for (let mask = 0; mask < 4; mask++) {
    const word = microQrFormatInfo(entry.symbolNumber, mask);
    for (const damage of [0, 1, (1 << 2) | (1 << 9), (1 << 0) | (1 << 7) | (1 << 14)]) {
      const decoded = microQrDecodeFormatInfo(word ^ damage);
      assert.equal(decoded?.symbolNumber, entry.symbolNumber);
      assert.equal(decoded?.mask, mask);
    }
  }
  // Four flipped bits cannot be guaranteed correct by BCH(15,5).
  const fourBitDamage = 0x4b1c ^ 0b100000010000011;
  const damaged = microQrDecodeFormatInfo(fourBitDamage);
  assert.ok(damaged === null || damaged.symbolNumber !== 0 || damaged.mask !== 3);
});

test('Micro QR tables: four masks implement the Micro QR predicates', () => {
  assert.equal(microQrMaskBit(0, 3, 2), true);
  assert.equal(microQrMaskBit(0, 3, 3), false);
  assert.equal(microQrMaskBit(1, 3, 2), true);
  assert.equal(microQrMaskBit(2, 1, 3), false);
  assert.equal(microQrMaskBit(2, 2, 3), true);
  assert.equal(microQrMaskBit(3, 3, 1), true);
  assert.throws(() => microQrMaskBit(4, 0, 0), /0\.\.3/);
});
