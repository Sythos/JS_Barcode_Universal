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
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */

/**
 * Aztec Code layer geometry and Reed-Solomon parameters.
 *
 * `totalBits` counts the payload ring before its leading pad bits are added;
 * consequently only `usableBits` can be partitioned into codewords. Compact
 * symbols have no reference grid. Full symbols insert alternating reference
 * rows and columns every 16 modules around the centre.
 *
 * The five data fields use generator base 1. GF(256)/DataMatrix is also the
 * Aztec 8-bit field: both use primitive polynomial 0x12d.
 *
 * @module aztec/tables
 */

import { GF16, GF64, GF256_AZTEC, GF1024, GF4096 } from '../core/galois-field.js';

/** Reed-Solomon generator base defined for Aztec parameter and data fields. */
export const AZTEC_RS_GENERATOR_BASE = 1;

/** Minimum recommended error correction: 23 percent plus three codewords. */
export const AZTEC_DEFAULT_ECC_PERCENT = 23;
export const AZTEC_MIN_ECC_WORDS = 3;

/** Word size selected solely by the number of layers. */
export function wordSizeForLayers(layers) {
  if (!Number.isInteger(layers) || layers < 1 || layers > 32) {
    throw new RangeError(`Aztec: layers must be an integer from 1 to 32 (got ${layers})`);
  }
  if (layers <= 2) return 6;
  if (layers <= 8) return 8;
  if (layers <= 22) return 10;
  return 12;
}

/** Return the field used by Aztec codewords of `wordSize` bits. */
export function fieldForWordSize(wordSize) {
  switch (wordSize) {
    case 4: return GF16; // Mode message only.
    case 6: return GF64;
    case 8: return GF256_AZTEC;
    case 10: return GF1024;
    case 12: return GF4096;
    default: throw new RangeError(`Aztec: unsupported codeword size ${wordSize}`);
  }
}

/** Return the data field selected for a symbol with `layers` layers. */
export function fieldForLayers(layers) {
  return fieldForWordSize(wordSizeForLayers(layers));
}

/** Matrix side length, including Full-mode reference grid lines. */
export function aztecSymbolSize(layers, compact = false) {
  if (!Number.isInteger(layers) || layers < 1 || layers > (compact ? 4 : 32)) {
    throw new RangeError(`Aztec: ${compact ? 'Compact' : 'Full'} layers out of range: ${layers}`);
  }
  if (compact) return 11 + 4 * layers;
  const baseMatrixSize = 14 + 4 * layers;
  return baseMatrixSize + 1 + 2 * Math.floor((baseMatrixSize / 2 - 1) / 15);
}

function layer(layers, compact) {
  const wordSize = wordSizeForLayers(layers);
  const totalBits = ((compact ? 88 : 112) + 16 * layers) * layers;
  const usableBits = totalBits - totalBits % wordSize;
  const totalCodewords = usableBits / wordSize;
  const baseMatrixSize = (compact ? 11 : 14) + 4 * layers;
  return Object.freeze({
    compact,
    layers,
    wordSize,
    totalBits,
    usableBits,
    totalCodewords,
    // Compact mode encodes the count in six bits and can therefore hold no
    // more than 64 data codewords even where the ring itself is larger.
    maxDataCodewords: compact ? Math.min(totalCodewords, 64) : totalCodewords,
    baseMatrixSize,
    symbolSize: aztecSymbolSize(layers, compact),
    modeMessageDataWords: compact ? 2 : 4,
    modeMessageWords: compact ? 7 : 10,
    modeMessageBits: compact ? 28 : 40,
    rsGeneratorBase: AZTEC_RS_GENERATOR_BASE,
  });
}

/** Compact Aztec layers 1 through 4, in encoding preference order. */
export const AZTEC_COMPACT_LAYERS = Object.freeze(
  Array.from({ length: 4 }, (_, i) => layer(i + 1, true)),
);

/** Full Aztec layers 1 through 32, in ascending layer order. */
export const AZTEC_FULL_LAYERS = Object.freeze(
  Array.from({ length: 32 }, (_, i) => layer(i + 1, false)),
);

