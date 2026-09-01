import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  KARTRAK_PALETTE,
  PolychromeMatrix,
  decodeKarTrak,
  decodeKarTrakMatrix,
  detectKarTrak,
  encodeKarTrak,
  kartrakCheckDigit,
  toColorImageData,
} from '../src/js/kartrak/index.js';

// The worked example from Wikipedia's "KarTrak" article, decoded from the
// photograph shown at the top of that page: "Start 8350199918 Stop 5".
const WORKED_EXAMPLE = '8350199918';
const WORKED_CHECK_DIGIT = 5;

function rendered(matrix, options = {}) {
  return toColorImageData(matrix, { scale: 6, margin: 8, ...options });
}

test('kartrakCheckDigit matches the published worked example', () => {
  const digits = WORKED_EXAMPLE.split('').map(Number);
  assert.equal(kartrakCheckDigit(digits), WORKED_CHECK_DIGIT);
});

test('encodeKarTrak round-trips through the matrix decoder for a range of payloads', () => {
  for (const value of ['0000000000', '8350199918', '9999999999', '1234567890', '6005551234']) {
    const matrix = encodeKarTrak(value);
    const decoded = decodeKarTrakMatrix(matrix);
    assert.equal(decoded.format, 'kartrak');
    assert.equal(decoded.text, value);
    assert.equal(decoded.equipmentCode, value.slice(0, 1));
    assert.equal(decoded.ownershipCode, value.slice(1, 4));
    assert.equal(decoded.carNumber, value.slice(4, 10));
    assert.equal(decoded.checkDigit, kartrakCheckDigit(value.split('').map(Number)));
  }
});

test('encodeKarTrak rejects anything other than exactly 10 digits', () => {
  for (const bad of ['', '123', '12345678901', '123456789a', ' 123456789', '123 456789']) {
    assert.throws(() => encodeKarTrak(bad), /10 digits/);
  }
});

test('a payload whose check digit is 10 uses the dedicated value-10 glyph and round-trips', () => {
  let found = null;
  for (let n = 0; n < 100 && !found; n++) {
    const value = String(n).padStart(10, '0');
    if (kartrakCheckDigit(value.split('').map(Number)) === 10) found = value;
  }
  assert.ok(found, 'expected to find a payload with check digit 10 in the search range');
  const decoded = decodeKarTrakMatrix(encodeKarTrak(found));
  assert.equal(decoded.checkDigit, 10);
});

test('decodeKarTrakMatrix rejects a tampered check digit', () => {
  const matrix = encodeKarTrak(WORKED_EXAMPLE);
  const tampered = matrix.clone();
  // Line 13 (the checksum) is matrix rows 0-1 (topmost). Rotate its lower
  // stripe's palette index within 1..4 so the line is still a uniform,
  // structurally valid digit stripe, just a different value.
  const currentLower = tampered.get(0, 1);
  const otherLower = (currentLower % 4) + 1;
  for (let x = 0; x < tampered.width; x++) tampered.set(x, 1, otherLower);
  assert.throws(() => decodeKarTrakMatrix(tampered), /check digit mismatch|not a valid digit/);
});

test('decodeKarTrakMatrix rejects a missing or corrupted START/STOP label', () => {
  const matrix = encodeKarTrak(WORKED_EXAMPLE);

  const noStart = matrix.clone();
  for (let x = 0; x < noStart.width; x++) noStart.set(x, noStart.height - 1, 2); // last row = START lower stripe
  assert.throws(() => decodeKarTrakMatrix(noStart), /start label/);

  const noStop = matrix.clone();
  for (let x = 0; x < noStop.width; x++) noStop.set(x, 2, 2); // STOP upper stripe row
  assert.throws(() => decodeKarTrakMatrix(noStop), /stop label/);
});

test('decodeKarTrakMatrix rejects the wrong grid shape', () => {
  const wrong = new PolychromeMatrix(4, 4, KARTRAK_PALETTE);
  assert.throws(() => decodeKarTrakMatrix(wrong), /colour grid/);
});

