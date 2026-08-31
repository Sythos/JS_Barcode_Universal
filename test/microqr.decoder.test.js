import assert from 'node:assert/strict';
import test from 'node:test';
import { BitWriter } from '../src/js/core/bit-buffer.js';
import { BitMatrix } from '../src/js/core/bit-matrix.js';
import { ChecksumError, FormatError } from '../src/js/core/errors.js';
import { GF256_QR } from '../src/js/core/galois-field.js';
import { rsEncode } from '../src/js/core/reed-solomon.js';
import { decodeMicroQR } from '../src/js/microqr/decoder.js';
import {
  microQrBlockLayout,
  microQrDataModuleOrder,
  microQrFormatInfo,
  microQrFormatInfoPositions,
  microQrMaskBit,
  microQrVersionSize,
} from '../src/js/microqr/tables.js';

const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const MODES = { numeric: 0, alphanumeric: 1, byte: 2, kanji: 3 };
const COUNT_BITS = {
  numeric: [0, 3, 4, 5, 6], alphanumeric: [0, 0, 3, 4, 5],
  byte: [0, 0, 0, 4, 5], kanji: [0, 0, 0, 3, 4],
};

function bitAt(writer, index) {
  return (writer.bytes[index >>> 3] >>> (7 - (index & 7))) & 1;
}

function drawFunctions(matrix) {
  const size = matrix.width;
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    const ring = x === 0 || x === 6 || y === 0 || y === 6;
    const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
    matrix.setValue(x, y, ring || core);
  }
  for (let i = 0; i < 8; i++) {
    matrix.unset(7, i);
    matrix.unset(i, 7);
  }
  for (let i = 8; i < size; i++) {
    matrix.setValue(i, 0, (i & 1) === 0);
    matrix.setValue(0, i, (i & 1) === 0);
  }
}

function payloadWriter(mode, value) {
  const writer = new BitWriter();
  if (mode === 'numeric') {
    for (let i = 0; i < value.length; i += 3) {
      const count = Math.min(3, value.length - i);
      writer.put(Number(value.slice(i, i + count)), count === 3 ? 10 : count === 2 ? 7 : 4);
    }
  } else if (mode === 'alphanumeric') {
    let i = 0;
    for (; i + 1 < value.length; i += 2) {
      writer.put(ALPHANUMERIC.indexOf(value[i]) * 45 + ALPHANUMERIC.indexOf(value[i + 1]), 11);
    }
    if (i < value.length) writer.put(ALPHANUMERIC.indexOf(value[i]), 6);
  } else if (mode === 'byte') {
    for (const byte of value) writer.put(byte, 8);
  } else {
    for (const encoded of value) writer.put(encoded, 13);
  }
  return writer;
}

function buildSymbol({ version, ecc, mask, mode, value, count, rawPayload }) {
  const versionNumber = Number(String(version).replace(/^M/i, ''));
  const versionName = `M${versionNumber}`;
  const layout = microQrBlockLayout(versionName, ecc);
  const payload = rawPayload || payloadWriter(mode, value);
  const characters = count ?? (mode === 'byte' || mode === 'kanji' ? value.length : value.length);
  const data = new BitWriter();
  if (versionNumber > 1) data.put(MODES[mode], versionNumber - 1);
  data.put(characters, COUNT_BITS[mode][versionNumber]);
  for (let i = 0; i < payload.length; i++) data.putBit(bitAt(payload, i) === 1);
  assert.ok(data.length <= layout.dataBits, 'fixture payload fits');
  for (let i = 0, n = Math.min(2 * versionNumber + 1, layout.dataBits - data.length); i < n; i++) data.putBit(false);
  if (versionNumber !== 1 && versionNumber !== 3) {
    while ((data.length & 7) && data.length < layout.dataBits) data.putBit(false);
  }
  let pad = 0;
  while (data.length + 8 <= layout.dataBits) data.put(pad++ & 1 ? 0x11 : 0xec, 8);
  while (data.length < layout.dataBits) data.putBit(false);

  const dataBytes = Array.from(data.toBytes());
  if (layout.shortDataCodewordBits === 4) dataBytes[dataBytes.length - 1] &= 0xf0;
  const eccBytes = rsEncode(dataBytes, layout.eccCodewords, GF256_QR, 0);
  const message = [];
  const fullData = layout.shortDataCodewordBits === 4 ? dataBytes.length - 1 : dataBytes.length;
  for (let i = 0; i < fullData; i++) for (let bit = 7; bit >= 0; bit--) message.push((dataBytes[i] >>> bit) & 1);
  if (layout.shortDataCodewordBits === 4) {
    for (let bit = 7; bit >= 4; bit--) message.push((dataBytes[dataBytes.length - 1] >>> bit) & 1);
  }
  for (const byte of eccBytes) for (let bit = 7; bit >= 0; bit--) message.push((byte >>> bit) & 1);

  const matrix = new BitMatrix(microQrVersionSize(versionName));
  drawFunctions(matrix);
  const order = microQrDataModuleOrder(versionName);
  for (let i = 0; i < message.length; i++) {
    const x = order[i * 2], y = order[i * 2 + 1];
    matrix.setValue(x, y, (message[i] === 1) !== microQrMaskBit(mask, x, y));
  }
  const format = microQrFormatInfo(versionName, ecc, mask);
  const positions = microQrFormatInfoPositions(versionName);
  for (let i = 0; i < positions.length; i++) {
    matrix.setValue(positions[i][0], positions[i][1], ((format >>> i) & 1) === 1);
  }
  return matrix;
}

