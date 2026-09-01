import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CODE25_DATALOGIC_DIGIT_PATTERNS,
  CODE25_DIGIT_PATTERNS,
  code25CheckDigit,
  decode,
  decodeCode32,
  decodePZN,
  encode,
  encodeCode32,
  encodeDataLogic2of5,
  encodeIATA2of5,
  encodeIndustrial2of5,
  encodeMatrix2of5,
  encodePZN,
  encodeStandard2of5,
  toImageData,
} from '../src/index.js';

function rendered(matrix, options = {}) {
  return toImageData(matrix, {
    scale: 3,
    margin: 30,
    barHeight: 64,
    ...options,
  });
}

test('Code 25 tables retain ten unique digits and exactly two wide bars', () => {
  assert.equal(CODE25_DIGIT_PATTERNS.length, 10);
  assert.equal(new Set(CODE25_DIGIT_PATTERNS).size, 10);
  for (const pattern of CODE25_DIGIT_PATTERNS) {
    assert.equal(pattern.length, 10);
    assert.equal([...pattern].reduce((sum, width) => sum + Number(width), 0), 14);
    assert.equal([...pattern].filter((_, index) => index % 2 === 0 && pattern[index] !== '1').length, 2);
  }
});

test('Standard and Industrial 2 of 5 round-trip with optional check digits', () => {
  const payload = '01234567';
  assert.equal(code25CheckDigit(payload), 0);
  for (const [format, writer] of [
    ['standard2of5', encodeStandard2of5],
    ['code2of5', encodeStandard2of5],
    ['industrial2of5', encodeIndustrial2of5],
  ]) {
    const matrix = writer(payload, { checkDigit: true });
    const image = rendered(matrix);
    const checked = decode(image, { formats: [format], checkDigit: true });
    assert.equal(checked.length, 1, format);
    assert.deepEqual(checked[0], { format: 'industrial2of5', text: payload, checkDigit: true });

    const literal = decode(image, { formats: [format] });
    assert.equal(literal.length, 1, format);
    assert.equal(literal[0].text, `${payload}0`);
  }
});

test('Data Logic 2 of 5 table retains ten unique digits with exactly two wide elements', () => {
  assert.equal(CODE25_DATALOGIC_DIGIT_PATTERNS.length, 10);
  assert.equal(new Set(CODE25_DATALOGIC_DIGIT_PATTERNS).size, 10);
  for (const pattern of CODE25_DATALOGIC_DIGIT_PATTERNS) {
    assert.equal(pattern.length, 6);
    assert.equal([...pattern].reduce((sum, width) => sum + Number(width), 0), 10);
    assert.equal([...pattern].filter((width) => width === '3').length, 2);
  }
});

test('Data Logic 2 of 5 round-trips with the width-modulated digit grammar and its own frame', () => {
  const payload = '01234567';
  const matrix = encodeDataLogic2of5(payload, { checkDigit: true });
  const image = rendered(matrix);

  const checked = decode(image, { formats: ['datalogic2of5'], checkDigit: true });
  assert.equal(checked.length, 1);
  assert.deepEqual(checked[0], { format: 'datalogic2of5', text: payload, checkDigit: true });

  const literal = decode(image, { formats: ['datalogic2of5'] });
  assert.equal(literal.length, 1);
  assert.equal(literal[0].text, `${payload}${code25CheckDigit(payload)}`);

  for (const alias of ['data-logic-2-of-5', 'chinapost', 'china-post']) {
    const aliased = decode(image, { formats: [alias], checkDigit: true });
    assert.equal(aliased.length, 1, alias);
    assert.equal(aliased[0].format, 'datalogic2of5');
  }
});

test('Data Logic 2 of 5 camera profile requires a valid check digit and quiet zone', () => {
  const matrix = encodeDataLogic2of5('86420', { checkDigit: true, wideRatio: 4 });
  const image = rendered(matrix, { scale: 2 });
  const result = decode(image, { formats: ['datalogic2of5'], profile: 'camera' });
  assert.equal(result.length, 1);
  assert.equal(result[0].text, '86420');
  assert.equal(result[0].quality.checksum, true);

  const damaged = matrix.clone();
  damaged.flip(Math.floor(damaged.width / 2), 0);
  assert.equal(decode(rendered(damaged, { scale: 2 }), { formats: ['datalogic2of5'], profile: 'camera' }).length, 0);
});