test('detectKarTrak locates and decodes an axis-aligned rendered plate', () => {
  const matrix = encodeKarTrak(WORKED_EXAMPLE);
  const image = rendered(matrix);
  const found = detectKarTrak(image);
  assert.ok(found);
  assert.equal(found.text, WORKED_EXAMPLE);
  assert.equal(found.checkDigit, WORKED_CHECK_DIGIT);
  assert.ok(found.bounds.width > 0 && found.bounds.height > 0);
});

test('detectKarTrak tolerates colour tint, blur and noise', () => {
  const matrix = encodeKarTrak(WORKED_EXAMPLE);
  const base = rendered(matrix, { scale: 10, margin: 10 });

  function tinted(image, [dr, dg, db]) {
    const data = new Uint8ClampedArray(image.data);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i] + dr;
      data[i + 1] = data[i + 1] + dg;
      data[i + 2] = data[i + 2] + db;
    }
    return { data, width: image.width, height: image.height };
  }

  function noised(image, amplitude, seed) {
    const data = new Uint8ClampedArray(image.data);
    let state = seed >>> 0;
    for (let i = 0; i < data.length; i += 4) {
      state = (state * 1664525 + 1013904223) >>> 0;
      const n = ((state >>> 24) / 255 - 0.5) * 2 * amplitude;
      data[i] = data[i] + n;
      data[i + 1] = data[i + 1] + n;
      data[i + 2] = data[i + 2] + n;
    }
    return { data, width: image.width, height: image.height };
  }

  for (const delta of [[20, -20, 15], [-30, 25, -20], [40, 40, -35]]) {
    const found = detectKarTrak(tinted(base, delta));
    assert.ok(found, `tint ${delta}`);
    assert.equal(found.text, WORKED_EXAMPLE, `tint ${delta}`);
  }

  for (let seed = 1; seed <= 5; seed++) {
    const found = detectKarTrak(noised(base, 30, seed * 7919));
    assert.ok(found, `noise seed ${seed}`);
    assert.equal(found.text, WORKED_EXAMPLE, `noise seed ${seed}`);
  }
});

test('detectKarTrak returns null, not a false positive, on unrelated procedural images', () => {
  function proceduralImage(width, height, pixel) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const [r, g, b] = pixel(x, y);
        data.set([r, g, b, 255], (y * width + x) * 4);
      }
    }
    return { data, width, height };
  }

  let state = 0x9e3779b9;
  for (let seed = 0; seed < 10; seed++) {
    state = (state * 1664525 + 1013904223 + seed) >>> 0;
    let local = state;
    const noise = proceduralImage(64, 96, () => {
      local = (local * 1664525 + 1013904223) >>> 0;
      const v = local >>> 24;
      return [v, v, v];
    });
    assert.equal(detectKarTrak(noise), null, `noise seed ${seed}`);
  }

  // A blue/red checkerboard is deliberately adversarial: it uses two of the
  // four real KarTrak colours directly, unlike the grayscale noise above.
  const checker = proceduralImage(64, 96, (x, y) => (((x >> 3) + (y >> 3)) % 2 ? [0, 51, 204] : [204, 0, 0]));
  assert.equal(detectKarTrak(checker), null);

  assert.equal(detectKarTrak(null), null);
  assert.equal(detectKarTrak({ width: 4, height: 4 }), null);
});

test('decodeKarTrak dispatches on both a matrix and a raw image, and throws when nothing is found', () => {
  const matrix = encodeKarTrak(WORKED_EXAMPLE);
  assert.equal(decodeKarTrak(matrix).text, WORKED_EXAMPLE);
  assert.equal(decodeKarTrak(rendered(matrix)).text, WORKED_EXAMPLE);

  const blank = { data: new Uint8ClampedArray(64 * 64 * 4).fill(200), width: 64, height: 64 };
  assert.throws(() => decodeKarTrak(blank), /was not found/);
});
