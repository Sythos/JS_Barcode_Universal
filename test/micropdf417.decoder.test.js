import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeMicroPDF417 } from '../src/js/micropdf417/decoder.js';
import { encodeMicroPDF417 } from '../src/js/micropdf417/encoder.js';
import { MICROPDF417_VARIANTS } from '../src/js/micropdf417/tables.js';

test('MicroPDF417 decoder identifies and reads all 34 variants from RAPs without metadata', () => {
  for (const variant of MICROPDF417_VARIANTS) {
    const encoded = encodeMicroPDF417('A', { variant: variant.id, compaction: 'text', rowHeight: 2 });
    const matrix = encoded.clone();
    const decoded = decodeMicroPDF417(matrix);
    assert.equal(decoded.text, 'A');
    assert.equal(decoded.variant, variant.id);
    assert.equal(decoded.rows, variant.rows);
    assert.equal(decoded.columns, variant.columns);
    assert.equal(decoded.eccCodewords, variant.eccCodewords);
    assert.equal(decoded.rowHeight, 2);
  }
});

test('MicroPDF417 decoder preserves compaction payloads and declared row height', () => {
  const text = encodeMicroPDF417('Micro PDF', { variant: 17, compaction: 'text', rowHeight: 3 }).clone();
  assert.equal(decodeMicroPDF417(text).text, 'Micro PDF');

  const numeric = encodeMicroPDF417('12345678901234567890', { variant: 31, compaction: 'numeric' }).clone();
  assert.equal(decodeMicroPDF417(numeric).text, '12345678901234567890');

  const bytes = encodeMicroPDF417(Uint8Array.of(0, 1, 2, 250), { variant: 31, compaction: 'byte' }).clone();
  assert.deepEqual(Array.from(decodeMicroPDF417(bytes).bytes.slice(0, 4)), [0, 1, 2, 250]);
});

test('MicroPDF417 decoder restores an erased data codeword through fixed GF(929) ECC', () => {
  const encoded = encodeMicroPDF417('ERASURE', { variant: 34, compaction: 'text', rowHeight: 2 });
  const damaged = encoded.clone();
  for (let y = 0; y < 2; y++) for (let x = 10; x < 27; x++) damaged.unset(x, y);
  const decoded = decodeMicroPDF417(damaged);
  assert.equal(decoded.text, 'ERASURE');
  assert.equal(decoded.corrections, 1);
});

test('MicroPDF417 decoder rejects a matrix whose RAPs do not identify a valid variant', () => {
  const damaged = encodeMicroPDF417('A', { variant: 1, compaction: 'text' }).clone();
  damaged.flip(0, 0);
  assert.throws(() => decodeMicroPDF417(damaged), /row-address patterns/);
});
