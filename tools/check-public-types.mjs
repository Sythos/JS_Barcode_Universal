/*!
 * Sythos Barcode Suite — public declaration validator
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'src');
const TEMP = join(ROOT, 'temp', 'type-api', 'src');
const TSC = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && full.endsWith('.d.ts')) files.push(full);
  }
  return files;
}

if (!existsSync(TSC)) {
  console.error('Public declaration validation requires the development dependency "typescript".');
  process.exit(1);
}

rmSync(join(ROOT, 'temp', 'type-api'), { recursive: true, force: true });
mkdirSync(TEMP, { recursive: true });

for (const file of [join(SOURCE, 'index.d.ts'), ...walk(join(SOURCE, 'ts'))]) {
  const target = join(TEMP, relative(SOURCE, file));
  mkdirSync(dirname(target), { recursive: true });
  cpSync(file, target);
}

const entry = join(TEMP, 'index.d.ts');
const bundleEsm = join(TEMP, 'ts', 'bundle', 'sythos-barcode.esm.d.ts');
const bundleIife = join(TEMP, 'ts', 'bundle', 'sythos-barcode.d.ts');
const result = spawnSync(process.execPath, [
  TSC,
  '--ignoreConfig',
  '--noEmit',
  '--skipLibCheck', 'false',
  '--moduleResolution', 'nodenext',
  '--module', 'nodenext',
  entry,
  bundleEsm,
  bundleIife,
], { cwd: ROOT, stdio: 'inherit' });

rmSync(join(ROOT, 'temp', 'type-api'), { recursive: true, force: true });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);
console.log('  public TypeScript declarations validated');
