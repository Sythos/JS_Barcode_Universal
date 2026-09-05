# Security guide

This guide explains the security boundary around Sythos Barcode Universal and
the checks that protect the published package. It is a practical companion to
the repository's [Security Policy](https://github.com/Sythos/JS_Barcode_Universal/blob/main/SECURITY.md), not a replacement for
it. The policy is the source of truth for reporting channels, supported
versions and coordinated disclosure.

## The short version

Treat barcode text, pixels, camera frames and rendering options as untrusted
input. The SDK validates its own format and resource boundaries, but it cannot
know whether a decoded URL, account number, GS1 field or free-form string is
safe for the application that receives it.

The SDK runs inside the browser, Web Worker or Node.js (or Bun as an
alternative) process that imports it.
It is not a sandbox, a malware scanner or a policy engine. A successful decode
does not mean that the payload is safe to display, open, execute or forward.

## Trust boundaries

| Boundary | Treat as untrusted | What the SDK does | What the application must still do |
| --- | --- | --- | --- |
| Encode request | Payload text and format/options supplied by a user, request or remote configuration | Validates the selected format and encoding rules | Apply size, business and content limits before creating a symbol |
| Render request | scale, margin, barHeight and matrix dimensions | Rejects invalid values and final images outside the resource budget | Keep user-controlled render options within an application-specific budget |
| Image input | Camera frames, uploaded files, canvas pixels and decoded image objects | Requires safe dimensions and byte-valued channels; rejects unsafe rasters | Resize and schedule frames sensibly; do not let an untrusted producer allocate unlimited work |
| Decoder result | result.text, format metadata, bounds and confidence | Returns only a structurally validated result; returns an empty array when no valid symbol is found | Validate the meaning, destination and permissions before taking an action |
| Browser integration | Camera permission, DOM, storage and navigation | Provides a decoder and camera-facing profile, not browser policy | Use HTTPS or localhost, request only the required permission and keep DOM output as text |
| Node.js or Bun integration | Files, streams and process configuration around the SDK | Does not open files, spawn processes or contact a service for decoding | Validate paths, isolate jobs and apply time/memory limits in the host application |

The most important distinction is **decoded is not trusted**. A barcode can be
perfectly valid and still contain a phishing URL, an unexpected GS1 value or a
payload that is dangerous for the surrounding application.

## Built-in resource limits

The image and rendering paths reject invalid, fractional or oversized values.
The current hard limits are:

- no more than 16,384 pixels on either final image side;
- no more than 16,777,216 pixels in the final image in total;
- integer scale from 1 through 16,384;
- integer margin from 0 through 8,191 modules;
- integer barHeight from 1 through 16,384 pixels when supplied;
- positive safe-integer source image dimensions and four channel values per
  pixel.

The total-pixel ceiling is still a high limit: it is roughly twice the area of
an ordinary 4K image. It is a safety ceiling, not a recommendation to accept
every frame at that size. An application processing remote files or a live
camera should normally use a much smaller working budget.

These checks reduce accidental and hostile allocation pressure. They do not
turn a browser tab or a Node.js or Bun process into an unlimited service. Add request
timeouts, queue limits, cancellation and application-level memory controls
around workloads that can be supplied by other users.

## Safe decode handling

decode() returns an array. An empty array is the normal answer when a frame
does not contain a validated symbol. decodeStrict() is available when a
controlled boundary wants an exception instead; it is usually the wrong
choice inside a continuous camera loop.

~~~js
import { decode } from '@sythos/js_barcode_universal';

const results = decode(frameImage, {
  formats: ['qr', 'datamatrix'],
  profile: 'camera',
});

for (const result of results) {
  // The text is data. It is not an instruction for the application.
  renderAsText(result.text);
}
~~~

Do not promote a partial visual guess into application data. In particular,
avoid accepting a result merely because a detector found a plausible shape;
the decoder must establish the format, checksum/error correction and payload
before the caller acts on it. For a camera loop, accept a result only after
the frame is coherent and use application-level stability rules when repeated
frames are required.

## Safe display and navigation

Decoded text must be inserted as text, not as HTML. The same rule applies to
error messages that include input-derived details.

~~~js
const output = document.querySelector('#decoded-text');

for (const result of decode(frameImage)) {
  output.textContent = result.format + ': ' + result.text;
}
~~~

If the application intentionally supports links, parse and allow-list them
before navigation. Do not pass arbitrary decoded text to innerHTML, eval(),
a shell, a SQL query, a template engine or a privileged IPC call.

~~~js
function allowlistedHttpUrl(value, allowedHosts) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (!['https:', 'http:'].includes(url.protocol)) return null;
  if (!allowedHosts.has(url.hostname)) return null;
  return url.href;
}

const target = allowlistedHttpUrl(result.text, new Set(['www.sythos.net']));
if (target) window.location.assign(target);
~~~

The allow-list belongs to the application. The SDK cannot infer whether a
particular hostname, scheme or business identifier is appropriate for every
consumer.

## Camera and file inputs

Camera access is controlled by the browser and normally requires a secure
context (HTTPS or localhost). Permission to read a frame is not proof that the
frame is safe or useful. Before calling the decoder:

1. stop or skip frames that are incomplete, changing or obviously empty;
2. resize very large frames to the application's working budget while keeping
   enough module detail for the selected format;
3. pass a platform-neutral RGBA image with safe integer dimensions;
4. treat an empty result as normal and continue the loop without throwing;
5. accept a hit only when the result and its visual evidence satisfy the
   application's stability and business rules.

