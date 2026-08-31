import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const fixtureUrl = new URL('./fixtures/pdf417-device-evidence.user-attestation.json', import.meta.url);

test('PDF417 device evidence records only the supplied user attestation', async () => {
  const evidence = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  assert.equal(evidence.evidenceType, 'user-attestation');
  assert.deepEqual(evidence.observations.continuousReading, { attempts: 6, correct: 6 });
  assert.deepEqual(evidence.observations.readers, [
    'web application reported by the user as ZXing-based',
    'Pixel 10 camera with Android 17 and current Chrome',
    'iPhone 17 camera with current Safari',
  ]);
  assert.deepEqual(evidence.unknowns.payloads, null);
  assert.deepEqual(evidence.unknowns.sourceImagesOrVideo, null);
  assert.deepEqual(evidence.unknowns.symbolOptions, null);
  assert.deepEqual(evidence.unknowns.deviceModel, ['Pixel 10', 'iPhone 17']);
  assert.equal(evidence.unknowns.screenOrPrintMedium, 'Brother MFC-L2710DW laser print');
  assert.equal(evidence.qualification.supportsDeviceEvidenceGate, true);
  assert.equal(evidence.qualification.isAutomated, false);
  assert.equal(evidence.qualification.isReproducibleFromRepository, false);
  assert.equal(evidence.qualification.provesIndependentTwoEngineInteroperability, false);
  assert.equal(evidence.unknowns.readerApplicationAndVersion[0].includes('not recorded'), true);
  assert.equal(evidence.unknowns.readerApplicationAndVersion[1].includes('not recorded'), true);
  assert.equal(evidence.unknowns.operatingSystem[1].includes('not recorded'), true);
});
