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
 * EXPERIMENTAL. JAB Code's LDPC (Low-Density Parity-Check) codec: a regular
 * Gallager-construction parity-check matrix, derived deterministically from
 * a shared PRNG seed (see `pseudo-random.ts`) rather than transmitted, plus
 * systematic generator-matrix encoding and an iterative hard-decision
 * bit-flipping decoder.
 *
 * This is the one piece of this module verified purely by careful reading
 * of JAB Code's own reference algorithm (no live reference build was
 * available to confirm bit-exact interop) -- see
 * `docs/JABCODE_NOTES.md` for the honest verification boundary. Ported
 * faithfully (matrix construction order, permutation state, Gauss-Jordan
 * steps) rather than restructured, specifically so the risk of a subtle,
 * hard-to-notice divergence is as low as a from-scratch reading can make
 * it; represented with plain row arrays instead of the reference's
 * bit-packed 32-bit words, since correctness of this port matters far more
 * than matching its memory layout.
 *
 * @module jabcode/ldpc
 */

import { JabRandom } from './pseudo-random.js';

const MESSAGE_SEED = 785465;

type Matrix = Uint8Array[]; // rows of 0/1 bytes, each row.length === capacity

/**
 * Regular LDPC parity-check-like matrix A, Gallager's construction: the
 * first `capacity/wr` rows each get a run of `wr` consecutive ones at a
 * unique diagonal offset; the remaining `wc-1` bands are column-permuted
 * copies of that first band, using a Fisher-Yates shuffle whose state
 * carries over across bands (not reset per band -- verified directly from
 * the reference source, an easy detail to get wrong).
 */
function createMatrixA(wc: number, wr: number, capacity: number): Matrix {
  const nbPcb = wr < 4 ? Math.floor(capacity / 2) : Math.floor(capacity / wr) * wc;
  const rows: Matrix = Array.from({ length: nbPcb }, () => new Uint8Array(capacity));

  const firstBandRows = Math.floor(capacity / wr);
  for (let i = 0; i < firstBandRows; i++) {
    for (let j = 0; j < wr; j++) rows[i][i * wr + j] = 1;
  }

  const permutation = new Int32Array(capacity);
  for (let i = 0; i < capacity; i++) permutation[i] = i;
  const rnd = new JabRandom(MESSAGE_SEED);

  for (let band = 1; band < wc; band++) {
    const rowOffset = band * firstBandRows;
    for (let j = 0; j < capacity; j++) {
      const pos = rnd.nextIndex(capacity - j);
      const sourceColumn = permutation[pos];
      for (let k = 0; k < firstBandRows; k++) {
        rows[rowOffset + k][j] |= rows[k][sourceColumn];
      }
      const tmp = permutation[capacity - 1 - j];
      permutation[capacity - 1 - j] = permutation[pos];
      permutation[pos] = tmp;
    }
  }
  return rows;
}

interface EliminationResult {
  /** matrixH (encode) or matrixA (decode) after row/column rearrangement, matrix_rank rows tall. */
  matrix: Matrix;
  rank: number;
}

/**
 * Gauss-Jordan elimination over GF(2), matching the reference's column
 * bookkeeping (`column_arrangement`, `swap_col`) so the rearranged matrix
 * this returns lines up with the reference's own systematic form.
 */
