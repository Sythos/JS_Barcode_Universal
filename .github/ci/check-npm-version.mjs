/*!
 * Sythos Barcode Universal
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-License-Identifier: MIT
 *
 * CI-only check that the npm CLI matches the packageManager field.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const match = /^npm@(\d+\.\d+\.\d+)$/u.exec(manifest.packageManager ?? '');

if (!match) {
  console.error('package.json packageManager must be "npm@<major>.<minor>.<patch>".');
  process.exit(1);
}

const expected = match[1];

if (process.argv.includes('--print')) {
  console.log(expected);
  process.exit(0);
}

const actual = execFileSync('npm', ['--version'], {
  encoding: 'utf8',
  shell: process.platform === 'win32'
}).trim();

if (actual !== expected) {
  console.error(`npm ${actual} is installed, but packageManager pins npm ${expected}.`);
  process.exit(1);
}

console.log(`npm ${actual} matches packageManager.`);
