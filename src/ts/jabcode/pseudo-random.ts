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
 * EXPERIMENTAL. A 64-bit linear congruential generator with a Mersenne-
 * Twister-style output "tempering" step, plus the specific float32-precision
 * range-reduction formula that JAB Code's own LDPC matrix construction and
 * data interleaving use to turn its output into a bounded random index.
 *
 * This is not a general-purpose PRNG choice of this project's own -- it
 * exists ONLY because a genuine JAB Code implementation must reproduce the
 * exact same pseudo-random sequence the format's own reference encoder/
 * decoder uses (both sides derive an identical LDPC parity-check matrix and
 * interleave permutation from a shared seed, with no other synchronization
 * mechanism). The multiplier, tempering constants and seeds below are
 * therefore verified facts about the format, not implementation choices --
 * see `docs/JABCODE_NOTES.md` for how they were verified and the honest
 * limits of that verification (no live reference build was available to
 * confirm bit-exact interop; see that file before relying on this for
 * anything beyond this project's own round trip).
 *
 * @module jabcode/pseudo-random
 */

const MULTIPLIER = 6364136223846793005n;
const MASK64 = (1n << 64n) - 1n;
const UINT32_MAX_F32 = Math.fround(0xffffffff);

export class JabRandom {
  private seed: bigint;

  constructor(seed: number) {
    this.seed = BigInt(seed) & MASK64;
  }

  /** Advance the 64-bit LCG state and return the tempered upper 32 bits. */
  next(): number {
    this.seed = (MULTIPLIER * this.seed + 1n) & MASK64;
    let x = Number(this.seed >> 32n) >>> 0;
    x ^= x >>> 11;
    x ^= (x << 7) & 0x9d2c5680;
    x ^= (x << 15) & 0xefc60000;
    x ^= x >>> 18;
    return x >>> 0;
  }

  /**
   * `(jab_int32)((jab_float)lcg64_temper() / (jab_float)UINT32_MAX * range)`,
   * reproduced with `Math.fround` at each single-precision operation
   * boundary so the float32 rounding matches the C reference bit for bit
   * (IEEE 754 float32 arithmetic is fully specified and deterministic
   * across compilers/runtimes, so this is a faithful translation, not an
   * approximation).
   */
  nextIndex(range: number): number {
    const ratio = Math.fround(Math.fround(this.next()) / UINT32_MAX_F32);
    return Math.trunc(Math.fround(ratio * Math.fround(range)));
  }
}
