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

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decode, encode, encodeCode11, encodeEAN13WithAddon, encodeMSI, listFormats, toImageData,
} from '../src/index.js';

function raster(matrix, scale = 3) {
  return toImageData(matrix, { scale, margin: 6 });
}

function solid(width, height, value) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set([value, value, value, 255], i);
  return { data, width, height };
}

function procedural(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = pixel(x, y);
      data.set([value, value, value, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

function rotate90(image) {
  const data = new Uint8ClampedArray(image.data.length);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const destination = (x * image.height + (image.height - 1 - y)) * 4;
      const source = (y * image.width + x) * 4;
      data.set(image.data.subarray(source, source + 4), destination);
    }
  }
  return { data, width: image.height, height: image.width };
}

function rotateByDegrees(image, degrees) {
  const radians = degrees * Math.PI / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const width = Math.ceil(Math.abs(image.width * cos) + Math.abs(image.height * sin));
  const height = Math.ceil(Math.abs(image.width * sin) + Math.abs(image.height * cos));
  const data = new Uint8ClampedArray(width * height * 4);
  const sourceCenterX = (image.width - 1) / 2;
  const sourceCenterY = (image.height - 1) / 2;
  const destinationCenterX = (width - 1) / 2;
  const destinationCenterY = (height - 1) / 2;
  for (let y = 0; y < height; y++) {
    const dy = y - destinationCenterY;
    for (let x = 0; x < width; x++) {
      const dx = x - destinationCenterX;
      const sourceX = Math.round(cos * dx + sin * dy + sourceCenterX);
      const sourceY = Math.round(-sin * dx + cos * dy + sourceCenterY);
      if (sourceX < 0 || sourceX >= image.width || sourceY < 0 || sourceY >= image.height) continue;
      const source = (sourceY * image.width + sourceX) * 4;
      data.set(image.data.subarray(source, source + 4), (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

const readable = listFormats().filter((format) => format.canRead).map((format) => format.id);
const camera = (image, formats = readable) => decode(image, {
  formats, profile: 'camera', tryHarder: true, binarizer: 'global',
});

test('camera profile rejects empty, textured and noisy frames', () => {
  let state = 0x12345678;
  const frames = [
    solid(96, 64, 255), solid(96, 64, 0), solid(96, 64, 127),
    procedural(96, 64, (x, y) => ((x >> 3) + (y >> 3)) % 2 ? 96 : 160),
    procedural(96, 64, () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state >>> 24;
    }),
    procedural(96, 64, (x, y) => Math.min(255, Math.max(0, 60 + x * 2 + y + (x - 48) ** 2 / 18))),
  ];
  for (const frame of frames) assert.deepEqual(camera(frame), []);
});

test('camera profile returns validated EAN parents, optional supplements and quality metadata', () => {
  const plain = camera(raster(encode('9781234567897', { format: 'ean13' })), ['ean13', 'ean2', 'ean5']);
  assert.equal(plain.length, 1);
  assert.equal(plain[0].format, 'ean13');
  assert.equal(plain[0].text, '9781234567897');
  assert.equal(plain[0].addon, undefined);
  assert.ok(plain[0].confidence >= 0.9);
  assert.equal(plain[0].quality.quietZone, true);
  assert.equal(plain[0].quality.checksum, true);
  assert.ok(plain[0].quality.rows >= 2);
  assert.equal(plain[0].quality.consistency, 1);
  assert.ok(plain[0].bounds.width > 90);
  assert.equal(plain[0].rotation, 0);

  const two = camera(raster(encodeEAN13WithAddon('9781234567897', '05')), ['ean13', 'ean2', 'ean5']);
  assert.equal(two.length, 1);
  assert.equal(two[0].format, 'ean13');
  assert.equal(two[0].addon?.format, 'ean2');
  assert.equal(two[0].addon?.text, '05');
  const five = camera(raster(encodeEAN13WithAddon('9781234567897', '52999')), ['ean13', 'ean2', 'ean5']);
  assert.equal(five.length, 1);
  assert.equal(five[0].addon?.format, 'ean5');
  assert.equal(five[0].addon?.text, '52999');
});

test('camera profile reads complete 1D symbols at quarter turns without accepting fragments', () => {
  const source = raster(encode('9781234567897', { format: 'ean13' }));
  const clockwise = camera(rotate90(source), ['ean13']);
  assert.equal(clockwise.length, 1);
  assert.equal(clockwise[0].format, 'ean13');
  assert.equal(clockwise[0].text, '9781234567897');
  assert.equal(clockwise[0].rotation, 90);
  const counterclockwise = camera(rotate90(rotate90(rotate90(source))), ['ean13']);
  assert.equal(counterclockwise.length, 1);
  assert.equal(counterclockwise[0].text, '9781234567897');
  assert.equal(counterclockwise[0].rotation, 270);

  const shortCode39 = camera(raster(encode('A', { format: 'code39' })), ['code39']);
  assert.equal(shortCode39.length, 1);
  assert.equal(shortCode39[0].text, 'A');

  const clipped = raster(encode('8410066143504', { format: 'ean13' }));
  for (let y = 0; y < clipped.height; y++) {
    for (let x = Math.floor(clipped.width / 2); x < clipped.width; x++) {
      const pixel = (y * clipped.width + x) * 4;
      clipped.data[pixel] = clipped.data[pixel + 1] = clipped.data[pixel + 2] = 255;
    }
  }
  assert.deepEqual(camera(clipped, ['ean13', 'code11', 'msi', 'codabar']), []);
});

test('camera profile detects all 45-degree orientations without mutating or duplicating input', () => {
  const source = raster(encode('9781234567897', { format: 'ean13' }));
  const original = Uint8ClampedArray.from(source.data);
  for (const rotation of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const image = rotateByDegrees(source, rotation);
    const found = camera(image, ['ean13']);
    assert.equal(found.length, 1, `${rotation} degrees should produce one result`);
    assert.equal(found[0].text, '9781234567897');
    assert.equal(found[0].rotation, rotation);
  }
  assert.deepEqual(source.data, original, 'decode must preserve the original input');
});

test('camera profile preserves check-validated Code 11 and MSI reads', () => {
  const code11 = camera(raster(encodeCode11('12345', { checkDigit: true })), ['code11']);
  assert.equal(code11.length, 1);
  assert.equal(code11[0].format, 'code11');
  assert.equal(code11[0].text, '12345');
  assert.equal(code11[0].quality.checksum, true);

  const msi = camera(raster(encodeMSI('12345', { checkDigit: true })), ['msi']);
  assert.equal(msi.length, 1);
  assert.equal(msi[0].format, 'msi');
  assert.equal(msi[0].text, '12345');
  assert.equal(msi[0].quality.checksum, true);
});

test('camera profile prioritizes an EAN parent over coincidental 1D candidates', () => {
  const image = raster(encode('9781234567897', { format: 'ean13' }));
  const results = camera(image);
  assert.equal(results.length, 1, JSON.stringify(results));
  assert.equal(results[0].format, 'ean13');
  assert.equal(results[0].text, '9781234567897');
});
