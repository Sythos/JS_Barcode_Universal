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

/** GS1 element-string codec used by GS1 DataBar Expanded. @module databar/gs1 */

import { EncodeError, FormatError } from '../core/errors.js';

export const GS1_SEPARATOR = '\x1d';

const EXACT = new Map([
  ['00', [18, true]], ['01', [14, true]], ['02', [14, true]],
  ['10', [20, false]], ['11', [6, true]], ['12', [6, true]],
  ['13', [6, true]], ['15', [6, true]], ['16', [6, true]],
  ['17', [6, true]], ['20', [2, true]], ['21', [20, false]],
  ['22', [29, false]], ['30', [8, false]], ['37', [8, false]],
  ['240', [30, false]], ['241', [30, false]], ['242', [6, false]],
  ['243', [20, false]], ['250', [30, false]], ['251', [30, false]],
  ['253', [30, false]], ['254', [20, false]], ['255', [13, true]],
  ['400', [30, false]], ['401', [30, false]], ['402', [17, true]],
  ['403', [30, false]], ['410', [13, true]], ['411', [13, true]],
  ['412', [13, true]], ['413', [13, true]], ['414', [13, true]],
  ['415', [13, true]], ['416', [13, true]], ['417', [13, true]],
  ['420', [20, false]], ['421', [15, false]], ['422', [3, true]],
  ['423', [15, false]], ['424', [3, true]], ['425', [3, true]],
  ['426', [3, true]], ['427', [3, false]],
  ['7001', [13, true]], ['7002', [30, false]], ['7003', [10, true]],
  ['7004', [4, false]], ['7005', [12, false]], ['7006', [6, true]],
  ['7007', [12, false]], ['7008', [3, false]], ['7009', [10, false]],
  ['7010', [2, false]], ['7020', [20, false]], ['7021', [20, false]],
  ['7022', [20, false]], ['710', [20, false]], ['711', [20, false]],
  ['712', [20, false]], ['713', [20, false]], ['714', [20, false]],
  ['715', [20, false]],
  ['8001', [14, true]], ['8002', [20, false]], ['8003', [30, false]],
  ['8004', [30, false]], ['8005', [6, true]], ['8006', [18, true]],
  ['8007', [34, false]], ['8008', [12, false]], ['8009', [50, false]],
  ['8010', [30, false]], ['8011', [12, false]], ['8012', [20, false]],
  ['8013', [30, false]], ['8017', [18, true]], ['8018', [18, true]],
  ['8019', [10, false]], ['8020', [25, false]], ['8026', [18, true]],
  ['8110', [70, false]], ['8111', [4, true]], ['8112', [70, false]],
  ['8200', [70, false]],
]);

function rangedAI(ai) {
  if (/^31[0-6]\d$/.test(ai) || /^32[0-7]\d$/.test(ai) ||
      /^33[0-7]\d$/.test(ai) || /^34[0-9]\d$/.test(ai) ||
      /^35[0-7]\d$/.test(ai) || /^36[0-9]\d$/.test(ai)) return [6, true];
  if (/^390\d$/.test(ai) || /^392\d$/.test(ai)) return [15, false];
  if (/^391\d$/.test(ai) || /^393\d$/.test(ai)) return [18, false];
  if (/^394\d$/.test(ai)) return [4, true];
  if (/^395\d$/.test(ai)) return [6, true];
  if (/^703\d$/.test(ai) || /^723\d$/.test(ai)) return [30, false];
  return undefined;
}

export function gs1AIInfo(ai) {
  if (typeof ai !== 'string' || !/^\d{2,4}$/.test(ai)) return undefined;
  const spec = EXACT.get(ai) || rangedAI(ai);
  if (!spec) return undefined;
  return { ai, length: spec[0], fixed: spec[1] };
}

function assertCharacters(value, label, ErrorType) {
  if (/[^\x20-\x7e]/.test(value)) {
    throw new ErrorType(`GS1: ${label} contains a character outside the GS1 element-string character set`);
  }
}

function validateElement(ai, value, ErrorType) {
  const info = gs1AIInfo(ai);
  if (!info) throw new ErrorType(`GS1: unsupported or invalid Application Identifier ${ai}`);
  if (value.length === 0) throw new ErrorType(`GS1: AI ${ai} must not be empty`);
  if (info.fixed ? value.length !== info.length : value.length > info.length) {
    const expectation = info.fixed ? `exactly ${info.length}` : `at most ${info.length}`;
    throw new ErrorType(`GS1: AI ${ai} requires ${expectation} characters`);
  }
  assertCharacters(value, `AI ${ai}`, ErrorType);
  return { ai, value, fixed: info.fixed };
}

export function parseGS1ElementString(input) {
  if (typeof input !== 'string' || input.length === 0) {
    throw new EncodeError('GS1: element string must be a non-empty string');
  }
  const elements = [];
  let offset = 0;
  while (offset < input.length) {
    const match = /^\((\d{2,4})\)/.exec(input.slice(offset));
    if (!match) throw new EncodeError(`GS1: expected an Application Identifier at offset ${offset}`);
    const ai = match[1];
    offset += match[0].length;
    const next = input.indexOf('(', offset);
    const end = next < 0 ? input.length : next;
    elements.push(validateElement(ai, input.slice(offset, end), EncodeError));
    offset = end;
  }
  return elements;
}

export function encodeGS1ElementString(input) {
  const elements = Array.isArray(input)
    ? input.map(({ ai, value }) => validateElement(String(ai), String(value), EncodeError))
    : parseGS1ElementString(input);
  return elements.map((element, index) =>
    `${element.ai}${element.value}${!element.fixed && index + 1 < elements.length ? GS1_SEPARATOR : ''}`
  ).join('');
}

function matchAIAt(data, offset) {
  for (const length of [4, 3, 2]) {
    const ai = data.slice(offset, offset + length);
    if (gs1AIInfo(ai)) return ai;
  }
  return undefined;
}

export function decodeGS1ElementString(data) {
  if (typeof data !== 'string' || data.length === 0) {
    throw new FormatError('GS1: encoded data must be a non-empty string');
  }
  const elements = [];
  let offset = 0;
  while (offset < data.length) {
    if (data[offset] === GS1_SEPARATOR) {
      throw new FormatError(`GS1: unexpected separator at offset ${offset}`);
    }
    const ai = matchAIAt(data, offset);
    if (!ai) throw new FormatError(`GS1: unknown Application Identifier at offset ${offset}`);
    offset += ai.length;
    const info = gs1AIInfo(ai);
    let value;
    if (info.fixed) {
      value = data.slice(offset, offset + info.length);
      if (value.length !== info.length || value.includes(GS1_SEPARATOR)) {
        throw new FormatError(`GS1: truncated fixed-length AI ${ai}`);
      }
      offset += info.length;
    } else {
      const separator = data.indexOf(GS1_SEPARATOR, offset);
      const end = separator < 0 ? data.length : separator;
      value = data.slice(offset, end);
      offset = separator < 0 ? data.length : separator + 1;
    }
    elements.push(validateElement(ai, value, FormatError));
  }
  return elements;
}

export function formatGS1Elements(elements) {
  return elements.map(({ ai, value }) => `(${ai})${value}`).join('');
}
