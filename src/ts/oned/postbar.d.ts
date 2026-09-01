/*
 * Sythos Barcode Suite — MIT License — Copyright (c) 2026 Sythos
 * Original work. No code from any other barcode implementation.
 */
import { BitMatrix } from '../core/bit-matrix.js';

export type PostBarProfileId = 'postbarc10' | 'postbard22' | 'postbarg12';

export interface PostBarDecodeResult {
  format: PostBarProfileId;
  postalCode: string;
  addressLocator?: string;
  customerInfo?: string;
  countryCode?: string;
  machineId?: string;
  corrections: number;
}

export interface PostBarOptions {
  profile?: 'camera';
}

export declare function encodePostBarC10(fields: { postalCode: string; machineId: string }): BitMatrix;
export declare function encodePostBarD22(fields: { postalCode: string; addressLocator: string; customerInfo: string }): BitMatrix;
export declare function encodePostBarG12(fields: { countryCode: string; postalCode: string }): BitMatrix;
export declare function decodePostBar(image: BitMatrix, options?: PostBarOptions): PostBarDecodeResult[];
