/*!
 * Sythos Barcode Suite — GS1 Composite declarations
 * SPDX-License-Identifier: MIT
 */

import type { BitMatrix } from '../core/bit-matrix.js';

export const GS1_COMPOSITE_PROFILE: 'sythos-gs1-composite-bounded';
export const GS1_COMPOSITE_HOSTS: readonly [
  'databar14',
  'databar-truncated',
  'databar-stacked',
  'databar-stacked-omnidirectional',
  'databar-limited',
  'databar-expanded',
];

export type GS1CompositeHostFormat = typeof GS1_COMPOSITE_HOSTS[number];
export type GS1CompositeComponent = 'auto' | 'cc-a' | 'cc-b';
export type GS1Element = { ai: string; value: string };

export type GS1CompositeInput = {
  linear: {
    format: GS1CompositeHostFormat | string;
    value: string | number | GS1Element[];
    options?: Record<string, unknown>;
  };
  data: string | GS1Element[];
  component?: GS1CompositeComponent;
  rowHeight?: number;
  separatorGap?: 1 | 2 | 3;
  moduleScale?: number;
};

export type GS1CompositeOptions = {
  component?: GS1CompositeComponent;
  rowHeight?: number;
  separatorGap?: 1 | 2 | 3;
  moduleScale?: number;
};

export type GS1CompositeResult = {
  format: 'gs1composite';
  profile: typeof GS1_COMPOSITE_PROFILE;
  certified: false;
  text: string;
  raw: string;
  gs1: true;
  linkage: true;
  elements: ReadonlyArray<GS1Element & { fixed?: boolean }>;
  linearFormat: GS1CompositeHostFormat;
  linear: Record<string, unknown>;
  component: 'cc-a' | 'cc-b';
  componentVariant: number;
  componentRows: number;
  componentColumns: number;
  componentRowHeight: number;
  corrections: number;
  moduleScale: number;
  separatorGap?: number;
  symbologyIdentifier: ']e1' | ']e2';
  bounds?: { x: number; y: number; width: number; height: number };
  corners?: Array<{ x: number; y: number }>;
  matrix?: BitMatrix;
  moduleSize?: number;
  rotation?: 0 | 90 | 180 | 270;
  confidence?: number;
  quality?: { quietZone: boolean; checksum: boolean; rows: number; consistency: number };
};

export function encodeGS1Composite(input: GS1CompositeInput, options?: GS1CompositeOptions): BitMatrix;
export function decodeGS1Composite(matrix: BitMatrix): GS1CompositeResult;
export function detectGS1Composite(binaryImage: BitMatrix): GS1CompositeResult | null;
export const detectAndDecodeGS1Composite: typeof detectGS1Composite;
