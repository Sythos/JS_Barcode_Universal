import assert from 'node:assert/strict';
import test from 'node:test';
import { BitMatrix } from '../src/js/core/bit-matrix.js';
import { PerspectiveTransform } from '../src/js/image/perspective.js';
import { encodeMicroQR } from '../src/js/microqr/encoder.js';
import { detectAndDecodeMicroQR, detectMicroQR } from '../src/js/microqr/detector.js';
import { encodeQR } from '../src/js/qr/encoder.js';

function rotateClockwise(source) {
  const out = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    if (source.get(x, y)) out.set(source.height - 1 - y, x);
  }
  return out;
}

function rotate(source, turns) {
  let result = source;
  for (let i = 0; i < turns; i++) result = rotateClockwise(result);
  return result;
}

function invert(source) {
  const out = source.clone();
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) out.flip(x, y);
  return out;
}

function warp(source, width, height, corners, supersample = 3) {
  const forward = PerspectiveTransform.quadToQuad(
    0, 0, source.width, 0, source.width, source.height, 0, source.height,
    corners[0].x, corners[0].y, corners[1].x, corners[1].y,
    corners[2].x, corners[2].y, corners[3].x, corners[3].y,
  );
  const inverse = forward.inverse();
  const out = new BitMatrix(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let dark = 0;
    for (let sy = 0; sy < supersample; sy++) for (let sx = 0; sx < supersample; sx++) {
      const point = inverse.transformPoint(
        x + (sx + 0.5) / supersample,
        y + (sy + 0.5) / supersample,
      );
      if (point.x >= 0 && point.y >= 0 && point.x < source.width && point.y < source.height &&
          source.get(Math.floor(point.x), Math.floor(point.y))) dark++;
    }
    if (dark * 2 > supersample * supersample) out.set(x, y);
  }
  return out;
}

test('Micro QR detector reads M1-M4 from clean integer-scaled rasters', () => {
  const cases = [
    ['M1', '12345', null],
    ['M2', 'HELLO', 'L'],
    ['M3', 'micro', 'L'],
    ['M4', 'Hello Sythos', 'M'],
  ];
  for (const [version, text, ecc] of cases) {
    const symbol = encodeMicroQR(text, { version, ...(ecc ? { ecc } : {}), mask: 1 });
    const image = symbol.withMargin(2).scale(4);
    const detections = detectMicroQR(image);
    assert.equal(detections.length, 1, `${version}: one geometric candidate`);
    assert.equal(detections[0].dimension, symbol.width, `${version}: dimension`);
    assert.equal(detections[0].version, version, `${version}: version`);
    assert.ok(Math.abs(detections[0].moduleSize - 4) < 0.8, `${version}: module pitch`);
    const decoded = detectAndDecodeMicroQR(image);
    assert.equal(decoded.length, 1, `${version}: one decoded symbol`);
    assert.equal(decoded[0].text, text, `${version}: payload`);
  }
});

test('Micro QR detector normalizes all quarter-turn orientations', () => {
  const text = 'TURN TEST';
  const source = encodeMicroQR(text, { version: 'M4', ecc: 'M', mask: 2 }).withMargin(2).scale(5);
  for (let turns = 0; turns < 4; turns++) {
    const found = detectAndDecodeMicroQR(rotate(source, turns));
    assert.equal(found.length, 1, `${turns} quarter turns`);
    assert.equal(found[0].text, text, `${turns} quarter turns payload`);
    assert.equal(found[0].rotation, turns * 90, `${turns} quarter turns orientation`);
  }
});

test('Micro QR detector handles non-integer scale and mild projective distortion', () => {
  const text = 'PERSPECTIVE';
  const source = encodeMicroQR(text, { version: 'M4', ecc: 'M', mask: 0 }).withMargin(2);
  const image = warp(source, 142, 128, [
    { x: 21.4, y: 13.8 }, { x: 124.2, y: 21.6 },
    { x: 115.7, y: 113.4 }, { x: 14.8, y: 105.1 },
  ]);
  const found = detectAndDecodeMicroQR(image);
  assert.equal(found.length, 1);
  assert.equal(found[0].text, text);
});

test('Micro QR detector accepts the nominal two-module quiet zone and inverted polarity', () => {
  const text = 'NEGATIVE';
  const source = encodeMicroQR(text, { version: 'M4', ecc: 'Q', mask: 3 }).withMargin(2).scale(4);
  const found = detectAndDecodeMicroQR(invert(source));
  assert.equal(found.length, 1);
  assert.equal(found[0].text, text);
  assert.equal(found[0].inverted, true);
});

test('Micro QR detector rejects QR Model 2 and deterministic non-symbol rasters', () => {
  const normalQr = encodeQR('NOT MICRO QR', { ecc: 'M' }).withMargin(4).scale(3);
  assert.deepEqual(detectAndDecodeMicroQR(normalQr), []);

  const blank = new BitMatrix(140, 120);
  assert.deepEqual(detectMicroQR(blank), []);
  assert.deepEqual(detectAndDecodeMicroQR(blank), []);

  const stripes = new BitMatrix(140, 120);
  for (let x = 3; x < stripes.width; x += 8) stripes.setRegion(x, 4, 3, 112);
  assert.deepEqual(detectAndDecodeMicroQR(stripes), []);

  const random = new BitMatrix(140, 120);
  let state = 0x51a7e;
  for (let y = 0; y < random.height; y++) for (let x = 0; x < random.width; x++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    if (state / 0x100000000 < 0.25) random.set(x, y);
  }
  assert.deepEqual(detectAndDecodeMicroQR(random), []);
});
