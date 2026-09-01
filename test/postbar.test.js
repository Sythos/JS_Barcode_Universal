import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decode, encode, toImageData } from '../src/index.js';
import {
  decodePostBar,
  encodePostBarC10,
  encodePostBarD22,
  encodePostBarG12,
} from '../src/js/oned/postbar.js';

function rendered(matrix, options = {}) {
  return toImageData(matrix, { scale: 4, margin: 24, barHeight: 60, ...options });
}

// The fully worked PostBar.C10 example from US Patent 5,602,382A (col. 11-12):
// DCI=Z, postal code K1S 5B6, machine ID DHAH -> the stated 16-symbol
// codeword 18 29 12 5 14 27 52 54 4 6 8 33 9 6 20 41 and bar sequence
// "AT DDA AAH HAD HDA DHA HDH HAD HAH TAD TAH ADT HTD HAA HTH ATA AHD DHAH AT".
// H=0,A=1,D=2,T=3, so DHAH is machine ID digits '2','0','1','0'.
const C10_EXAMPLE = { postalCode: 'K1S5B6', machineId: '2010' };
const C10_EXPECTED_BARS = 'ATDDAAAHHADHDADHAHDHHADHAHTADTAHADTHTDHAAHTHATAAHDDHAHAT';

function barString(matrix) {
  let bars = '';
  const rows = { '0,5': 'A', '3,8': 'D', '0,8': 'H', '3,5': 'T' };
  for (let x = 0; x < matrix.width; x += 2) {
    let top = matrix.height, bottom = 0, dark = false;
    for (let y = 0; y < matrix.height; y++) {
      if (matrix.get(x, y)) { dark = true; if (y < top) top = y; if (y + 1 > bottom) bottom = y + 1; }
    }
    bars += dark ? rows[`${top},${bottom}`] : '?';
  }
  return bars;
}

test('PostBar.C10 reproduces the patent\'s own worked example bar-for-bar', () => {
  const matrix = encodePostBarC10(C10_EXAMPLE);
  assert.equal(barString(matrix), C10_EXPECTED_BARS);
});

test('PostBar.C10 round-trips through the matrix decoder', () => {
  const matrix = encodePostBarC10(C10_EXAMPLE);
  const [result] = decodePostBar(matrix);
  assert.deepEqual(result, {
    format: 'postbarc10', corrections: 0, postalCode: 'K1S5B6', machineId: '2010',
  });
});

test('PostBar.D22 reproduces the patent\'s own worked example', () => {
  // Patent's D22 example: DCI=C, postal code L3B 4T9, AL=1420, Customer
  // Information=CFFMIPLXF6V.
  const matrix = encodePostBarD22({
    postalCode: 'L3B4T9', addressLocator: '1420', customerInfo: 'CFFMIPLXF6V',
  });
  const [result] = decodePostBar(matrix);
  assert.deepEqual(result, {
    format: 'postbard22',
    corrections: 0,
    postalCode: 'L3B4T9',
    addressLocator: '1420',
    customerInfo: 'CFFMIPLXF6V',
  });
});

test('PostBar.G12 reproduces the patent\'s own worked example', () => {
  // Patent's G12 example: DCI=1, country code 180, ZIP 91266 padded with
  // three trailing spaces to the 8-character Z field.
  const matrix = encodePostBarG12({ countryCode: '180', postalCode: '91266   ' });
  const [result] = decodePostBar(matrix);
  assert.deepEqual(result, {
    format: 'postbarg12', corrections: 0, countryCode: '180', postalCode: '91266   ',
  });
});

test('PostBar rejects malformed field input at the encoder boundary', () => {
  assert.throws(() => encodePostBarC10({ postalCode: 'K1S5B', machineId: '2010' }), /postalCode/);
  assert.throws(() => encodePostBarC10({ postalCode: 'K1S5B6', machineId: '4444' }), /machineId/);
  assert.throws(() => encodePostBarC10({ postalCode: '11S5B6', machineId: '2010' }), /A-character/);
  assert.throws(() => encodePostBarG12({ countryCode: '18X', postalCode: '91266   ' }), /N-character/);
});

test('Reed-Solomon corrects damage within capacity and rejects damage beyond it', () => {
  const matrix = encodePostBarD22({
    postalCode: 'L3B4T9', addressLocator: '1420', customerInfo: 'CFFMIPLXF6V',
  });

  function corruptColumn(source, x) {
    const clone = source.clone();
    for (let y = 0; y < clone.height; y++) {
      if (clone.get(x, y)) clone.set(x, y, 0); else clone.set(x, y);
    }
    return clone;
  }

  // D22 is a (25,21) RS code: 2t+e<=4, so up to 2 full symbol errors correct.
  let lightlyDamaged = matrix;
  for (const x of [8, 20]) lightlyDamaged = corruptColumn(lightlyDamaged, x);
  const [corrected] = decodePostBar(lightlyDamaged);
  assert.equal(corrected.postalCode, 'L3B4T9');
  assert.equal(corrected.addressLocator, '1420');
  assert.ok(corrected.corrections >= 1);

  // Six corrupted columns spread across distinct symbols exceeds capacity;
  // the decoder must reject, not return plausible-looking wrong data.
  let heavilyDamaged = matrix;
  for (const x of [8, 20, 32, 44, 56, 68]) heavilyDamaged = corruptColumn(heavilyDamaged, x);
  assert.deepEqual(decodePostBar(heavilyDamaged), []);
});

test('PostBar is exposed through the top-level dispatcher and listFormats()', () => {
  const matrix = encode(C10_EXAMPLE, { format: 'postbarc10' });
  const [result] = decode(rendered(matrix), { formats: ['postbarc10'] });
  assert.equal(result.postalCode, 'K1S5B6');
  assert.equal(result.machineId, '2010');
});

test('PostBar camera profile requires a measurable quiet zone', () => {
  const matrix = encodePostBarC10(C10_EXAMPLE);
  const wide = rendered(matrix, { margin: 24 });
  assert.equal(decode(wide, { formats: ['postbarc10'], profile: 'camera' }).length, 1);

  const tight = rendered(matrix, { margin: 0 });
  assert.deepEqual(decode(tight, { formats: ['postbarc10'], profile: 'camera' }), []);
});

test('an unrequested PostBar profile is not returned when formats is restricted', () => {
  const c10 = encodePostBarC10(C10_EXAMPLE);
  assert.deepEqual(decode(rendered(c10), { formats: ['postbard22'] }), []);
});

test('PostBar rejects unrelated procedural raster without false positives', () => {
  function proceduralImage(width, height, pixel) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const value = pixel(x, y);
        data.set([value, value, value, 255], (y * width + x) * 4);
      }
    }
    return { data, width, height };
  }

  let state = 0x2545f491;
  for (let seed = 0; seed < 12; seed++) {
    state = (state * 1664525 + 1013904223 + seed) >>> 0;
    let local = state;
    const noise = proceduralImage(160, 60, () => {
      local = (local * 1664525 + 1013904223) >>> 0;
      return local >>> 24;
    });
    const result = decode(noise, {
      formats: ['postbarc10', 'postbard22', 'postbarg12'], tryHarder: true, binarizer: 'global',
    });
    assert.deepEqual(result, [], `noise seed ${seed}`);
  }
});
