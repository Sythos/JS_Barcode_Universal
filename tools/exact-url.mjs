/*!
 * Sythos Barcode Suite — exact URL reference helper
 *
 * MIT License
 * Copyright (c) 2026 Sythos
 * SPDX-License-Identifier: MIT
 */

const HTTP_URL_TOKEN = /https?:\/\/[^\s<>"'`()\[\]{}]+/giu;
const TRAILING_URL_PUNCTUATION = /[.,;:!?]+$/u;

function canonicalizeUrl(value) {
  try {
    const url = new URL(value);
    return [
      url.protocol,
      url.username,
      url.password,
      url.hostname,
      url.port,
      url.pathname,
      url.search,
      url.hash,
    ].join('\u0000');
  } catch {
    return null;
  }
}

/**
 * Check that text contains the expected HTTP(S) URL as a complete reference.
 *
 * URL-looking fragments are parsed before comparison so a matching substring
 * inside another host or path cannot satisfy the check.
 *
 * @param {string} text
 * @param {string} expectedUrl
 * @returns {boolean}
 */
export function containsExactUrlReference(text, expectedUrl) {
  if (typeof text !== 'string' || typeof expectedUrl !== 'string') return false;

  const expected = canonicalizeUrl(expectedUrl);
  if (!expected) return false;

  for (const match of text.matchAll(HTTP_URL_TOKEN)) {
    const candidate = match[0].replace(TRAILING_URL_PUNCTUATION, '');
    if (canonicalizeUrl(candidate) === expected) return true;
  }

  return false;
}
