/*!
 * Sythos Barcode Suite
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
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */

import { BitMatrix } from '../core/bit-matrix.js';
import { sampleGrid, sampleGridVoting } from '../image/grid-sampler.js';
import { PerspectiveTransform } from '../image/perspective.js';
import { decodePDF417 } from './decoder.js';

const START_PATTERN = [8, 1, 1, 1, 1, 1, 1, 3];
const STOP_PATTERN = [7, 1, 1, 3, 1, 1, 1, 2, 1];
const SCAN_ANGLES = [0, -4, 4, -8, 8, -14, 14, -22, 22, -32, 32]
  .map((degrees) => degrees * Math.PI / 180);

function rotateClockwise(source) {
  const rotated = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    if (source.get(x, y)) rotated.set(source.height - 1 - y, x);
  }
  return rotated;
}

function scanGeometry(angle) {
  return {
    along: { x: Math.cos(angle), y: Math.sin(angle) },
    across: { x: -Math.sin(angle), y: Math.cos(angle) },
  };
}

function projectionRange(image, vector) {
  const points = [
    { x: 0, y: 0 }, { x: image.width - 1, y: 0 },
    { x: image.width - 1, y: image.height - 1 }, { x: 0, y: image.height - 1 },
  ];
  const values = points.map((point) => point.x * vector.x + point.y * vector.y);
  return { min: Math.min(...values), max: Math.max(...values) };
}

function lineRange(image, geometry, across) {
  const { along, across: normal } = geometry;
  let min = -Infinity, max = Infinity;
  const constrain = (low, high, step, offset) => {
    if (Math.abs(step) < 1e-9) return offset >= low && offset <= high;
    const first = (low - offset) / step, second = (high - offset) / step;
    min = Math.max(min, Math.min(first, second));
    max = Math.min(max, Math.max(first, second));
    return min <= max;
  };
  if (!constrain(0, image.width - 1, along.x, normal.x * across) ||
      !constrain(0, image.height - 1, along.y, normal.y * across)) return null;
  return { min: Math.ceil(min), max: Math.floor(max) };
}

function runsInLine(image, geometry, across) {
  const range = lineRange(image, geometry, across);
  if (!range || range.max < range.min) return [];
  const { along, across: normal } = geometry;
  const runs = [];
  const valueAt = (position) => image.get(
    Math.round(along.x * position + normal.x * across),
    Math.round(along.y * position + normal.y * across),
  );
  let dark = valueAt(range.min), start = range.min;
  for (let position = range.min + 1; position <= range.max + 1; position++) {
    const value = position <= range.max ? valueAt(position) : !dark;
    if (value !== dark) {
      runs.push({ dark, start, end: position, length: position - start });
      start = position; dark = value;
    }
  }
  return runs;
}

function removeSinglePixelSpecks(runs) {
  const clean = runs.map((run) => ({ ...run }));
  for (let index = 1; index < clean.length - 1;) {
    if (clean[index].length > 1) { index++; continue; }
    const merged = {
      dark: clean[index - 1].dark,
      start: clean[index - 1].start,
      end: clean[index + 1].end,
      length: clean[index - 1].length + clean[index].length + clean[index + 1].length,
    };
    clean.splice(index - 1, 3, merged);
    index = Math.max(1, index - 2);
  }
  return clean;
}

function matchPattern(runs, at, expected) {
  if (at + expected.length > runs.length || !runs[at].dark) return null;
  let observed = 0, modules = 0;
  for (let i = 0; i < expected.length; i++) { observed += runs[at + i].length; modules += expected[i]; }
  const scale = observed / modules;
  if (scale < 0.65) return null;
  let error = 0;
  for (let i = 0; i < expected.length; i++) {
    const delta = Math.abs(runs[at + i].length - expected[i] * scale);
    if (delta > Math.max(1.15, scale * 0.62)) return null;
    error += delta / scale;
  }
  if (error / expected.length > 0.48) return null;
  return { start: runs[at].start, end: runs[at + expected.length - 1].end, scale, error, at };
}

