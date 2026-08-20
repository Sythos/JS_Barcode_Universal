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
 * Error types.
 *
 * Decoding uses exceptions for control flow internally: a detector that fails
 * on one candidate should be cheap to abandon, and a `try` around a candidate
 * loop reads better than threading `null` through six call frames. The public
 * API converts them to results.
 *
 * @module core/errors
 */
/** Base class so consumers can `catch (e) { if (e instanceof BarcodeError) ... }`. */
export class BarcodeError extends Error {
    /** @param {string} message */
    constructor(message) {
        super(message);
        this.name = new.target.name;
    }
}
/** Input could not be encoded — bad payload, or it does not fit the symbology. */
export class EncodeError extends BarcodeError {
}
/** No symbol was found in the image. Not an error condition for `decode()`. */
export class NotFoundError extends BarcodeError {
}
/** A symbol was found, but its geometry or content is malformed. */
export class FormatError extends BarcodeError {
}
/** A symbol was found and read, but error correction could not repair it. */
export class ChecksumError extends BarcodeError {
}
