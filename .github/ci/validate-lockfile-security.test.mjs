import assert from 'node:assert/strict';
import test from 'node:test';

import { validateLockfile } from './validate-lockfile-security.mjs';

test('accepts patched brace-expansion lockfile resolutions, including nested entries', () => {
  const lock = {
    packages: {
      'node_modules/brace-expansion': { version: '5.0.12' },
      'node_modules/example/node_modules/brace-expansion': { version: '5.1.0' },
    },
  };

  assert.equal(validateLockfile(lock), 2);
});

test('rejects vulnerable brace-expansion resolutions', () => {
  const lock = {
    packages: {
      'node_modules/brace-expansion': { version: '5.0.11' },
    },
  };

  assert.throws(() => validateLockfile(lock), /require 5\.0\.12 or later/);
});

test('rejects unrecognized package-lock formats instead of skipping the check', () => {
  assert.throws(() => validateLockfile({ dependencies: {} }), /supported packages map/);
});