function quietPenalty(runs, start, stop) {
  const before = start.at > 0 ? runs[start.at - 1].length / start.scale : 0;
  const afterIndex = stop.at + STOP_PATTERN.length;
  const after = afterIndex < runs.length ? runs[afterIndex].length / stop.scale : 0;
  return Math.max(0, 2 - before) + Math.max(0, 2 - after);
}

function patternPairs(runs) {
  const starts = [], stops = [];
  for (let at = 0; at < runs.length; at++) {
    const start = matchPattern(runs, at, START_PATTERN); if (start) starts.push(start);
    const stop = matchPattern(runs, at, STOP_PATTERN); if (stop) stops.push(stop);
  }
  const pairs = [];
  for (const start of starts) for (const stop of stops) {
    if (stop.start <= start.end) continue;
    const measured = stop.end - start.start;
    const localScale = Math.sqrt(start.scale * stop.scale);
    const roughColumns = Math.round((measured / localScale - 69) / 17);
    for (let columns = Math.max(1, roughColumns - 2); columns <= Math.min(30, roughColumns + 2); columns++) {
      const width = 69 + columns * 17;
      const globalScale = measured / width;
      const ratio = Math.max(start.scale, stop.scale, globalScale) /
        Math.min(start.scale, stop.scale, globalScale);
      if (ratio > 1.85) continue;
      const scaleError = Math.abs(Math.log(start.scale / globalScale)) +
        Math.abs(Math.log(stop.scale / globalScale));
      pairs.push({ start, stop, columns, width, scale: globalScale,
        startScale: start.scale, stopScale: stop.scale,
        error: start.error + stop.error + scaleError * 4 + quietPenalty(runs, start, stop) * 0.15 });
    }
  }
  pairs.sort((a, b) => a.error - b.error);
  const used = new Set();
  return pairs.filter((pair) => {
    if (used.has(pair.columns)) return false;
    used.add(pair.columns);
    return used.size <= 3;
  });
}

function pointAt(geometry, along, across) {
  return {
    x: geometry.along.x * along + geometry.across.x * across,
    y: geometry.along.y * along + geometry.across.y * across,
  };
}

function scanHits(image, angle) {
  const geometry = scanGeometry(angle);
  const range = projectionRange(image, geometry.across);
  const hits = [];
  for (let across = Math.ceil(range.min); across <= Math.floor(range.max); across++) {
    const raw = runsInLine(image, geometry, across);
    let pairs = patternPairs(raw);
    if (!pairs.length) pairs = patternPairs(removeSinglePixelSpecks(raw));
    for (const pair of pairs) {
      hits.push({ across, left: pair.start.start, right: pair.stop.end,
        leftPoint: pointAt(geometry, pair.start.start, across),
        rightPoint: pointAt(geometry, pair.stop.end, across),
        scale: pair.scale, startScale: pair.startScale, stopScale: pair.stopScale,
        columns: pair.columns, width: pair.width, error: pair.error,
        geometry });
    }
  }
  return hits;
}

function fittedLine(hits, key) {
  const meanX = hits.reduce((sum, hit) => sum + hit.across, 0) / hits.length;
  const meanY = hits.reduce((sum, hit) => sum + hit[key], 0) / hits.length;
  let covariance = 0, variance = 0;
  for (const hit of hits) {
    const delta = hit.across - meanX;
    covariance += delta * (hit[key] - meanY);
    variance += delta * delta;
  }
  const slope = variance ? covariance / variance : 0;
  return { slope, intercept: meanY - slope * meanX };
}

function lineValue(line, at) {
  return line.intercept + line.slope * at;
}

