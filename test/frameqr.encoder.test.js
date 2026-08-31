import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeFrameQR } from '../src/js/frameqr/encoder.js';
import { FRAMEQR_PROFILE, canvasModules, normalizeCanvasSpec } from '../src/js/frameqr/tables.js';

test('Sythos Canvas QR encoder reserves a declared canvas on a QR H symbol', () => {
  const matrix = encodeFrameQR('https://www.sythos.net/', {
    version: 5,
    canvas: { shape: 'square', size: 5 },
  });

  assert.equal(matrix.width, 37);
  assert.deepEqual(matrix.frameqr, {
    profile: FRAMEQR_PROFILE.id,
    certified: false,
    canvas: normalizeCanvasSpec(matrix.width, { shape: 'square', size: 5 }),
  });
  for (const [x, y] of canvasModules(matrix.width, matrix.frameqr.canvas)) {
    assert.equal(matrix.get(x, y), false, `canvas module ${x},${y} is light`);
  }
});

test('Sythos Canvas QR encoder fixes ECC H and rejects unsafe canvas requests', () => {
  assert.throws(() => encodeFrameQR('Sythos', { ecc: 'M' }), /fixed to H/);
  assert.throws(
    () => encodeFrameQR('Sythos', { version: 1, canvas: { size: 13 } }),
    /canvas|safe|damage/i,
  );
});

test('Sythos Canvas QR encoder increases the QR version until the canvas is safe', () => {
  const matrix = encodeFrameQR('auto version selection');
  assert.ok(matrix.width > 21, 'a default canvas must not silently damage version 1');
  assert.equal(matrix.frameqr.certified, false);
});
