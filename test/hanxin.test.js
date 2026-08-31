import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BitMatrix } from '../src/js/core/bit-matrix.js';
import { EncodeError, FormatError, NotFoundError } from '../src/js/core/errors.js';
import {
  HANXIN_DATA_MODULES,
  HANXIN_ECC_LEVELS,
  HANXIN_TOTAL_CODEWORDS,
  HANXIN_VERSIONS,
  decodeHanXin,
  detectAndDecodeHanXin,
  detectHanXin,
  encodeHanXin,
  encodeHanXinBytes,
  hanXinDataCoordinates,
  hanXinDimension,
  hanXinSize,
  validateHanXinTables,
} from '../src/js/hanxin/index.js';

function invert(source) {
  const result = source.clone();
  for (let y = 0; y < result.height; y++) {
    for (let x = 0; x < result.width; x++) result.flip(x, y);
  }
  return result;
}

function rotate(source, degrees) {
  if (degrees === 0) return source.clone();
  const result = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (!source.get(x, y)) continue;
      if (degrees === 90) result.set(source.height - 1 - y, x);
      else if (degrees === 180) result.set(source.width - 1 - x, source.height - 1 - y);
      else if (degrees === 270) result.set(y, source.width - 1 - x);
      else throw new RangeError('test rotation must be a right-angle turn');
    }
  }
  return result;
}

test('Han Xin compact tables cover versions 1-3 and all four EC levels', () => {
  assert.deepEqual(validateHanXinTables(), []);
  assert.deepEqual([...HANXIN_VERSIONS], [1, 2, 3]);
  assert.deepEqual([...HANXIN_DATA_MODULES], [205, 301, 405]);
  assert.deepEqual([...HANXIN_TOTAL_CODEWORDS], [25, 37, 50]);
  assert.deepEqual([...HANXIN_ECC_LEVELS], ['L1', 'L2', 'L3', 'L4']);
  for (const version of HANXIN_VERSIONS) {
    assert.equal(hanXinSize(version), 21 + version * 2);
    assert.equal(hanXinDimension(version), hanXinSize(version));
    assert.equal(hanXinDataCoordinates(version).length, HANXIN_DATA_MODULES[version - 1]);
  }
});

test('Han Xin encodes and strictly decodes numeric, text and byte modes', () => {
  const numeric = decodeHanXin(encodeHanXin('0012345', { mode: 'numeric', version: 1, ecc: 'L1', mask: 0 }));
  assert.equal(numeric.mode, 'numeric');
  assert.equal(numeric.text, '0012345');
  assert.deepEqual([...numeric.bytes], [...new TextEncoder().encode('0012345')]);

  const text = decodeHanXin(encodeHanXin('Hello-World/42', { mode: 'text', version: 2, ecc: 'L2', mask: 1 }));
  assert.equal(text.mode, 'text');
  assert.equal(text.text, 'Hello-World/42');

  const utf8 = 'Han Xin 编码';
  const byte = decodeHanXin(encodeHanXin(utf8, { mode: 'byte', version: 2, ecc: 'L3', mask: 2 }));
  assert.equal(byte.mode, 'byte');
  assert.equal(byte.text, utf8);
  assert.deepEqual([...byte.bytes], [...new TextEncoder().encode(utf8)]);

  const arbitrary = Uint8Array.from([0, 1, 127, 128, 254, 255]);
  const arbitraryResult = decodeHanXin(encodeHanXinBytes(arbitrary, { version: 3, ecc: 'L4', mask: 3 }));
  assert.deepEqual([...arbitraryResult.bytes], [...arbitrary]);
});

test('Han Xin round-trips every compact version and error-correction level', () => {
  for (const version of HANXIN_VERSIONS) {
    for (const [index, ecc] of HANXIN_ECC_LEVELS.entries()) {
      const matrix = encodeHanXin('VM', {
        version,
        ecc,
        mode: 'byte',
        mask: (version + index) % 4,
      });
      const result = decodeHanXin(matrix);
      assert.equal(result.version, version);
      assert.equal(result.ecc, ecc);
      assert.equal(result.mask, (version + index) % 4);
      assert.equal(result.text, 'VM');
    }
  }
});