function finderExtent(image, hits, edgeKey, scaleKey, centreModules, fallback) {
  const geometry = hits[0].geometry;
  const edge = fittedLine(hits, edgeKey), scale = fittedLine(hits, scaleKey);
  const span = fallback.bottom - fallback.top;
  const projection = projectionRange(image, geometry.across);
  const margin = Math.max(6, span * 0.35, hits[0].scale * 4);
  const start = Math.max(Math.ceil(projection.min), Math.floor(fallback.top - margin));
  const end = Math.min(Math.floor(projection.max), Math.ceil(fallback.bottom + margin));
  const values = [];
  for (let across = start; across <= end; across++) {
    const localScale = Math.max(0.5, lineValue(scale, across));
    const centre = lineValue(edge, across) + localScale * centreModules;
    let dark = 0;
    for (const offset of [-0.75, 0, 0.75]) {
      const point = pointAt(geometry, centre + localScale * offset, across);
      if (image.get(Math.round(point.x), Math.round(point.y))) dark++;
    }
    values.push({ across, dark: dark >= 2 });
  }
  const segments = [];
  let first = null, lastDark = null, gap = 0;
  for (const value of values) {
    if (value.dark) {
      if (first === null) first = value.across;
      lastDark = value.across; gap = 0;
    } else if (first !== null && ++gap > 2) {
      segments.push({ top: first, bottom: lastDark + 1 });
      first = null; lastDark = null; gap = 0;
    }
  }
  if (first !== null) segments.push({ top: first, bottom: lastDark + 1 });
  let best = null, bestScore = -Infinity;
  for (const segment of segments) {
    const overlap = Math.max(0, Math.min(segment.bottom, fallback.bottom) - Math.max(segment.top, fallback.top));
    const score = overlap * 4 + (segment.bottom - segment.top) -
      Math.abs((segment.top + segment.bottom) / 2 - (fallback.top + fallback.bottom) / 2);
    if (overlap >= span * 0.55 && score > bestScore) { best = segment; bestScore = score; }
  }
  return best ?? fallback;
}

function intersectBoundary(leftAcross, rightAcross, leftCentre, rightCentre, leftEdge, rightEdge) {
  const delta = rightCentre - leftCentre;
  if (Math.abs(delta) < 1e-6) return { left: leftAcross, right: rightAcross };
  const slope = (rightAcross - leftAcross) / delta;
  const intercept = leftAcross - slope * leftCentre;
  const atEdge = (edge, fallback) => {
    const denominator = 1 - slope * edge.slope;
    return Math.abs(denominator) < 1e-6 ? fallback :
      (slope * edge.intercept + intercept) / denominator;
  };
  return { left: atEdge(leftEdge, leftAcross), right: atEdge(rightEdge, rightAcross) };
}

function groupHits(hits, image) {
  const groups = [];
  for (const hit of hits.sort((a, b) => a.across - b.across || a.error - b.error)) {
    let best = null, bestDistance = Infinity;
    for (const group of groups) {
      const last = group.hits[group.hits.length - 1];
      const gap = hit.across - last.across;
      if (hit.columns !== last.columns || gap <= 0 || gap > Math.max(5, hit.scale * 3)) continue;
      const scaleRatio = Math.max(hit.scale, last.scale) / Math.min(hit.scale, last.scale);
      if (scaleRatio > 1.45) continue;
      const tolerance = Math.max(5, hit.scale * 4 + gap);
      const distance = Math.abs(hit.left - last.left) + Math.abs(hit.right - last.right);
      if (distance > tolerance * 2 || distance >= bestDistance) continue;
      best = group; bestDistance = distance;
    }
    if (best) best.hits.push(hit); else groups.push({ hits: [hit] });
  }
  const candidates = [];
  for (const group of groups) {
    const rows = group.hits;
    const scale = rows.reduce((sum, hit) => sum + hit.scale, 0) / rows.length;
    const top = rows[0].across, bottom = rows[rows.length - 1].across + 1;
    const span = bottom - top;
    if (rows.length < 4 || span < Math.max(6, scale * 4) || rows.length / span < 0.28) continue;
    const geometry = rows[0].geometry;
    const left = fittedLine(rows, 'left'), right = fittedLine(rows, 'right');
    const startScale = fittedLine(rows, 'startScale'), stopScale = fittedLine(rows, 'stopScale');
    const fallback = { top, bottom };
    const leftExtent = image ? finderExtent(image, rows, 'left', 'startScale', 4, fallback) : fallback;
    const rightExtent = image ? finderExtent(image, rows, 'right', 'stopScale', -14.5, fallback) : fallback;
    const boundary = (leftAcross, rightAcross) => intersectBoundary(
      leftAcross,
      rightAcross,
      lineValue(left, leftAcross) + lineValue(startScale, leftAcross) * 4,
      lineValue(right, rightAcross) - lineValue(stopScale, rightAcross) * 14.5,
      left,
      right,
    );
    const topBoundary = boundary(leftExtent.top, rightExtent.top);
    const bottomBoundary = boundary(leftExtent.bottom, rightExtent.bottom);
    candidates.push({
      width: rows[0].width, scale,
      corners: [
        pointAt(geometry, lineValue(left, topBoundary.left), topBoundary.left),
        pointAt(geometry, lineValue(right, topBoundary.right), topBoundary.right),
        pointAt(geometry, lineValue(right, bottomBoundary.right), bottomBoundary.right),
        pointAt(geometry, lineValue(left, bottomBoundary.left), bottomBoundary.left),
      ],
      score: rows.length / span * 8 + Math.log2(rows.length + 1) * 2 -
        rows.reduce((sum, hit) => sum + hit.error, 0) / rows.length,
    });
  }
  return candidates.sort((a, b) => b.score - a.score);
}

