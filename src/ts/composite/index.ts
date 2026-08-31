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

/**
 * Bounded GS1 DataBar Composite profile.
 *
 * The complete ISO/IEC 24723 composite symbology has several component
 * layouts and a dedicated compaction system. This SDK profile keeps the
 * pairing contract deliberately narrow: one validated GS1 DataBar host is
 * linked to one strict MicroPDF417-derived CC-A or CC-B component. The marker
 * and geometry checks make the profile safe for round trips without claiming
 * interchange certification for every normative composite variant.
 *
 * @module composite
 */

import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError, FormatError } from '../core/errors.js';
import * as databar from '../databar/index.js';
import {
  decodeGS1ElementString,
  encodeGS1ElementString,
  formatGS1Elements,
} from '../databar/gs1.js';
import * as micropdf417 from '../micropdf417/index.js';

export const GS1_COMPOSITE_PROFILE = 'sythos-gs1-composite-bounded';
export const GS1_COMPOSITE_HOSTS = Object.freeze([
  'databar14',
  'databar-truncated',
  'databar-stacked',
  'databar-stacked-omnidirectional',
  'databar-limited',
  'databar-expanded',
]);

const COMPONENT_WIDTH = 55;
const COMPONENT_VARIANTS = Object.freeze({
  'cc-a': Object.freeze([7]),
  'cc-b': Object.freeze([8, 9, 10, 11, 12, 13]),
});
const ALL_COMPONENT_VARIANTS = Object.freeze([7, 8, 9, 10, 11, 12, 13]);
const MAX_SCALE = 8;
const MAX_DIMENSION = 16_777_216;
const MAX_MODULES = 67_108_864;
// A short, private marker is part of this bounded profile. It is intentionally
// not presented as the ISO/IEC composite linkage flag or an interoperability
// claim; it only prevents a standalone component from being accepted here.
const COMPONENT_PREFIX = Object.freeze({ 'cc-a': 'A|', 'cc-b': 'B|' });

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function positiveInteger(value, fallback, label, maximum = MAX_SCALE) {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum) {
    throw new EncodeError(`GS1 Composite ${label} must be an integer in 1..${maximum}`);
  }
  return result;
}

function normalizeHost(value) {
  if (typeof value !== 'string') throw new EncodeError('GS1 Composite linear.format must be a string');
  const id = value.toLowerCase().replace(/_/g, '-');
  if (id === 'databar' || id === 'databar14' || id === 'gs1databar14' || id === 'gs1-databar14'
      || id === 'databar-omnidirectional' || id === 'omnidirectional') return 'databar14';
  if (id === 'databar-truncated' || id === 'gs1-databar-truncated' || id === 'truncated') return 'databar-truncated';
  if (id === 'databar-stacked' || id === 'gs1databar-stacked' || id === 'gs1-databar-stacked') return 'databar-stacked';
  if (id === 'databar-stacked-omnidirectional' || id === 'gs1databar-stacked-omnidirectional'
      || id === 'gs1-databar-stacked-omni' || id === 'databar-stacked-omni') return 'databar-stacked-omnidirectional';
  if (id === 'databar-limited' || id === 'gs1databar-limited' || id === 'gs1-databar-limited') return 'databar-limited';
  if (id === 'databar-expanded' || id === 'gs1databar-expanded' || id === 'gs1-databar-expanded') return 'databar-expanded';
  throw new EncodeError(`GS1 Composite linear format is not supported: ${value}`);
}

function hostWidth(host) {
  if (host === 'databar14' || host === 'databar-truncated') return 96;
  if (host === 'databar-stacked' || host === 'databar-stacked-omnidirectional') return 50;
  if (host === 'databar-limited') return 79;
  return null;
}

function encodeHost(host, value, options) {
  if (host === 'databar14') {
    return databar.encodeDataBar14(value, { ...options, linkage: true, variant: 'omnidirectional' });
  }
  if (host === 'databar-truncated') {
    return databar.encodeDataBar14(value, { ...options, linkage: true, variant: 'truncated' });
  }
  if (host === 'databar-stacked') {
    return databar.encodeDataBar14Stacked(value, { ...options, linkage: true });
  }
  if (host === 'databar-stacked-omnidirectional') {
    return databar.encodeDataBarStackedOmnidirectional(value, { ...options, linkage: true });
  }
  if (host === 'databar-limited') {
    return databar.encodeDataBarLimited(value, { ...options, linkage: true });
  }
  return databar.encodeDataBarExpanded(value, { ...options, linkage: true });
}

