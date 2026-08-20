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
/** MicroPDF417 high-level compaction adapter. @module micropdf417/compaction */
import { EncodeError } from '../core/errors.js';
import { compactPdf417Bytes, compactPdf417Numeric, compactPdf417Text, } from '../pdf417/compaction.js';
function byteLength(value) {
    if (value instanceof Uint8Array)
        return value.byteLength;
    if (ArrayBuffer.isView(value))
        return value.byteLength;
    return -1;
}
function assertNotEmpty(value) {
    if ((typeof value === 'string' && value.length === 0) || byteLength(value) === 0) {
        throw new EncodeError('MicroPDF417: value must not be empty');
    }
}
function latin1Bytes(value) {
    if (typeof value !== 'string')
        return value;
    const bytes = [];
    for (const character of value) {
        const codePoint = character.codePointAt(0);
        if (codePoint > 255) {
            throw new EncodeError('MicroPDF417 ECI 3: string contains a character outside ISO-8859-1');
        }
        bytes.push(codePoint);
    }
    return Uint8Array.from(bytes);
}
function compactByte(value, eci) {
    if (eci === undefined)
        return compactPdf417Bytes(value);
    if (eci === 3)
        return compactPdf417Bytes(latin1Bytes(value));
    if (eci === 26) {
        if (typeof value !== 'string') {
            throw new EncodeError('MicroPDF417 ECI 26: value must be a string so UTF-8 validity is known');
        }
        const encoded = compactPdf417Bytes(value);
        return encoded[0] === 927 && encoded[1] === 26 ? encoded : [927, 26, ...encoded];
    }
    throw new EncodeError('MicroPDF417: supported ECI assignment numbers are 3 and 26');
}
/**
 * Compact one MicroPDF417 value.
 *
 * Unlike PDF417, MicroPDF417 starts in Byte Compaction. Text therefore needs
 * an explicit 900 latch. Byte compaction always emits 901 or 924 so its start
 * state is unambiguous, including when an ECI designator precedes it.
 */
export function compactMicroPDF417(value, options = {}) {
    assertNotEmpty(value);
    const mode = options.compaction ?? 'auto';
    const eci = options.eci;
    if (eci !== undefined && eci !== 3 && eci !== 26) {
        throw new EncodeError('MicroPDF417: supported ECI assignment numbers are 3 and 26');
    }
    if (mode === 'text') {
        if (eci !== undefined)
            throw new EncodeError('MicroPDF417: explicit ECI is supported only with byte compaction');
        return [900, ...compactPdf417Text(value)];
    }
    if (mode === 'numeric') {
        if (eci !== undefined)
            throw new EncodeError('MicroPDF417: explicit ECI is supported only with byte compaction');
        return compactPdf417Numeric(value);
    }
    if (mode === 'byte')
        return compactByte(value, eci);
    if (mode !== 'auto') {
        throw new EncodeError(`MicroPDF417: unsupported compaction mode ${JSON.stringify(mode)}`);
    }
    if (eci !== undefined)
        return compactByte(value, eci);
    if (typeof value === 'string' && /^\d{13,}$/.test(value))
        return compactPdf417Numeric(value);
    if (typeof value === 'string') {
        try {
            return [900, ...compactPdf417Text(value)];
        }
        catch (error) {
            if (!(error instanceof EncodeError))
                throw error;
        }
    }
    return compactPdf417Bytes(value);
}
