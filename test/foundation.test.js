import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createDetectionCandidate,
  isValidCorners,
  normalizeRotation,
} from '../src/js/core/detection-contract.js';
import {
  createSymbolLayout,
  layoutModuleCount,
  validateSymbolLayout,
} from '../src/js/core/symbol-layout.js';
import {
  createDataBarLayout,
  dataBarTotalModules,
  validateDataBarLayout,
} from '../src/js/databar/layout.js';
import {
  barHeightProfile,
  decodeHeightProfile,
  encodeHeightProfile,
  validateHeightState,
} from '../src/js/image/height-coded.js';

// The foundation modules are compiled into src/js before this suite runs.

const points = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

const matrix = { width: 5, height: 5 };

function geometry(overrides = {}) {
  return {
    corners: points,
    moduleSize: 2,
    rotation: 0,
    matrix,
    ...overrides,
  };
}

test('detection contract accepts valid geometry and candidate metadata', () => {
  const valid = geometry({ rotation: 90, confidence: 0.8 });
  assert.equal(isValidCorners(valid.corners), true);

  const candidate = createDetectionCandidate({
    ...valid,
  }, {
    result: { format: 'test', text: 'payload' },
    quality: { quietZone: true, checksum: true, rows: 1, consistency: 0.95 },
    score: 0.9,
  });
  assert.deepEqual(candidate.corners, points);
  assert.equal(candidate.rotation, 90);
  assert.equal(candidate.result.text, 'payload');
  assert.deepEqual(candidate.quality, {
    quietZone: true,
    checksum: true,
    rows: 1,
    consistency: 0.95,
  });
  assert.equal(candidate.score, 0.9);
});

test('detection contract normalizes rotations and rejects unsafe geometry', () => {
  assert.equal(normalizeRotation(0), 0);
  assert.equal(normalizeRotation(315), 315);

  for (const rotation of [-1, 360, 360.5, 90.5, Infinity, NaN]) {
    assert.throws(() => normalizeRotation(rotation), RangeError);
  }

  const invalidCornerCases = [
    geometry({ corners: points.slice(0, 3) }),
    geometry({ corners: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: NaN }] }),
    geometry({ corners: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }] }),
  ];
  for (const value of invalidCornerCases) {
    assert.equal(isValidCorners(value.corners), false);
    assert.throws(() => createDetectionCandidate(value), RangeError);
  }

  const invalidGeometryCases = [
    geometry({ moduleSize: 0 }),
    geometry({ rotation: 22.5 }),
    geometry({ confidence: 1.1 }),
    geometry({ matrix: null }),
  ];

  for (const value of invalidGeometryCases) {
    assert.equal(isValidCorners(value.corners), true);
    assert.throws(() => createDetectionCandidate(value));
  }
  assert.throws(
    () => createDetectionCandidate(geometry(), { quality: { consistency: 2 } }),
    TypeError,
  );
  assert.throws(
    () => createDetectionCandidate(geometry(), { score: Infinity }),
    RangeError,
  );
  assert.throws(() => createDetectionCandidate(invalidCornerCases[0]), RangeError);
});

test('symbol layout validates geometry, budget and module totals', () => {
  const layout = createSymbolLayout({
    moduleShape: 'square',
    lattice: 'square',
    width: 21,
    height: 21,
    quietZone: 4,
    rows: 2,
    columns: 3,
  });

  assert.equal(validateSymbolLayout(layout), true);
  assert.equal(layoutModuleCount(layout), 21 * 21 * 2 * 3);
  assert.equal(Object.isFrozen(layout), true);
  assert.equal('unexpected' in layout, false);

  const invalidCases = [
    { ...layout, width: 0 },
    { ...layout, height: 1.5 },
    { ...layout, moduleShape: 'hex' },
    { ...layout, lattice: 'triangle' },
    { ...layout, rows: 0 },
    { ...layout, columns: -1 },
    { ...layout, width: 4096, height: 4096, quietZone: 1, rows: 1, columns: 1 },
    { ...layout, width: 1, height: 1, rows: 4096, columns: 4096 },
  ];

  for (const value of invalidCases) {
    assert.equal(validateSymbolLayout(value), false);
    assert.throws(() => layoutModuleCount(value), TypeError);
  }
});

test('DataBar layout validates stacked invariants, budget and total modules', () => {
  const stacked = createDataBarLayout({
    id: 'stacked',
    rows: 2,
    modulesPerRow: 50,
    rowHeight: 2,
    separatorModules: 1,
    quietZone: 1,
    linkage: false,
    checksumModulus: 79,
    stacked: true,
  });
  assert.equal(validateDataBarLayout(stacked), true);
  assert.equal(dataBarTotalModules(stacked), 50 * (2 * 2 + 1));
  assert.equal(Object.isFrozen(stacked), true);

  const omni = createDataBarLayout({
    id: 'omni',
    rows: 1,
    modulesPerRow: 96,
    rowHeight: 1,
    separatorModules: 0,
    quietZone: 1,
    linkage: false,
    checksumModulus: 79,
    stacked: false,
  });
  assert.equal(dataBarTotalModules(omni), 96);

  const invalidCases = [
    { ...stacked, stacked: false },
    { ...stacked, rows: 1, separatorModules: 0, stacked: false },
    { ...stacked, separatorModules: 0 },
    { ...stacked, id: 'omni' },
    { ...stacked, id: 'unknown' },
    { ...stacked, modulesPerRow: 0 },
    { ...stacked, checksumModulus: 1 },
    { ...stacked, modulesPerRow: 4096, rowHeight: 4096, rows: 4096 },
  ];

  for (const value of invalidCases) {
    assert.equal(validateDataBarLayout(value), false);
    assert.throws(() => dataBarTotalModules(value), TypeError);
  }
});

test('height-coded profiles round-trip the two-state alphabet', () => {
  assert.equal(validateHeightState(0, 2), 0);
  assert.equal(validateHeightState(1, 2), 1);
  assert.deepEqual(barHeightProfile(0, 2), { top: 0.25, bottom: 0.75 });
  assert.deepEqual(barHeightProfile(1, 2), { top: 0, bottom: 1 });

  const states = [0, 1, 1, 0, 1];
  const profile = encodeHeightProfile(states, 2);
  assert.deepEqual(decodeHeightProfile(profile, 2), states);
  assert.notEqual(profile[0], profile[1]);
});

test('height-coded profiles round-trip four states and reject mismatches', () => {
  const states = [0, 1, 2, 3, 3, 2, 1, 0];
  const profile = encodeHeightProfile(states, 4);
  assert.deepEqual(decodeHeightProfile(profile, 4), states);
  assert.deepEqual(barHeightProfile(1, 4), { top: 0, bottom: 0.75 });
  assert.deepEqual(barHeightProfile(2, 4), { top: 0.25, bottom: 1 });

  for (const invalidState of [-1, 2, 1.5, NaN, Infinity]) {
    assert.throws(() => validateHeightState(invalidState, 2), RangeError);
  }
  for (const invalidState of [-1, 4, 1.5, NaN, Infinity]) {
    assert.throws(() => validateHeightState(invalidState, 4), RangeError);
  }
  assert.throws(() => validateHeightState(3, 2), RangeError);
  assert.throws(() => encodeHeightProfile([0, 2], 2), RangeError);
  assert.throws(() => decodeHeightProfile(encodeHeightProfile([2], 4), 2), RangeError);
  assert.throws(() => decodeHeightProfile([{ top: 0.1, bottom: 0.9 }], 4), RangeError);
  assert.throws(() => decodeHeightProfile([{ top: 0.8, bottom: 0.2 }], 4), RangeError);
});
