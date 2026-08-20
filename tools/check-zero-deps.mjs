/*!
 * Sythos Barcode Suite — build tool
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

/**
 * Guard the zero-dependency promise.
 *
 * "Zero runtime dependencies" is a headline claim, and headline claims decay
 * quietly: someone adds one convenient import, the tests still pass, and the
 * README is wrong from then on. This makes that a build failure instead.
 *
 * Two things are checked, because either alone is insufficient:
 *
 *   1. package.json declares no dependencies or peerDependencies.
 *   2. No file in src/ imports a bare specifier. A dependency that is imported
 *      but undeclared is still a dependency — it just fails at the consumer's
 *      install rather than ours.
 *
 * `node:` builtins are permitted. They are part of the runtime rather than
 * something npm installs, and the two places they appear are both feature
 * -detected with a fallback, so a browser build never reaches them.
 *
 * Usage: node tools/check-zero-deps.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const problems = [];

// --- 1. Declared dependencies.
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
  const names = Object.keys(pkg[field] || {});
  if (names.length) {
    problems.push(`package.json ${field}: ${names.join(', ')}`);
  }
}

// --- 2. Imports in src/.
/** @param {string} dir @returns {string[]} */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.js') || name.endsWith('.ts')) out.push(full);
  }
  return out;
}

const patterns = [
  /^\s*import\s+[^'"]*from\s*['"]([^'"]+)['"]/gm,
  /^\s*import\s*['"]([^'"]+)['"]/gm,
  /^\s*export\s+[^'"]*from\s*['"]([^'"]+)['"]/gm,
  // Dynamic imports too — that is how node:zlib is reached in png.js.
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
];

let nodeBuiltins = 0;

for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file).split('\\').join('/');

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const spec = match[1];
      if (spec.startsWith('.')) continue;
      if (spec.startsWith('node:')) {
        nodeBuiltins++;
        continue;
      }
      problems.push(`${rel} imports "${spec}" — bare specifiers are dependencies`);
    }
  }
}

if (problems.length) {
  console.error('Zero-dependency rule violated:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

console.log(
  `  zero dependencies confirmed ` +
  `(${nodeBuiltins} guarded node: builtin import${nodeBuiltins === 1 ? '' : 's'})`
);
