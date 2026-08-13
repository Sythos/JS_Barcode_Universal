/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
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
 * Structural contract for FrameQR Code.
 *
 * DENSO WAVE's public material describes FrameQR(R) as a proprietary symbol
 * with a freely shaped canvas, dedicated generation/reading software and no
 * compatibility with ordinary QR readers. It does not publish the bitstream,
 * placement or error-correction rules required for an interoperable encoder.
 * Consequently this module does not claim to implement DENSO FrameQR.
 *
 * The implementable profile below starts with an ISO/IEC 18004 QR Model 2
 * symbol at level H and clears a bounded group of data modules. Its worst-case
 * damage is calculated per Reed-Solomon block and must remain within the
 * standard QR correction radius. Function modules are never canvas modules.
 * This provides a deterministic, independently testable FrameQR Code profile, but
 * it is explicitly non-certified and not a substitute for proprietary FrameQR
 * generation or validation software.
 *
 * @module frameqr/tables
 */

import {
  blockLayout,
  dataModuleOrder,
  reservedModules,
  versionSize,
} from '../qr/tables.js';

/** Public identity and compatibility boundary of the implementable profile. */
export const FRAMEQR_PROFILE = Object.freeze({
  id: 'sythos-canvas-qr/1',
  name: 'FrameQR Code',
  certified: false,
  densoFrameQrCompatible: false,
  baseSymbology: 'QR Code Model 2',
  requiredEcc: 'H',
  standard: 'ISO/IEC 18004 QR Code baseline',
});

/** Canvas shapes whose module membership is fully deterministic. */
export const FRAMEQR_CANVAS_SHAPES = Object.freeze(['square', 'circle', 'diamond']);

function oddAtMost(value, maximum) {
  let n = Math.max(1, Math.min(maximum, Math.floor(value)));
  if ((n & 1) === 0) n--;
  return Math.max(1, n);
}

function assertSymbolSize(symbolSize) {
  if (!Number.isInteger(symbolSize) || symbolSize < 21 || symbolSize > 177 || (symbolSize - 17) % 4 !== 0) {
    throw new RangeError(`FrameQR Code: ${symbolSize} is not a QR Model 2 symbol size`);
  }
}

/**
 * Canonicalise a canvas request.
 *
 * Coordinates and dimensions are module units. Odd dimensions make the centre
 * unambiguous. Only quarter turns are accepted because arbitrary-angle raster
 * membership would depend on renderer-specific sampling.
 *
 * @param {number} symbolSize QR module width/height (21..177).
 * @param {object} [canvas]
 * @returns {{shape:string,centerX:number,centerY:number,width:number,height:number,angle:number}}
 */
export function normalizeCanvasSpec(symbolSize, canvas = {}) {
  assertSymbolSize(symbolSize);
  if (canvas === null || typeof canvas !== 'object' || Array.isArray(canvas)) {
    throw new TypeError('FrameQR Code: canvas must be an object');
  }

  const shape = String(canvas.shape ?? 'square').toLowerCase();
  if (!FRAMEQR_CANVAS_SHAPES.includes(shape)) {
    throw new RangeError(`FrameQR Code: unsupported canvas shape "${shape}"`);
  }

  const defaultSize = oddAtMost(Math.max(3, Math.round(symbolSize * 0.17)), symbolSize - 16);
  const requestedSize = canvas.size;
  const requestedWidth = canvas.width ?? requestedSize ?? defaultSize;
  const requestedHeight = canvas.height ?? requestedSize ?? defaultSize;
  const maximumDimension = symbolSize - 16;
  for (const [name, value] of [['width', requestedWidth], ['height', requestedHeight]]) {
    if (!Number.isFinite(Number(value)) || Number(value) < 1 || Number(value) > maximumDimension) {
      throw new RangeError(
        `FrameQR Code: canvas ${name} must be between 1 and ${maximumDimension} modules`
      );
    }
  }
  const width = oddAtMost(Number(requestedWidth), maximumDimension);
  const height = oddAtMost(Number(requestedHeight), maximumDimension);
  const centerX = Math.round(canvas.centerX ?? (symbolSize - 1) / 2);
  const centerY = Math.round(canvas.centerY ?? (symbolSize - 1) / 2);
  const angle = ((Number(canvas.angle ?? 0) % 360) + 360) % 360;

  if (![0, 90, 180, 270].includes(angle)) {
    throw new RangeError('FrameQR Code: angle must be 0, 90, 180 or 270 degrees');
  }
  if (centerX < 8 || centerY < 8 || centerX >= symbolSize - 8 || centerY >= symbolSize - 8) {
    throw new RangeError('FrameQR Code: canvas centre must remain inside the finder-pattern boundary');
  }

  return { shape, centerX, centerY, width, height, angle };
}

/**
 * Enumerate canvas modules, including any overlaps with QR function modules.
 * A conforming encoder rejects such overlaps rather than damaging function
 * patterns.
 *
 * @param {number} symbolSize
 * @param {object} [canvas]
 * @returns {Array<[number, number]>}
 */
