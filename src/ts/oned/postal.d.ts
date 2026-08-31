/*
 * Sythos Barcode Suite — MIT License — Copyright (c) 2026 Sythos
 * Original work. No code from any other barcode implementation.
 */
import { BitMatrix } from '../core/bit-matrix.js';

export type PostalFormat =
  | 'postnet'
  | 'planet'
  | 'rm4scc'
  | 'kix'
  | 'auspost'
  | 'japanpost'
  | 'imb';

export interface PostalOptions {
  checkDigit?: boolean;
  customerEncoding?: 'character' | 'numeric';
  custinfoenc?: 'character' | 'numeric';
  profile?: 'camera';
}

export interface PostalDecodeResult {
  format: PostalFormat;
  text: string;
  checkDigit: boolean;
}

export declare const POSTAL_FORMATS: PostalFormat[];
export declare const POSTAL_ALIASES: Readonly<Record<string, PostalFormat>>;
export declare const STATE_PROFILES: readonly (readonly [number, number])[];

export declare function encodePostnet(value: string, options?: PostalOptions): BitMatrix;
export declare function encodePlanet(value: string, options?: PostalOptions): BitMatrix;
export declare function encodeRM4SCC(value: string, options?: PostalOptions): BitMatrix;
export declare function encodeKIX(value: string): BitMatrix;
export declare function encodeAustraliaPost(value: string, options?: PostalOptions): BitMatrix;
export declare function encodeJapanPost(value: string): BitMatrix;
export declare function encodeIMB(value: string): BitMatrix;

export declare function decodePostal(
  image: BitMatrix,
  options?: PostalOptions & { formats?: string[] },
): PostalDecodeResult[];
