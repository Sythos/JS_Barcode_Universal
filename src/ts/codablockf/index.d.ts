import type { BitMatrix } from '../core/bit-matrix.js';

export interface CodablockFEncodeOptions {
  rows?: number;
  columns?: number;
  rowHeight?: number;
  separatorHeight?: number;
}

export interface CodablockFMatrixMetadata {
  readonly rows: number;
  readonly columns: number;
  readonly rowHeight: number;
  readonly separatorHeight: number;
  readonly checks: readonly [number, number];
}

export interface CodablockFDecodeResult {
  readonly format: 'codablockf';
  readonly text: string;
  readonly rows: number;
  readonly columns: number;
  readonly moduleSize: number;
  readonly checksum: true;
}

export declare function encodeCodablockF(value: string, options?: CodablockFEncodeOptions): BitMatrix;
export declare function codablockFChecks(values: readonly number[]): [number, number];
export declare function decodeCodablockF(matrix: BitMatrix): CodablockFDecodeResult;
export declare function detectCodablockF(image: BitMatrix): CodablockFDecodeResult | null;
export declare const detectAndDecodeCodablockF: typeof detectCodablockF;
