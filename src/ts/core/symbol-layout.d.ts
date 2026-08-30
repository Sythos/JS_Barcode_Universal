/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */

/**
 * Shared geometry metadata for matrix, dot, hexagonal, and stacked symbols.
 *
 * A layout is deliberately only a descriptor. It does not allocate a module
 * matrix and does not prescribe how a format stores or renders its data.
 *
 * @module core/symbol-layout
 */

/** The shape of one logical module. */
export type ModuleShape = 'square' | 'dot';

/** The lattice used to arrange logical modules. */
export type Lattice = 'square' | 'hex';

/** Explicit aliases for callers that prefer the longer type names. */
export type SymbolModuleShape = ModuleShape;
export type SymbolLattice = Lattice;

/**
 * The immutable description of a symbol's module geometry.
 *
 * `width` and `height` describe one symbol panel in logical modules. Optional
 * `rows` and `columns` describe a repeated panel arrangement, which lets a
 * future stacked format share this descriptor without changing the matrix
 * formats. They default to one panel when calculating a module count.
 */
export interface SymbolLayoutDescriptor {
    readonly moduleShape: ModuleShape;
    readonly lattice: Lattice;
    readonly width: number;
    readonly height: number;
    readonly quietZone: number;
    readonly rows?: number;
    readonly columns?: number;
}

/** The canonical layout type returned by {@link createSymbolLayout}. */
export type SymbolLayout = SymbolLayoutDescriptor;

/** Input accepted by {@link createSymbolLayout}. */
export type SymbolLayoutOptions = SymbolLayoutDescriptor;

/** Alias for code that uses input-oriented naming. */
export type SymbolLayoutInput = SymbolLayoutOptions;

/**
 * Return whether an unknown value is a valid symbol layout descriptor.
 *
 * Validation is side-effect free and performs no matrix allocation. A valid
 * descriptor may be mutable when supplied by a caller; use
 * {@link createSymbolLayout} when an immutable value is required.
 */
export declare function validateSymbolLayout(value: unknown): value is SymbolLayout;

/**
 * Create a validated, shallowly immutable symbol layout descriptor.
 *
 * Only the documented fields are copied. Unknown input properties are ignored,
 * so a future caller can pass a richer format-specific object without leaking
 * mutable implementation state into the shared descriptor.
 *
 * @throws {TypeError} If `options` is not an object.
 * @throws {RangeError} If any field is invalid or exceeds the safe budget.
 */
export declare function createSymbolLayout(options: SymbolLayoutOptions): SymbolLayout;

/**
 * Count logical modules in a complete layout without allocating a matrix.
 *
 * Optional rows and columns multiply the panel dimensions. Quiet-zone modules
 * are intentionally excluded: this helper reports symbol modules, while the
 * validation budget also protects the future rendered footprint.
 *
 * @throws {TypeError} If `layout` is not a valid descriptor.
 */
export declare function layoutModuleCount(layout: SymbolLayout): number;
