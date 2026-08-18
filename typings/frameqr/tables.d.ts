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
/** Public identity and compatibility boundary of the implementable profile. */
export declare const FRAMEQR_PROFILE: Readonly<{
    id: "sythos-canvas-qr/1";
    name: "FrameQR Code";
    certified: false;
    densoFrameQrCompatible: false;
    baseSymbology: "QR Code Model 2";
    requiredEcc: "H";
    standard: "ISO/IEC 18004 QR Code baseline";
}>;
/** Canvas shapes whose module membership is fully deterministic. */
export declare const FRAMEQR_CANVAS_SHAPES: readonly string[];
/**
 * Canonicalise a canvas request.
 *
 * Coordinates and dimensions are module units. Odd dimensions make the centre
 * unambiguous. Only quarter turns are accepted because arbitrary-angle raster
 * membership would depend on renderer-specific sampling.
 *
 * @param {number} symbolSize QR module width/height (21..177).
 * @param {object} [canvas]
 * @returns {{shape:string,centerX:number,centerY:number,width:number,height:number,angle:number}}
 */
export declare function normalizeCanvasSpec(symbolSize: number, canvas?: object): {
    shape: string;
    centerX: number;
    centerY: number;
    width: number;
    height: number;
    angle: number;
};
/**
 * Enumerate canvas modules, including any overlaps with QR function modules.
 * A conforming encoder rejects such overlaps rather than damaging function
 * patterns.
 *
 * @param {number} symbolSize
 * @param {object} [canvas]
 * @returns {Array<[number, number]>}
 */
export declare function canvasModules(symbolSize: number, canvas?: object): Array<[number, number]>;
/**
 * Calculate worst-case QR codeword damage caused by a canvas.
 * A codeword is counted if any of its modules is touched. This is conservative:
 * clearing an already-light module does no damage, but safety cannot depend on
 * one payload or mask.
 *
 * @param {number} version QR version 1..40.
 * @param {object} [canvas]
 */
export declare function analyzeCanvasDamage(version: number, canvas?: object): {
    profile: "sythos-canvas-qr/1";
    certified: boolean;
    version: number;
    symbolSize: number;
    canvas: {
        shape: string;
        centerX: number;
        centerY: number;
        width: number;
        height: number;
        angle: number;
    };
    canvasModuleCount: number;
    reservedOverlaps: [number, number][];
    touchedCodewordCount: number;
    touchedCodewordsByBlock: number[];
    correctionBudgetPerBlock: number;
    safe: boolean;
};
/** Validate a canvas and return the non-certifying structural analysis. */
export declare function validateCanvasSpec(version: any, canvas?: {}): {
    profile: "sythos-canvas-qr/1";
    certified: boolean;
    version: number;
    symbolSize: number;
    canvas: {
        shape: string;
        centerX: number;
        centerY: number;
        width: number;
        height: number;
        angle: number;
    };
    canvasModuleCount: number;
    reservedOverlaps: [number, number][];
    touchedCodewordCount: number;
    touchedCodewordsByBlock: number[];
    correctionBudgetPerBlock: number;
    safe: boolean;
};
/** Self-check the fixed profile contract and representative QR geometries. */
export declare function validateFrameQrTables(): string[];
