import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FRAMEQR_CANVAS_SHAPES,
  FRAMEQR_PROFILE,
  analyzeCanvasDamage,
  canvasModules,
  normalizeCanvasSpec,
  validateCanvasSpec,
  validateFrameQrTables,
} from '../src/js/frameqr/tables.js';

test('Frame QR profile: compatibility boundary is explicit and immutable', () => {
  assert.equal(FRAMEQR_PROFILE.id, 'sythos-canvas-qr/1');
  assert.equal(FRAMEQR_PROFILE.certified, false);
  assert.equal(FRAMEQR_PROFILE.densoFrameQrCompatible, false);
  assert.equal(FRAMEQR_PROFILE.requiredEcc, 'H');
  assert.equal(Object.isFrozen(FRAMEQR_PROFILE), true);
  assert.deepEqual(FRAMEQR_CANVAS_SHAPES, ['square', 'circle', 'diamond']);
  assert.deepEqual(validateFrameQrTables(), []);
});

test('Frame QR profile: canvas normalisation is deterministic', () => {
  assert.deepEqual(normalizeCanvasSpec(29), {
    shape: 'square', centerX: 14, centerY: 14, width: 5, height: 5, angle: 0,
  });
  assert.deepEqual(normalizeCanvasSpec(29, {
    shape: 'DIAMOND', width: 7, height: 5, centerX: 13.6, centerY: 15.2, angle: -90,
  }), {
    shape: 'diamond', centerX: 14, centerY: 15, width: 7, height: 5, angle: 270,
  });
  assert.throws(() => normalizeCanvasSpec(22), /not a QR Model 2 symbol size/);
  assert.throws(() => normalizeCanvasSpec(29, { shape: 'star' }), /unsupported canvas shape/);
  assert.throws(() => normalizeCanvasSpec(29, { angle: 45 }), /0, 90, 180 or 270/);
  assert.throws(() => normalizeCanvasSpec(29, { centerX: 3 }), /finder-pattern boundary/);
});

test('Frame QR profile: shape membership has stable module counts', () => {
  assert.equal(canvasModules(29, { shape: 'square', size: 5 }).length, 25);
  assert.equal(canvasModules(29, { shape: 'diamond', size: 5 }).length, 13);
  assert.equal(canvasModules(29, { shape: 'circle', size: 5 }).length, 13);

  const rotated = canvasModules(33, { shape: 'square', width: 3, height: 7, angle: 90 });
  const xs = rotated.map(([x]) => x);
  const ys = rotated.map(([, y]) => y);
  assert.equal(Math.max(...xs) - Math.min(...xs) + 1, 7);
  assert.equal(Math.max(...ys) - Math.min(...ys) + 1, 3);
});

test('Frame QR profile: damage is budgeted independently for every RS block', () => {
  const analysis = analyzeCanvasDamage(3, { shape: 'square', size: 3 });
  assert.equal(analysis.certified, false);
  assert.equal(analysis.version, 3);
  assert.equal(analysis.reservedOverlaps.length, 0);
  assert.equal(analysis.touchedCodewordsByBlock.length, 2);
  assert.ok(analysis.touchedCodewordsByBlock.every(
    (count) => count <= analysis.correctionBudgetPerBlock,
  ));
  assert.equal(analysis.safe, true);
  assert.deepEqual(validateCanvasSpec(3, { shape: 'square', size: 3 }), analysis);
});

test('Frame QR profile: function-pattern damage and excessive damage are rejected', () => {
  const alignmentCollision = analyzeCanvasDamage(7, { shape: 'square', size: 5 });
  assert.ok(alignmentCollision.reservedOverlaps.length > 0);
  assert.equal(alignmentCollision.safe, false);

  const excessive = analyzeCanvasDamage(3, { shape: 'square', size: 13 });
  assert.equal(excessive.safe, false);
  assert.ok(
    excessive.reservedOverlaps.length > 0 ||
    excessive.touchedCodewordsByBlock.some(
      (count) => count > excessive.correctionBudgetPerBlock,
    ),
  );
});
