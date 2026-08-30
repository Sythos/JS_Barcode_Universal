import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decode, encode, toImageData } from '../src/index.js';
import {
  decodeTelepen,
  decodeTelepenNumeric,
  encodeTelepen,
  encodeTelepenNumeric,
  telepenPattern,
  TELEPEN_MAX_LENGTH,
  TELEPEN_START_VALUE,
  TELEPEN_STOP_VALUE,
} from '../src/js/oned/telepen.js';

test('Telepen generates unique 16-module glyphs with documented guards', () => {
  const patterns = new Set();
  for (let value = 0; value < 128; value++) {
    const pattern = telepenPattern(value);
    assert.equal([...pattern].reduce((sum, width) => sum + Number(width), 0), 16);
    assert.equal(patterns.has(pattern), false);
    patterns.add(pattern);
  }
  assert.equal(telepenPattern(TELEPEN_START_VALUE), '111111111133');
  assert.equal(telepenPattern(TELEPEN_STOP_VALUE), '331111111111');
});

test('Telepen Alpha round-trips the complete seven-bit payload range', () => {
  const payload = String.fromCharCode(...Array.from({ length: 128 }, (_, value) => value));
  const decoded = decodeTelepen(encodeTelepen(payload).getRow(0));
  assert.ok(decoded);
  assert.equal(decoded.format, 'telepen');
  assert.equal(decoded.mode, 'ascii');
  assert.equal(decoded.text, payload);
});

test('Telepen Numeric supports digit pairs and digit-X pairs', () => {
  const payload = '00112738999X';
  const matrix = encodeTelepenNumeric(payload);
  const decoded = decodeTelepenNumeric(matrix.getRow(0));
  assert.deepEqual(decoded, { format: 'telepennumeric', text: payload, mode: 'numeric' });

  const publicImage = toImageData(encode(payload, { format: 'telepennumeric' }), {
    scale: 1,
    margin: 10,
    barHeight: 50,
  });
  const publicResult = decode(publicImage, { formats: ['telepennumeric'] });
  assert.equal(publicResult.length, 1);
  assert.equal(publicResult[0].text, payload);
  assert.equal(publicResult[0].format, 'telepennumeric');

  assert.throws(() => encodeTelepenNumeric('123'), /even number/);
  assert.doesNotThrow(() => encodeTelepenNumeric('1X'));
  assert.throws(() => encodeTelepenNumeric('X1'), /second position/);
});

test('Telepen generic image path handles scaling and strict corruption rejection', () => {
  const matrix = encodeTelepen('TELEPEN-CAMERA');
  const image = toImageData(matrix, { scale: 3, margin: 30, barHeight: 64 });
  const results = decode(image, { formats: ['telepen'] });
  assert.equal(results.length, 1);
  assert.equal(results[0].text, 'TELEPEN-CAMERA');

  const cameraResults = decode(image, { formats: ['telepen'], profile: 'camera' });
  assert.equal(cameraResults.length, 1);
  assert.equal(cameraResults[0].text, 'TELEPEN-CAMERA');

  const reversed = Uint8Array.from(matrix.scale(2).getRow(0)).reverse();
  assert.equal(decodeTelepen(reversed), null);

  const damaged = matrix.clone();
  damaged.flip(Math.floor(damaged.width / 2), 0);
  assert.equal(decodeTelepen(damaged.getRow(0)), null);
});

test('Telepen enforces the payload length boundary', () => {
  assert.doesNotThrow(() => encodeTelepen('A'.repeat(TELEPEN_MAX_LENGTH)));
  assert.throws(() => encodeTelepen('A'.repeat(TELEPEN_MAX_LENGTH + 1)), /limited/);
});