function validQuadrilateral(value) {
  return Array.isArray(value) && value.length === 4 &&
    value.every((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y));
}

function manualCandidate(corners) {
  const horizontal = (Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y) +
    Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y)) / 2;
  const vertical = (Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y) +
    Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y)) / 2;
  const out = [];
  for (let columns = 1; columns <= 30; columns++) {
    const width = 69 + columns * 17, scale = horizontal / width;
    if (scale < 0.65) continue;
    const moduleHeight = vertical / scale;
    let plausibility = Infinity;
    for (let rowHeight = 3; rowHeight <= 12; rowHeight++) {
      const rows = Math.round(moduleHeight / rowHeight);
      if (rows >= 3 && rows <= 90) plausibility = Math.min(plausibility,
        Math.abs(moduleHeight - rows * rowHeight) / rowHeight);
    }
    out.push({ width, scale, corners, score: Number.isFinite(plausibility) ? 2 - plausibility : 0 });
  }
  return out.sort((a, b) => b.score - a.score);
}

function edgeLength(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function rowCandidates(candidate, options) {
  const vertical = (edgeLength(candidate.corners[0], candidate.corners[3]) +
    edgeLength(candidate.corners[1], candidate.corners[2])) / 2;
  const allowedHeights = Number.isInteger(options.rowHeight) ? [options.rowHeight] :
    Array.from({ length: 10 }, (_, index) => index + 3);
  const rows = [];
  for (let value = 3; value <= 90; value++) {
    let score = Infinity;
    for (const rowHeight of allowedHeights) {
      score = Math.min(score, Math.abs(Math.log(vertical / (candidate.scale * value * rowHeight))));
    }
    rows.push({ value, score });
  }
  return rows.sort((a, b) => a.score - b.score).map((entry) => entry.value);
}

function shiftedCandidate(candidate, amount) {
  if (!amount) return candidate;
  const topDx = candidate.corners[3].x - candidate.corners[0].x;
  const topDy = candidate.corners[3].y - candidate.corners[0].y;
  const bottomDx = candidate.corners[2].x - candidate.corners[1].x;
  const bottomDy = candidate.corners[2].y - candidate.corners[1].y;
  const topLength = Math.hypot(topDx, topDy) || 1;
  const bottomLength = Math.hypot(bottomDx, bottomDy) || 1;
  return { ...candidate, corners: [
    { x: candidate.corners[0].x - topDx / topLength * amount, y: candidate.corners[0].y - topDy / topLength * amount },
    { x: candidate.corners[1].x - bottomDx / bottomLength * amount, y: candidate.corners[1].y - bottomDy / bottomLength * amount },
    { x: candidate.corners[2].x + bottomDx / bottomLength * amount, y: candidate.corners[2].y + bottomDy / bottomLength * amount },
    { x: candidate.corners[3].x + topDx / topLength * amount, y: candidate.corners[3].y + topDy / topLength * amount },
  ] };
}

function canonicalRows(matrix) {
  const rowHeight = 3;
  const out = new BitMatrix(matrix.width, matrix.height * rowHeight);
  for (let y = 0; y < matrix.height; y++) for (let x = 0; x < matrix.width; x++) {
    if (matrix.get(x, y)) out.setRegion(x, y * rowHeight, 1, rowHeight);
  }
  return out;
}

function sampleCandidate(image, candidate, options) {
  for (const edgeShift of [0, candidate.scale * 0.35, -candidate.scale * 0.25]) {
    const geometry = shiftedCandidate(candidate, edgeShift);
    for (const rows of rowCandidates(geometry, options)) {
      const transform = PerspectiveTransform.quadToQuad(0, 0, geometry.width, 0, geometry.width, rows, 0, rows,
      geometry.corners[0].x, geometry.corners[0].y, geometry.corners[1].x, geometry.corners[1].y,
      geometry.corners[2].x, geometry.corners[2].y, geometry.corners[3].x, geometry.corners[3].y);
      for (const voting of [false, true]) {
        let matrix;
        try { matrix = voting ? sampleGridVoting(image, geometry.width, rows, transform) : sampleGrid(image, geometry.width, rows, transform); }
        catch { continue; }
        try {
          const result = decodePDF417(matrix, { ...options, rowHeight: 1 });
          return { matrix: canonicalRows(matrix), result, corners: geometry.corners };
        }
        catch { /* Try the next geometry. */ }
      }
    }
  }
  return null;
}

function automaticCandidates(image) {
  const out = [];
  for (const angle of SCAN_ANGLES) {
    out.push(...groupHits(scanHits(image, angle), image));
    if (out.length) break;
  }
  return out;
}

function detectInOrientation(image, options, supplied) {
  for (const candidate of [...supplied, ...automaticCandidates(image)]) {
    const decoded = sampleCandidate(image, candidate, options);
    if (decoded) return { candidate, decoded };
  }
  if (supplied.length) return null;
  for (const angle of SCAN_ANGLES.slice(1)) {
    const candidates = groupHits(scanHits(image, angle), image);
    for (const candidate of candidates) {
      const decoded = sampleCandidate(image, candidate, options);
      if (decoded) return { candidate, decoded };
    }
  }
  return null;
}

/*
 * Locate a binarized raster symbol from its repeated start and stop patterns.
 * The detector estimates a projective quadrilateral; grayscale binarization
 * remains the caller's responsibility.
 */
export function detectPDF417(binaryImage, options = {}) {
  if (!binaryImage?.width || !binaryImage?.height || typeof binaryImage.get !== 'function') return null;
  let oriented = binaryImage;
  let toOriginal = (point) => ({ x: point.x, y: point.y });
  for (let turns = 0; turns < 4; turns++) {
    const supplied = turns === 0 && validQuadrilateral(options.quadrilateral)
      ? manualCandidate(options.quadrilateral.map(({ x, y }) => ({ x, y }))) : [];
    const found = detectInOrientation(oriented, options, supplied);
    if (found) {
      return { matrix: found.decoded.matrix, rotation: turns * 90,
        corners: found.decoded.corners.map(toOriginal), ...found.decoded.result };
    }
    const previous = oriented, previousToOriginal = toOriginal;
    oriented = rotateClockwise(previous);
    toOriginal = (point) => previousToOriginal({ x: point.y, y: previous.height - point.x });
  }
  return null;
}

export function detectAndDecodePDF417(binaryImage, options = {}) { return detectPDF417(binaryImage, options); }
