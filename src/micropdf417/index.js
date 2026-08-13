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

export {
  MICROPDF417_VARIANTS,
  microPdf417NextRap,
  microPdf417VariantByNumber,
  microPdf417VariantForCapacity,
  microPdf417RapSequence,
  microPdf417RowAddress,
  validateMicroPdf417Tables,
} from './tables.js';
export {
  microPdf417EccLength,
  microPdf417Generator,
  microPdf417ErrorCorrection,
  microPdf417CorrectErrors,
} from './error-correction.js';
export { compactMicroPDF417 } from './compaction.js';
export { encodeMicroPDF417 } from './encoder.js';
export { decodeMicroPDF417 } from './decoder.js';
export { detectMicroPDF417, detectAndDecodeMicroPDF417 } from './detector.js';
