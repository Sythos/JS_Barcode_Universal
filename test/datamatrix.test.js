/*!
 * Sythos Barcode Suite — tests
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * SPDX-License-Identifier: MIT
 */

/** Data Matrix ECC 200 tests: tables, codec, ECC and image detection. */

import test from 'node:test';
import assert from 'node:assert/strict';

import { decode } from '../src/index.js';
import { BitMatrix } from '../src/js/core/bit-matrix.js';
import { LuminanceSource } from '../src/js/image/luminance.js';
import { binarize } from '../src/js/image/binarizer.js';
import {
  SYMBOLS,
  symbolForDataCodewords,
  validateTables,
} from '../src/js/datamatrix/tables.js';
import { encodeDataMatrix } from '../src/js/datamatrix/encoder.js';
import { decodeDataMatrix } from '../src/js/datamatrix/decoder.js';
import { detectDataMatrix, detectAndDecodeDataMatrix } from '../src/js/datamatrix/detector.js';

/** Render a symbol as an opaque, black-on-white RGBA image. */
function toImageData(matrix, scale = 8, quiet = 2) {
  const width = (matrix.width + quiet * 2) * scale;
  const height = (matrix.height + quiet * 2) * scale;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 0; y < matrix.height; y++) {
    for (let x = 0; x < matrix.width; x++) {
      if (!matrix.get(x, y)) continue;
      for (let yy = 0; yy < scale; yy++) {
        for (let xx = 0; xx < scale; xx++) {
          const p = (((y + quiet) * scale + yy) * width + (x + quiet) * scale + xx) * 4;
          data[p] = data[p + 1] = data[p + 2] = 0;
        }
      }
    }
  }
  return { data, width, height };
}

/** Toggle modules at well-spaced positions, avoiding the finder borders. */
function damage(matrix, count) {
  const out = matrix.clone();
  const positions = [];
  for (let y = 1; y < out.height - 1; y++) {
    for (let x = 1; x < out.width - 1; x++) positions.push([x, y]);
  }
  const stride = Math.max(1, Math.floor(positions.length / count));
  for (let i = 0; i < count; i++) {
    const [x, y] = positions[Math.min(i * stride, positions.length - 1)];
    out.flip(x, y);
  }
  return out;
}

test('data matrix tables: all ECC 200 symbols satisfy geometry and capacity invariants', () => {
  const problems = validateTables();
  assert.deepEqual(problems, [], `\n  - ${problems.join('\n  - ')}`);
  assert.ok(SYMBOLS.length >= 30, 'ECC 200 requires square and rectangular symbols');

  for (const symbol of SYMBOLS) {
    assert.ok(symbol.width >= 8 && symbol.height >= 8, `${symbol.width}x${symbol.height}: dimensions`);
    assert.ok(symbol.dataCodewords > 0 && symbol.errorCodewords > 0,
      `${symbol.width}x${symbol.height}: non-zero data and ECC`);
    assert.equal(symbol.width % symbol.regionWidth, 0, `${symbol.width}x${symbol.height}: region width divides symbol`);
    assert.equal(symbol.height % symbol.regionHeight, 0, `${symbol.width}x${symbol.height}: region height divides symbol`);
  }

  // Independent ISO/IEC 16022 ECC 200 capacity landmarks.
  const expected = [[10, 10, 3], [12, 12, 5], [16, 16, 12], [26, 26, 44], [32, 32, 62], [144, 144, 1558], [18, 8, 5], [32, 8, 10]];
  for (const [width, height, dataCodewords] of expected) {
    const symbol = SYMBOLS.find((s) => s.width === width && s.height === height);
    assert.ok(symbol, `published ${width}x${height} symbol is present`);
    assert.equal(symbol.dataCodewords, dataCodewords, `${width}x${height} data capacity`);
  }
});

test('data matrix tables: capacity choice never returns an undersized symbol', () => {
  for (const n of [1, 3, 4, 5, 12, 44, 45, 62, 1558]) {
    const symbol = symbolForDataCodewords(n);
    assert.ok(symbol.dataCodewords >= n, `${n} data codewords fit`);
  }
  assert.throws(() => symbolForDataCodewords(1559));
});

test('data matrix: ASCII and digit-pair messages round-trip in their smallest symbols', () => {
  const ascii = encodeDataMatrix('ABC');
  assert.equal(ascii.width, 10);
  assert.equal(ascii.height, 10);
  assert.equal(decodeDataMatrix(ascii).text, 'ABC');

  // Three digit-pairs occupy three ASCII codewords, unlike six ordinary bytes.
  const digits = encodeDataMatrix('123456');
  assert.equal(digits.width, 10);
  assert.equal(digits.height, 10);
  assert.equal(decodeDataMatrix(digits).text, '123456');
});

test('data matrix: Base256 preserves arbitrary bytes without text normalization', () => {
  const bytes = Uint8Array.from([0, 1, 31, 127, 128, 255, 0, 42]);
  const matrix = encodeDataMatrix(bytes, { encoding: 'base256' });
  const result = decodeDataMatrix(matrix);
  assert.deepEqual([...result.bytes], [...bytes]);
});

test('data matrix: GS1 shifts Base256 randomization to absolute codeword positions', () => {
  const bytes = Uint8Array.from([0, 1, 127, 128, 254, 255]);
  const result = decodeDataMatrix(encodeDataMatrix(bytes, { encoding: 'base256', gs1: true }));
  assert.equal(result.gs1, true);
  assert.deepEqual([...result.bytes], [...bytes]);
});