The SDK does not upload camera frames or decoded text. It also does not open
files or start camera capture by itself; browser examples are integration
examples and still run under browser permission and origin rules.

## Dependency and workflow boundary

The published package has **zero runtime dependencies**. TypeScript is pinned
as an exact development dependency for compilation and public declaration
checks; it is not installed as part of an application's runtime graph. The
lockfile records that development toolchain so CI can use npm ci instead of
resolving a moving dependency range.

Pull-request and release workflows install with:

~~~sh
npm ci --ignore-scripts --no-audit --no-fund
~~~

The pull-request quality workflow also runs on pushes to `main`. Its read-only Node jobs run ESLint,
the TypeScript compiler and public-type checks, package-surface and zero-runtime-dependency checks,
documentation consistency checks and the local workflow-attestation validator. No publish token or
release credential is available to that gate, and the published package still has zero runtime
dependencies.

GitHub Dependency Review checks dependency changes in pull requests. Additional tokenless workflows
run OSV Scanner for known dependency vulnerabilities, OSSF Scorecard for repository supply-chain
posture and `actionlint` for GitHub Actions syntax and expression mistakes. These controls validate
the repository and its development toolchain; the Blue Oak 1.0.0 allow-list entry is limited to the
development-only `minimatch` transitive dependency and is not shipped in the SDK. The controls do
not become part of the SDK consumed at runtime.

The same pull-request gate runs a bounded, deterministic `fast-check` property suite across the
supported 1D and 2D encoders and decoders. It checks matrix invariants and round-trip payloads with
small, reproducible inputs; the fuzzing harness remains development-only and is excluded from the
published npm package.

APIsec is intentionally not enabled because this repository is a barcode SDK, not an HTTP/OpenAPI
service, and the hosted scanner requires an account and secrets. OWASP ZAP API scanning needs an
authorized live target or API specification, so it is outside this project's current boundary.
`zizmor` is not a mandatory check while its action remains an early-development option, and Gitleaks
is excluded because organization use can require an external licence. No scanner is allowed to
silently introduce a registration, secret or runtime dependency requirement.

Package and release publication jobs request the permissions needed for OIDC,
artifact metadata and attestations. The documentation Pages deploy job also
uses an OIDC token for Pages deployment, but it does not publish the SDK or
create an artifact attestation. Pull-request quality jobs are read-only and do
not publish or create artifact attestations. Third-party GitHub Actions are
pinned to immutable commit SHAs in the checked-in workflows. These are useful
supply-chain controls, not a claim that every dependency, runner or hosted
service is perfect.

## Reporting a vulnerability

Do **not** put a suspected vulnerability, exploit or sensitive proof of concept
in a public GitHub Issue. Use [GitHub Private Vulnerability
Reporting](https://github.com/Sythos/JS_Barcode_Universal/security/advisories/new)
when it is available.

### Choose the channel

Use the private channel first whenever security impact is possible:

| Situation | Channel |
| --- | --- |
| Wrong decode, ordinary rendering or documentation bug, or a performance regression after security impact has been ruled out | Public GitHub Issue |
| Denial of service or memory abuse from attacker-controlled input, even without code execution | GitHub Private Vulnerability Reporting; notify `devsec@sythos.net` for High or Critical impact |
| Code execution in the browser, Node.js or Bun process or consuming application; data or secret exposure; package/CI compromise; or runner/host compromise | GitHub Private Vulnerability Reporting and, for High or Critical impact, `devsec@sythos.net` |

If the private channel is unavailable, email `devsec@sythos.net` and do not put
the details in a public Issue. A public Issue is appropriate for an ordinary
bug only after security impact has been ruled out or a maintainer has asked for
non-sensitive public tracking.

Notify devsec@sythos.net as well for High or Critical impact, including:

- arbitrary code execution in the browser, Node.js or Bun process or consuming app;
- exposure or exfiltration of application data, tokens or secrets;
- CI, release, npm, GitHub Actions or package-integrity compromise;
- runner or host compromise, persistence or lateral movement;
- a practical bypass of an SDK input-validation or trust boundary.

Code execution in a consuming application remains security-sensitive even when
the host operating system is not compromised. Report it privately first; a
public Issue is appropriate only after security impact has been ruled out or a
maintainer has explicitly asked for non-sensitive public tracking.

Include the affected version/tag/commit, runtime and operating system, a small
sanitised reproduction, expected versus actual behavior, prerequisites and
impact. Remove credentials, personal data, customer identifiers and live
tokens. Please avoid testing systems or data that you do not own, service
disruption, persistence and data exfiltration.

The full response and disclosure process is in [SECURITY.md](https://github.com/Sythos/JS_Barcode_Universal/blob/main/SECURITY.md).

## Local security and quality checks

From the repository root, the normal local gates are:

~~~sh
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

The TypeScript build check deliberately expects generated JavaScript to remain
unchanged in a clean checkout. If it produces a diff, stop and inspect it; do
not publish a package whose source and generated runtime disagree.

## What these checks do not prove

Green local or hosted checks do not prove that an application has safe
business rules, that a barcode payload is benign, that a browser permission is
appropriate, or that an external specification has no patent or trademark
issue. Artifact attestations and npm provenance add build evidence; they do
not replace review, consumer-side verification or legal advice.

For licensing and provenance boundaries, see [licensing.md](licensing.md)
and [NOTICE.md](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md). For the exact release artifact procedure,
see [release-verification.md](../release-verification.md).
