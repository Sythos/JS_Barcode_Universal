import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const repositoryRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export function validateLockfile(lock) {
  const packageEntries = lock?.packages;

  if (!packageEntries || typeof packageEntries !== 'object' || Array.isArray(packageEntries)) {
    throw new Error('package-lock.json does not expose a supported packages map.');
  }

  const minimumVersion = [5, 0, 12];
  const resolutions = Object.entries(packageEntries).filter(([path]) => (
    path === 'node_modules/brace-expansion'
    || path.endsWith('/node_modules/brace-expansion')
  ));

  for (const [path, metadata] of resolutions) {
    const version = metadata?.version;
    const match = typeof version === 'string' ? /^(\d+)\.(\d+)\.(\d+)$/.exec(version) : null;

    if (!match) {
      throw new Error(`Cannot verify brace-expansion version for ${path}: ${String(version)}.`);
    }

    const resolvedVersion = match.slice(1).map(Number);
    const isPatched = resolvedVersion[0] > minimumVersion[0]
      || (resolvedVersion[0] === minimumVersion[0] && resolvedVersion[1] > minimumVersion[1])
      || (resolvedVersion[0] === minimumVersion[0]
        && resolvedVersion[1] === minimumVersion[1]
        && resolvedVersion[2] >= minimumVersion[2]);

    if (!isPatched) {
      throw new Error(`Vulnerable brace-expansion resolution ${version} found at ${path}; require 5.0.12 or later.`);
    }
  }

  return resolutions.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lockPath = join(repositoryRoot, 'package-lock.json');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const resolutionCount = validateLockfile(lock);
  console.log(`Validated ${resolutionCount} brace-expansion lockfile resolution(s); all are 5.0.12 or later.`);
}
