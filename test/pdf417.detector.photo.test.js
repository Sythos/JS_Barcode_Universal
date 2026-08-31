import assert from 'node:assert/strict';
import test from 'node:test';
import { BitMatrix } from '../src/js/core/bit-matrix.js';
import { PerspectiveTransform } from '../src/js/image/perspective.js';
import { decodePDF417 } from '../src/js/pdf417/decoder.js';
import { detectAndDecodePDF417 } from '../src/js/pdf417/detector.js';
import { encodePDF417 } from '../src/js/pdf417/encoder.js';

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function warpToRaster(source, width, height, corners, options = {}) {
  const sourceToImage = PerspectiveTransform.quadToQuad(
    0, 0, source.width, 0, source.width, source.height, 0, source.height,
    corners[0].x, corners[0].y, corners[1].x, corners[1].y,
    corners[2].x, corners[2].y, corners[3].x, corners[3].y,
  );
  const imageToSource = sourceToImage.inverse();
  const grayscale = new Float64Array(width * height).fill(1);
  const supersample = options.supersample ?? 3;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let dark = 0;
    for (let sy = 0; sy < supersample; sy++) for (let sx = 0; sx < supersample; sx++) {
      const point = imageToSource.transformPoint(x + (sx + 0.5) / supersample, y + (sy + 0.5) / supersample);
      if (point.x >= 0 && point.y >= 0 && point.x < source.width && point.y < source.height &&
          source.get(Math.floor(point.x), Math.floor(point.y))) dark++;
    }
    grayscale[y * width + x] = 1 - dark / (supersample * supersample);
  }
  const blurRadius = options.blurRadius ?? 0;
  let filtered = grayscale;
  if (blurRadius > 0) {
    filtered = new Float64Array(grayscale.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let total = 0, count = 0;
      for (let dy = -blurRadius; dy <= blurRadius; dy++) for (let dx = -blurRadius; dx <= blurRadius; dx++) {
        const px = x + dx, py = y + dy;
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        total += grayscale[py * width + px]; count++;
      }
      filtered[y * width + x] = total / count;
    }
  }
  const random = seededRandom(options.seed ?? 1);
  const noise = options.lumaNoise ?? 0;
  const threshold = options.threshold ?? 0.5;
  const image = new BitMatrix(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const value = filtered[y * width + x] + (random() * 2 - 1) * noise;
    if (value < threshold) image.set(x, y);
  }
  const flips = Math.floor(width * height * (options.pixelNoise ?? 0));
  for (let index = 0; index < flips; index++) {
    image.flip(Math.floor(random() * width), Math.floor(random() * height));
  }
  return image;
}

function addClutter(image, seed, count) {
  const random = seededRandom(seed);
  for (let index = 0; index < count; index++) {
    const x = Math.floor(random() * image.width);
    const y = Math.floor(random() * image.height);
    const width = 1 + Math.floor(random() * 7);
    const height = 1 + Math.floor(random() * 5);
    image.setRegion(x, y, width, height);
  }
}

test('PDF417 photo detector rectifies a rotated perspective raster at non-integer scale', () => {
  const symbol = encodePDF417('PHOTO PERSPECTIVE', { compaction: 'text', rowHeight: 4, columns: 4 });
  const image = warpToRaster(symbol, 470, 220, [
    { x: 38.4, y: 42.8 }, { x: 424.2, y: 66.1 },
    { x: 397.6, y: 181.7 }, { x: 63.5, y: 157.2 },
  ]);
  const result = detectAndDecodePDF417(image);
  assert.equal(result?.text, 'PHOTO PERSPECTIVE');
  assert.equal(decodePDF417(result.matrix).text, 'PHOTO PERSPECTIVE');
});

test('PDF417 photo detector handles a strongly rotated projective raster', () => {
  const symbol = encodePDF417('OBLIQUE PHOTO', { compaction: 'text', rowHeight: 4, columns: 4 });
  const image = warpToRaster(symbol, 510, 330, [
    { x: 74.2, y: 34.5 }, { x: 454.6, y: 162.8 },
    { x: 408.3, y: 286.4 }, { x: 38.7, y: 145.1 },
  ]);
  const result = detectAndDecodePDF417(image);
  assert.equal(result?.text, 'OBLIQUE PHOTO');
});

test('PDF417 photo detector survives mild blur, threshold drift, noise, and background clutter', () => {
  const symbol = encodePDF417('DEGRADED PHOTO', { compaction: 'text', rowHeight: 5, columns: 5, eccLevel: 4 });
  const image = warpToRaster(symbol, 520, 250, [
    { x: 62.7, y: 52.4 }, { x: 472.1, y: 35.6 },
    { x: 445.8, y: 205.3 }, { x: 79.2, y: 218.6 },
  ], { blurRadius: 1, lumaNoise: 0.1, threshold: 0.53, pixelNoise: 0.0012, seed: 0x417 });
  addClutter(image, 0xc0ffee, 34);
  const result = detectAndDecodePDF417(image);
  assert.equal(result?.text, 'DEGRADED PHOTO');
});

test('PDF417 photo detector handles a tightly cropped quiet zone and oblique rotation', () => {
  const symbol = encodePDF417('CROPPED PHOTO', { compaction: 'text', rowHeight: 4, columns: 3 });
  const image = warpToRaster(symbol, 390, 185, [
    { x: -3.8, y: 35.2 }, { x: 342.4, y: 1.8 },
    { x: 389.8, y: 143.7 }, { x: 35.3, y: 184.2 },
  ]);
  const result = detectAndDecodePDF417(image);
  assert.equal(result?.text, 'CROPPED PHOTO');
});

test('PDF417 photo detector rejects deterministic non-symbol rasters', () => {
  const blank = new BitMatrix(320, 180);
  assert.equal(detectAndDecodePDF417(blank), null);

  const random = seededRandom(0xbadc0de);
  const noise = new BitMatrix(320, 180);
  for (let y = 0; y < noise.height; y++) for (let x = 0; x < noise.width; x++) {
    if (random() < 0.24) noise.set(x, y);
  }
  assert.equal(detectAndDecodePDF417(noise), null);

  const stripes = new BitMatrix(320, 180);
  for (let x = 4; x < stripes.width; x += 9) stripes.setRegion(x, 18, 3, 144);
  assert.equal(detectAndDecodePDF417(stripes), null);
});
