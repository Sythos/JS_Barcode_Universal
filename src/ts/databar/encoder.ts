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

/** GS1 DataBar Omnidirectional and Truncated encoder. @module databar/encoder */

import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError } from '../core/errors.js';
import { encodeDataBar14GTIN } from './codec.js';
import {
  DATABAR14_CHECKSUM_WEIGHTS,
  DATABAR14_FINDERS,
  dataBar14CharacterWidths,
} from './patterns.js';

function finderIndexes(characters) {
  const widths = characters.map((value, index) =>
    dataBar14CharacterWidths(value, index === 0 || index === 3 ? 'outside' : 'inside')
  );
  let checksum = 0;
  const weightOffsets = [0, 8, 24, 16];
  for (let character = 0; character < 4; character++) {
    for (let element = 0; element < 8; element++) {
      checksum += widths[character][element] * DATABAR14_CHECKSUM_WEIGHTS[weightOffsets[character] + element];
    }
  }
  checksum %= 79;
  if (checksum >= 8) checksum++;
  if (checksum >= 72) checksum++;
  return { widths, checksum, left: Math.floor(checksum / 9), right: checksum % 9 };
}

function widthsToMatrix(widths, height) {
  const width = widths.reduce((sum, value) => sum + value, 0);
  const matrix = new BitMatrix(width, height);
  let dark = false;
  let x = 0;
  for (const run of widths) {
    if (dark) matrix.setRegion(x, 0, run, height);
    x += run;
    dark = !dark;
  }
  return matrix;
}

/** Encode a checked GTIN as DataBar Omnidirectional or Truncated. */
export function encodeDataBar14(value, options = {}) {
  const variant = options.variant ?? 'omnidirectional';
  if (variant !== 'omnidirectional' && variant !== 'truncated') {
    throw new EncodeError('GS1 DataBar-14 physical encoder currently supports omnidirectional and truncated');
  }
  const height = options.height ?? (variant === 'omnidirectional' ? 33 : 13);
  if (!Number.isInteger(height) || height < (variant === 'omnidirectional' ? 33 : 13)) {
    throw new EncodeError(`GS1 DataBar ${variant} height is below its normative minimum`);
  }
  const compacted = encodeDataBar14GTIN(value, { linkage: options.linkage });
  const characters = compacted.physicalCharacters;
  const check = finderIndexes(characters);
  const widths = [1, 1];
  widths.push(...check.widths[0]);
  widths.push(...DATABAR14_FINDERS[check.left]);
  widths.push(...check.widths[1].slice().reverse());
  widths.push(...check.widths[2]);
  widths.push(...DATABAR14_FINDERS[check.right].slice().reverse());
  widths.push(...check.widths[3].slice().reverse());
  widths.push(1, 1);
  const matrix = widthsToMatrix(widths, height);
  matrix.databar = Object.freeze({ variant, gtin: compacted.gtin, linkage: compacted.linkage, checksum: check.checksum });
  return matrix;
}
