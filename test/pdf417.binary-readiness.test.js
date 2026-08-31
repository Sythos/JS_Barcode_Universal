import assert from 'node:assert/strict';
import test from 'node:test';

import { decode } from '../src/index.js';
import { decodePDF417 } from '../src/js/pdf417/decoder.js';
import { encodePDF417 } from '../src/js/pdf417/encoder.js';
import { compactPdf417Bytes, decodePdf417CompactionDetailed } from '../src/js/pdf417/compaction.js';
import { toImageData } from '../src/js/render/image-data.js';

test('PDF417 byte compaction preserves arbitrary octets in decoder results', () => {
  for (const length of [0, 1, 5, 6, 11, 12]) {
    const input = Uint8Array.from({ length }, (_, index) => [0x00, 0x01, 0x7f, 0x80, 0xfe, 0xff][index % 6]);
    const result = decodePDF417(encodePDF417(input, { compaction: 'byte' }));
    assert.deepEqual(Array.from(result.text, (character) => character.charCodeAt(0)), [...input]);
    assert.deepEqual(result.bytes, input);
    assert.equal(result.segments.length, 1);
    assert.equal(result.segments[0].mode, 'byte');
    assert.deepEqual(result.segments[0].bytes, input);
  }
});

test('PDF417 detailed compaction preserves byte segments, shifts, ECI and boundaries', () => {
  const byteCodewords = compactPdf417Bytes(Uint8Array.from([0, 128, 255]));
  const codewords = [1, 913, 233, 900, ...byteCodewords, 902, 12];
  const result = decodePdf417CompactionDetailed(codewords);

  assert.equal(result.text, `AB\u00e9\u0000\u0080\u00ff2`);
  assert.deepEqual(result.bytes, Uint8Array.from([233, 0, 128, 255]));
  assert.deepEqual(result.segments.map(({ mode, latch, eci, codewordStart, codewordEnd }) => ({ mode, latch, eci, codewordStart, codewordEnd })), [
    { mode: 'text', latch: null, eci: 3, codewordStart: 0, codewordEnd: 3 },
    { mode: 'byte', latch: 901, eci: 3, codewordStart: 4, codewordEnd: 8 },
    { mode: 'numeric', latch: 902, eci: 3, codewordStart: 8, codewordEnd: 10 },
  ]);
  assert.deepEqual(result.segments[0].bytes, Uint8Array.of(233));
  assert.deepEqual(result.segments[1].bytes, Uint8Array.from([0, 128, 255]));
  assert.deepEqual(result.segments[2].bytes, new Uint8Array(0));
});

test('PDF417 detailed compaction applies UTF-8 ECI without changing raw bytes', () => {
  const result = decodePdf417CompactionDetailed([927, 26, 901, 0xc3, 0xa9]);
  assert.equal(result.text, '\u00e9');
  assert.deepEqual(result.bytes, Uint8Array.from([0xc3, 0xa9]));
  assert.equal(result.segments[0].eci, 26);
});

test('PDF417 generic image decode propagates raw bytes and compaction segments', () => {
  const input = Uint8Array.from([0x00, 0x01, 0x7f, 0x80, 0xfe, 0xff]);
  const image = toImageData(encodePDF417(input, { compaction: 'byte', eccLevel: 2 }), { scale: 3, margin: 4 });
  const [result] = decode(image, { formats: ['pdf417'] });
  assert.deepEqual(result.bytes, input);
  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0].mode, 'byte');
});