function decodeHost(host, matrix) {
  if (host === 'databar14' || host === 'databar-truncated') return databar.decodeDataBar14(matrix);
  if (host === 'databar-stacked') return databar.decodeDataBar14Stacked(matrix);
  if (host === 'databar-stacked-omnidirectional') return databar.decodeDataBarStackedOmnidirectional(matrix);
  if (host === 'databar-limited') return databar.decodeDataBarLimited(matrix);
  return databar.decodeDataBarExpanded(matrix);
}

function normalizedGS1Data(input) {
  let raw;
  if (Array.isArray(input)) {
    raw = encodeGS1ElementString(input);
  } else if (typeof input === 'string') {
    if (input.startsWith('(')) raw = encodeGS1ElementString(input);
    else {
      decodeGS1ElementString(input);
      raw = input;
    }
  } else {
    throw new EncodeError('GS1 Composite data must be a GS1 element string or element array');
  }
  const elements = decodeGS1ElementString(raw);
  return { raw, elements };
}

function expandedInput(value) {
  if (typeof value !== 'string' || value.startsWith('(')) return value;
  try {
    return formatGS1Elements(decodeGS1ElementString(value));
  } catch {
    return value;
  }
}

function normalizedLinearOptions(options) {
  if (!isRecord(options)) throw new EncodeError('GS1 Composite linear.options must be an object');
  if (options.linkage === false) throw new EncodeError('GS1 Composite linear host must use linkage=true');
  for (const key of ['moduleScale', 'scale']) {
    if (options[key] !== undefined && options[key] !== 1) {
      throw new EncodeError('GS1 Composite controls the common module scale; linear scaling must be 1');
    }
  }
  return { ...options, linkage: true };
}

function selectComponent(raw, requested, rowHeight) {
  if (requested !== 'auto' && requested !== 'cc-a' && requested !== 'cc-b') {
    throw new EncodeError('GS1 Composite component must be auto, cc-a or cc-b');
  }
  const order = requested === 'auto'
    ? ALL_COMPONENT_VARIANTS
    : COMPONENT_VARIANTS[requested];
  const kindFor = (variant) => variant === 7 ? 'cc-a' : 'cc-b';
  let lastError;
  for (const variant of order) {
    const kind = kindFor(variant);
    const payload = `${COMPONENT_PREFIX[kind]}${raw}`;
    try {
      const matrix = micropdf417.encodeMicroPDF417(payload, {
        variant,
        rowHeight,
        compaction: 'byte',
        eci: 3,
      });
      return Object.freeze({ matrix, kind, variant, payload });
    } catch (error) {
      lastError = error;
      if (!(error instanceof EncodeError)) throw error;
    }
  }
  throw new EncodeError(`GS1 Composite data does not fit the selected ${requested} component${lastError ? `: ${lastError.message}` : ''}`);
}

function copyMatrix(source, target, offsetX, offsetY) {
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (source.get(x, y)) target.set(offsetX + x, offsetY + y);
    }
  }
}

function metadataFor({ component, linear, width, height, scale, gap, host }) {
  return Object.freeze({
    profile: GS1_COMPOSITE_PROFILE,
    component: component.kind,
    componentVariant: component.variant,
    componentRows: component.matrix.micropdf417?.rows ?? component.variant,
    componentColumns: component.matrix.micropdf417?.columns ?? 2,
    componentRowHeight: component.matrix.micropdf417?.rowHeight ?? 2,
    componentX: component.x * scale,
    componentY: component.y * scale,
    componentWidth: component.matrix.width * scale,
    componentHeight: component.matrix.height * scale,
    linearFormat: host,
    linearX: linear.x * scale,
    linearY: linear.y * scale,
    linearWidth: linear.matrix.width * scale,
    linearHeight: linear.matrix.height * scale,
    separatorGap: gap * scale,
    moduleScale: scale,
    width: width * scale,
    height: height * scale,
  });
}

