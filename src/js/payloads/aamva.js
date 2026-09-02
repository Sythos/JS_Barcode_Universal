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
 * AAMVA DL/ID Card Design Standard: not a barcode symbology -- a
 * structured text payload format for the PDF417 barcode on the back of
 * North American driver's licenses and ID cards, defined by the American
 * Association of Motor Vehicle Administrators. This module builds the
 * fixed header, subfile designator table and "DL"/"ID" subfile data
 * element lines, then encodes the result as an ordinary PDF417 symbol
 * (byte compaction, since the format embeds raw control characters).
 *
 * A structured-data builder like this is exactly what a real issuing
 * authority's own card-personalization system, or a business testing its
 * own age-verification/ID scanner against the standard, needs -- the
 * same kind of feature several existing open-source PDF417 tools already
 * provide. It carries no jurisdiction's real Issuer Identification
 * Number by default (`iin` is a required field, not defaulted to any
 * specific real jurisdiction) and produces only the data structure
 * itself, nothing resembling a physical card or its security features.
 *
 * Ported from the AAMVA "DL/ID Card Design Standard" (2020 edition, the
 * document's own bar codes are designated AAMVA Version "10"), read
 * directly from AAMVA's own published PDF: the fixed header (D.12.3),
 * subfile designator (D.12.4), the Table D.3 mandatory data elements,
 * and the worked example in D.13, whose header/offset/length values were
 * used to verify this module's own offset and length computation
 * (a Virginia sample: DL subfile at offset 41 length 278, second subfile
 * at offset 319 -- 41 + 278 -- confirming the layout end to end).
 *
 * @module payloads/aamva
 */
import { EncodeError } from '../core/errors.js';
import { encodePDF417 } from '../pdf417/encoder.js';
const DATA_ELEMENT_SEPARATOR = '\n'; // LF, ASCII 0x0A
const RECORD_SEPARATOR = '\x1e'; // RS, ASCII 0x1E
const SEGMENT_TERMINATOR = '\r'; // CR, ASCII 0x0D
const COMPLIANCE_INDICATOR = '@';
function requireField(value, name) {
    if (!value)
        throw new EncodeError(`AAMVA: ${name} is required`);
    return value;
}
/** Builds the DL/ID subfile's data element lines (element ID directly followed by its value, one per line). */
function buildSubfileElements(fields) {
    const elements = [
        ['DAQ', requireField(fields.customerId, 'customerId')],
        ['DCS', requireField(fields.lastName, 'lastName')],
        ['DDE', fields.familyNameTruncation ?? 'N'],
        ['DAC', requireField(fields.firstName, 'firstName')],
        ['DDF', fields.firstNameTruncation ?? 'N'],
        ['DAD', fields.middleName ?? 'NONE'],
        ['DDG', fields.middleNameTruncation ?? 'N'],
        ['DCU', fields.suffix],
        ['DCA', requireField(fields.vehicleClass, 'vehicleClass')],
        ['DCB', requireField(fields.restrictions, 'restrictions')],
        ['DCD', requireField(fields.endorsements, 'endorsements')],
        ['DBD', requireField(fields.issueDate, 'issueDate')],
        ['DBB', requireField(fields.dateOfBirth, 'dateOfBirth')],
        ['DBA', requireField(fields.expirationDate, 'expirationDate')],
        ['DBC', requireField(fields.sex, 'sex')],
        ['DAU', requireField(fields.height, 'height')],
        ['DAY', requireField(fields.eyeColor, 'eyeColor')],
        ['DAG', requireField(fields.street1, 'street1')],
        ['DAH', fields.street2],
        ['DAI', requireField(fields.city, 'city')],
        ['DAJ', requireField(fields.state, 'state')],
        ['DAK', requireField(fields.postalCode, 'postalCode')],
        ['DCF', requireField(fields.documentDiscriminator, 'documentDiscriminator')],
        ['DCG', requireField(fields.country, 'country')],
    ];
    return elements
        .filter((entry) => entry[1] !== undefined)
        .map(([id, value]) => id + value)
        .join(DATA_ELEMENT_SEPARATOR) + DATA_ELEMENT_SEPARATOR;
}
/** Builds the full AAMVA 2D barcode payload: header, subfile designator table, and DL/ID subfile data. */
export function buildAAMVA(fields) {
    const iin = requireField(fields.iin, 'iin');
    if (!/^\d{6}$/.test(iin))
        throw new EncodeError('AAMVA: iin must be exactly 6 digits');
    const aamvaVersion = fields.aamvaVersion ?? '10';
    const jurisdictionVersion = fields.jurisdictionVersion ?? '00';
    const documentType = fields.documentType ?? 'DL';
    const subfileBody = documentType + buildSubfileElements(fields) + SEGMENT_TERMINATOR;
    const subfileLength = subfileBody.length;
    // Fixed header: @ + LF + RS + CR + "ANSI " + IIN(6) + version(2) + jurisdictionVersion(2) + numberOfEntries(2)
    const header = `${COMPLIANCE_INDICATOR}${DATA_ELEMENT_SEPARATOR}${RECORD_SEPARATOR}${SEGMENT_TERMINATOR}ANSI ${iin}${aamvaVersion}${jurisdictionVersion}01`;
    const designatorOffset = header.length + 10; // one 10-byte subfile designator entry
    const designator = documentType + String(designatorOffset).padStart(4, '0') + String(subfileLength).padStart(4, '0');
    return header + designator + subfileBody;
}
/** Builds an AAMVA payload and encodes it as a PDF417 symbol using byte compaction. */
export function encodeAAMVA(fields, options = {}) {
    return encodePDF417(buildAAMVA(fields), { compaction: 'byte', ...options });
}
