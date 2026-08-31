import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GS1_SEPARATOR,
  decodeGS1ElementString,
  encodeGS1ElementString,
  formatGS1Elements,
  gs1AIInfo,
  parseGS1ElementString,
} from '../src/js/databar/gs1.js';

test('GS1 codec preserves fixed and variable-length DataBar Expanded fields', () => {
  const readable = '(01)09506000134352(17)280531(10)ABC123(21)987654';
  const encoded = encodeGS1ElementString(readable);
  assert.equal(encoded, `01095060001343521728053110ABC123${GS1_SEPARATOR}21987654`);
  assert.equal(formatGS1Elements(decodeGS1ElementString(encoded)), readable);
});

test('GS1 codec accepts structured fields and decimal-indicator AIs', () => {
  const fields = [
    { ai: '01', value: '09506000134352' },
    { ai: '3103', value: '001750' },
    { ai: '3922', value: '1299' },
  ];
  const encoded = encodeGS1ElementString(fields);
  assert.equal(encoded, '0109506000134352310300175039221299');
  assert.deepEqual(decodeGS1ElementString(encoded).map(({ ai, value }) => ({ ai, value })), fields);
});

test('GS1 AI metadata distinguishes fixed and variable fields', () => {
  assert.deepEqual(gs1AIInfo('01'), { ai: '01', length: 14, fixed: true });
  assert.deepEqual(gs1AIInfo('10'), { ai: '10', length: 20, fixed: false });
  assert.deepEqual(gs1AIInfo('3103'), { ai: '3103', length: 6, fixed: true });
  assert.equal(gs1AIInfo('9999'), undefined);
});

test('GS1 parser rejects malformed, unsupported, oversized and truncated fields', () => {
  assert.throws(() => parseGS1ElementString('0109506000134352'), /expected an Application Identifier/);
  assert.throws(() => parseGS1ElementString('(9999)ABC'), /unsupported or invalid/);
  assert.throws(() => parseGS1ElementString('(01)123'), /exactly 14/);
  assert.throws(() => parseGS1ElementString('(10)123456789012345678901'), /at most 20/);
  assert.throws(() => decodeGS1ElementString('01123'), /truncated fixed-length/);
  assert.throws(() => decodeGS1ElementString(`${GS1_SEPARATOR}0109506000134352`), /unexpected separator/);
});