/** Encode a bounded, linked GS1 DataBar Composite profile. */
export function encodeGS1Composite(input, options = {}) {
  if (!isRecord(input)) throw new EncodeError('GS1 Composite input must be an object');
  if (!isRecord(options)) throw new EncodeError('GS1 Composite options must be an object');
  if (!isRecord(input.linear)) throw new EncodeError('GS1 Composite linear host is required');
  const host = normalizeHost(input.linear.format);
  if (input.linear.value === undefined || input.linear.value === null) {
    throw new EncodeError('GS1 Composite linear.value is required');
  }
  const data = normalizedGS1Data(input.data);
  const rowHeight = positiveInteger(input.rowHeight ?? options.rowHeight, 2, 'rowHeight', 64);
  if (rowHeight < 2) throw new EncodeError('GS1 Composite rowHeight must be at least 2');
  const separatorGap = positiveInteger(input.separatorGap ?? options.separatorGap, 1, 'separatorGap', 3);
  const moduleScale = positiveInteger(input.moduleScale ?? options.moduleScale, 1, 'moduleScale', MAX_SCALE);
  const requestedComponent = input.component ?? options.component ?? 'auto';
  const linearOptions = normalizedLinearOptions(input.linear.options ?? {});
  const linearValue = host === 'databar-expanded' ? expandedInput(input.linear.value) : input.linear.value;
  const linearMatrix = encodeHost(host, linearValue, linearOptions);
  if (linearMatrix.databar?.linkage !== true) {
    throw new EncodeError('GS1 Composite host encoder did not preserve linkage=true');
  }
  const component = selectComponent(data.raw, requestedComponent, rowHeight);
  const width = Math.max(linearMatrix.width, component.matrix.width);
  const componentX = Math.floor((width - component.matrix.width) / 2);
  const linearX = Math.floor((width - linearMatrix.width) / 2);
  const linearY = component.matrix.height + separatorGap;
  const height = linearY + linearMatrix.height;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_MODULES) {
    throw new EncodeError('GS1 Composite matrix exceeds the safe allocation budget');
  }
  const base = new BitMatrix(width, height);
  copyMatrix(component.matrix, base, componentX, 0);
  copyMatrix(linearMatrix, base, linearX, linearY);
  const matrix = moduleScale === 1 ? base : base.scale(moduleScale);
  const componentMeta = { ...component, x: componentX, y: 0 };
  const linearMeta = { matrix: linearMatrix, x: linearX, y: linearY };
  matrix.gs1composite = metadataFor({
    component: componentMeta,
    linear: linearMeta,
    width,
    height,
    scale: moduleScale,
    gap: separatorGap,
    host,
  });
  return matrix;
}

function crop(source, x, y, width, height) {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Number.isSafeInteger(width)
      || !Number.isSafeInteger(height) || width < 1 || height < 1
      || x < 0 || y < 0 || x + width > source.width || y + height > source.height) return null;
  const output = new BitMatrix(width, height);
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      if (source.get(x + column, y + row)) output.set(column, row);
    }
  }
  return output;
}

function collapseScale(source, scale) {
  if (!Number.isSafeInteger(scale) || scale < 1
      || source.width % scale !== 0 || source.height % scale !== 0) return null;
  if (scale === 1) return source;
  const output = new BitMatrix(source.width / scale, source.height / scale);
  for (let y = 0; y < output.height; y++) {
    for (let x = 0; x < output.width; x++) {
      const expected = Boolean(source.get(x * scale, y * scale));
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          if (Boolean(source.get(x * scale + dx, y * scale + dy)) !== expected) return null;
        }
      }
      if (expected) output.set(x, y);
    }
  }
  return output;
}

function hasDark(source, x, y, width, height) {
  for (let row = y; row < y + height; row++) {
    for (let column = x; column < x + width; column++) {
      if (source.get(column, row)) return true;
    }
  }
  return false;
}

function payloadFromComponent(decoded, kind) {
  const prefix = COMPONENT_PREFIX[kind];
  if (!decoded || typeof decoded.text !== 'string' || !decoded.text.startsWith(prefix)) {
    throw new FormatError('GS1 Composite component marker is invalid');
  }
  const raw = decoded.text.slice(prefix.length);
  const elements = decodeGS1ElementString(raw);
  return { raw, elements };
}

function compositeResult(host, linear, component, kind, raw, elements, geometry = {}) {
  if (linear.linkage !== true) throw new FormatError('GS1 Composite linear host is not linked');
  return Object.freeze({
    format: 'gs1composite',
    profile: GS1_COMPOSITE_PROFILE,
    certified: false,
    text: raw,
    raw,
    gs1: true,
    linkage: true,
    elements: Object.freeze(elements),
    linearFormat: host,
    linear: Object.freeze({ ...linear, format: host }),
    component: kind,
    componentVariant: component.variant,
    componentRows: component.rows,
    componentColumns: component.columns,
    componentRowHeight: component.rowHeight,
    corrections: component.corrections,
    moduleScale: geometry.moduleScale ?? 1,
    separatorGap: geometry.separatorGap,
    symbologyIdentifier: kind === 'cc-a' ? ']e1' : ']e2',
    ...geometry,
  });
}

