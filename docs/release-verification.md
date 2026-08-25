# Release verification

This is the practical checklist for checking a tagged Sythos Barcode Universal
release before trusting or mirroring it. It describes the repository's actual
validation and publication paths as they exist today; it does not claim a
hermetic or formally certified build.

## What a release is supposed to prove

A green release should establish all of the following:

1. the tag is a real semantic-version tag and matches package.json without the
   leading v;
2. the lockfile and exact development toolchain can install cleanly with
   scripts disabled;
3. the JavaScript source, TypeScript source, declarations and public exports
   agree;
4. the package contains the intended files and no runtime dependency graph;
5. the published release assets have checksums and GitHub artifact-attestation
   evidence;
6. the public npm job publishes the validated tarball and requests npm
   provenance.

These are layered checks. None of them proves that a decoded payload is safe
for an application's business logic, that a format is legally cleared in
every jurisdiction or that a release is free of every possible defect.

## The authoritative inputs

Use these files rather than guessing from a release title or a stale README:

| Question | Authority |
| --- | --- |
| Package name, version, exports, files and Node requirement | package.json |
| Exact development dependency graph | package-lock.json |
| JavaScript/TypeScript consistency | src/, tools/compile-typescript.mjs, tsconfig*.json |
| Package/runtime smoke checks | .github/ci/validate-package.mjs |
| Attestation workflow structure | .github/ci/validate-attestations.mjs |
| Pull-request and publication gates | .github/workflows/pr-quality.yml, npm-publish.yml, npm-publish-github-packages.yml |
| Tagged GitHub release assets | .github/workflows/release.yml |
| Source and provenance context | LICENSE, NOTICE.md, licenses/ |

