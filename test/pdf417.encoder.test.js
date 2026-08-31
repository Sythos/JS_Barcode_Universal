import assert from 'node:assert/strict';
import test from 'node:test';
import { encodePDF417 } from '../src/js/pdf417/encoder.js';
import { decodePDF417 } from '../src/js/pdf417/decoder.js';
import { detectAndDecodePDF417 } from '../src/js/pdf417/detector.js';

function copyInto(source, target, offsetX, offsetY, shiftForRow = () => 0) {
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    if (source.get(x, y)) target.set(offsetX + shiftForRow(y) + x, offsetY + y);
  }
}

test('PDF417 ideal matrix round trips all implemented compaction modes', () => {
  for (const [text, options] of [['Ad: 102', { compaction: 'text' }], ['12345678901234567890', { compaction: 'numeric' }], ['bytes', { compaction: 'byte' }]]) {
    const matrix = encodePDF417(text, options);
    assert.equal(decodePDF417(matrix).text, text);
    assert.equal(detectAndDecodePDF417(matrix).text, text);
  }
});

test('PDF417 encodes every standard ECC level', () => {
  for (let eccLevel = 0; eccLevel <= 8; eccLevel++) {
    const matrix = encodePDF417('A', { compaction: 'text', eccLevel });
    assert.equal(decodePDF417(matrix).eccLevel, eccLevel);
  }
});

test('PDF417 preserves UTF-8 byte text with ECI and stored row height', () => {
  const matrix = encodePDF417('Caffè', { compaction: 'byte', rowHeight: 4 });
  assert.equal(decodePDF417(matrix).text, 'Caffè');
  assert.throws(() => encodePDF417('A', { rows: 2 }), /rows/);
  assert.throws(() => encodePDF417('A', { columns: 1.5 }), /columns/);
});

test('PDF417 detector recovers all module-aligned right-angle rotations', () => {
  let matrix = encodePDF417('ROTATE', { compaction: 'text' });
  const rotate = (source) => {
    const target = new (source.constructor)(source.height, source.width);
    for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) if (source.get(x, y)) target.set(source.height - 1 - y, x);
    return target;
  };
  for (let turns = 0; turns < 4; turns++) {
    assert.equal(detectAndDecodePDF417(matrix).text, 'ROTATE');
    matrix = rotate(matrix);
  }
});

test('PDF417 detector normalizes integer module scale', () => {
  const matrix = encodePDF417('SCALE', { compaction: 'text' });
  for (const scale of [2, 3]) assert.equal(detectAndDecodePDF417(matrix.scale(scale)).text, 'SCALE');
});

test('PDF417 decoder corrects an unreadable data codeword as an erasure', () => {
  const matrix = encodePDF417('ERASURE', { compaction: 'text', eccLevel: 2 });
  const damaged = matrix.clone();
  for (let y = 0; y < 3; y++) for (let x = 34; x < 51; x++) damaged.unset(x, y);
  const result = decodePDF417(damaged);
  assert.equal(result.text, 'ERASURE');
  assert.equal(result.corrections, 1);
});

test('PDF417 detector infers supported row heights without matrix metadata', () => {
  for (const rowHeight of [4, 5, 6]) {
    const matrix = encodePDF417('HEIGHT', { compaction: 'text', rowHeight });
    assert.equal(detectAndDecodePDF417(matrix).text, 'HEIGHT');
    assert.equal(detectAndDecodePDF417(matrix.scale(2)).text, 'HEIGHT');
  }
});

test('PDF417 detector samples a supplied module quadrilateral', () => {
  const source = encodePDF417('QUAD', { compaction: 'text' }).scale(4);
  const result = detectAndDecodePDF417(source, {
    quadrilateral: [{ x: 0, y: 0 }, { x: source.width, y: 0 }, { x: source.width, y: source.height }, { x: 0, y: source.height }],
  });
  assert.equal(result.text, 'QUAD');
});

test('PDF417 detector localizes an embedded raster despite unrelated dark pixels', () => {
  const symbol = encodePDF417('STRAY', { compaction: 'text' }).scale(3);
  const image = new symbol.constructor(symbol.width + 18, symbol.height + 18);
  copyInto(symbol, image, 9, 9);
  image.set(0, 0);
  image.set(image.width - 1, image.height - 1);
  const result = detectAndDecodePDF417(image);
  assert.equal(result.text, 'STRAY');
  assert.deepEqual(result.corners, [
    { x: 9, y: 9 }, { x: 9 + symbol.width, y: 9 },
    { x: 9 + symbol.width, y: 9 + symbol.height }, { x: 9, y: 9 + symbol.height },
  ]);
});

test('PDF417 detector automatically rectifies a moderate horizontal shear', () => {
  const symbol = encodePDF417('SHEAR', { compaction: 'text', rowHeight: 4 }).scale(3);
  const offset = 8;
  const rowShift = (y) => Math.floor(y / 18);
  const maximumShift = rowShift(symbol.height - 1);
  const image = new symbol.constructor(symbol.width + offset * 2 + maximumShift, symbol.height + offset * 2);
  copyInto(symbol, image, offset, offset, rowShift);
  const result = detectAndDecodePDF417(image);
  assert.equal(result.text, 'SHEAR');
  assert.ok(result.corners[3].x - result.corners[0].x >= maximumShift - 1);
});
