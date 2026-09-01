/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
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
 * EXPERIMENTAL, published for early/beta use at the
 * `@sythos/js_barcode_universal/color` subpath. Not exported from the
 * package root (`src/ts/index.ts`) and not registered in `ONED_FORMATS` —
 * it is not part of the stable API and its shape may still change. See
 * `docs/COLOR_PIPELINE_NOTES.md` for status, known limits, and what would
 * need to happen before a format built on this (`../kartrak/`) is
 * field-ready.
 *
 * `PolychromeMatrix` generalises `BitMatrix` from one bit per module to one
 * small palette-index per module, for symbologies where colour (not just
 * bar/space presence) carries data — e.g. KarTrak ACI. It intentionally
 * does NOT replace or extend `BitMatrix`: every existing format module
 * depends on `BitMatrix`'s binary contract, and retrofitting colour there
 * would put all ~85 already-shipped formats at risk for the benefit of a
 * format that may never ship. This is a parallel, independent type instead.
 *
 * @module color/matrix
 */
import { EncodeError } from '../core/errors.js';
const MAX_PALETTE_SIZE = 16;
/**
 * @typedef {[number, number, number]} RGB
 */
export class PolychromeMatrix {
    /**
     * @param {number} width
     * @param {number} height
     * @param {readonly RGB[]} palette Index 0 is always the background/quiet-zone colour.
     */
    constructor(width, height, palette) {
        if (width < 1 || height < 1) {
            throw new EncodeError(`PolychromeMatrix: dimensions must be positive, got ${width}x${height}`);
        }
        if (!Array.isArray(palette) || palette.length < 2 || palette.length > MAX_PALETTE_SIZE) {
            throw new EncodeError(`PolychromeMatrix: palette must have 2..${MAX_PALETTE_SIZE} colours, got ${palette?.length}`);
        }
        for (const colour of palette) {
            if (!Array.isArray(colour) || colour.length !== 3
                || colour.some((c) => !Number.isInteger(c) || c < 0 || c > 255)) {
                throw new EncodeError(`PolychromeMatrix: palette colours must be [r,g,b] bytes, got ${JSON.stringify(colour)}`);
            }
        }
        this.width = width;
        this.height = height;
        this.palette = palette.map((c) => [...c]);
        // One byte per module is deliberately generous headroom over the 16-entry
        // palette cap above; it keeps indexing simple (no bit-packing) since a
        // colour symbol's module count is orders of magnitude below where that
        // would matter, unlike BitMatrix's row-packed bit storage.
        this.cells = new Uint8Array(width * height);
    }
    /**
     * @param {number} x @param {number} y
     * @returns {number} Palette index (0 = background) or 0 when out of bounds.
     */
    get(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height)
            return 0;
        return this.cells[y * this.width + x];
    }
    /** @param {number} x @param {number} y @param {number} index */
    set(x, y, index) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height)
            return;
        if (!Number.isInteger(index) || index < 0 || index >= this.palette.length) {
            throw new EncodeError(`PolychromeMatrix: palette index ${index} out of range 0..${this.palette.length - 1}`);
        }
        this.cells[y * this.width + x] = index;
    }
    /** @returns {PolychromeMatrix} */
    clone() {
        const m = new PolychromeMatrix(this.width, this.height, this.palette);
        m.cells.set(this.cells);
        return m;
    }
    /**
     * Add a uniform background-colour border (the colour equivalent of
     * `BitMatrix#withMargin`).
     *
     * @param {number} size
     * @returns {PolychromeMatrix}
     */
    withMargin(size) {
        if (size <= 0)
            return this.clone();
        const m = new PolychromeMatrix(this.width + size * 2, this.height + size * 2, this.palette);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const index = this.get(x, y);
                if (index !== 0)
                    m.set(x + size, y + size, index);
            }
        }
        return m;
    }
}
