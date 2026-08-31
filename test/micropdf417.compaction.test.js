import assert from 'node:assert/strict';
import test from 'node:test';
import { compactMicroPDF417 } from '../src/js/micropdf417/compaction.js';
import { decodePdf417CompactionDetailed } from '../src/js/pdf417/compaction.js';

test('MicroPDF417 compaction emits an explicit Text latch', () => {
  const codewords = compactMicroPDF417('Greetings', { compaction: 'text' });
  assert.equal(codewords[0], 900);
  assert.equal(decodePdf417CompactionDetailed(codewords).text, 'Greetings');
});

test('MicroPDF417 compaction preserves Numeric and Byte mode latches', () => {
  const numeric = compactMicroPDF417('12345678901234567890', { compaction: 'numeric' });
  assert.equal(numeric[0], 902);
  assert.equal(decodePdf417CompactionDetailed(numeric).text, '12345678901234567890');

  const bytes = compactMicroPDF417(Uint8Array.from([0, 1, 2, 250]), { compaction: 'byte' });
  assert.equal(bytes[0], 901);
  assert.deepEqual(Array.from(decodePdf417CompactionDetailed(bytes).bytes), [0, 1, 2, 250]);

  assert.equal(compactMicroPDF417(Uint8Array.from([0, 1, 2, 3, 4, 5]), { compaction: 'byte' })[0], 924);
});

test('MicroPDF417 compaction supports ECI 3 and ECI 26 without guessing bytes', () => {
  const latin1 = compactMicroPDF417('Caf\u00e9', { compaction: 'byte', eci: 3 });
  assert.equal(latin1[0], 901);
  assert.equal(decodePdf417CompactionDetailed(latin1).text, 'Caf\u00e9');

  const utf8 = compactMicroPDF417('ASCII', { compaction: 'byte', eci: 26 });
  assert.deepEqual(utf8.slice(0, 3), [927, 26, 901]);
  assert.equal(decodePdf417CompactionDetailed(utf8).text, 'ASCII');

  const inferredUtf8 = compactMicroPDF417('Caf\u00e9', { compaction: 'auto' });
  assert.deepEqual(inferredUtf8.slice(0, 3), [927, 26, 901]);
  assert.equal(decodePdf417CompactionDetailed(inferredUtf8).text, 'Caf\u00e9');
});

test('MicroPDF417 automatic compaction keeps the established PDF417 thresholds', () => {
  assert.equal(compactMicroPDF417('1234567890123')[0], 902);
  assert.equal(compactMicroPDF417('123456789012')[0], 900);
  assert.equal(compactMicroPDF417('Mixed text')[0], 900);
});

test('MicroPDF417 compaction rejects empty or unproved ECI combinations', () => {
  assert.throws(() => compactMicroPDF417(''), /must not be empty/);
  assert.throws(() => compactMicroPDF417(new Uint8Array(0)), /must not be empty/);
  assert.throws(() => compactMicroPDF417('A', { compaction: 'text', eci: 26 }), /only with byte/);
  assert.throws(() => compactMicroPDF417('A', { compaction: 'byte', eci: 999 }), /assignment numbers/);
  assert.throws(() => compactMicroPDF417('\u20ac', { compaction: 'byte', eci: 3 }), /outside ISO-8859-1/);
  assert.throws(() => compactMicroPDF417(Uint8Array.of(0x41), { compaction: 'byte', eci: 26 }), /must be a string/);
});
