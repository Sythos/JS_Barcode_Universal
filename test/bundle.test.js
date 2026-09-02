import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const IIFE_PATH = fileURLToPath(new URL('../bundle/sythos-barcode.js', import.meta.url));
const ESM_URL = new URL('../bundle/sythos-barcode.esm.js', import.meta.url);
const PACKAGE_VERSION = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')).version;

// Loading the IIFE bundle via require() only exercises its side effect (it
// sets globalThis.SythosBarcode, the documented browser <script> tag
// contract) -- its own `module.exports = __entry` reassignment does not
// reliably propagate back through require()'s return value in a package
// whose package.json declares "type": "module", so that return value is
// never asserted on here.
require(IIFE_PATH);
const SythosBarcode = globalThis.SythosBarcode;

test('the IIFE bundle sets the documented globalThis.SythosBarcode entry point', () => {
  assert.equal(typeof SythosBarcode, 'object');
  assert.ok(SythosBarcode);
});

test('the bundled VERSION matches package.json', () => {
  assert.equal(SythosBarcode.VERSION, PACKAGE_VERSION);
});

test('listFormats() reports the full 61-entry registry through the bundle', () => {
  const formats = SythosBarcode.listFormats();
  assert.equal(formats.length, 61);
});

test('QR round-trips through the bundle: encode, render, decode', () => {
  const matrix = SythosBarcode.encodeQR('Bundle QR check', { ecc: 'M' });
  const image = SythosBarcode.toImageData(matrix, { scale: 4, margin: 4 });
  const [result] = SythosBarcode.decode(image, { formats: ['qr'] });
  assert.equal(result?.text, 'Bundle QR check');
});

test('DataMatrix round-trips through the bundle', () => {
  const matrix = SythosBarcode.encodeDataMatrix('Bundle DM check');
  const image = SythosBarcode.toImageData(matrix, { scale: 4, margin: 4 });
  const [result] = SythosBarcode.decode(image, { formats: ['datamatrix'] });
  assert.equal(result?.text, 'Bundle DM check');
});

test('PDF417 round-trips through the bundle', () => {
  const matrix = SythosBarcode.encodePDF417('Bundle PDF417 check');
  const image = SythosBarcode.toImageData(matrix, { scale: 3, margin: 4 });
  const [result] = SythosBarcode.decode(image, { formats: ['pdf417'] });
  assert.equal(result?.text, 'Bundle PDF417 check');
});

// These formats were added to src/ after the browser bundles were last
// rebuilt (a1ff72e..0ff525c) and were confirmed missing before tools/build-bundle.mjs
// existed -- kept here as regression coverage for that staleness bug.
test('formats added since the bundle was last hand-built are present', () => {
  for (const name of [
    'encodeDXFilmEdge', 'decodeDXFilmEdge',
    'encodePostBarC10', 'encodePostBarD22', 'encodePostBarG12', 'decodePostBar',
    'encodeStandard2of5', 'decodeStandard2of5',
    'encodeMatrix2of5', 'decodeMatrix2of5',
    'encodeJAN', 'encodeITF6',
    'encodeDataLogic2of5', 'decodeDataLogic2of5',
  ]) {
    assert.equal(typeof SythosBarcode[name], 'function', `${name} missing from the bundle`);
  }
});

// KarTrak, JAB Code and the payload conventions are deliberately absent from
// the root encode()/decode()/listFormats() surface (see docs/api/overview.md)
// and are published only via their own subpath exports -- the browser bundle
// mirrors src/index.js exactly, so they must stay out of it too.
test('subpath-only modules stay out of the bundle by design', () => {
  for (const name of ['encodeKarTrak', 'encodeJABCode', 'encodeVCard', 'encodeSwissQR']) {
    assert.equal(SythosBarcode[name], undefined, `${name} unexpectedly present in the bundle`);
  }
});

test('the ESM bundle exposes the same surface as the IIFE bundle', async () => {
  const esm = await import(ESM_URL);
  assert.equal(esm.default.VERSION, PACKAGE_VERSION);
  assert.equal(esm.VERSION, PACKAGE_VERSION);
  assert.deepEqual(Object.keys(esm.default).sort(), Object.keys(SythosBarcode).sort());

  const matrix = esm.encodeQR('ESM bundle check', { ecc: 'M' });
  const image = esm.toImageData(matrix, { scale: 4, margin: 4 });
  const [result] = esm.decode(image, { formats: ['qr'] });
  assert.equal(result?.text, 'ESM bundle check');
});
