import assert from 'node:assert/strict';
import test from 'node:test';
import { BitMatrix } from '../src/js/core/bit-matrix.js';
import { encodeFrameQR } from '../src/js/frameqr/encoder.js';
import { detectAndDecodeFrameQR, detectFrameQR } from '../src/js/frameqr/detector.js';
import { encodeQR } from '../src/js/qr/encoder.js';

function rotateClockwise(source) {
  const out = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (source.get(x, y)) out.set(source.height - 1 - y, x);
    }
  }
  return out;
}

function rotate(source, turns) {
  let result = source;
  for (let i = 0; i < turns; i++) result = rotateClockwise(result);
  return result;
}

test('Frame QR detector reads the profile from a quiet-zone integer raster', () => {
  const symbol = encodeFrameQR('https://www.sythos.net', { version: 3 });
  const image = symbol.withMargin(4).scale(3);
  const detections = detectFrameQR(image);

  assert.equal(detections.length, 1);
  assert.equal(detections[0].result.text, 'https://www.sythos.net');
  assert.equal(detections[0].profile, 'sythos-canvas-qr/1');
  assert.equal(detections[0].certified, false);
  assert.equal(detections[0].dimension, symbol.width);
  assert.ok(Math.abs(detections[0].moduleSize - 3) < 0.8);
  assert.equal(detectAndDecodeFrameQR(image)[0].format, 'frameqr');
});

test('Frame QR detector normalizes all in-plane quarter turns', () => {
  const source = encodeFrameQR('ROTATE', { version: 4, canvas: { shape: 'circle', size: 7 } })
    .withMargin(3)
    .scale(2);

  for (let turns = 0; turns < 4; turns++) {
    const found = detectAndDecodeFrameQR(rotate(source, turns), {
      canvas: { shape: 'circle', size: 7 },
    });
    assert.equal(found.length, 1, `${turns} quarter turns`);
    assert.equal(found[0].text, 'ROTATE', `${turns} quarter turns payload`);
    assert.equal(found[0].rotation, turns * 90, `${turns} quarter turns orientation`);
  }
});

test('Frame QR detector accepts explicit non-square canvas profiles', () => {
  const canvas = { shape: 'diamond', width: 9, height: 5, angle: 90 };
  const symbol = encodeFrameQR('DIAMOND', { version: 5, canvas });
  const image = symbol.withMargin(4).scale(2);
  const found = detectAndDecodeFrameQR(image, { canvas });
  assert.equal(found.length, 1);
  assert.equal(found[0].text, 'DIAMOND');
  assert.equal(found[0].frame.shape, 'diamond');
  assert.equal(found[0].frame.angle, 90);
});

test('Frame QR detector rejects ordinary QR symbols and unrelated rasters', () => {
  const normalQr = encodeQR('ORDINARY QR', { ecc: 'H' }).withMargin(4).scale(3);
  assert.deepEqual(detectAndDecodeFrameQR(normalQr), []);

  const blank = new BitMatrix(160, 140);
  assert.deepEqual(detectFrameQR(blank), []);
  assert.deepEqual(detectAndDecodeFrameQR(blank), []);

  const stripes = new BitMatrix(160, 140);
  for (let x = 5; x < stripes.width; x += 9) stripes.setRegion(x, 3, 3, 130);
  assert.deepEqual(detectAndDecodeFrameQR(stripes), []);
});

