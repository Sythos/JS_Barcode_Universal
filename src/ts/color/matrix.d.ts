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
export type RGB = readonly [number, number, number];
export type KarTrakMatrixMetadata = Readonly<{
    profile: string;
    text: string;
    equipmentCode: string;
    ownershipCode: string;
    carNumber: string;
    checkDigit: number;
}>;
export declare class PolychromeMatrix {
    readonly width: number;
    readonly height: number;
    readonly palette: RGB[];
    kartrak?: KarTrakMatrixMetadata;
    readonly cells: Uint8Array;
    constructor(width: number, height: number, palette: readonly RGB[]);
    get(x: number, y: number): number;
    set(x: number, y: number, index: number): void;
    clone(): PolychromeMatrix;
    withMargin(size: number): PolychromeMatrix;
}
