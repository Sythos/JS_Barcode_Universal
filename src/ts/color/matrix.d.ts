/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */
export type RGB = [number, number, number];
export declare class PolychromeMatrix {
    readonly width: number;
    readonly height: number;
    readonly palette: RGB[];
    readonly cells: Uint8Array;
    constructor(width: number, height: number, palette: readonly RGB[]);
    get(x: number, y: number): number;
    set(x: number, y: number, index: number): void;
    clone(): PolychromeMatrix;
    withMargin(size: number): PolychromeMatrix;
}