The root [documentation architecture](https://github.com/Sythos/JS_Barcode_Universal/blob/main/docs/DOCS_ARCHITECTURE.md) defines the same
source-of-truth rule for future pages.

## Reproduce the local validation

Use a clean temporary checkout of the tag. Keeping the verification checkout
separate from a working branch prevents a local generated-file change from
being mistaken for release evidence.

~~~sh
git fetch --tags origin
git switch --detach vX.Y.Z

npm ci --ignore-scripts --no-audit --no-fund
npm run build:ts
git diff --exit-code -- src/index.js src/js
npm run types
npm run types:api
node .github/ci/validate-package.mjs
node tools/check-zero-deps.mjs
node .github/ci/validate-attestations.mjs
npm pack --dry-run --ignore-scripts --no-audit --no-fund --json
git diff --check
~~~

The release workflow uses Node.js 24 and the lockfile-backed npm ci path. The
repository declares Node.js >=24; using another major version can make the
result a different experiment. npm ci is intentional: unlike npm install, it
refuses to silently rewrite the lockfile or resolve a new development
dependency range.

The build:ts step is checked for a clean generated-JavaScript diff. If it
changes src/index.js or src/js, stop. A release must not mix TypeScript from
one source state with generated JavaScript from another.

## CI toolchain baseline

The workflow toolchain uses maintained, explicitly selected baselines rather
than floating major ranges:

| Component | Baseline | Why it is pinned |
| --- | --- | --- |
| Node.js | 24 | The project runtime and the current LTS line used by CI. |
| Python | 3.14 | Current stable interpreter for the documentation-only job. |
| MkDocs | 1.6.1 | Latest stable MkDocs 1.x line supported by the selected Material release. |
| Material for MkDocs | 9.7.7 | Current stable documentation theme release. |
| TypeScript | 7.0.2 | Exact development dependency recorded in package.json and package-lock.json. |

Every GitHub Action is pinned to a full commit SHA. The Pages actions use
Node.js 24-compatible releases; a warning from an older action runtime should
be treated as dependency drift and fixed before the next release cycle.

## Verify the tag and package version

The release workflow accepts v*.*.* tags, checks that the tag resolves to a
commit and rejects a tag/package mismatch. A reviewer can make the same check
without trusting the release title:

~~~sh
TAG=vX.Y.Z
VERSION=$(node -p "require('./package.json').version")
TAG_VERSION=$(printf '%s' "$TAG" | sed 's/^v//')
test "$VERSION" = "$TAG_VERSION"
git rev-parse --verify "refs/tags/$TAG^{commit}"
git status --short
~~~

The release must be checked from the tag itself, not from an untagged local
working tree. If the tag is signed in a deployment policy, verify that
signature using the project's configured Git tooling; the workflow's version
gate is not a substitute for a signed-tag policy.

## Inspect the package surface

Preview the npm file list before packing:

~~~sh
npm pack --dry-run --ignore-scripts --no-audit --no-fund --json
~~~

Create a review copy and inspect its entries without executing package scripts:

~~~sh
mkdir -p release-check
npm pack --ignore-scripts --no-audit --no-fund --pack-destination release-check
tar -tzf release-check/*.tgz
~~~

Confirm that the archive contains the intended src, src/ts, bundle, examples,
licenses, LICENSE, NOTICE.md, README.md, AI_USAGE.md and llms.txt files, and
that it does not contain a barcode library as a runtime dependency. The exact
list is owned by package.json.files; do not turn this paragraph into a second
hand-maintained package manifest.

The package has no dependencies or optionalDependencies. TypeScript is a
development tool and is not part of the runtime graph. node_modules itself
must never be used as evidence of the published package surface.

## Understand the GitHub release assets

The tagged release workflow builds four assets:

1. the npm package tarball (*.tgz);
2. sythos-barcode.js, the IIFE browser bundle;
3. sythos-barcode.esm.js, the ESM browser bundle;
4. SHA256SUMS, containing the checksums for the tarball and both bundles.

The workflow removes old assets before refreshing an existing release and names
the release from the repository name plus the tag (for example, underscores in
the repository name become spaces). A successful workflow still deserves an
asset-list check; a green job is not proof that a browser downloaded the asset
you expected.

Download the assets from the GitHub release page, then verify the manifest in a
POSIX shell such as Git Bash:

~~~sh
sha256sum -c SHA256SUMS
~~~

On PowerShell, compare the output of:

~~~powershell
Get-FileHash .\*.tgz -Algorithm SHA256
Get-FileHash .\sythos-barcode.js -Algorithm SHA256
Get-FileHash .\sythos-barcode.esm.js -Algorithm SHA256
~~~

with the corresponding lines in SHA256SUMS. A checksum proves that the file
you downloaded matches the file named by that manifest; it does not prove that
the original source was correct or that a different file from a mirror is
safe. Verify the expected filename, tag and repository as well.

## Artifact attestations and npm provenance

The release workflow invokes actions/attest for the release output, with the
OIDC, attestation and artifact-metadata permissions limited to the release job.
The workflow intentionally sets create-storage-record: false; do not infer
“no registry storage record” to mean “no build evidence”. Verify the resulting
attestation through GitHub's attestation service when it is available for the
release:

~~~sh
gh attestation verify ./sythos-barcode.js \
  --repo Sythos/JS_Barcode_Universal
~~~

Repeat for the ESM bundle and tarball when reviewing all release subjects. Use
a recent GitHub CLI and the exact repository; a verification result for another
project or a copied local file is not evidence for this release.

The public npm workflow publishes the already validated tarball with
npm publish --provenance. npm provenance and GitHub artifact attestations are
related but separate records: one follows npm's publication provenance, the
other follows GitHub's attested build subject. Check both when the deployment
policy requires both. GitHub Packages uses its own attested publication path in
the dedicated workflow.

Attestation and provenance are evidence about where and how an artifact was
produced. They do not certify API correctness, malware absence, patent status,
trademark clearance, data safety or the behavior of an application that embeds
the SDK. Keep code review and the local checks in the chain.

## Reproducibility limits

The project deliberately improves reproducibility with a committed lockfile,
an exact TypeScript version, a declared Node.js major, script-free npm ci,
generated-source synchronization and checksums. That is strong practical
release hygiene, but it is not a promise of a bit-for-bit hermetic build across
all npm, Node.js, operating-system and archive-tool versions.

In particular:

- npm/tar archive metadata and tool versions can affect byte-for-byte output;
- a checksum verifies a published object, not an independently rebuilt object;
- a green attestation does not validate the semantics of every barcode format;
- committed bundles must still be inspected and tested as release subjects;
- a consumer should verify the exact tag, package version, asset name and
  checksum before mirroring or pinning an artifact.

If an independently rebuilt archive differs, record the exact Node.js, npm,
platform, checkout commit and command before drawing a conclusion. Do not
silently replace the published asset or regenerate a tag to make a mismatch
disappear.

## A compact consumer checklist

Before deploying a release into a sensitive application:

- pin the exact package version or GitHub release tag;
- confirm the tag and package.json version agree;
- inspect the npm package file list and runtime dependency graph;
- verify SHA256SUMS for downloaded release assets;
- verify GitHub attestation and npm provenance when your policy requires them;
- read [SECURITY.md](https://github.com/Sythos/JS_Barcode_Universal/blob/main/SECURITY.md) for decoder and rendering boundaries;
- read [licensing.md](guides/licensing.md) and the format inventories for legal
  questions;
- apply your own payload, URL, privacy, memory and business-policy checks.

For a vulnerability or supply-chain concern, use the private reporting route
in [SECURITY.md](https://github.com/Sythos/JS_Barcode_Universal/blob/main/SECURITY.md), not a public Issue with sensitive details.