function transpose(matrix) {
  const result = new BitMatrix(matrix.height, matrix.width);
  for (let y = 0; y < matrix.height; y++) for (let x = 0; x < matrix.width; x++) {
    result.setValue(y, x, matrix.get(x, y));
  }
  return result;
}

function buildPublishedM2LFixture() {
  // ISO/IEC 18004:2015 Annex I, payload 01234567. These data and ECC
  // codewords are copied as fixture facts; this path deliberately does not
  // call the local payload or Reed-Solomon encoders.
  const codewords = [0x40, 0x18, 0xac, 0xc3, 0x00, 0x86, 0x0d, 0x22, 0xae, 0x30];
  const matrix = new BitMatrix(13);
  drawFunctions(matrix);
  const order = microQrDataModuleOrder('M2');
  let offset = 0;
  for (const byte of codewords) for (let bit = 7; bit >= 0; bit--, offset++) {
    const x = order[offset * 2], y = order[offset * 2 + 1];
    const value = ((byte >>> bit) & 1) === 1;
    matrix.setValue(x, y, value !== microQrMaskBit(1, x, y));
  }
  const format = 0x5099; // Symbol number 1 (M2-L), mask reference 01.
  const positions = microQrFormatInfoPositions('M2');
  for (let i = 0; i < positions.length; i++) {
    matrix.setValue(positions[i][0], positions[i][1], ((format >>> i) & 1) === 1);
  }
  return matrix;
}

function flipStreamBit(matrix, version, offset) {
  const order = microQrDataModuleOrder(version);
  matrix.flip(order[offset * 2], order[offset * 2 + 1]);
}

test('Micro QR decoder reads M1-M4 and every supported data mode', () => {
  const cases = [
    [{ version: 'M1', ecc: 'DETECT', mask: 0, mode: 'numeric', value: '12345' }, '12345'],
    [{ version: 'M2', ecc: 'L', mask: 1, mode: 'alphanumeric', value: 'AB12' }, 'AB12'],
    [{ version: 'M3', ecc: 'M', mask: 2, mode: 'byte', value: [0x48, 0xe9] }, 'Hé'],
    // Shift_JIS 0x8ABF (漢) maps to the Micro QR 13-bit value 0x073F.
    [{ version: 'M4', ecc: 'Q', mask: 3, mode: 'kanji', value: [0x073f] }, '漢'],
  ];
  for (const [options, expected] of cases) {
    const result = decodeMicroQR(buildSymbol(options));
    assert.equal(result.text, expected, options.version);
    assert.equal(result.version, options.version);
    assert.equal(result.mode, options.mode);
    assert.equal(result.ecc, options.ecc);
    assert.equal(result.mask, options.mask);
    assert.equal(result.corrections, 0);
    assert.equal(result.mirrored, false);
  }
});

test('Micro QR decoder reads the independent ISO Annex I M2-L fixture', () => {
  const result = decodeMicroQR(buildPublishedM2LFixture());
  assert.equal(result.text, '01234567');
  assert.equal(result.version, 'M2');
  assert.equal(result.ecc, 'L');
  assert.equal(result.mask, 1);
  assert.equal(result.corrections, 0);
  assert.equal(result.formatCorrections, 0);
});

