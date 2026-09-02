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
 * Builds the browser bundles (`bundle/sythos-barcode.js`, an IIFE, and
 * `bundle/sythos-barcode.esm.js`, an ES module) from the compiled
 * `src/index.js` entry point and everything it transitively imports under
 * `src/js/`.
 *
 * Both bundles use a tiny hand-rolled module registry (`__modules`,
 * `__require`) rather than a real module system: each source file's ESM
 * `import`/`export` statements are mechanically rewritten into
 * `__require()` calls and `__exports.x = x` assignments, and everything
 * else in the file (including comments) is copied through byte-for-byte.
 * Only files reachable from `src/index.js` are included -- subpath-only
 * modules such as `kartrak`, `jabcode`, `payloads` and `color` are
 * deliberately excluded, matching their absence from the root `encode`/
 * `decode`/`listFormats()` surface (see docs/api/overview.md).
 *
 * @module tools/build-bundle
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const BUNDLE_DIR = path.join(ROOT, 'bundle');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;

function bundleHeader() {
  return `/*!
 * Sythos Barcode Suite v${VERSION}
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
 * Zero runtime dependencies.
 */
`;
}

/** Strips a file's own leading `/*! ... *\/` license banner; the bundle carries one shared header instead. */
function stripLicenseHeader(text) {
  return text.replace(/^\/\*!.*?\*\/\r?\n+/s, '');
}

function keyToFsPath(key) {
  return key === 'index.js' ? path.join(SRC, 'index.js') : path.join(SRC, ...key.split('/'));
}

/** Resolves a relative import/export specifier against the importing module's own key. */
function resolveKey(fromKey, specifier) {
  const fromDir = path.posix.dirname(fromKey);
  return path.posix.normalize(path.posix.join(fromDir, specifier));
}

/**
 * Rewrites one module's ESM import/export statements into the `__require`/
 * `__exports` idiom. Only top-level `ImportDeclaration`, `ExportNamedDeclaration`
 * and `ExportAllDeclaration` statements are touched; every other statement
 * (and every comment, since "leading trivia" is just the raw text between
 * two consecutive statements' offsets) is copied through unchanged.
 */
function transformModule(key) {
  const fsPath = keyToFsPath(key);
  const raw = fs.readFileSync(fsPath, 'utf8');
  const text = stripLicenseHeader(raw);
  const program = parse(text, { ecmaVersion: 2022, sourceType: 'module' });

  const deps = [];
  const parts = [];
  const deferred = [];
  let reexportCounter = 0;
  let cursor = 0;

  for (const stmt of program.body) {
    const leading = text.slice(cursor, stmt.start);
    cursor = stmt.end;

    if (stmt.type === 'ImportDeclaration') {
      const depKey = resolveKey(key, stmt.source.value);
      deps.push(depKey);
      let code;
      const namespaceSpec = stmt.specifiers.find((s) => s.type === 'ImportNamespaceSpecifier');
      const defaultSpec = stmt.specifiers.find((s) => s.type === 'ImportDefaultSpecifier');
      if (defaultSpec) throw new Error(`${key}: default imports are not supported`);
      if (namespaceSpec) {
        code = `const ${namespaceSpec.local.name} = __require(${JSON.stringify(depKey)});`;
      } else if (stmt.specifiers.length) {
        const bindings = stmt.specifiers.map((s) => {
          const local = s.local.name;
          const remote = s.imported.name;
          return remote === local ? local : `${remote}: ${local}`;
        });
        code = `const { ${bindings.join(', ')} } = __require(${JSON.stringify(depKey)});`;
      } else {
        code = `__require(${JSON.stringify(depKey)});`;
      }
      parts.push(leading + code);
      continue;
    }

    if (stmt.type === 'ExportAllDeclaration') {
      if (stmt.exported) throw new Error(`${key}: 'export * as ns' is not supported`);
      const depKey = resolveKey(key, stmt.source.value);
      deps.push(depKey);
      parts.push(`${leading}Object.assign(__exports, __require(${JSON.stringify(depKey)}));`);
      continue;
    }

    if (stmt.type === 'ExportNamedDeclaration') {
      if (stmt.declaration) {
        const decl = stmt.declaration;
        const names = [];
        if (decl.type === 'VariableDeclaration') {
          for (const d of decl.declarations) {
            if (d.id.type !== 'Identifier') throw new Error(`${key}: non-identifier export binding is not supported`);
            names.push(d.id.name);
          }
        } else if ((decl.type === 'FunctionDeclaration' || decl.type === 'ClassDeclaration') && decl.id) {
          names.push(decl.id.name);
        } else {
          throw new Error(`${key}: unsupported exported declaration kind ${decl.type}`);
        }
        deferred.push(...names);
        parts.push(leading + text.slice(decl.start, decl.end));
        continue;
      }
      if (stmt.source) {
        const depKey = resolveKey(key, stmt.source.value);
        deps.push(depKey);
        const varName = `__reexport${reexportCounter++}`;
        const assigns = stmt.specifiers.map((s) => `__exports.${s.exported.name} = ${varName}.${s.local.name};`);
        parts.push(`${leading}const ${varName} = __require(${JSON.stringify(depKey)}); ${assigns.join(' ')}`);
        continue;
      }
      const assigns = stmt.specifiers.map((s) => `__exports.${s.exported.name} = ${s.local.name};`);
      parts.push(leading + assigns.join(' '));
      continue;
    }

    parts.push(leading + text.slice(stmt.start, stmt.end));
  }

  if (deferred.length) {
    parts.push(`\n\n${deferred.map((n) => `__exports.${n} = ${n};`).join('\n')}\n`);
  }

  return { body: parts.join(''), deps };
}