test('data matrix: multi-block and uneven 144x144 interleaving preserve stream order', () => {
  // 205 single-byte ASCII codewords select 64x64 (two RS blocks).
  const multiBlock = 'M'.repeat(205);
  const medium = encodeDataMatrix(multiBlock, { shape: 'square' });
  assert.equal(medium.width, 64);
  assert.equal(decodeDataMatrix(medium).text, multiBlock);

  // 1305 codewords select 144x144, whose last two of ten blocks are shorter.
  const unevenBlocks = 'U'.repeat(1305);
  const largest = encodeDataMatrix(unevenBlocks, { shape: 'square' });
  assert.equal(largest.width, 144);
  assert.equal(decodeDataMatrix(largest).text, unevenBlocks);
});

test('data matrix: forced rectangular ECC 200 symbols encode and decode', () => {
  const matrix = encodeDataMatrix('RECTANGULAR', { shape: 'rectangular' });
  assert.notEqual(matrix.width, matrix.height, 'forced rectangular shape is honoured');
  assert.equal(decodeDataMatrix(matrix).text, 'RECTANGULAR');
  const bits = binarize(LuminanceSource.fromImageData(toImageData(matrix)), 'global');
  assert.equal(detectAndDecodeDataMatrix(bits).text, 'RECTANGULAR');
});

test('data matrix: GS1 uses FNC1 in first position without changing the payload', () => {
  const result = decodeDataMatrix(encodeDataMatrix('0101234567890128', { gs1: true }));
  assert.equal(result.text, '0101234567890128');
  assert.equal(result.gs1, true);
});

test('data matrix: clean symbols require no Reed-Solomon repairs', () => {
  const result = decodeDataMatrix(encodeDataMatrix('ECC CLEAN 1234567890'));
  assert.equal(result.corrections, 0);
});

test('data matrix: Reed-Solomon corrects damage but rejects excessive corruption', () => {
  const pristine = encodeDataMatrix('ERROR CORRECTION 1234567890 ABCDEFGHIJ');
  const repaired = decodeDataMatrix(damage(pristine, 3));
  assert.equal(repaired.text, 'ERROR CORRECTION 1234567890 ABCDEFGHIJ');
  assert.ok(repaired.corrections > 0, 'damage must cause reported repairs');
  assert.throws(() => decodeDataMatrix(damage(pristine, 60)));
});

test('data matrix detector: binarized rendered symbol is located, sampled and decoded', () => {
  const matrix = encodeDataMatrix('IMAGE PIPELINE 42');
  const bits = binarize(LuminanceSource.fromImageData(toImageData(matrix)), 'auto');
  const detected = detectDataMatrix(bits);
  assert.ok(detected.matrix instanceof BitMatrix, 'detector returns a sampled matrix');
  assert.equal(decodeDataMatrix(detected.matrix).text, 'IMAGE PIPELINE 42');
  assert.equal(detectAndDecodeDataMatrix(bits).text, 'IMAGE PIPELINE 42');
});

test('data matrix detector: rejects smaller clock-border harmonics', () => {
  for (const [dimension, length] of [[80, 369], [120, 817], [144, 1305]]) {
    const text = 'H'.repeat(length);
    const matrix = encodeDataMatrix(text, { shape: 'square' });
    assert.equal(matrix.width, dimension, `fixture selects ${dimension}x${dimension}`);
    const image = toImageData(matrix, 3, 2);
    const bits = binarize(LuminanceSource.fromImageData(image), 'global');
    const detected = detectDataMatrix(bits);
    assert.equal(detected?.width, dimension, `${dimension}x${dimension} is not aliased smaller`);
    assert.equal(detected?.height, dimension);
    assert.equal(detectAndDecodeDataMatrix(bits)?.text, text);
  }
});

test('data matrix detector: accepts the standard right clock phase from an external symbol', () => {
  // Independently generated 16x16 ECC 200 symbol for
  // "12345678901234567890".  Its right clock edge is light at the top and
  // dark where it meets the solid bottom border.
  const matrix = BitMatrix.parse([
    '#.#.#.#.#.#.#.#.',
    '##..#..#.#.##.##',
    '##..##...#..#...',
    '##...###..###.##',
    '###.#...#.#..##.',
    '#...##..###.##.#',
    '#.##....#.......',
    '#..##..#..#.####',
    '#...##..####..#.',
    '####...######.##',
    '#.#..##..######.',
    '#...##...#..####',
    '##.#.##..##..##.',
    '#.##.#..##.#.#.#',
    '###.######..#.#.',
    '################',
  ].join('\n'));
  const image = toImageData(matrix, 16, 8);
  const bits = binarize(LuminanceSource.fromImageData(image), 'global');
  const detected = detectDataMatrix(bits);
  assert.ok(detected, 'standard ECC 200 border phase is detected');
  assert.equal(detected.width, 16);
  assert.equal(detected.height, 16);
  assert.equal(detectAndDecodeDataMatrix(bits).text, '12345678901234567890');
  assert.equal(decode(image, { formats: ['datamatrix'] })[0]?.text,
    '12345678901234567890', 'public auto pipeline decodes the large-module raster');
});
