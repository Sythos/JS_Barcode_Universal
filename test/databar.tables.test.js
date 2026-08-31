import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DATABAR14_INSIDE_GROUPS,
  DATABAR14_OUTSIDE_GROUPS,
  DATABAR14_PAIR_RADIX,
  DATABAR14_VARIANTS,
  DATABAR_LIMITED_LINKAGE_OFFSET,
  DATABAR_LIMITED_PAIR_RADIX,
  dataBar14GroupFor,
  validateDataBarTables,
} from '../src/js/databar/tables.js';

test('DataBar GTIN tables: normative cardinalities and variants are stable', () => {
  assert.deepEqual(validateDataBarTables(), []);
  assert.equal(DATABAR14_OUTSIDE_GROUPS.at(-1).last, 2840);
  assert.equal(DATABAR14_INSIDE_GROUPS.at(-1).last, 1596);
  assert.equal(DATABAR14_PAIR_RADIX, 2841 * 1597);
  assert.deepEqual(Object.keys(DATABAR14_VARIANTS), [
    'omnidirectional', 'truncated', 'stacked', 'stacked-omnidirectional',
  ]);
  assert.equal(DATABAR14_VARIANTS.omnidirectional.checksumModulus, 79);
  assert.equal(DATABAR14_VARIANTS.stacked.rows, 2);
  assert.equal(DATABAR_LIMITED_PAIR_RADIX, 2013571);
  assert.equal(DATABAR_LIMITED_LINKAGE_OFFSET, 2015133531096n);
});

test('DataBar GTIN tables: character groups have inclusive boundary ownership', () => {
  assert.equal(dataBar14GroupFor(0, 'outside'), DATABAR14_OUTSIDE_GROUPS[0]);
  assert.equal(dataBar14GroupFor(160, 'outside'), DATABAR14_OUTSIDE_GROUPS[0]);
  assert.equal(dataBar14GroupFor(161, 'outside'), DATABAR14_OUTSIDE_GROUPS[1]);
  assert.equal(dataBar14GroupFor(2840, 'outside'), DATABAR14_OUTSIDE_GROUPS[4]);
  assert.equal(dataBar14GroupFor(335, 'inside'), DATABAR14_INSIDE_GROUPS[0]);
  assert.equal(dataBar14GroupFor(336, 'inside'), DATABAR14_INSIDE_GROUPS[1]);
  assert.throws(() => dataBar14GroupFor(2841, 'outside'), /out of range/);
  assert.throws(() => dataBar14GroupFor(1597, 'inside'), /out of range/);
});
