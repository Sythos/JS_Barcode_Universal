import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { encodeMicroPDF417 } from '../src/js/micropdf417/encoder.js';
import {
  MICROPDF417_VARIANTS,
  microPdf417RapSequence,
  microPdf417RowAddress,
} from '../src/js/micropdf417/tables.js';

function sequenceBits(sequence) {
  let dark = true;
  let bits = '';
  for (const digit of sequence) {
    bits += (dark ? '1' : '0').repeat(Number(digit));
    dark = !dark;
  }
  return bits;
}

function rowBits(matrix, y, start, width) {
  let bits = '';
  for (let x = start; x < start + width; x++) bits += matrix.get(x, y) ? '1' : '0';
  return bits;
}

const fixtureUrl = new URL('./fixtures/micropdf417-encoder-vectors.json', import.meta.url);
const fixtures = JSON.parse(readFileSync(fixtureUrl, 'utf8'));

test('MicroPDF417 encoder renders every fixed variant with the declared geometry', () => {
  assert.equal(MICROPDF417_VARIANTS.length, 34);
  for (const variant of MICROPDF417_VARIANTS) {
    const matrix = encodeMicroPDF417('A', { variant: variant.id, compaction: 'text', rowHeight: 2 });
    assert.equal(matrix.width, 21 + variant.columns * 17 + (variant.columns > 2 ? 10 : 0));
    assert.equal(matrix.height, variant.rows * 2);
    assert.equal(matrix.micropdf417.variant, variant.id);
    assert.equal(matrix.micropdf417.codewords.length, variant.totalCodewords);
    assert.equal(matrix.micropdf417.eccCodewords, variant.eccCodewords);
    for (let row = 0; row < variant.rows; row++) {
      assert.equal(rowBits(matrix, row * 2, 0, matrix.width), rowBits(matrix, row * 2 + 1, 0, matrix.width));
      const address = microPdf417RowAddress(variant, row);
      assert.equal(rowBits(matrix, row * 2, 0, 10), sequenceBits(microPdf417RapSequence(address.left, 'side')));
      assert.equal(rowBits(matrix, row * 2, matrix.width - 11, 10), sequenceBits(microPdf417RapSequence(address.right, 'side')));
      assert.equal(matrix.get(matrix.width - 1, row * 2), true);
      if (variant.columns > 2) {
        const centreX = variant.columns === 3 ? 27 : 44;
        assert.equal(rowBits(matrix, row * 2, centreX, 10), sequenceBits(microPdf417RapSequence(address.center, 'center')));
      }
    }
  }
});

test('MicroPDF417 encoder exposes deterministic payload metadata for supported compaction modes', () => {
  const text = encodeMicroPDF417('MICRO', { variant: 1, compaction: 'text' });
  assert.equal(text.micropdf417.dataCodewords[0], 900);
  assert.equal(text.micropdf417.payloadCodewords, 4);

  const numeric = encodeMicroPDF417('1234567890123', { compaction: 'numeric' });
  assert.equal(numeric.micropdf417.dataCodewords[0], 902);

  const bytes = encodeMicroPDF417(Uint8Array.of(0, 1, 2), { compaction: 'byte' });
  assert.equal(bytes.micropdf417.dataCodewords[0], 901);

  const utf8 = encodeMicroPDF417('Caf\u00e9', { compaction: 'byte', eci: 26 });
  assert.deepEqual(utf8.micropdf417.dataCodewords.slice(0, 3), [927, 26, 901]);
});

test('MicroPDF417 encoder selects a fitting variant under column and aspect constraints', () => {
  const oneColumn = encodeMicroPDF417('A', { columns: 1 });
  assert.equal(oneColumn.micropdf417.columns, 1);
  const fourColumns = encodeMicroPDF417('A', { columns: 4 });
  assert.equal(fourColumns.micropdf417.columns, 4);
  const wide = encodeMicroPDF417('A', { aspectRatio: 4 });
  assert.ok(wide.width / wide.height > 1);
});

test('MicroPDF417 encoder rejects invalid, conflicting or overflowing options', () => {
  assert.throws(() => encodeMicroPDF417('A', { variant: 0 }), /variant/);
  assert.throws(() => encodeMicroPDF417('A', { columns: 5 }), /columns/);
  assert.throws(() => encodeMicroPDF417('A', { rowHeight: 1 }), /rowHeight/);
  assert.throws(() => encodeMicroPDF417('A', { rows: 8 }), /fixed by/);
  assert.throws(() => encodeMicroPDF417('A', { eccLevel: 2 }), /fixed by/);
  assert.throws(() => encodeMicroPDF417('A', { variant: 1, columns: 2 }), /has 1 columns/);
  assert.throws(() => encodeMicroPDF417(Uint8Array.of(1, 2, 3, 4), { variant: 1, compaction: 'byte' }), /holds/);
  assert.throws(() => encodeMicroPDF417('A', { structuredAppend: {} }), /not implemented/);
});

test('MicroPDF417 encoder preserves deterministic fixtures for the matrix decoder milestone', () => {
  assert.equal(fixtures.schemaVersion, 1);
  for (const fixture of fixtures.vectors) {
    const value = Array.isArray(fixture.value) ? Uint8Array.from(fixture.value) : fixture.value;
    const matrix = encodeMicroPDF417(value, fixture.options);
    let canonicalRows = '';
    for (let row = 0; row < matrix.micropdf417.rows; row++) {
      canonicalRows += rowBits(matrix, row * matrix.micropdf417.rowHeight, 0, matrix.width) + '\n';
    }
    assert.equal(matrix.width, fixture.width, fixture.id);
    assert.equal(matrix.micropdf417.rows, fixture.rows, fixture.id);
    assert.deepEqual(matrix.micropdf417.codewords, fixture.codewords, fixture.id);
    assert.equal(createHash('sha256').update(canonicalRows).digest('hex'), fixture.sha256, fixture.id);
  }
});
