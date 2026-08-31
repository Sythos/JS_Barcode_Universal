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

/**
 * Renderer tests.
 *
 * The PNG round-trip is the one that matters. A renderer can emit a file that
 * every viewer opens and still have the pixels wrong, so these tests decode
 * what was written — inflate the IDAT, unpack the 1-bit scanlines — and compare
 * every pixel against the source matrix. The CRC32 used to verify the chunks is
 * written here rather than imported from `png.js`: checking a checksum against
 * the implementation that produced it proves nothing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';

import { BitMatrix } from '../src/js/core/bit-matrix.js';
import { normalizeOptions, parseColor } from '../src/js/render/options.js';
import { toSVG, toSVGDataURI } from '../src/js/render/svg.js';
import { toImageData } from '../src/js/render/image-data.js';
import { toPNG, toPNGDataURI, deflateStored } from '../src/js/render/png.js';
import { isWebGL2Available } from '../src/js/render/webgl.js';
import { isWebGPUAvailable } from '../src/js/render/webgpu.js';

/* ------------------------------------------------------------------ *
 * Fixtures and helpers
 * ------------------------------------------------------------------ */

/** A small asymmetric pattern: rotations and flips of it are all distinct. */
const SAMPLE = BitMatrix.parse(`
  #.#
  ..#
  ##.
`);

/** Two rows, so `normalizeOptions` does not treat it as a linear symbol. */
const SINGLE = BitMatrix.parse(`
  #.
  ..
`);

/**
 * Deterministic pseudo-random bytes. The high byte of the LCG is used because
 * the low bits of a linear congruential generator are close to degenerate and
 * would make a poor test of a compressor.
 *
 * @param {number} n @param {number} [seed]
 * @returns {Uint8Array}
 */
function pseudoBytes(n, seed = 0x2f6e2b1) {
  const out = new Uint8Array(n);
  let s = seed >>> 0;
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = (s >>> 24) & 0xff;
  }
  return out;
}

/**
 * Compare byte sequences, reporting the first difference rather than dumping
 * two hundred kilobytes of diff.
 *
 * @param {Uint8Array} actual @param {Uint8Array} expected @param {string} label
 */