export function canvasModules(symbolSize, canvas = {}) {
  const spec = normalizeCanvasSpec(symbolSize, canvas);
  const rotate = spec.angle === 90 || spec.angle === 270;
  const width = rotate ? spec.height : spec.width;
  const height = rotate ? spec.width : spec.height;
  const halfWidth = (width - 1) / 2;
  const halfHeight = (height - 1) / 2;
  const modules = [];

  for (let dy = -halfHeight; dy <= halfHeight; dy++) {
    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      const nx = halfWidth === 0 ? 0 : dx / halfWidth;
      const ny = halfHeight === 0 ? 0 : dy / halfHeight;
      let inside;
      if (spec.shape === 'circle') inside = nx * nx + ny * ny <= 1 + Number.EPSILON;
      else if (spec.shape === 'diamond') inside = Math.abs(nx) + Math.abs(ny) <= 1 + Number.EPSILON;
      else inside = true;
      if (inside) modules.push([spec.centerX + dx, spec.centerY + dy]);
    }
  }
  return modules;
}

/** Build the interleaved-codeword to RS-block map used by QR Model 2. */
function codewordBlockMap(layout) {
  const dataCounts = new Array(layout.blockCount);
  for (let block = 0; block < layout.blockCount; block++) {
    dataCounts[block] = block < layout.group1Blocks
      ? layout.group1DataCount
      : layout.group2DataCount;
  }

  const map = [];
  const maxData = Math.max(...dataCounts);
  for (let i = 0; i < maxData; i++) {
    for (let block = 0; block < layout.blockCount; block++) {
      if (i < dataCounts[block]) map.push(block);
    }
  }
  for (let i = 0; i < layout.eccPerBlock; i++) {
    for (let block = 0; block < layout.blockCount; block++) map.push(block);
  }
  return map;
}

/**
 * Calculate worst-case QR codeword damage caused by a canvas.
 * A codeword is counted if any of its modules is touched. This is conservative:
 * clearing an already-light module does no damage, but safety cannot depend on
 * one payload or mask.
 *
 * @param {number} version QR version 1..40.
 * @param {object} [canvas]
 */
export function analyzeCanvasDamage(version, canvas = {}) {
  if (!Number.isInteger(version) || version < 1 || version > 40) {
    throw new RangeError(`FrameQR Code: version must be an integer 1-40, got ${version}`);
  }
  const symbolSize = versionSize(version);
  const spec = normalizeCanvasSpec(symbolSize, canvas);
  const modules = canvasModules(symbolSize, spec);
  const reserved = reservedModules(version);
  const reservedOverlaps = modules.filter(([x, y]) => reserved.get(x, y));

  const moduleKeys = new Set(modules.map(([x, y]) => `${x},${y}`));
  const order = dataModuleOrder(version);
  const touchedCodewords = new Set();
  for (let bit = 0; bit < order.length / 2; bit++) {
    if (moduleKeys.has(`${order[bit * 2]},${order[bit * 2 + 1]}`)) touchedCodewords.add(bit >> 3);
  }

  const layout = blockLayout(version, 'H');
  const blockMap = codewordBlockMap(layout);
  const touchedByBlockSets = Array.from({ length: layout.blockCount }, () => new Set());
  for (const codeword of touchedCodewords) {
    const block = blockMap[codeword];
    if (block !== undefined) touchedByBlockSets[block].add(codeword);
  }
  const touchedCodewordsByBlock = touchedByBlockSets.map((set) => set.size);
  const correctionBudgetPerBlock = Math.floor(layout.eccPerBlock / 2);
  const safe = reservedOverlaps.length === 0 &&
    touchedCodewordsByBlock.every((count) => count <= correctionBudgetPerBlock);

  return {
    profile: FRAMEQR_PROFILE.id,
    certified: false,
    version,
    symbolSize,
    canvas: spec,
    canvasModuleCount: modules.length,
    reservedOverlaps,
    touchedCodewordCount: touchedCodewords.size,
    touchedCodewordsByBlock,
    correctionBudgetPerBlock,
    safe,
  };
}

/** Validate a canvas and return the non-certifying structural analysis. */
export function validateCanvasSpec(version, canvas = {}) {
  return analyzeCanvasDamage(version, canvas);
}

/** Self-check the fixed profile contract and representative QR geometries. */
export function validateFrameQrTables() {
  const problems = [];
  if (FRAMEQR_PROFILE.certified !== false || FRAMEQR_PROFILE.densoFrameQrCompatible !== false) {
    problems.push('profile compatibility boundary must remain explicitly non-certified');
  }
  if (new Set(FRAMEQR_CANVAS_SHAPES).size !== FRAMEQR_CANVAS_SHAPES.length) {
    problems.push('canvas shape identifiers must be unique');
  }
  for (const version of [1, 2, 3, 4, 7, 10, 20, 30, 40]) {
    const size = versionSize(version);
    const spec = normalizeCanvasSpec(size);
    const modules = canvasModules(size, spec);
    const unique = new Set(modules.map(([x, y]) => `${x},${y}`));
    if (unique.size !== modules.length) problems.push(`v${version}: duplicate canvas modules`);
    if (modules.some(([x, y]) => x < 0 || y < 0 || x >= size || y >= size)) {
      problems.push(`v${version}: canvas escapes the symbol`);
    }
    const analysis = analyzeCanvasDamage(version, spec);
    if (analysis.touchedCodewordsByBlock.length !== blockLayout(version, 'H').blockCount) {
      problems.push(`v${version}: damage analysis block count mismatch`);
    }
  }
  return problems;
}