function decodeFromMetadata(matrix) {
  const meta = matrix.gs1composite;
  if (!isRecord(meta) || meta.profile !== GS1_COMPOSITE_PROFILE) return null;
  const componentMatrix = crop(matrix, meta.componentX, meta.componentY, meta.componentWidth, meta.componentHeight);
  const linearMatrix = crop(matrix, meta.linearX, meta.linearY, meta.linearWidth, meta.linearHeight);
  if (!componentMatrix || !linearMatrix) throw new FormatError('GS1 Composite metadata points outside the matrix');
  const logicalComponent = collapseScale(componentMatrix, meta.moduleScale ?? 1);
  if (!logicalComponent) throw new FormatError('GS1 Composite component is not integer-scaled');
  const component = micropdf417.decodeMicroPDF417(logicalComponent, { variant: meta.componentVariant });
  const payload = payloadFromComponent(component, meta.component);
  const host = normalizeHost(meta.linearFormat);
  const linear = decodeHost(host, linearMatrix);
  return compositeResult(host, linear, component, meta.component, payload.raw, payload.elements, {
    moduleScale: meta.moduleScale,
    separatorGap: meta.separatorGap,
    bounds: { x: 0, y: 0, width: matrix.width, height: matrix.height },
  });
}

function attemptCandidate(image, host, variant, rowHeight, scale, canvasX, topY, gap, canvasWidth, bounds) {
  const entry = micropdf417.microPdf417VariantByNumber(variant);
  const componentHeight = entry.rows * rowHeight * scale;
  const componentWidth = COMPONENT_WIDTH * scale;
  // Centre in logical modules first, then apply the common raster scale. This
  // preserves the encoder's floor-centering for odd width differences.
  const logicalCanvasWidth = Math.floor(canvasWidth / scale);
  const componentX = canvasX + Math.floor((logicalCanvasWidth - COMPONENT_WIDTH) / 2) * scale;
  const hostWidthModules = hostWidth(host);
  const linearWidth = hostWidthModules === null ? canvasWidth : hostWidthModules * scale;
  const linearModules = hostWidthModules === null ? logicalCanvasWidth : hostWidthModules;
  const linearX = canvasX + Math.floor((logicalCanvasWidth - linearModules) / 2) * scale;
  const linearY = topY + componentHeight + gap * scale;
  const linearHeight = bounds.maxY - linearY + 1;
  if (linearHeight < 1 || linearX < 0 || linearX + linearWidth > image.width
      || componentX < 0 || componentX + componentWidth > image.width) return null;
  // The two DataBar-14 host presentations share the same 96-module geometry;
  // their normative heights provide the only reliable distinction after
  // image metadata has been discarded.
  if (host === 'databar14' && linearHeight < 33 * scale) return null;
  if (host === 'databar-truncated' && linearHeight >= 33 * scale) return null;
  if (hasDark(image, canvasX, topY + componentHeight, canvasWidth, gap * scale)) return null;
  const componentMatrix = crop(image, componentX, topY, componentWidth, componentHeight);
  const linearMatrix = crop(image, linearX, linearY, linearWidth, linearHeight);
  if (!componentMatrix || !linearMatrix) return null;
  try {
    const logicalComponent = collapseScale(componentMatrix, scale);
    if (!logicalComponent) return null;
    const component = micropdf417.decodeMicroPDF417(logicalComponent, { variant });
    const kind = variant === 7 ? 'cc-a' : 'cc-b';
    const payload = payloadFromComponent(component, kind);
    const linear = decodeHost(host, linearMatrix);
    return {
      result: compositeResult(host, linear, component, kind, payload.raw, payload.elements, {
        moduleScale: scale,
        separatorGap: gap * scale,
        bounds: { x: canvasX, y: topY, width: canvasWidth, height: linearY + linearHeight - topY },
      }),
      matrix: componentMatrix,
      geometry: { x: canvasX, y: topY, width: canvasWidth, height: linearY + linearHeight - topY },
    };
  } catch {
    return null;
  }
}

