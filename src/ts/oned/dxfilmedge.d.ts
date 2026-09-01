/*
 * Sythos Barcode Suite — MIT License — Copyright (c) 2026 Sythos
 * Original work. No code from any other barcode implementation.
 */
import { BitMatrix } from '../core/bit-matrix.js';

export interface DXFilmEdgeFields {
  productCode: number;
  generation: number;
  frameNumber?: number;
  halfFrame?: boolean;
}

export interface DXFilmEdgeDecodeResult {
  format: 'dxfilmedge';
  productCode: number;
  generation: number;
  frameNumber?: number;
  halfFrame?: boolean;
}

export declare function encodeDXFilmEdge(fields: DXFilmEdgeFields): BitMatrix;
export declare function decodeDXFilmEdgeMatrix(matrix: BitMatrix): DXFilmEdgeDecodeResult | null;
export interface DXFilmEdgeOptions {
  profile?: 'camera';
}

export declare function decodeDXFilmEdge(image: BitMatrix, options?: DXFilmEdgeOptions): DXFilmEdgeDecodeResult[];
