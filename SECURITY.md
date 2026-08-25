# Security Policy

We take security reports seriously, while keeping the process practical. This SDK runs inside a
consumer's browser or Node.js process, so a vulnerability does not need to compromise the host
machine to be a real security issue. If it can execute code, expose data, or tamper with the
consumer application, please treat it as security-sensitive.

## Supported versions

| Release line | Security support | Notes |
| --- | --- | --- |
| Latest `1.5.x` stable release | Supported | Upgrade to the latest patch before reporting a regression. |
| `main` | Supported for triage | Development changes may move quickly, but security reports are welcome. |
| Older release lines | Not supported | Please reproduce on the latest stable release first. |

The current stable release is listed on the [GitHub releases page](https://github.com/Sythos/JS_Barcode_Universal/releases)
and on [npm](https://www.npmjs.com/package/@sythos/js_barcode_universal).

## Reporting a vulnerability

**Do not open a public GitHub issue for a suspected security vulnerability.** Public Issues are
for ordinary bugs; they are not the place to leave a loaded exploit on the front porch.

### Preferred channel: private GitHub report

Use [GitHub Private Vulnerability Reporting](https://github.com/Sythos/JS_Barcode_Universal/security/advisories/new)
whenever possible. It keeps the report, discussion and evidence private while we investigate.

### High or critical impact

For a **High** or **Critical** issue, also notify `devsec@sythos.net`. Use this route immediately
for any of the following:

- arbitrary code execution in a browser, Node.js process or consuming application;
- exposure or exfiltration of application data, tokens or secrets;
- CI, release, npm, GitHub Actions or package-integrity compromise;
- runner or host compromise, persistence or unauthorized lateral movement;
- a practical bypass of the SDK's input-validation or trust boundary.

If private reporting is temporarily unavailable, email `devsec@sythos.net` first and do not publish
the details elsewhere. For Medium or Low security impact, the private GitHub channel is normally
enough unless the maintainer asks for an additional notification.

## What to include

Please include enough detail to reproduce the problem without sharing live secrets:

- affected package version, release tag or commit;
- browser/Node.js version, operating system and relevant runtime configuration;
- a minimal reproduction or sanitized proof of concept;
- expected and actual behavior;
- impact, prerequisites and whether user-controlled image, camera or file data is required;
- logs, stack traces and sample inputs with credentials, personal data and production identifiers
  removed.

Do not attach passwords, access tokens, private customer data or an unredacted production sample.
The smallest useful reproduction is usually the fastest route to a fix.

## How we handle reports

1. We aim to acknowledge a private report within five business days.
2. We reproduce and assess impact, affected versions and exploitability.
3. We coordinate a fix, regression coverage and a release or advisory when appropriate.
4. We agree on a disclosure date with the reporter before publishing technical details.
5. We credit the reporter only with explicit permission.

Please do not disclose an exploitable issue, weaponized proof of concept or affected release details
publicly before coordinated disclosure is complete. A public issue may be used later for a confirmed,
non-sensitive fix or after the maintainer explicitly asks for public tracking.

## Public issues and non-security bugs

Public Issues are appropriate for reproducible decoder errors, incorrect output, crashes, rendering
bugs, documentation problems and performance regressions **after security impact has been ruled out**.
When in doubt, use the private channel. A crash can still be security-relevant if it enables denial
of service, memory abuse or a path to code or data compromise.

## Scope

Reports are in scope when they affect the published JavaScript or TypeScript runtime, generated
bundles, image/camera input boundary, browser examples, build and release workflows, provenance,
or the npm/GitHub package publication path.

## Security controls

Camera and file rasters are untrusted input. The decoder accepts only byte-valued channels and
positive safe-integer dimensions, with a maximum of 16,384 pixels per side and 16,777,216 pixels
in total. Renderers enforce the same final-image limits before allocating output and reject invalid,
fractional or oversized `scale`, `margin` and `barHeight` values.

The browser examples render scanned payloads and browser error messages as DOM text, not HTML.
Applications using decoded data should preserve that boundary and apply their own scheme and
business-policy checks before acting on a scanned value.

Release integrity depends on review as well as automation: third-party GitHub Actions are pinned to
immutable commit SHAs, and the development toolchain is bound by `package-lock.json`, an exact
TypeScript version and `npm ci --ignore-scripts` in the pull-request and release validation paths.
Artifact attestations and npm provenance provide build evidence; neither replaces code review or
consumer-side verification.

Good-faith research is welcome. Please avoid privacy violations, service disruption, persistence,
data exfiltration and testing against systems or data that you do not own. We will treat careful,
non-destructive research made through this policy as authorized for triage, subject to applicable law.