function gaussJordan(matrixA: Matrix, capacity: number, encode: boolean): EliminationResult {
  const nbPcb = matrixA.length;
  const matrixH: Matrix = matrixA.map((row) => row.slice());

  // Sized by `capacity`, not `nbPcb` -- a pivot column can land anywhere in
  // [0, capacity), and the backfill below (`swapCol[2*loop1]`) reads this
  // array at exactly those out-of-range column positions. Undersizing it
  // doesn't throw on a typed array, it just silently reads back 0.
  const columnArrangement = new Int32Array(capacity);
  const processedColumn = new Uint8Array(capacity);
  const zeroLinesNb = new Int32Array(nbPcb);
  const swapCol = new Int32Array(2 * capacity);
  let loop = 0;
  let zeroLines = 0;

  for (let i = 0; i < nbPcb; i++) {
    let pivotColumn = capacity + 1;
    for (let j = 0; j < capacity; j++) {
      if (matrixH[i][j]) { pivotColumn = j; break; }
    }
    if (pivotColumn < capacity) {
      processedColumn[pivotColumn] = 1;
      columnArrangement[pivotColumn] = i;
      if (pivotColumn >= nbPcb) {
        swapCol[2 * loop] = pivotColumn;
        loop++;
      }
      for (let j = 0; j < nbPcb; j++) {
        if (matrixH[j][pivotColumn] && j !== i) {
          for (let k = 0; k < capacity; k++) matrixH[j][k] ^= matrixH[i][k];
        }
      }
    } else {
      zeroLinesNb[zeroLines] = i;
      zeroLines++;
    }
  }

  const rank = nbPcb - zeroLines;
  let loop2 = 0;
  for (let i = rank; i < nbPcb; i++) {
    if (columnArrangement[i] > 0) {
      for (let j = 0; j < nbPcb; j++) {
        if (processedColumn[j] === 0) {
          columnArrangement[j] = columnArrangement[i];
          columnArrangement[i] = 0;
          processedColumn[j] = 1;
          processedColumn[i] = 0;
          swapCol[2 * loop] = i;
          swapCol[2 * loop + 1] = j;
          columnArrangement[i] = j;
          loop++;
          loop2++;
          break;
        }
      }
    }
  }

  let loop1 = 0;
  for (let kl = 0; kl < nbPcb; kl++) {
    if (processedColumn[kl] === 0 && loop1 < loop - loop2) {
      columnArrangement[kl] = columnArrangement[swapCol[2 * loop1]];
      processedColumn[kl] = 1;
      swapCol[2 * loop1 + 1] = kl;
      loop1++;
    }
  }
  loop1 = 0;
  for (let kl = 0; kl < nbPcb; kl++) {
    if (processedColumn[kl] === 0) {
      columnArrangement[kl] = zeroLinesNb[loop1];
      loop1++;
    }
  }

  // NOTE: Int32Array.prototype.map coerces its callback's return value back
  // to int32, so mapping straight to row arrays (not numbers) requires a
  // plain array first -- an easy silent-corruption trap here.
  const arrangement = Array.from(columnArrangement.subarray(0, nbPcb));
  const source = encode ? matrixH : matrixA;
  const target: Matrix = arrangement.map((src) => source[src].slice());
  for (let i = 0; i < loop; i++) {
    const c1 = swapCol[2 * i];
    const c2 = swapCol[2 * i + 1];
    for (let j = 0; j < nbPcb; j++) {
      const tmp = target[j][c1];
      target[j][c1] = target[j][c2];
      target[j][c2] = tmp;
    }
  }
  return { matrix: target, rank };
}

/** Systematic generator matrix G = [C^T; I] built from the reduced parity-check matrix A = [I | C^T]. */
function createGeneratorMatrix(matrixA: Matrix, capacity: number, pn: number): Matrix {
  const g: Matrix = Array.from({ length: capacity }, () => new Uint8Array(pn));
  for (let i = 0; i < pn; i++) g[capacity - pn + i][i] = 1;

  let matrixIndex = capacity - pn;
  let band = 0;
  for (let i = 0; i < (capacity - pn) * pn; i++) {
    if (matrixIndex >= capacity) { band++; matrixIndex = capacity - pn; }
    const row = Math.floor(i / pn);
    const col = i % pn;
    if (col < pn) {
      g[row][col] = matrixA[band][matrixIndex] ? 1 : 0;
      matrixIndex++;
    }
  }
  return g;
}

