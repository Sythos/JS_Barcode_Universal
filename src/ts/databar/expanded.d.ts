import { BitMatrix } from '../core/bit-matrix.js';

export interface DataBarExpandedOptions {
  linkage?: boolean;
  moduleScale?: number;
  scale?: number;
  /** Physical bar height in raster modules; minimum is 34 times the scale. */
  height?: number;
}

export interface DataBarExpandedResult {
  format: 'databar-expanded';
  variant: 'expanded';
  text: string;
  raw: string;
  gs1: true;
  linkage: boolean;
  checksum: number;
  checksumValid: true;
  dataCharacters: number;
  pairs: number;
  moduleScale: number;
  height: number;
  symbologyIdentifier: ']e0';
  elements: Array<{ ai: string; value: string; fixed: boolean }>;
}

/** Encode a parenthesized GS1 element string as linear GS1 DataBar Expanded. */
export function encodeDataBarExpanded(value: string | Array<{ ai: string; value: string }>, options?: DataBarExpandedOptions): BitMatrix;
/** Decode a clean, upright or integer-scaled GS1 DataBar Expanded matrix. */
export function decodeDataBarExpanded(matrix: BitMatrix): DataBarExpandedResult;
/** Detect one complete, axis-aligned or quarter-turned Expanded symbol, or return null. */
export function detectDataBarExpanded(binaryImage: BitMatrix, options?: object): DataBarExpandedResult | null;
export const detectAndDecodeDataBarExpanded: typeof detectDataBarExpanded;
/** Decode a complete unscaled Expanded scanline, or return null. */
export function decodeDataBarExpandedScanline(row: ArrayLike<boolean | number>): DataBarExpandedResult | null;
export const encodeGS1DataBarExpanded: typeof encodeDataBarExpanded;
export const decodeGS1DataBarExpanded: typeof decodeDataBarExpanded;
export const detectGS1DataBarExpanded: typeof detectDataBarExpanded;
export const detectAndDecodeGS1DataBarExpanded: typeof detectDataBarExpanded;
