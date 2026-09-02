/*!
 * Sythos Barcode Suite — JAB Code declarations
 * SPDX-License-Identifier: MIT
 */

import type { RGB } from '../color/matrix.js';

export { PolychromeMatrix } from '../color/matrix.js';
export { toColorImageData } from '../color/render.js';
import { PolychromeMatrix } from '../color/matrix.js';

export const JABCODE_PROFILE: 'sythos-jabcode-default-mode';
export const JABCODE_PALETTE: readonly RGB[];

export type JABCodeImage = { data: Uint8ClampedArray; width: number; height: number };
export type JABCodeCorners = {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
};

export function encodeJABCode(payload: Uint8Array): PolychromeMatrix;
export function decodeJABCodeMatrix(matrix: PolychromeMatrix): Uint8Array;
export function decodeJABCode(image: JABCodeImage, corners: JABCodeCorners, version: number): Uint8Array;
