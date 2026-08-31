import assert from 'node:assert/strict';
import test from 'node:test';
import fixture from './fixtures/compact-pdf417-blackbox-2026-08-13.json' with { type: 'json' };
import { BitMatrix } from '../src/js/core/bit-matrix.js';
import {
  COMPACT_PDF417_START_BITS,
  compactPdf417Geometry,
  compactPdf417Width,
  validateCompactPdf417Tables,
} from '../src/js/compactpdf417/tables.js';
import { encodeCompactPDF417 } from '../src/js/compactpdf417/encoder.js';
import { decodeCompactPDF417 } from '../src/js/compactpdf417/decoder.js';
import { detectAndDecodeCompactPDF417, detectCompactPDF417 } from '../src/js/compactpdf417/detector.js';
import { encodePDF417 } from '../src/js/pdf417/encoder.js';

function rotateClockwise(source) {
  const out = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    if (source.get(x, y)) out.set(source.height - 1 - y, x);
  }
  return out;
}

test('Compact PDF417 layout is distinct from high-level compaction modes', () => {
  assert.deepEqual(validateCompactPdf417Tables(), []);
  assert.equal(COMPACT_PDF417_START_BITS, '11111111010101000');
  assert.equal(compactPdf417Width(1), 52);
  assert.equal(compactPdf417Width(30), 545);
  assert.deepEqual(compactPdf417Geometry(86, 24, 3), {
    width: 86, height: 24, columns: 3, rows: 8, rowHeight: 3,
  });
});

test('Compact PDF417 round-trips Text, Numeric and Byte payloads', () => {
  const cases = [
    ['COMPACT TEXT', { compaction: 'text', columns: 3, rows: 8, rowHeight: 3 }],
    ['12345678901234567890', { compaction: 'numeric', columns: 4, rows: 8, rowHeight: 3 }],
    ['Café', { compaction: 'byte', columns: 3, rows: 8, rowHeight: 3 }],
  ];
  for (const [text, options] of cases) {
    const matrix = encodeCompactPDF417(text, options);
    const decoded = decodeCompactPDF417(matrix);
    assert.equal(decoded.text, text);
    assert.equal(decoded.format, 'compact-pdf417');
    assert.equal(decoded.compact, true);
  }
});

test('Compact PDF417 has the expected two-column overhead reduction', () => {
  const compact = encodeCompactPDF417('WIDTH TEST', { columns: 3, rows: 8, rowHeight: 3 });
  const normal = encodePDF417('WIDTH TEST', { columns: 3, rows: 8, rowHeight: 3 });
  assert.equal(compact.width, normal.width - 34);
  assert.equal(compact.height, normal.height);
  assert.equal(compact.compactPdf417.layout, 'compact');
});

test('Compact PDF417 clean detector handles quiet zones, scale and quarter turns', () => {
  const source = encodeCompactPDF417('DETECT COMPACT', { columns: 3, rows: 8, rowHeight: 4 });
  let image = source.withMargin(4).scale(3);
  for (let rotation = 0; rotation < 4; rotation++) {
    const found = detectAndDecodeCompactPDF417(image);
    assert.equal(found?.text, 'DETECT COMPACT', `${rotation} quarter turns`);
    assert.equal(found?.compact, true);
    assert.equal(found?.moduleSize, 3);
    image = rotateClockwise(image);
  }
});

test('Compact PDF417 detector rejects ordinary PDF417 and unrelated rasters', () => {
  const normal = encodePDF417('NORMAL PDF417', { columns: 3, rows: 8, rowHeight: 3 })
    .withMargin(4)
    .scale(2);
  assert.equal(detectCompactPDF417(normal), null);

  const blank = new BitMatrix(300, 160);
  assert.equal(detectCompactPDF417(blank), null);

  const stripes = new BitMatrix(300, 160);
  for (let x = 3; x < stripes.width; x += 11) stripes.setRegion(x, 5, 3, 145);
  assert.equal(detectCompactPDF417(stripes), null);
});

test('Compact PDF417 decoder rejects a missing reduced stop module', () => {
  const matrix = encodeCompactPDF417('STOP CHECK', { columns: 3, rows: 8, rowHeight: 3 });
  const stopX = matrix.width - 1;
  for (let y = 0; y < matrix.height; y++) matrix.unset(stopX, y);
  assert.throws(() => decodeCompactPDF417(matrix), /reduced stop module/);
});

test('Compact PDF417 fixture records an independent black-box vector', () => {
  assert.equal(fixture.format, 'compact-pdf417');
  assert.equal(fixture.validation.sourceCodeCopied, false);
  assert.equal(fixture.validation.externalOracle, 'ZXing PDF417 reader when configured');
  const matrix = encodeCompactPDF417(fixture.text, fixture.options);
  assert.equal(matrix.width, fixture.width);
  assert.equal(matrix.height, fixture.height);
  assert.deepEqual(matrix.compactPdf417.codewords, fixture.codewords);
  assert.equal(decodeCompactPDF417(matrix).text, fixture.text);
});
