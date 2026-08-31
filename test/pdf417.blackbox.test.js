import assert from 'node:assert/strict';
import test from 'node:test';
import report from './fixtures/pdf417-blackbox-2026-08-11.json' with { type: 'json' };

test('PDF417 black-box report records bidirectional text, numeric and binary vectors', () => {
  assert.equal(report.qualification.blackBoxOnly, true);
  assert.equal(report.qualification.runtimeDependenciesAdded, false);
  assert.ok(report.directions.sythosToZxing.every(({ result }) => result === 'pass'));
  assert.ok(report.directions.zxingToSythos.every(({ result }) => result === 'pass'));
  assert.ok(report.directions.bwipToSythos.every(({ result }) => result === 'pass'));
  assert.ok(report.directions.zintToSythos.every(({ result }) => result === 'pass'));
  assert.deepEqual(report.directions.zintToSythos.filter(({ mode }) => mode === 'byte').map(({ codewords }) => codewords), [901, 924]);
  assert.equal(report.qualification.binaryByteForByteInterop, 'pass-for-recorded-zint-901-and-924-vectors');
});