test('Han Xin decoder handles right-angle rotations and polarity', () => {
  const source = encodeHanXin('ORIENTATION CHECK', { version: 2, ecc: 'L2', mode: 'byte', mask: 1 });
  assert.equal(decodeHanXin(source).rotation, 0);
  for (const degrees of [90, 180, 270]) {
    const result = decodeHanXin(rotate(source, degrees));
    assert.equal(result.text, 'ORIENTATION CHECK');
    assert.equal(result.rotation, degrees === 90 ? 270 : degrees === 270 ? 90 : 180);
  }
  const inverted = decodeHanXin(invert(source));
  assert.equal(inverted.text, 'ORIENTATION CHECK');
  assert.equal(inverted.inverted, true);
  assert.equal(decodeHanXin(invert(source), { inverted: true }).text, 'ORIENTATION CHECK');
});

test('Han Xin detector accepts a clean integer-scale symbol and rejects noise', () => {
  const source = encodeHanXin('DETECT ME', { version: 1, ecc: 'L1', mode: 'byte', mask: 0 });
  const image = source.withMargin(3).scale(3);
  const detection = detectHanXin(image);
  assert.ok(detection);
  assert.equal(detection.result.text, 'DETECT ME');
  assert.equal(detection.moduleSize, 3);
  assert.deepEqual(detection.dimension, { width: 23, height: 23 });
  assert.deepEqual(detection.corners, [
    { x: 9, y: 9 },
    { x: 78, y: 9 },
    { x: 78, y: 78 },
    { x: 9, y: 78 },
  ]);
  assert.equal(detectAndDecodeHanXin(image).text, 'DETECT ME');
  assert.equal(detectAndDecodeHanXin(new BitMatrix(23, 23)), null);
  assert.equal(detectAndDecodeHanXin(new BitMatrix(22, 23)), null);
  assert.throws(() => detectHanXin(null), NotFoundError);
});

test('Han Xin Reed-Solomon repair accepts a single damaged module', () => {
  const source = encodeHanXin('CORRECT ME', { version: 1, ecc: 'L1', mode: 'byte', mask: 0 });
  const damaged = source.clone();
  damaged.flip(...hanXinDataCoordinates(1)[0]);
  const result = decodeHanXin(damaged);
  assert.equal(result.text, 'CORRECT ME');
  assert.ok(result.corrections >= 1);
});

test('Han Xin rejects malformed structure, remainder bits and unsafe input', () => {
  const source = encodeHanXin('STRICT INPUT', { version: 1, ecc: 'L1', mode: 'byte', mask: 0 });

  const badFinder = source.clone();
  badFinder.flip(0, 0);
  assert.throws(() => decodeHanXin(badFinder), FormatError);
  assert.equal(detectAndDecodeHanXin(badFinder), null);

  const badRemainder = source.clone();
  const remainder = hanXinDataCoordinates(1)[HANXIN_TOTAL_CODEWORDS[0] * 8];
  badRemainder.flip(...remainder);
  assert.throws(() => decodeHanXin(badRemainder), /remainder modules/);

  // Both redundant function-information copies are damaged in a fixed tail
  // bit, so no valid copy remains to authorize the symbol.
  const badInfo = source.clone();
  badInfo.flip(17, 8);
  badInfo.flip(5, 14);
  assert.throws(() => decodeHanXin(badInfo), /structural information is unreadable/);

  assert.throws(() => encodeHanXin(''), EncodeError);
  assert.throws(() => encodeHanXin(new Uint8Array()), EncodeError);
  assert.throws(() => encodeHanXin([]), EncodeError);
  assert.throws(() => encodeHanXin([256]), EncodeError);
  assert.throws(() => encodeHanXin([1.5]), EncodeError);
  assert.throws(() => encodeHanXin(new Uint8Array(8192)), /at most 8191/);
  assert.throws(() => encodeHanXin('A', { version: 4 }), /supported versions are 1-3/);
  assert.throws(() => encodeHanXin('A', { ecc: 0 }), /error correction/);
  assert.throws(() => encodeHanXin('A', { mask: 4 }), /mask must be an integer/);
  assert.throws(() => encodeHanXin('not numeric', { mode: 'numeric' }), /digits only/);
  assert.throws(() => encodeHanXin('编', { mode: 'text' }), /supported ASCII/);
});
