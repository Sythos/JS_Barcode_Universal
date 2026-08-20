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
 * PNG output, with no dependencies and no compression library of our own.
 *
 * A barcode is a two-colour image, so this writes a 1-bit palette PNG: eight
 * modules per byte, and a two-entry palette. That is both the smallest and the
 * simplest correct encoding.
 *
 * Compression strategy, in order of preference:
 *
 *   1. `node:zlib` in Node.
 *   2. `CompressionStream('deflate')` in browsers that have it.
 *   3. Stored (uncompressed) deflate blocks, written here.
 *
 * Writing a Huffman coder would be a week of work to save a few kilobytes on
 * an image that is mostly already tiny. The stored-block fallback is about
 * eighty lines and produces a completely valid PNG; the only cost is size, on
 * the minority of platforms that reach it.
 *
 * @module render/png
 */
import { normalizeOptions, parseColor } from './options.js';
/* ------------------------------------------------------------------ *
 * Checksums
 * ------------------------------------------------------------------ */
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();
/**
 * @param {Uint8Array} bytes
 * @returns {number}
 */
function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}
/**
 * @param {Uint8Array} bytes
 * @returns {number}
 */
function adler32(bytes) {
    let a = 1;
    let b = 0;
    // 5552 is the largest run that cannot overflow the 32-bit accumulator.
    for (let i = 0; i < bytes.length;) {
        const end = Math.min(i + 5552, bytes.length);
        for (; i < end; i++) {
            a += bytes[i];
            b += a;
        }
        a %= 65521;
        b %= 65521;
    }
    return ((b << 16) | a) >>> 0;
}
/* ------------------------------------------------------------------ *
 * Deflate
 * ------------------------------------------------------------------ */
/**
 * Wrap data in stored (type 00) deflate blocks with a zlib header.
 *
 * A stored block's length field is sixteen bits, so each block caps at 65535
 * bytes and longer data must be split. BFINAL is set on the last block only —
 * getting that wrong yields a stream that decodes correctly for any small
 * image and truncates on the first large one.
 *
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
export function deflateStored(data) {
    const MAX = 0xffff;
    const blockCount = Math.max(1, Math.ceil(data.length / MAX));
    const out = new Uint8Array(2 + blockCount * 5 + data.length + 4);
    let p = 0;
    // zlib header: deflate, 32K window, no preset dictionary. 0x78 0x01 is a
    // valid FCHECK pair (0x7801 % 31 === 0).
    out[p++] = 0x78;
    out[p++] = 0x01;
    for (let i = 0; i < blockCount; i++) {
        const start = i * MAX;
        const len = Math.min(MAX, data.length - start);
        const isLast = i === blockCount - 1;
        out[p++] = isLast ? 1 : 0; // BFINAL, BTYPE = 00
        out[p++] = len & 0xff; // LEN, little endian
        out[p++] = (len >>> 8) & 0xff;
        out[p++] = ~len & 0xff; // NLEN, one's complement
        out[p++] = (~len >>> 8) & 0xff;
        out.set(data.subarray(start, start + len), p);
        p += len;
    }
    const sum = adler32(data);
    out[p++] = (sum >>> 24) & 0xff; // adler32, big endian
    out[p++] = (sum >>> 16) & 0xff;
    out[p++] = (sum >>> 8) & 0xff;
    out[p++] = sum & 0xff;
    return out.subarray(0, p);
}
/**
 * Compress with whatever the platform provides, falling back to stored blocks.
 *
 * @param {Uint8Array} data
 * @returns {Promise<Uint8Array>}
 */
async function deflate(data) {
    // Node: zlib is built in, so this is not a dependency.
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        try {
            const zlib = await import('node:zlib');
            return new Uint8Array(zlib.deflateSync(data));
        }
        catch {
            /* fall through */
        }
    }
    // Browsers: CompressionStream('deflate') emits the zlib format PNG wants.
    if (typeof CompressionStream === 'function') {
        try {
            const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'));
            const buffer = await new Response(stream).arrayBuffer();
            return new Uint8Array(buffer);
        }
        catch {
            /* fall through */
        }
    }
    return deflateStored(data);
}
/* ------------------------------------------------------------------ *
 * PNG assembly
 * ------------------------------------------------------------------ */
const SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/**
 * @param {string} type Four ASCII characters.
 * @param {Uint8Array} payload
 * @returns {Uint8Array}
 */
function chunk(type, payload) {
    const out = new Uint8Array(12 + payload.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, payload.length);
    for (let i = 0; i < 4; i++)
        out[4 + i] = type.charCodeAt(i);
    out.set(payload, 8);
    // The CRC covers the type and the payload, but not the length.
    view.setUint32(8 + payload.length, crc32(out.subarray(4, 8 + payload.length)));
    return out;
}
/**
 * Render to a PNG file.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {import('./options.js').RenderOptions} [options]
 * @returns {Promise<Uint8Array>}
 */
export async function toPNG(matrix, options = {}) {
    const opts = normalizeOptions(matrix, options);
    const { scale, source, pixelWidth, pixelHeight } = opts;
    const dark = parseColor(opts.dark);
    const light = parseColor(opts.light);
    // --- Scanlines: filter byte 0, then one bit per pixel, MSB leftmost.
    const bytesPerRow = (pixelWidth + 7) >> 3;
    const raw = new Uint8Array((bytesPerRow + 1) * pixelHeight);
    const rowBits = new Uint8Array(bytesPerRow);
    for (let my = 0; my < source.height; my++) {
        rowBits.fill(0);
        for (let mx = 0; mx < source.width; mx++) {
            if (!source.get(mx, my))
                continue;
            const from = mx * scale;
            for (let px = from; px < from + scale; px++) {
                rowBits[px >> 3] |= 0x80 >> (px & 7);
            }
        }
        for (let py = 0; py < scale; py++) {
            const offset = (my * scale + py) * (bytesPerRow + 1);
            raw[offset] = 0; // filter type 0 (None)
            raw.set(rowBits, offset + 1);
        }
    }
    // --- Chunks.
    const ihdr = new Uint8Array(13);
    const ihdrView = new DataView(ihdr.buffer);
    ihdrView.setUint32(0, pixelWidth);
    ihdrView.setUint32(4, pixelHeight);
    ihdr[8] = 1; // bit depth
    ihdr[9] = 3; // colour type 3: palette
    ihdr[10] = 0; // compression: deflate
    ihdr[11] = 0; // filter method
    ihdr[12] = 0; // no interlace
    // Palette index 0 is light (a clear module), index 1 is dark.
    const plte = new Uint8Array([
        light[0], light[1], light[2],
        dark[0], dark[1], dark[2],
    ]);
    const parts = [SIGNATURE, chunk('IHDR', ihdr), chunk('PLTE', plte)];
    // tRNS is only emitted when something is actually translucent, so the common
    // opaque case produces a file every decoder handles identically.
    if (light[3] < 255 || dark[3] < 255) {
        parts.push(chunk('tRNS', new Uint8Array([light[3], dark[3]])));
    }
    parts.push(chunk('IDAT', await deflate(raw)));
    parts.push(chunk('IEND', new Uint8Array(0)));
    let total = 0;
    for (const part of parts)
        total += part.length;
    const file = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        file.set(part, offset);
        offset += part.length;
    }
    return file;
}
/**
 * Render to a data URI usable as an `<img>` src or a download href.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {import('./options.js').RenderOptions} [options]
 * @returns {Promise<string>}
 */
export async function toPNGDataURI(matrix, options = {}) {
    const bytes = await toPNG(matrix, options);
    let binary = '';
    for (let i = 0; i < bytes.length; i++)
        binary += String.fromCharCode(bytes[i]);
    const base64 = typeof btoa === 'function'
        ? btoa(binary)
        /* eslint-disable-next-line no-undef */
        : Buffer.from(bytes).toString('base64');
    return 'data:image/png;base64,' + base64;
}