test('Matrix 2 of 5 shares the width-modulated digit table with its own longer guard frame', () => {
  const payload = '01234567';
  const matrix = encodeMatrix2of5(payload, { checkDigit: true });
  const image = rendered(matrix);

  const checked = decode(image, { formats: ['matrix2of5'], checkDigit: true });
  assert.equal(checked.length, 1);
  assert.deepEqual(checked[0], { format: 'matrix2of5', text: payload, checkDigit: true });

  const literal = decode(image, { formats: ['matrix2of5'] });
  assert.equal(literal.length, 1);
  assert.equal(literal[0].text, `${payload}${code25CheckDigit(payload)}`);

  const aliased = decode(image, { formats: ['matrix-2-of-5'], checkDigit: true });
  assert.equal(aliased.length, 1);
  assert.equal(aliased[0].format, 'matrix2of5');

  // A Data Logic symbol using the same digit table must not be misread as
  // Matrix 2 of 5, and vice versa — only the guard frame differs.
  const dataLogicImage = rendered(encodeDataLogic2of5(payload, { checkDigit: true }));
  assert.deepEqual(decode(dataLogicImage, { formats: ['matrix2of5'] }), []);
});

test('Matrix 2 of 5 camera profile requires a valid check digit and quiet zone', () => {
  const matrix = encodeMatrix2of5('86420', { checkDigit: true, wideRatio: 4 });
  const image = rendered(matrix, { scale: 2 });
  const result = decode(image, { formats: ['matrix2of5'], profile: 'camera' });
  assert.equal(result.length, 1);
  assert.equal(result[0].text, '86420');
  assert.equal(result[0].quality.checksum, true);

  const damaged = matrix.clone();
  damaged.flip(Math.floor(damaged.width / 2), 0);
  assert.equal(decode(rendered(damaged, { scale: 2 }), { formats: ['matrix2of5'], profile: 'camera' }).length, 0);
});

test('IATA 2 of 5 supports the same digit grammar with its own frame', () => {
  const payload = '31415926';
  const matrix = encodeIATA2of5(payload, { checkDigit: true, wideRatio: 4 });
  const result = decode(rendered(matrix, { scale: 2 }), {
    formats: ['iata-2-of-5'],
    checkDigit: true,
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].format, 'iata2of5');
  assert.equal(result[0].text, payload);
});

test('Code 25 camera profile requires a valid check digit and quiet zone', () => {
  const matrix = encodeIndustrial2of5('9876543', { checkDigit: true });
  const image = rendered(matrix);
  const result = decode(image, { formats: ['industrial2of5'], profile: 'camera' });
  assert.equal(result.length, 1);
  assert.equal(result[0].text, '9876543');
  assert.equal(result[0].quality.checksum, true);

  const damaged = matrix.clone();
  damaged.flip(Math.floor(damaged.width / 2), 0);
  assert.equal(decode(rendered(damaged), { formats: ['industrial2of5'], profile: 'camera' }).length, 0);
});

test('Code 32 accepts eight digits, validates its Luhn-style check and decodes', () => {
  const body = '01234567';
  const matrix = encodeCode32(body);
  const image = rendered(matrix);
  const result = decode(image, { formats: ['code32'] });
  assert.equal(result.length, 1);
  assert.equal(result[0].format, 'code32');
  assert.equal(result[0].text, body);
  assert.deepEqual(decodeCode32(matrix.getRow(0)), {
    format: 'code32',
    text: body,
    checkDigit: true,
  });
  assert.throws(() => encodeCode32(`${body}1`), /invalid check digit/);
});

test('PZN-7 and PZN-8 preserve their variant and check digit', () => {
  for (const [format, body, options, variant] of [
    ['pzn', '123456', {}, 'pzn7'],
    ['pzn8', '1234567', { pzn8: true }, 'pzn8'],
  ]) {
    const matrix = encodePZN(body, options);
    const image = rendered(matrix);
    const result = decode(image, { formats: [format] });
    assert.equal(result.length, 1, format);
    assert.equal(result[0].format, 'pzn');
    assert.equal(result[0].text, body);
    assert.equal(result[0].pznVariant, variant);
    assert.equal(result[0].checkDigit, true);
    assert.equal(decodePZN(matrix.getRow(0)).pznVariant, variant);
  }
  assert.throws(() => encodePZN('1234561'), /invalid check digit/);
  assert.throws(() => encodePZN('12345671', { pzn8: true }), /invalid check digit/);
});

test('new aliases are exposed by the top-level writer dispatcher', () => {
  for (const format of ['code32', 'italian-pharmacode', 'pzn', 'pzn7', 'pzn8',
    'code2of5', 'standard2of5', 'standard-2-of-5', 'industrial2of5',
    'industrial-2-of-5', 'iata2of5', 'iata-2-of-5', 'datalogic2of5', 'matrix2of5']) {
    assert.doesNotThrow(() => encode(format === 'code32' || format === 'italian-pharmacode'
      ? '01234567' : format.startsWith('pzn') ? (format === 'pzn8' ? '1234567' : '123456') : '1234', { format }));
  }
});
