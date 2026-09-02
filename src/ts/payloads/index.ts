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
 * Structured payload builders for text/data conventions that are
 * commonly carried by an existing barcode symbology's payload rather
 * than being symbologies of their own -- vCard, Swiss QR-bill, SEPA/EPC
 * QR, VIN, AAMVA DL/ID, and the historical "SPARQCode" conventions. Each
 * builds a correctly formatted, validated payload string and encodes it
 * with this SDK's own `qr`, `code39` or `pdf417` encoder -- there is no
 * separate symbology here, just structured input for existing ones. See
 * `docs/formats/qr-family.md`, `docs/formats/oned.md` and
 * `docs/formats/pdf417-family.md` for per-convention documentation.
 *
 * @module payloads
 */

export { buildVCard, encodeVCard } from './vcard.js';
export { vinCheckDigit, validateVIN, encodeVIN } from './vin.js';
export { buildSPARQCodePayload, encodeSPARQCode } from './sparqcode.js';
export { buildSwissQR, encodeSwissQR, qrReferenceCheckDigit, validateIBAN, isQrIban } from './swiss-qr.js';
export { buildSEPAQR, encodeSEPAQR } from './sepa-qr.js';
export { buildAAMVA, encodeAAMVA } from './aamva.js';