/**
 * The metadata-ecc variant (wr<=0, `createMetadataMatrixA` in the
 * reference) is not implemented here: default-mode JAB Code -- this
 * project's scope, see `docs/JABCODE_NOTES.md` -- skips metadata Part I/II
 * encoding entirely, so message data (always wr>0) is the only LDPC use.
 */

/** One sub-block's worth of systematic LDPC encoding: message bits in, full codeword (message+parity) out. */
function encodeBlock(message: Uint8Array, wc: number, wr: number, gross: number): Uint8Array {
  const matrixA = createMatrixA(wc, wr, gross);
  const { matrix: matrixH, rank } = gaussJordan(matrixA, gross, true);
  const pn = gross - rank;
  const g = createGeneratorMatrix(matrixH, gross, pn);

  const codeword = new Uint8Array(gross);
  for (let i = 0; i < gross; i++) {
    let bit = 0;
    for (let j = 0; j < pn; j++) bit ^= g[i][j] & message[j];
    codeword[i] = bit;
  }
  return codeword;
}

/**
 * LDPC-encode a message. Mirrors the reference's sub-block splitting (blocks
 * capped near 2700 bits for construction speed) so multi-block payloads are
 * encoded exactly the same way, block by block.
 */
export function encodeLDPC(message: Uint8Array, wc: number, wr: number): Uint8Array {
  const pn = message.length;
  let gross = Math.ceil((pn * wr) / (wr - wc));
  gross = wr * Math.ceil(gross / wr);

  let subBlocks = 0;
  for (let i = 1; i < 10000; i++) {
    if (Math.floor(gross / i) < 2700) { subBlocks = i; break; }
  }
  const grossSub = Math.floor(Math.floor(gross / subBlocks) / wr) * wr;
  const pnSub = Math.floor((grossSub * (wr - wc)) / wr);

  // `subBlocksExact` is the reference's own `nb_sub_blocks` reassignment
  // (`Pg / Pg_sub_block`, undecremented) -- NOT the original sub-block
  // count above, which only sized `grossSub`. The tail block exists iff
  // `iterations` was decremented below, not from any remainder in `gross`.
  const subBlocksExact = Math.floor(gross / grossSub);
  let iterations = subBlocksExact;
  if (pnSub * iterations < pn) iterations--;

  const out = new Uint8Array(gross);
  for (let iter = 0; iter < iterations; iter++) {
    const block = encodeBlock(message.subarray(iter * pnSub, (iter + 1) * pnSub), wc, wr, grossSub);
    out.set(block, iter * grossSub);
  }
  if (iterations !== subBlocksExact) {
    const start = iterations * pnSub;
    const lastIndex = iterations * grossSub;
    const lastGross = gross - lastIndex;
    const block = encodeBlock(message.subarray(start, pn), wc, wr, lastGross);
    out.set(block, lastIndex);
  }
  return out;
}

/**
 * Iterative hard-decision bit-flipping decoder. Flips the bit(s) involved
 * in the most unsatisfied parity checks each round, matching the
 * reference's `decodeMessage`. Sufficient for a clean, already-classified
 * grid (this project's own decode contract for this format -- see
 * `docs/JABCODE_NOTES.md`); the reference also has a soft-decision
 * log-likelihood decoder for genuine photographic noise, which is out of
 * scope here since there is no arbitrary-photo detector for this format
 * yet either.
 */
