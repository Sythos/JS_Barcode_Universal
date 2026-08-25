/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-License-Identifier: MIT
 *
 * CI-only package validation. This file is not part of the runtime SDK.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const packagePath = join(repositoryRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

function fail(message) {
  console.error(`Package validation failed: ${message}`);
  process.exit(1);
}

function collectExportTargets(value, targets = []) {
  if (typeof value === 'string') {
    targets.push(value);
    return targets;
  }
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) collectExportTargets(nested, targets);
  }
  return targets;
}

function walkSource(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkSource(absolute));
    else if (entry.isFile() && absolute.endsWith('.js')) files.push(absolute);
  }
  return files;
}

if (packageJson.dependencies || packageJson.optionalDependencies) {
  fail('runtime dependencies are present; keep validation tools in devDependencies only');
}

const exportTargets = collectExportTargets(packageJson.exports);
for (const target of exportTargets) {
  if (!target.startsWith('./')) fail(`unsupported export target: ${target}`);
  const absolute = resolve(repositoryRoot, target.slice(2));
  if (!existsSync(absolute)) fail(`missing export target: ${target}`);
}

const sourceRoot = join(repositoryRoot, 'src');
const sourceFiles = walkSource(sourceRoot);
for (const sourceFile of sourceFiles) {
  const syntax = spawnSync(process.execPath, ['--check', sourceFile], { encoding: 'utf8' });
  if (syntax.status !== 0) {
    process.stderr.write(syntax.stderr || 'JavaScript syntax check failed.\n');
    process.exit(syntax.status || 1);
  }
}

const publicModule = await import(`${pathToFileURL(join(sourceRoot, 'index.js')).href}?ci=${Date.now()}`);
for (const name of ['encode', 'decode', 'listFormats']) {
  if (typeof publicModule[name] !== 'function') fail(`public API export is missing: ${name}`);
}

for (const invalidImage of [
  null,
  { data: new Uint8Array(4), width: 0, height: 1 },
  { data: new Uint8Array(4), width: 1, height: 16_777_217 },
  { data: [-1, 0, 0, 255], width: 1, height: 1 },
]) {
  try {
    publicModule.decode(invalidImage, { formats: ['qr'] });
  } catch {
    continue;
  }
  fail('image input validation accepted malformed or unsafe raster data');
}

const callerOwnedGrey = new Uint8Array([17]);
const greySnapshot = publicModule.LuminanceSource.fromGrey(callerOwnedGrey, 1, 1);
callerOwnedGrey[0] = 231;
if (greySnapshot.get(0, 0) !== 17) {
  fail('greyscale input is still backed by caller-owned mutable data');
}

const qrMatrix = publicModule.encode('CI smoke', { format: 'qr' });
if (!qrMatrix || !Number.isInteger(qrMatrix.width) || !Number.isInteger(qrMatrix.height)) {
  fail('QR encoder did not return a valid BitMatrix');
}

const image = publicModule.toImageData(qrMatrix, { scale: 3, quiet: 2 });
const decoded = publicModule.decode(image, { formats: ['qr'], binarizer: 'global' });
if (!decoded.some((result) => result.text === 'CI smoke')) {
  fail('QR encode/render/decode smoke test did not recover the payload');
}

const esmBundle = await import(`${pathToFileURL(join(repositoryRoot, 'bundle', 'sythos-barcode.esm.js')).href}?ci=${Date.now()}`);
if (typeof esmBundle.encode !== 'function' || typeof esmBundle.decode !== 'function') {
  fail('ESM bundle does not expose the public encode/decode API');
}

const typeSourceFiles = [];
function walkTypeScript(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) walkTypeScript(absolute);
    else if (entry.isFile() && absolute.endsWith('.ts') && !absolute.endsWith('.d.ts')) typeSourceFiles.push(absolute);
  }
}
walkTypeScript(sourceRoot);

console.log(`Validated ${exportTargets.length} export targets, ${sourceFiles.length} JavaScript source files and ${typeSourceFiles.length} TypeScript source files.`);
console.log(`Runtime dependency check passed; ${publicModule.listFormats().length} format entries are registered.`);