function assertBytesEqual(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label}: length differs`);
  let at = -1;
  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) { at = i; break; }
  }
  assert.equal(at, -1, at === -1 ? '' :
    `${label}: first difference at byte ${at} — got ${actual[at]}, expected ${expected[at]}`);
}

/**
 * CRC32 as PNG defines it, written from the polynomial rather than imported
 * from `png.js`. No lookup table: this is deliberately a different shape of
 * implementation from the one under test.
 *
 * @param {Uint8Array} bytes
 * @returns {number}
 */
function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) {
      // Branchless: -(crc & 1) is all-ones when the low bit is set.
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Walk the chunk structure of a PNG, recomputing each CRC.
 *
 * @param {Uint8Array} png
 * @returns {Array<{type: string, data: Uint8Array, storedCRC: number, actualCRC: number}>}
 */
function readChunks(png) {
  assert.ok(png.length > 8, 'file is too short to contain a signature');
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks = [];
  let p = 8;
  while (p < png.length) {
    assert.ok(p + 8 <= png.length, `truncated chunk header at offset ${p}`);
    const length = view.getUint32(p);
    assert.ok(p + 12 + length <= png.length,
      `chunk at ${p} declares ${length} bytes, past the end of the file`);
    let type = '';
    for (let i = 0; i < 4; i++) type += String.fromCharCode(png[p + 4 + i]);
    chunks.push({
      type,
      data: png.subarray(p + 8, p + 8 + length),
      storedCRC: view.getUint32(p + 8 + length),
      // The CRC covers the type and the payload, but not the length field.
      actualCRC: crc32(png.subarray(p + 4, p + 8 + length)),
    });
    p += 12 + length;
  }
  assert.equal(p, png.length, 'trailing bytes after the last chunk');
  return chunks;
}

/**
 * Inflate, turning a rejected stream into a legible failure. A stored-block
 * writer that sets BFINAL on every block makes `inflateSync` throw a bare
 * Z_DATA_ERROR, which says nothing about what is actually wrong.
 *
 * @param {Uint8Array} stream @param {string} label
 * @returns {Uint8Array}
 */
function inflate(stream, label) {
  try {
    return new Uint8Array(inflateSync(stream));
  } catch (error) {
    assert.fail(`${label}: inflate rejected the stream (${error.code ?? error.message}) — ` +
      'the deflate stream is malformed');
  }
}

/** @param {Uint8Array[]} parts @returns {Uint8Array} */
function concat(parts) {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

/**
 * Decode a PNG produced by `toPNG` and assert every pixel matches the source.
 *
 * Only valid for matrices taller than one module: a one-row matrix is stretched
 * to `barHeight` before the quiet zone is added, so the pixel-to-module mapping
 * below would not hold.
 *
 * @param {Uint8Array} png
 * @param {BitMatrix} matrix
 * @param {{scale: number, margin: number}} options
 */
function assertPixelsMatch(png, matrix, { scale, margin }) {
  const chunks = readChunks(png);

  const ihdr = chunks.find((c) => c.type === 'IHDR');
  assert.ok(ihdr, 'no IHDR');
  const header = new DataView(ihdr.data.buffer, ihdr.data.byteOffset, ihdr.data.byteLength);
  const width = header.getUint32(0);
  const height = header.getUint32(4);
  assert.equal(width, (matrix.width + margin * 2) * scale, 'IHDR width');
  assert.equal(height, (matrix.height + margin * 2) * scale, 'IHDR height');

  const idat = chunks.filter((c) => c.type === 'IDAT');
  assert.ok(idat.length > 0, 'no IDAT');
  const raw = inflate(concat(idat.map((c) => c.data)), 'IDAT');

  const bytesPerRow = (width + 7) >> 3;
  assert.equal(raw.length, (bytesPerRow + 1) * height,
    'inflated data is not one filter byte plus one packed scanline per row');

  let problem = null;
  outer:
  for (let py = 0; py < height; py++) {
    const rowStart = py * (bytesPerRow + 1);
    if (raw[rowStart] !== 0) {
      problem = `row ${py}: filter byte is ${raw[rowStart]}, expected 0 (None)`;
      break;
    }
    const my = Math.floor(py / scale) - margin;
    for (let px = 0; px < width; px++) {
      // Palette index 0 is light, 1 is dark; the leftmost pixel is the MSB.
      const bit = (raw[rowStart + 1 + (px >> 3)] >> (7 - (px & 7))) & 1;
      const mx = Math.floor(px / scale) - margin;
      // get() reports false outside the matrix, which is exactly the quiet zone.
      const expected = matrix.get(mx, my) ? 1 : 0;
      if (bit !== expected) {
        problem = `pixel (${px},${py}) is ${bit}, expected ${expected} ` +
          `(module ${mx},${my})`;
        break outer;
      }
    }
  }
  assert.equal(problem, null, problem ?? '');
}

/** @param {{data: Uint8ClampedArray, width: number}} image @param {number} x @param {number} y */
function pixelAt(image, x, y) {
  const p = (y * image.width + x) * 4;
  return [image.data[p], image.data[p + 1], image.data[p + 2], image.data[p + 3]];
}

/* ------------------------------------------------------------------ *
 * SVG
 * ------------------------------------------------------------------ */

test('svg: document is structurally well formed', () => {
  const svg = toSVG(SAMPLE, { scale: 5, margin: 2 });

  assert.ok(svg.startsWith('<svg '), 'must start with the svg element');
  assert.ok(svg.endsWith('</svg>'), 'must end with the closing tag');
  assert.equal(svg.split('<svg ').length - 1, 1, 'exactly one root element');
  assert.equal(svg.split('</svg>').length - 1, 1, 'exactly one closing tag');
  assert.equal((svg.match(/</g) || []).length, (svg.match(/>/g) || []).length,
    'every angle bracket is paired');
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'), 'namespace declared');
  assert.ok(!svg.includes('undefined'), 'no undefined interpolated into the markup');
  // Every child element is self-closing, so nothing is left open before </svg>.
  const body = svg.slice(svg.indexOf('>') + 1, svg.length - '</svg>'.length);
  assert.equal((body.match(/</g) || []).length, (body.match(/\/>/g) || []).length,
    'every child element closes itself');
});

test('svg: dimensions follow scale and margin', () => {
  const svg = toSVG(SAMPLE, { scale: 5, margin: 2 });
  // 3 modules + 2 of margin on each side = 7, at 5 pixels each.
  assert.ok(svg.includes('width="35"'), svg.slice(0, 200));
  assert.ok(svg.includes('height="35"'), svg.slice(0, 200));
  assert.ok(svg.includes('viewBox="0 0 35 35"'), svg.slice(0, 200));

  const bare = toSVG(SAMPLE, { scale: 3, margin: 0 });
  assert.ok(bare.includes('width="9"'));
  assert.ok(bare.includes('viewBox="0 0 9 9"'));
});

test('svg: dark modules become a single path with runs merged', () => {
  const one = toSVG(SINGLE, { scale: 10, margin: 0 });
  assert.equal((one.match(/<path /g) || []).length, 1, 'exactly one path element');
  assert.ok(one.includes('d="M0 0h10v10h-10z"'), one);

  // Two adjacent modules must produce one 20-wide run, not two subpaths.
  const pair = toSVG(BitMatrix.parse('##\n..'), { scale: 10, margin: 0 });
  assert.ok(pair.includes('d="M0 0h20v10h-20z"'), pair);
});

test('svg: colours appear as given', () => {
  const svg = toSVG(SAMPLE, { scale: 4, margin: 1, dark: '#ff0000', light: '#00ff00' });
  assert.ok(svg.includes('fill="#ff0000"'), 'dark colour missing');
  assert.ok(svg.includes('fill="#00ff00"'), 'light colour missing');
  assert.ok(svg.includes('<rect '), 'background rect missing');

  // 'none' means no background at all rather than a rect painted with 'none'.
  const transparent = toSVG(SAMPLE, { scale: 4, margin: 1, light: 'none' });
  assert.ok(!transparent.includes('<rect'), 'transparent output must have no background');
  assert.ok(transparent.includes('<path '), 'foreground path still required');
});

test('svg: attribute values are escaped', () => {
  const svg = toSVG(SAMPLE, { scale: 2, margin: 0, dark: 'url(#a&b)"' });
  assert.ok(svg.includes('&amp;'), 'ampersand not escaped');
  assert.ok(svg.includes('&quot;'), 'quote not escaped');
  assert.equal((svg.match(/</g) || []).length, (svg.match(/>/g) || []).length);
});

test('svg: barHeight controls the height of a one-row symbol', () => {
  const linear = BitMatrix.parse('#.#.#');
  assert.equal(linear.height, 1);

  const svg = toSVG(linear, { scale: 4, margin: 0, barHeight: 40 });
  assert.ok(svg.includes('height="40"'), svg.slice(0, 200));
  assert.ok(svg.includes('width="20"'), svg.slice(0, 200));
  assert.ok(svg.includes('viewBox="0 0 20 40"'), svg.slice(0, 200));

  // The quiet zone is added after the stretch, so it is uniform on all sides.
  const padded = toSVG(linear, { scale: 4, margin: 3, barHeight: 40 });
  assert.ok(padded.includes('width="44"'), padded.slice(0, 200));   // (5 + 6) * 4
  assert.ok(padded.includes('height="64"'), padded.slice(0, 200));  // (10 + 6) * 4

  // A taller request must produce a taller image.
  const tall = toSVG(linear, { scale: 4, margin: 0, barHeight: 80 });
  assert.ok(tall.includes('height="80"'), tall.slice(0, 200));
});

test('svg: data URI carries exactly the same document', () => {
  const options = { scale: 6, margin: 2, dark: '#123456' };
  const uri = toSVGDataURI(SAMPLE, options);
  const prefix = 'data:image/svg+xml;base64,';

  assert.ok(uri.startsWith(prefix), uri.slice(0, 40));
  const base64 = uri.slice(prefix.length);
  assert.match(base64, /^[A-Za-z0-9+/]+={0,2}$/, 'payload is not plain base64');
  assert.equal(Buffer.from(base64, 'base64').toString('utf8'), toSVG(SAMPLE, options));
});

/* ------------------------------------------------------------------ *
 * Colours
 * ------------------------------------------------------------------ */

test('parseColor: hex forms', () => {
  assert.deepEqual(parseColor('#f00'), [255, 0, 0, 255]);
  assert.deepEqual(parseColor('#ABC'), [170, 187, 204, 255]);
  assert.deepEqual(parseColor('#f008'), [255, 0, 0, 136]);
  assert.deepEqual(parseColor('#1a2b3c'), [26, 43, 60, 255]);
  assert.deepEqual(parseColor('#1A2B3C'), [26, 43, 60, 255]);
  assert.deepEqual(parseColor('#1a2b3c80'), [26, 43, 60, 128]);
  assert.deepEqual(parseColor('#ffffffff'), [255, 255, 255, 255]);
});

test('parseColor: functional forms', () => {
  assert.deepEqual(parseColor('rgb(1, 2, 3)'), [1, 2, 3, 255]);
  assert.deepEqual(parseColor('rgb(255,255,255)'), [255, 255, 255, 255]);
  assert.deepEqual(parseColor('rgba(10, 20, 30, 0.5)'), [10, 20, 30, 128]);
  assert.deepEqual(parseColor('rgba(0, 0, 0, 0)'), [0, 0, 0, 0]);
  assert.deepEqual(parseColor('rgb(100%, 0%, 50%)'), [255, 0, 128, 255]);
});

test('parseColor: keywords', () => {
  assert.deepEqual(parseColor('none'), [0, 0, 0, 0]);
  assert.deepEqual(parseColor('transparent'), [0, 0, 0, 0]);
  assert.deepEqual(parseColor('TRANSPARENT'), [0, 0, 0, 0], 'case insensitive');
  assert.deepEqual(parseColor('  none  '), [0, 0, 0, 0], 'surrounding space ignored');
});

test('parseColor: an unrecognised colour falls back instead of throwing', () => {
  // Losing a barcode to an unusual colour string would be the worse failure.
  let value;
  assert.doesNotThrow(() => { value = parseColor('chartreuse'); });
  assert.deepEqual(value, [0, 0, 0, 255]);

  for (const input of ['', 'not a colour', '#12345', 'hsl(120, 50%, 50%)', 'rgb()']) {
    assert.doesNotThrow(() => parseColor(input), `threw on ${JSON.stringify(input)}`);
    assert.equal(parseColor(input).length, 4, `wrong shape for ${JSON.stringify(input)}`);
  }
});

/* ------------------------------------------------------------------ *
 * ImageData
 * ------------------------------------------------------------------ */

test('imageData: dimensions follow scale and margin', () => {
  const image = toImageData(SAMPLE, { scale: 3, margin: 1 });
  assert.equal(image.width, 15);   // (3 + 2) * 3
  assert.equal(image.height, 15);
  assert.equal(image.data.length, 15 * 15 * 4);

  const bigger = toImageData(SAMPLE, { scale: 8, margin: 4 });
  assert.equal(bigger.width, 88);  // (3 + 8) * 8
  assert.equal(bigger.height, 88);
});

test('imageData: dark and quiet-zone pixels carry the right bytes', () => {
  const image = toImageData(SAMPLE, { scale: 3, margin: 1 });

  // Module (0,0) of SAMPLE is dark; with a 1-module margin at scale 3 it covers
  // pixels x,y in [3,6).
  assert.deepEqual(pixelAt(image, 3, 3), [0, 0, 0, 255], 'top-left of a dark module');
  assert.deepEqual(pixelAt(image, 5, 5), [0, 0, 0, 255], 'bottom-right of the same module');

  // Module (1,0) is clear.
  assert.deepEqual(pixelAt(image, 7, 4), [255, 255, 255, 255], 'clear module');

  // Quiet zone, on every side.
  assert.deepEqual(pixelAt(image, 0, 0), [255, 255, 255, 255], 'top-left quiet zone');
  assert.deepEqual(pixelAt(image, 14, 14), [255, 255, 255, 255], 'bottom-right quiet zone');
  assert.deepEqual(pixelAt(image, 4, 1), [255, 255, 255, 255], 'above a dark module');
});

test('imageData: every pixel matches the matrix', () => {
  const scale = 3;
  const margin = 2;
  const image = toImageData(SAMPLE, { scale, margin });
  let problem = null;
  outer:
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const dark = SAMPLE.get(Math.floor(x / scale) - margin, Math.floor(y / scale) - margin);
      const expected = dark ? [0, 0, 0, 255] : [255, 255, 255, 255];
      const actual = pixelAt(image, x, y);
      for (let c = 0; c < 4; c++) {
        if (actual[c] !== expected[c]) {
          problem = `pixel (${x},${y}) is [${actual}], expected [${expected}]`;
          break outer;
        }
      }
    }
  }
  assert.equal(problem, null, problem ?? '');
});

test('imageData: custom colours are honoured, alpha included', () => {
  const image = toImageData(SAMPLE, {
    scale: 2,
    margin: 1,
    dark: '#ff0000',
    light: 'rgba(0, 0, 255, 0.5)',
  });
  assert.deepEqual(pixelAt(image, 2, 2), [255, 0, 0, 255], 'dark module');
  assert.deepEqual(pixelAt(image, 0, 0), [0, 0, 255, 128], 'translucent quiet zone');

  const cutout = toImageData(SINGLE, { scale: 2, margin: 1, light: 'none' });
  assert.deepEqual(pixelAt(cutout, 0, 0), [0, 0, 0, 0], 'fully transparent background');
});

/* ------------------------------------------------------------------ *
 * PNG
 * ------------------------------------------------------------------ */

test('png: begins with the eight-byte signature', async () => {
  const png = await toPNG(SAMPLE, { scale: 4, margin: 2 });
  assert.ok(png instanceof Uint8Array);
  assert.deepEqual(Array.from(png.subarray(0, 8)), PNG_SIGNATURE);
});

test('png: chunk structure is complete and correctly ordered', async () => {
  const png = await toPNG(SAMPLE, { scale: 4, margin: 2 });
  const chunks = readChunks(png);
  const types = chunks.map((c) => c.type);

  assert.ok(types.includes('IHDR'), `IHDR missing from ${types}`);
  assert.ok(types.includes('PLTE'), `PLTE missing from ${types}`);
  assert.ok(types.includes('IDAT'), `IDAT missing from ${types}`);
  assert.ok(types.includes('IEND'), `IEND missing from ${types}`);

  assert.equal(types[0], 'IHDR', 'IHDR must come first');
  assert.equal(types[types.length - 1], 'IEND', 'IEND must come last');
  assert.equal(types.indexOf('IEND'), types.length - 1, 'only one IEND, at the end');
  assert.ok(types.indexOf('PLTE') < types.indexOf('IDAT'), 'PLTE must precede IDAT');
  assert.equal(chunks[chunks.length - 1].data.length, 0, 'IEND carries no payload');
});

test('png: every chunk CRC matches an independently computed one', async () => {
  // The CRC here is computed by this file's own implementation, so a broken
  // crc32 in png.js cannot agree with itself and pass.
  for (const options of [
    { scale: 4, margin: 2 },
    { scale: 1, margin: 0 },
    { scale: 7, margin: 3, dark: '#102030', light: '#a0b0c0' },
    { scale: 5, margin: 4, light: 'none' },
  ]) {
    const png = await toPNG(SAMPLE, options);
    const chunks = readChunks(png);
    assert.ok(chunks.length >= 4, 'too few chunks');
    for (const c of chunks) {
      assert.equal(c.actualCRC, c.storedCRC,
        `${c.type} CRC is 0x${c.storedCRC.toString(16)}, expected ` +
        `0x${c.actualCRC.toString(16)} (options ${JSON.stringify(options)})`);
    }
  }
});

test('png: a corrupted payload no longer matches its stored CRC', async () => {
  // Confirms the check above can actually fail.
  const png = await toPNG(SAMPLE, { scale: 4, margin: 2 });
  const damaged = png.slice();
  damaged[20] ^= 0xff;
  const chunks = readChunks(damaged);
  assert.ok(chunks.some((c) => c.actualCRC !== c.storedCRC),
    'flipping a payload byte should break a CRC');
});

test('png: IHDR declares a 1-bit palette image of the expected size', async () => {
  const scale = 6;
  const margin = 3;
  const png = await toPNG(SAMPLE, { scale, margin });
  const ihdr = readChunks(png).find((c) => c.type === 'IHDR');

  assert.equal(ihdr.data.length, 13, 'IHDR is thirteen bytes');
  const view = new DataView(ihdr.data.buffer, ihdr.data.byteOffset, ihdr.data.byteLength);
  assert.equal(view.getUint32(0), (SAMPLE.width + margin * 2) * scale, 'width');
  assert.equal(view.getUint32(4), (SAMPLE.height + margin * 2) * scale, 'height');
  assert.equal(ihdr.data[8], 1, 'bit depth');
  assert.equal(ihdr.data[9], 3, 'colour type: palette');
  assert.equal(ihdr.data[10], 0, 'compression method: deflate');
  assert.equal(ihdr.data[11], 0, 'filter method');
  assert.equal(ihdr.data[12], 0, 'interlace method: none');
});

test('png: the palette holds the requested colours, light first', async () => {
  const png = await toPNG(SAMPLE, { scale: 2, margin: 1, dark: '#123456', light: '#abcdef' });
  const chunks = readChunks(png);
  const plte = chunks.find((c) => c.type === 'PLTE');

  assert.equal(plte.data.length, 6, 'two entries of three bytes');
  assert.deepEqual(Array.from(plte.data), [0xab, 0xcd, 0xef, 0x12, 0x34, 0x56]);
  assert.ok(!chunks.some((c) => c.type === 'tRNS'), 'no tRNS when everything is opaque');
});

test('png: translucency is declared with tRNS', async () => {
  const png = await toPNG(SAMPLE, { scale: 2, margin: 1, light: 'none' });
  const trns = readChunks(png).find((c) => c.type === 'tRNS');
  assert.ok(trns, 'tRNS expected when the background is transparent');
  assert.deepEqual(Array.from(trns.data), [0, 255], 'light transparent, dark opaque');
});

test('png: round-trips back to the source matrix', async () => {
  for (const options of [
    { scale: 1, margin: 0 },
    { scale: 1, margin: 4 },
    { scale: 4, margin: 2 },
    { scale: 5, margin: 3 },
    { scale: 3, margin: 1, dark: '#ff0000', light: '#00ff00' },
  ]) {
    const png = await toPNG(SAMPLE, options);
    assertPixelsMatch(png, SAMPLE, options);
  }
});

test('png: round-trips a matrix whose width is not a multiple of eight', async () => {
  // 11 modules at scale 1 with no margin: the last scanline byte is part fill.
  const odd = BitMatrix.parse(`
    #.##...#.#.
    .#..##.#..#
    ##########.
    ...........
    #.........#
  `);
  assert.equal(odd.width, 11);
  const png = await toPNG(odd, { scale: 1, margin: 0 });
  assertPixelsMatch(png, odd, { scale: 1, margin: 0 });

  const padded = await toPNG(odd, { scale: 3, margin: 2 });
  assertPixelsMatch(padded, odd, { scale: 3, margin: 2 });
});

test('png: an empty and a fully dark matrix both round-trip', async () => {
  const blank = new BitMatrix(9, 9);
  assertPixelsMatch(await toPNG(blank, { scale: 2, margin: 1 }), blank,
    { scale: 2, margin: 1 });

  const solid = new BitMatrix(9, 9);
  solid.setRegion(0, 0, 9, 9);
  assertPixelsMatch(await toPNG(solid, { scale: 2, margin: 1 }), solid,
    { scale: 2, margin: 1 });
});

test('png: data URI carries the same bytes as toPNG', async () => {
  const options = { scale: 3, margin: 2 };
  const uri = await toPNGDataURI(SAMPLE, options);
  const prefix = 'data:image/png;base64,';

  assert.ok(uri.startsWith(prefix), uri.slice(0, 40));
  const base64 = uri.slice(prefix.length);
  assert.match(base64, /^[A-Za-z0-9+/]+={0,2}$/, 'payload is not plain base64');

  const decoded = new Uint8Array(Buffer.from(base64, 'base64'));
  assert.deepEqual(Array.from(decoded.subarray(0, 8)), PNG_SIGNATURE);
  assertBytesEqual(decoded, await toPNG(SAMPLE, options), 'data URI payload');
});

/* ------------------------------------------------------------------ *
 * Stored deflate
 * ------------------------------------------------------------------ */

test('deflateStored: produces a zlib stream inflate accepts', () => {
  const data = pseudoBytes(1000);
  const stream = deflateStored(data);

  assert.equal(stream[0], 0x78, 'zlib CMF byte');
  assert.equal(((stream[0] << 8) | stream[1]) % 31, 0, 'FCHECK must make the header valid');
  assertBytesEqual(inflate(stream, '1000 bytes'), data, '1000 bytes');
});

test('deflateStored: spans multiple blocks past 65535 bytes', () => {
  // A stored block's length field is sixteen bits, so anything longer has to be
  // split, and BFINAL must be set on the last block only. Getting that wrong
  // decodes correctly for every small image and truncates on the first big one.
  const data = pseudoBytes(200000);
  const stream = deflateStored(data);
  const inflated = inflate(stream, '200000 bytes');

  assert.equal(inflated.length, 200000,
    'inflated length differs — a truncated stream means BFINAL was set too early');
  assertBytesEqual(inflated, data, '200000 bytes');
});

test('deflateStored: handles the block boundaries exactly', () => {
  // 65535 is one full block; 65536 is a block plus a single byte; 131070 is two
  // full blocks with nothing left over — where an off-by-one in the block count
  // shows up.
  for (const length of [0, 1, 65534, 65535, 65536, 65537, 131070, 131071]) {
    const data = pseudoBytes(length, 0x9e3779b1);
    const inflated = inflate(deflateStored(data), `${length} bytes`);
    assertBytesEqual(inflated, data, `${length} bytes`);
  }
});

test('deflateStored: repetitive data survives the round trip too', () => {
  // All-zero input is the shape a mostly-white barcode actually produces.
  const data = new Uint8Array(150000);
  for (let i = 0; i < data.length; i += 997) data[i] = 0xff;
  assertBytesEqual(inflate(deflateStored(data), 'sparse data'), data, 'sparse data');
});

test('png: a large symbol round-trips, scanlines well past 65535 bytes', async () => {
  const big = new BitMatrix(300, 300);
  let s = 0x1234567 >>> 0;
  for (let y = 0; y < 300; y++) {
    for (let x = 0; x < 300; x++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      // Structure plus noise: borders, a diagonal, and a pseudo-random field.
      const structural = x === 0 || y === 0 || x === 299 || y === 299 || x === y;
      if (structural || ((s >>> 24) & 1) === 1) big.set(x, y);
    }
  }

  const scale = 4;
  const margin = 4;
  const png = await toPNG(big, { scale, margin });

  const width = (300 + margin * 2) * scale;
  const height = (300 + margin * 2) * scale;
  const rawLength = ((width + 7) >> 3) + 1;
  assert.ok(rawLength * height > 65535,
    `raw scanlines are only ${rawLength * height} bytes; the test needs more`);

  for (const c of readChunks(png)) {
    assert.equal(c.actualCRC, c.storedCRC, `${c.type} CRC on the large image`);
  }
  assertPixelsMatch(png, big, { scale, margin });
});

/* ------------------------------------------------------------------ *
 * Backend probes
 * ------------------------------------------------------------------ */

test('probes: WebGL2 reports unavailable in Node without throwing', () => {
  let available;
  assert.doesNotThrow(() => { available = isWebGL2Available(); });
  assert.equal(available, false, 'there is no WebGL2 in Node');
});

test('probes: WebGPU resolves false in Node without throwing', async () => {
  const available = await isWebGPUAvailable();
  assert.equal(available, false, 'there is no WebGPU in Node');
});

/* ------------------------------------------------------------------ *
 * Cross-backend agreement
 * ------------------------------------------------------------------ */

test('backends agree on the pixel dimensions of a symbol', async () => {
  for (const options of [
    { scale: 2, margin: 0 },
    { scale: 5, margin: 4 },
  ]) {
    const opts = normalizeOptions(SAMPLE, options);
    const image = toImageData(SAMPLE, options);
    const svg = toSVG(SAMPLE, options);
    const ihdr = readChunks(await toPNG(SAMPLE, options)).find((c) => c.type === 'IHDR');
    const view = new DataView(ihdr.data.buffer, ihdr.data.byteOffset, ihdr.data.byteLength);

    assert.equal(image.width, opts.pixelWidth);
    assert.equal(image.height, opts.pixelHeight);
    assert.equal(view.getUint32(0), opts.pixelWidth);
    assert.equal(view.getUint32(4), opts.pixelHeight);
    assert.ok(svg.includes(`width="${opts.pixelWidth}"`));
    assert.ok(svg.includes(`height="${opts.pixelHeight}"`));
  }
});
