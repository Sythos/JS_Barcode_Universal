/*!
 * Sythos Barcode Suite — KarTrak ACI declarations
 * SPDX-License-Identifier: MIT
 */

import type { RGB } from '../color/matrix.js';

export { PolychromeMatrix } from '../color/matrix.js';
export { toColorImageData } from '../color/render.js';
import { PolychromeMatrix } from '../color/matrix.js';

export const KARTRAK_PROFILE: 'sythos-kartrak-aci';
export const KARTRAK_PALETTE: readonly RGB[];

export type KarTrakResult = {
  format: 'kartrak';
  profile: typeof KARTRAK_PROFILE;
  text: string;
  equipmentCode: string;
  ownershipCode: string;
  carNumber: string;
  checkDigit: number;
  bounds?: { x: number; y: number; width: number; height: number };
};

export type KarTrakDetectOptions = {
  palette?: readonly RGB[];
};

export function kartrakCheckDigit(digits: readonly number[]): number;
export function encodeKarTrak(value: string): PolychromeMatrix;
export function decodeKarTrakMatrix(matrix: PolychromeMatrix): KarTrakResult;
export function detectKarTrak(
  image: { data: Uint8ClampedArray; width: number; height: number },
  options?: KarTrakDetectOptions,
): KarTrakResult | null;
export function decodeKarTrak(
  input: PolychromeMatrix | { data: Uint8ClampedArray; width: number; height: number },
  options?: KarTrakDetectOptions,
): KarTrakResult;
