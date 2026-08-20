/*!
 * Sythos Barcode Suite — TypeScript compiler bridge
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

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = join(ROOT, 'temp', 'typescript');
const RUNTIME = join(ROOT, 'src', 'js');
const ENTRY = join(ROOT, 'src', 'index.js');
const TSC = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

function fail(message) {
  console.error(`TypeScript compilation failed: ${message}`);
  process.exit(1);
}

if (!existsSync(TSC)) {
  fail('the development dependency "typescript" is not installed');
}

rmSync(OUTPUT, { recursive: true, force: true });
mkdirSync(OUTPUT, { recursive: true });

const result = spawnSync(process.execPath, [TSC, '-p', join(ROOT, 'tsconfig.runtime.json')], {
  cwd: ROOT,
  stdio: 'inherit',
});
if (result.error) fail(result.error.message);
if (result.status !== 0) process.exit(result.status || 1);

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && full.endsWith('.js')) files.push(full);
  }
  return files;
}

const compiled = walk(OUTPUT);
const rootOutput = join(OUTPUT, 'index.js');
if (!existsSync(rootOutput)) fail('the TypeScript entry module was not emitted');

for (const file of compiled) {
  const rel = relative(OUTPUT, file);
  if (rel === 'index.js') {
    const source = readFileSync(file, 'utf8');
    const runtimeEntry = source
      .replace(/(from\s+['"])\.\//g, '$1./js/')
      .replace(/(import\(\s*['"])\.\//g, '$1./js/');
    writeFileSync(ENTRY, runtimeEntry);
    continue;
  }

  const target = join(RUNTIME, rel);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(file, target);
}

rmSync(OUTPUT, { recursive: true, force: true });
console.log(`  TypeScript runtime compiled: ${compiled.length} modules`);
