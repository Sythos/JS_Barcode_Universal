import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  decode,
  encode,
  listFormats,
  toImageData,
} from '../src/index.js';
import { BitMatrix } from '../src/js/core/bit-matrix.js';
import {
  decodeGS1Composite,
  detectAndDecodeGS1Composite,
  detectGS1Composite,
  encodeGS1Composite,
} from '../src/js/composite/index.js';

const GTIN = '00012345678905';
const LINEAR_DATA = '(01)00012345678905(17)260101';
const COMPONENT_DATA = '(01)09506000134352(17)260101';

function rotateClockwise(source) {
  const output = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) if (source.get(x, y)) output.set(source.height - 1 - y, x);
  }
  return output;
}

function input(format, data = COMPONENT_DATA) {
  return {
    linear: {
      format,
      value: format === 'databar-expanded' ? LINEAR_DATA : GTIN,
    },
    data,
  };
}

test('GS1 Composite round-trips every supported DataBar host', () => {
  for (const format of [
    'databar14',
    'databar-truncated',
    'databar-stacked',
    'databar-stacked-omnidirectional',
    'databar-limited',
    'databar-expanded',
  ]) {
    const matrix = encodeGS1Composite(input(format));
    const decoded = decodeGS1Composite(matrix);
    assert.equal(decoded.format, 'gs1composite');
    assert.equal(decoded.profile, 'sythos-gs1-composite-bounded');
    assert.equal(decoded.linearFormat, format);
    assert.equal(decoded.text, '010950600013435217260101');
    assert.equal(decoded.linkage, true);
    assert.equal(decoded.elements.length, 2);
    assert.equal(decoded.component, 'cc-b');
  }
});

test('GS1 Composite selects CC-A for a compact payload and supports CC-B explicitly', () => {
  const compact = encodeGS1Composite({
    linear: { format: 'databar14', value: GTIN },
    data: '(20)23',
  });
  assert.equal(decodeGS1Composite(compact).component, 'cc-a');
  assert.equal(decodeGS1Composite(compact).componentVariant, 7);

  const ccB = encodeGS1Composite({
    ...input('databar14'),
    component: 'cc-b',
  });
  assert.equal(decodeGS1Composite(ccB).component, 'cc-b');
  assert.ok(decodeGS1Composite(ccB).componentVariant >= 8);
});

test('GS1 Composite detector validates margins, integer scale and quarter turns', () => {
  let image = encodeGS1Composite(input('databar14')).withMargin(2).scale(2);
  for (const expectedRotation of [0, 90, 180, 270]) {
    const found = detectGS1Composite(image);
    assert.ok(found);
    assert.equal(found.text, '010950600013435217260101');
    assert.equal(found.moduleSize, 2);
    assert.equal(found.rotation, expectedRotation);
    image = rotateClockwise(image);
  }
});

test('GS1 Composite rejects standalone components, missing linkage and damaged separators', () => {
  const composite = encodeGS1Composite(input('databar14'));
  const component = new BitMatrix(composite.gs1composite.componentWidth, composite.gs1composite.componentHeight);
  for (let y = 0; y < component.height; y++) {
    for (let x = 0; x < component.width; x++) {
      if (composite.get(composite.gs1composite.componentX + x, y)) component.set(x, y);
    }
  }
  assert.equal(detectAndDecodeGS1Composite(component), null);

  assert.throws(() => encodeGS1Composite({
    linear: { format: 'databar14', value: GTIN, options: { linkage: false } },
    data: COMPONENT_DATA,
  }), /linkage=true/);

  const damaged = composite.clone();
  damaged.flip(10, composite.gs1composite.linearY - 1);
  assert.equal(detectGS1Composite(damaged), null);
});

test('root API exposes strict GS1 Composite encode, decode and format registry', () => {
  const listed = listFormats().find(({ id }) => id === 'gs1composite');
  assert.deepEqual(listed, {
    id: 'gs1composite',
    label: 'GS1 DataBar Composite (bounded profile)',
    canWrite: true,
    canRead: true,
    kind: '2D',
  });
  const matrix = encode(input('databar14'), { format: 'gs1-composite' });
  const image = toImageData(matrix.withMargin(4), { scale: 1 });
  const results = decode(image, { formats: ['gs1composite'], binarizer: 'global' });
  assert.equal(results.length, 1);
  assert.equal(results[0].format, 'gs1composite');
  assert.equal(results[0].linearFormat, 'databar14');
});