test('Micro QR decoder reads independent M1, M3 and M4 black-box matrices', () => {
  const fixtures = [
    ['1', '11111110101/10000010000/10111010111/10111010011/10111010000/10000010100/11111110111/00000000110/11000001000/00111100001/10011100111'],
    ['HELLO', '111111101010101/100000101001110/101110101111110/101110101111000/101110101000100/100000100000100/111111100111001/000000001111010/111100110000101/000001110000111/100000101111001/000010010111010/100001010000101/010000110000101/111001111111010'],
    ['ABC', '11111110101010101/10000010010011100/10111010001100011/10111010111000011/10111010011111100/10000010100000001/11111110011100101/00000000100101110/10110001111111101/01101011100011110/11101110100011010/00001100110110000/10001100010100100/01011101101110011/11100100100100111/00001101000001110/10011000111011100'],
  ];
  for (const [expected, rows] of fixtures) {
    assert.equal(decodeMicroQR(BitMatrix.parse(rows.replaceAll('/', '\n'))).text, expected);
  }
});

test('Micro QR decoder exposes ISO-8859-1 byte data without implicit UTF-8', () => {
  const result = decodeMicroQR(buildSymbol({
    version: 'M4', ecc: 'M', mask: 0, mode: 'byte', value: [0xc3, 0xa9],
  }));
  assert.equal(result.text, 'Ã©');
  assert.deepEqual(result.bytes, Uint8Array.of(0xc3, 0xa9));
});

test('Micro QR decoder corrects three BCH format bits and retries a mirrored matrix', () => {
  const matrix = buildSymbol({ version: 'M4', ecc: 'L', mask: 2, mode: 'numeric', value: '1234567890' });
  const positions = microQrFormatInfoPositions('M4');
  for (const index of [0, 7, 14]) matrix.flip(positions[index][0], positions[index][1]);
  const corrected = decodeMicroQR(matrix);
  assert.equal(corrected.text, '1234567890');
  assert.equal(corrected.formatCorrections, 3);

  const mirrored = decodeMicroQR(transpose(buildSymbol({
    version: 'M3', ecc: 'L', mask: 3, mode: 'alphanumeric', value: 'MIRROR',
  })));
  assert.equal(mirrored.text, 'MIRROR');
  assert.equal(mirrored.mirrored, true);
});

test('Micro QR decoder handles the M3 four-bit data codeword before ECC', () => {
  const matrix = buildSymbol({ version: 'M3', ecc: 'M', mask: 1, mode: 'numeric', value: '123456789' });
  const layout = microQrBlockLayout('M3', 'M');
  flipStreamBit(matrix, 'M3', (layout.dataCodewords - 1) * 8);
  const result = decodeMicroQR(matrix);
  assert.equal(result.text, '123456789');
  assert.equal(result.corrections, 1);
});

test('Micro QR M1 detects damage but never applies Reed-Solomon correction', () => {
  const matrix = buildSymbol({ version: 'M1', ecc: 'DETECT', mask: 0, mode: 'numeric', value: '12345' });
  flipStreamBit(matrix, 'M1', 0);
  assert.throws(() => decodeMicroQR(matrix), ChecksumError);
});

test('Micro QR decoder rejects damage beyond ECC capacity', () => {
  const matrix = buildSymbol({ version: 'M2', ecc: 'L', mask: 0, mode: 'numeric', value: '123456' });
  for (const offset of [0, 8, 16]) flipStreamBit(matrix, 'M2', offset);
  assert.throws(() => decodeMicroQR(matrix), ChecksumError);
});

test('Micro QR decoder rejects invalid geometry, contradictory format and malformed payloads', () => {
  assert.throws(() => decodeMicroQR(null), FormatError);
  assert.throws(() => decodeMicroQR(new BitMatrix(11, 13)), FormatError);
  assert.throws(() => decodeMicroQR(new BitMatrix(21)), FormatError);
  assert.throws(() => decodeMicroQR(new BitMatrix(11)), FormatError);

  const contradictory = buildSymbol({ version: 'M2', ecc: 'L', mask: 0, mode: 'numeric', value: '12' });
  const positions = microQrFormatInfoPositions('M2');
  const wrongFormat = microQrFormatInfo('M4', 'Q', 0);
  for (let i = 0; i < positions.length; i++) {
    contradictory.setValue(positions[i][0], positions[i][1], ((wrongFormat >>> i) & 1) === 1);
  }
  assert.throws(() => decodeMicroQR(contradictory), FormatError);

  const invalidDigit = new BitWriter();
  invalidDigit.put(10, 4);
  const malformed = buildSymbol({
    version: 'M2', ecc: 'M', mask: 1, mode: 'numeric', value: '', count: 1, rawPayload: invalidDigit,
  });
  assert.throws(() => decodeMicroQR(malformed), /invalid numeric digit/);
});