/** All allowed symbols. Compact entries precede Full entries for automatic selection. */
export const AZTEC_LAYERS = Object.freeze([
  ...AZTEC_COMPACT_LAYERS,
  ...AZTEC_FULL_LAYERS,
]);

/** Return one immutable layer record. */
export function aztecLayer(layers, compact = false) {
  if (!Number.isInteger(layers) || layers < 1 || layers > (compact ? 4 : 32)) {
    throw new RangeError(`Aztec: ${compact ? 'Compact' : 'Full'} layers out of range: ${layers}`);
  }
  return (compact ? AZTEC_COMPACT_LAYERS : AZTEC_FULL_LAYERS)[layers - 1];
}

/**
 * Calculate the minimum parity count for a data word count.
 *
 * The percentage is rounded up because a fractional codeword cannot be
 * emitted. The mandatory three words protect short payloads, where a bare
 * percentage would otherwise round to zero.
 */
export function eccCodewordsFor(dataCodewords, eccPercent = AZTEC_DEFAULT_ECC_PERCENT) {
  if (!Number.isInteger(dataCodewords) || dataCodewords < 0) {
    throw new RangeError(`Aztec: data codewords must be a non-negative integer (got ${dataCodewords})`);
  }
  if (!Number.isFinite(eccPercent) || eccPercent < 0 || eccPercent > 100) {
    throw new RangeError(`Aztec: ECC percent must be between 0 and 100 (got ${eccPercent})`);
  }
  return Math.ceil(dataCodewords * eccPercent / 100) + AZTEC_MIN_ECC_WORDS;
}

/**
 * Choose the first symbol which holds an already stuffed payload.
 *
 * `dataBits` must be a multiple of the candidate word size; callers which
 * start from high-level bits must stuff separately per candidate word size.
 */
export function selectAztecLayer(dataBits, {
  eccPercent = AZTEC_DEFAULT_ECC_PERCENT,
  layers = null,
  compact = null,
} = {}) {
  if (!Number.isInteger(dataBits) || dataBits < 0) {
    throw new RangeError(`Aztec: data bits must be a non-negative integer (got ${dataBits})`);
  }
  if (compact !== null && typeof compact !== 'boolean') {
    throw new TypeError('Aztec: compact must be true, false or null');
  }

  let candidates;
  if (layers !== null) {
    if (compact === null) throw new TypeError('Aztec: compact must be specified when layers is specified');
    candidates = [aztecLayer(layers, compact)];
  } else if (compact === null) {
    candidates = AZTEC_LAYERS;
  } else {
    candidates = compact ? AZTEC_COMPACT_LAYERS : AZTEC_FULL_LAYERS;
  }

  for (const candidate of candidates) {
    if (dataBits % candidate.wordSize !== 0) continue;
    const dataCodewords = dataBits / candidate.wordSize;
    const eccCodewords = eccCodewordsFor(dataCodewords, eccPercent);
    if (dataCodewords <= candidate.maxDataCodewords &&
        dataCodewords + eccCodewords <= candidate.totalCodewords) {
      return Object.freeze({ ...candidate, dataCodewords, eccCodewords });
    }
  }

  throw new RangeError('Aztec: payload and requested error correction do not fit an available symbol');
}

/** Check static identities so table corruption fails explicitly in tests. */
export function validateAztecTables() {
  const issues = [];
  for (const entry of AZTEC_LAYERS) {
    if (entry.usableBits % entry.wordSize !== 0) issues.push(`${entry.compact ? 'C' : 'F'}${entry.layers}: unaligned usable bits`);
    if (entry.totalCodewords !== entry.usableBits / entry.wordSize) issues.push(`${entry.compact ? 'C' : 'F'}${entry.layers}: codeword mismatch`);
    if (entry.symbolSize !== aztecSymbolSize(entry.layers, entry.compact)) issues.push(`${entry.compact ? 'C' : 'F'}${entry.layers}: matrix size mismatch`);
    if (entry.rsGeneratorBase !== AZTEC_RS_GENERATOR_BASE) issues.push(`${entry.compact ? 'C' : 'F'}${entry.layers}: generator base mismatch`);
    if (entry.compact && entry.maxDataCodewords > 64) issues.push(`C${entry.layers}: Compact data-word limit exceeded`);
  }
  return issues;
}