function decodeMessageHD(data: Uint8Array, offset: number, matrix: Matrix, length: number, height: number, maxIter: number): boolean {
  const maxVal = new Int32Array(length);
  const equalMax = new Int32Array(length);
  let prevIndex: number[] = [];

  for (let iter = 0; iter < maxIter; iter++) {
    maxVal.fill(0);
    let max = 0;
    for (let j = 0; j < height; j++) {
      let check = 0;
      for (let i = 0; i < length; i++) check ^= matrix[j][i] & data[offset + i];
      if (check) {
        for (let k = 0; k < length; k++) if (matrix[j][k]) maxVal[k]++;
      }
    }
    let counter = 0;
    for (let j = 0; j < length; j++) {
      const used = prevIndex.includes(j);
      if (maxVal[j] >= max && !used) {
        if (maxVal[j] !== max) counter = 0;
        max = maxVal[j];
        equalMax[counter] = j;
        counter++;
      }
    }
    if (max > 0) {
      const flips = length < 36 ? [equalMax[Math.floor(Math.random() * counter)]] : Array.from(equalMax.subarray(0, counter));
      for (const idx of flips) data[offset + idx] = data[offset + idx] ? 0 : 1;
      prevIndex = flips;
    } else {
      return true;
    }
  }
  // Final syndrome check: a genuine correction must zero every parity row.
  for (let j = 0; j < height; j++) {
    let check = 0;
    for (let i = 0; i < length; i++) check ^= matrix[j][i] & data[offset + i];
    if (check) return false;
  }
  return true;
}

/** Runs Gauss-Jordan + (if needed) the hard-decision corrector on one sub-block; returns the rank so the caller can locate the systematic message bits (they start at column `rank`, per the reference's own extraction offset -- not simply "the last N columns"). */
function decodeBlock(data: Uint8Array, offset: number, wc: number, wr: number, gross: number): { ok: boolean; rank: number } {
  const matrixA = createMatrixA(wc, wr, gross);
  const { matrix, rank } = gaussJordan(matrixA, gross, false);

  let syndromeOk = true;
  for (let i = 0; i < rank; i++) {
    let check = 0;
    for (let j = 0; j < gross; j++) check ^= matrix[i][j] & data[offset + j];
    if (check) { syndromeOk = false; break; }
  }
  if (!syndromeOk) {
    const corrected = decodeMessageHD(data, offset, matrix, gross, rank, 25);
    if (!corrected) return { ok: false, rank };
  }
  return { ok: true, rank };
}

/**
 * LDPC-decode (hard decision), returning the net message bits. Throws if
 * the damage exceeds the code's correction capacity for any sub-block.
 *
 * Mirrors the reference's `decodeLDPChd` loop precisely: it iterates
 * `subBlocksExact` (the reference's reassigned `nb_sub_blocks`) times, not
 * `iterations` (`decoding_iterations`, possibly one less) -- the tail
 * block is folded into that same loop at index `iterations`, not appended
 * separately by checking a leftover-bits remainder (an easy but incorrect
 * shortcut: `gross` is not guaranteed to be an exact multiple of
 * `grossSub`, so that remainder can be nonzero even when the reference
 * itself declares no tail block).
 */
export function decodeLDPC(received: Uint8Array, wc: number, wr: number): Uint8Array {
  const length = received.length;
  const gross = wr * Math.floor(length / wr);
  const pn = Math.floor((gross * (wr - wc)) / wr);

  let subBlocks = 0;
  for (let i = 1; i < 10000; i++) {
    if (Math.floor(gross / i) < 2700) { subBlocks = i; break; }
  }
  const grossSub = Math.floor(Math.floor(gross / subBlocks) / wr) * wr;
  const pnSub = Math.floor((grossSub * (wr - wc)) / wr);

  const subBlocksExact = Math.floor(gross / grossSub);
  let iterations = subBlocksExact;
  if (pnSub * iterations < pn) iterations--;

  const data = received.slice(0, gross);
  const out = new Uint8Array(pn);
  let written = 0;
  for (let iter = 0; iter < subBlocksExact; iter++) {
    const isTail = iter === iterations && iterations !== subBlocksExact;
    const blockGross = isTail ? gross - iterations * grossSub : grossSub;
    const blockPn = isTail ? Math.floor((blockGross * (wr - wc)) / wr) : pnSub;

    const { ok, rank } = decodeBlock(data, iter * grossSub, wc, wr, blockGross);
    if (!ok) throw new Error('LDPC decoding failed: damage exceeds correction capacity');
    out.set(data.subarray(iter * grossSub + rank, iter * grossSub + rank + blockPn), written);
    written += blockPn;
  }
  return out;
}
