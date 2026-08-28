import js from '@eslint/js';

const browserGlobals = {
  Blob: 'readonly',
  CanvasRenderingContext2D: 'readonly',
  CryptoKey: 'readonly',
  DOMException: 'readonly',
  DOMMatrix: 'readonly',
  Document: 'readonly',
  File: 'readonly',
  ImageData: 'readonly',
  ImageBitmap: 'readonly',
  OffscreenCanvas: 'readonly',
  OffscreenCanvasRenderingContext2D: 'readonly',
  Path2D: 'readonly',
  ReadableStream: 'readonly',
  TextDecoder: 'readonly',
  TextEncoder: 'readonly',
  URL: 'readonly',
  WebGL2RenderingContext: 'readonly',
  WebGLRenderingContext: 'readonly',
  WebGPU: 'readonly',
  Window: 'readonly',
  atob: 'readonly',
  btoa: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  window: 'readonly',
};

const nodeGlobals = {
  Buffer: 'readonly',
  process: 'readonly',
};

export default [
  {
    ignores: [
      'bundle/**',
      'node_modules/**',
      'site/**',
      'temp/**',
    ],
  },
  {
    files: [
      'src/index.js',
      'src/js/**/*.js',
      'tools/**/*.mjs',
      '.github/ci/**/*.mjs',
    ],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...browserGlobals,
        ...nodeGlobals,
      },
    },
    linterOptions: {
      // Existing source annotations intentionally suppress rules per module.
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      // Keep correctness checks strict without enforcing a project-wide style.
      'no-console': 'off',
      // Several generated/runtime parity helpers are intentionally retained in
      // the JavaScript mirror even when one build path does not call them.
      'no-unused-vars': 'off',
    },
  },
];