/** Walks the reachable module graph from `index.js`, dependency-first, transforming each module once. */
function buildModuleRegistry() {
  const bodies = new Map();
  const order = [];

  function visit(key) {
    if (bodies.has(key)) return;
    bodies.set(key, ''); // guards against a cycle re-entering this module while it's being processed
    const { body, deps } = transformModule(key);
    for (const dep of deps) visit(dep);
    bodies.set(key, body);
    order.push(key);
  }

  visit('index.js');

  let out = '';
  for (const key of order) {
    out += `__modules[${JSON.stringify(key)}] = function (__require, __exports) {\n${bodies.get(key)}\n};\n\n`;
  }
  return { registrySource: out, moduleCount: order.length };
}

const RUNTIME_PREAMBLE = `var __modules = {};
var __cache = {};
function __require(id) {
  if (__cache[id]) return __cache[id];
  var exports = {};
  // Cache before executing so a future cycle would see a partial object rather
  // than recursing forever. The graph is acyclic today; this is a guard rail.
  __cache[id] = exports;
  __modules[id](__require, exports);
  return exports;
}

`;

function buildIife(registrySource) {
  return `${bundleHeader()}(function (globalThisRef) {
'use strict';
${RUNTIME_PREAMBLE}${registrySource}var __entry = __require("index.js");
globalThisRef.SythosBarcode = __entry;
if (typeof module === 'object' && module.exports) module.exports = __entry;
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
`;
}

function buildEsm(registrySource, exportedNames) {
  const names = [...exportedNames].sort();
  return `${bundleHeader()}'use strict';
${RUNTIME_PREAMBLE}${registrySource}const __entry = __require("index.js");
export default __entry;
export const {
${names.map((n) => `  ${n}`).join(',\n')}
} = __entry;
`;
}

const { registrySource, moduleCount } = buildModuleRegistry();

fs.mkdirSync(BUNDLE_DIR, { recursive: true });
fs.writeFileSync(path.join(BUNDLE_DIR, 'sythos-barcode.js'), buildIife(registrySource));

// The ESM bundle's named-export list must match the entry module's actual
// runtime keys exactly (including anything reached only via `export *`,
// which can't be enumerated statically without re-parsing every transitive
// re-export target). Evaluate the same registry in an isolated sandbox --
// not `require()` on the written file, since that goes through Node's CJS/ESM
// interop for a package whose own package.json says "type": "module", which
// does not reliably propagate a plain `module.exports = x` reassignment.
// eslint-disable-next-line no-new-func -- a deliberate, isolated sandbox eval, not user input.
const evaluate = new Function(`'use strict';\n${RUNTIME_PREAMBLE}${registrySource}return __require("index.js");`);
const entry = evaluate();
const exportedNames = Object.keys(entry);

fs.writeFileSync(path.join(BUNDLE_DIR, 'sythos-barcode.esm.js'), buildEsm(registrySource, exportedNames));

console.log(`Bundle built: ${moduleCount} modules, ${exportedNames.length} exports, version ${VERSION}`);