function fallbackDecode(image) {
  const bounds = image.getBounds?.();
  if (!bounds) return null;
  const topY = bounds.y;
  for (let scale = 1; scale <= MAX_SCALE; scale++) {
    const xStart = Math.max(0, bounds.x - 2 * scale);
    const xEnd = Math.min(image.width - 1, bounds.x);
    for (const host of ['databar-stacked', 'databar-stacked-omnidirectional', 'databar-limited', 'databar-truncated', 'databar14']) {
      const modules = hostWidth(host);
      const canvasModules = Math.max(modules, COMPONENT_WIDTH);
      const canvasWidth = canvasModules * scale;
      if (canvasWidth > image.width) continue;
      for (let canvasX = xStart; canvasX <= xEnd; canvasX++) {
        for (let rowHeight = 2; rowHeight <= 6; rowHeight++) {
          for (const variant of ALL_COMPONENT_VARIANTS) {
            const found = attemptCandidate(image, host, variant, rowHeight, scale, canvasX, topY, 1, canvasWidth, {
              maxY: bounds.y + bounds.height - 1,
            });
            if (found) return found;
            for (const gap of [2, 3]) {
              const withGap = attemptCandidate(image, host, variant, rowHeight, scale, canvasX, topY, gap, canvasWidth, {
                maxY: bounds.y + bounds.height - 1,
              });
              if (withGap) return withGap;
            }
          }
        }
      }
    }
    // Expanded symbols have a payload-dependent width. Their dark bounds are
    // already the logical width, so try a few light-edge corrections around it.
    for (const delta of [-3, -2, -1, 0, 1, 2, 3]) {
      const canvasWidth = bounds.width + delta * scale;
      if (canvasWidth < COMPONENT_WIDTH * scale || canvasWidth > image.width) continue;
      for (const variant of ALL_COMPONENT_VARIANTS) {
        for (let rowHeight = 2; rowHeight <= 6; rowHeight++) {
          const found = attemptCandidate(image, 'databar-expanded', variant, rowHeight, scale, bounds.x, topY, 1, canvasWidth, {
            maxY: bounds.y + bounds.height - 1,
          });
          if (found) return found;
        }
      }
    }
  }
  return null;
}

function rotateClockwise(source) {
  const output = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) if (source.get(x, y)) output.set(source.height - 1 - y, x);
  }
  return output;
}

function mapPoint(point, previous) {
  return { x: point.y, y: previous.height - point.x };
}

function rectangle(bounds) {
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
}

function validImage(image) {
  return isRecord(image) && typeof image.get === 'function'
    && Number.isSafeInteger(image.width) && Number.isSafeInteger(image.height)
    && image.width > 0 && image.height > 0
    && image.width <= MAX_DIMENSION && image.height <= MAX_DIMENSION
    && image.width * image.height <= MAX_MODULES;
}

/** Decode one complete, axis-aligned bounded GS1 Composite symbol. */
export function decodeGS1Composite(matrix) {
  if (!validImage(matrix)) throw new FormatError('GS1 Composite decoder expects a bounded BitMatrix-like value');
  const fromMetadata = decodeFromMetadata(matrix);
  if (fromMetadata) return fromMetadata;
  const found = fallbackDecode(matrix);
  if (!found) throw new FormatError('GS1 Composite geometry, linkage or component marker is invalid');
  return found.result;
}

/** Detect one complete composite symbol in a clean binary raster. */
export function detectGS1Composite(binaryImage) {
  if (!validImage(binaryImage)) return null;
  let oriented = binaryImage;
  let toOriginal = (point) => ({ x: point.x, y: point.y });
  for (let turns = 0; turns < 4; turns++) {
    try {
      const metadataResult = decodeFromMetadata(oriented);
      if (metadataResult) {
        const bounds = { x: 0, y: 0, width: oriented.width, height: oriented.height };
        return Object.freeze({
          ...metadataResult,
          bounds,
          corners: rectangle(bounds).map(toOriginal),
          matrix: oriented,
          moduleSize: metadataResult.moduleScale ?? 1,
          rotation: (360 - turns * 90) % 360,
          confidence: 1,
          quality: { quietZone: true, checksum: true, rows: metadataResult.componentRows, consistency: 1 },
        });
      }
    } catch {
      // Metadata may be stale after a caller edited the matrix. Fall back to geometry.
    }
    const found = fallbackDecode(oriented);
    if (found) {
      const bounds = found.geometry;
      return Object.freeze({
        ...found.result,
        bounds,
        corners: rectangle(bounds).map(toOriginal),
        matrix: found.matrix,
        moduleSize: found.result.moduleScale ?? 1,
        rotation: (360 - turns * 90) % 360,
        confidence: 1,
        quality: {
          quietZone: bounds.x > 0 && bounds.y > 0
            && bounds.x + bounds.width < oriented.width
            && bounds.y + bounds.height < oriented.height,
          checksum: true,
          rows: found.result.componentRows,
          consistency: 1,
        },
      });
    }
    const previous = oriented;
    const previousToOriginal = toOriginal;
    oriented = rotateClockwise(previous);
    toOriginal = (point) => previousToOriginal(mapPoint(point, previous));
  }
  return null;
}

/** Alias kept consistent with the other two-dimensional detectors. */
export const detectAndDecodeGS1Composite = detectGS1Composite;
