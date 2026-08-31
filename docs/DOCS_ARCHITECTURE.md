# Documentation architecture

**Milestone:** M0 — information architecture and source audit
**Status:** complete
**Repository release audited:** `1.5.14` (`v1.5.14`)
**Owner:** Sythos

This file is the hand-off document for the documentation work. It records what
is authoritative, where each future page belongs, and how the pages must stay
honest as the SDK grows. It is deliberately an architecture record, not a user
guide. The user-facing pages start in M1.

## M0 boundary

M0 covers inventory, taxonomy, navigation, ownership and consistency rules.
It does **not** create the getting-started guide, API pages, format pages or
GitHub Pages site. Those are later milestones. In particular:

- `docs/` currently contains this architecture record only;
- no future page listed below is being presented as already available;
- no package version, tag or runtime code is changed by M0;
- no npm or GitHub publication is part of M0.

That boundary is intentional: a tidy map is cheaper to fix than a full forest
of pages pointing at the wrong tree.

## Documentation goals

The finished documentation should make five things obvious within a minute:

1. this is an MIT-licensed JavaScript and TypeScript SDK;
2. it generates and reads 1D and 2D barcodes;
3. it has zero runtime dependencies and works in browsers, Web Workers and
   Node.js 24+;
4. every format clearly declares writing and reading capability separately;
5. the examples, limits, security boundary and legal notes are practical and
   easy to verify.

The documentation is allowed to be friendly and informal. It is not allowed
to be vague about a decoder result, a camera limitation, a licence boundary or
an API that does not exist.

## Canonical source map

The following map is the source-of-truth contract for all future pages.

| Topic | Primary source | Supporting sources | Documentation rule |
| --- | --- | --- | --- |
| Package name, version, Node engine and publish surface | `package.json` | `package-lock.json`, release workflow | Never invent a version or an export. |
| Public API signatures and types | `src/index.d.ts`, `src/ts/index.d.ts` | `src/ts/*/index.d.ts`, `package.json.exports` | Type declarations win over prose when they disagree. |
| Runtime JavaScript entry points | `src/index.js`, `src/js/` | `tools/compile-typescript.mjs` | Describe generated JavaScript as an artefact, not as a second API. |
| Format registry and read/write capability | `listFormats()` in `src/index.js` | format modules in `src/ts/*`, README, PLAN | Derive the matrix from `canWrite` and `canRead`; do not hand-count it. |
| Format semantics and edge cases | `src/ts/*` format modules | `README.md`, `PLAN.md`, `NOTICE.md`, `licenses/*` | Explain observable behavior and link provenance where relevant. |
| Browser examples | `examples/create.html`, `examples/read.html` | README snippets | Examples must run against the current public entry points. |
| Image and camera behavior | image/detector/renderer source modules | examples, `README.md`, `SECURITY.md` | State validated limits; never promise arbitrary photographic robustness. |
| Security reporting and trust boundary | `SECURITY.md` | renderer/image validation, workflows | Private reporting rules and impact thresholds must stay aligned. |
| MIT terms and provenance | `LICENSE`, `NOTICE.md`, `licenses/` | `AI_USAGE.md` | Engineering notes are not legal advice or certification. |
| Release and reproducibility | `package.json`, `package-lock.json`, `.github/workflows/`, `.github/ci/` | bundle, checksums and attestations | Document commands that actually exist and pass. |
| Machine-readable project summary | `llms.txt` | README, package metadata | Useful for discovery, but never the primary API source. |

### Runtime and type layout snapshot

The audited checkout contains the TypeScript implementation under `src/ts/`,
compiled JavaScript under `src/js/`, and the stable root facade in `src/`.
`package.json` currently exposes 43 root and subpath targets. The source audit
found 86 TypeScript source files, 88 declaration files and 85 compiled
JavaScript modules. These numbers are an audit snapshot, not facts that pages
should hard-code forever; a future inventory command should refresh them.

## Capability inventory policy

The runtime registry is the authority. At release time, documentation may show
a friendly table generated from the same data, but the table must preserve the
two separate questions:

| Capability field | Meaning |
| --- | --- |
| `canWrite` | The SDK can encode the format into a symbol/matrix. |
| `canRead` | The generic decode pipeline can identify and decode the format from its supported input. |
| `write-only` | A deliberate capability boundary, not a failed promise. |
| `read` with a qualifier | Reading depends on a parent symbol, metadata or a supported profile. |

The current registry snapshot reports 45 entries and 44 generally readable
formats. The documentation must explain the important qualifiers instead of
turning the count into marketing copy:

- Pharmacode is write-only in the generic image pipeline;
- EAN-2 and EAN-5 are parent-bound supplements and require a validated EAN/UPC
  symbol;
- Telepen exposes full ASCII and an explicit Numeric pair mode; Numeric reads
  must be requested so compact pairs are not guessed as ASCII control data;
- Code 25/Standard 2 of 5, Industrial 2 of 5 and IATA 2 of 5 share a numeric
  digit grammar but expose distinct guard profiles; Code 32 and PZN validate
  pharmaceutical check digits before returning data;
- the Sythos Canvas QR profile is a project profile and is not DENSO FrameQR
  compatibility or certification;
- GS1 DataBar Omnidirectional/Truncated, Limited, Stacked, Stacked
  Omnidirectional and Expanded are separate physical variants, while Expanded
  Stacked remains out of scope;
- MaxiCode is a fixed 30×33 path with Modes 2–5 and a clean single-symbol
  detector;
- the postal family (POSTNET, PLANET, RM4SCC, KIX, Australia Post, Japan Post
  and IMb) uses strict operator-specific height-coded alphabets and checks;
- SQRC and Face Authentication SQRC remain excluded because their DENSO
  licensing boundary is documented in `PLAN.md`;
- any future unsupported variant must be labelled as unsupported, not silently
  grouped under a similar name.

When a page needs a count, prefer a generated value or a release audit note.
Manual format-count prose is an invitation for documentation drift.

## Documentation tree

The checked-in documentation follows this structure. New destinations should
be added to the ownership map and navigation in the same change, so the site
never advertises a page that has not been reviewed.

```text
docs/
├── DOCS_ARCHITECTURE.md
├── index.md
├── getting-started.md
├── installation.md
├── faq.md
├── troubleshooting.md
├── api/
│   ├── overview.md
│   ├── encoding.md
│   ├── decoding.md
│   ├── rendering.md
│   ├── typescript.md
│   └── subpath-exports.md
├── formats/
│   ├── overview.md
│   ├── oned.md
│   ├── qr-family.md
│   ├── datamatrix.md
│   ├── aztec.md
│   ├── pdf417-family.md
│   ├── gs1-and-ean.md
│   ├── frameqr-profile.md
│   └── excluded-formats.md
├── guides/
│   ├── browser.md
│   ├── node.md
│   ├── web-workers.md
│   ├── camera-reading.md
│   ├── image-pipeline.md
│   ├── performance.md
│   ├── security.md
│   └── licensing.md
├── examples/
│   ├── create-barcode.md
│   ├── read-barcode.md
│   ├── camera-loop.md
│   └── typescript-project.md
└── release-verification.md
```

## Page ownership and content map

| Area | Future pages own | Must read from |
| --- | --- | --- |
| Landing and onboarding | `index.md`, `getting-started.md`, `installation.md` | README quick start, `package.json`, public exports |
| API reference | `api/*` | `src/index.d.ts`, subpath declarations, `package.json.exports` |
| Format catalogue | `formats/*` | `listFormats()`, format modules, README/PLAN, legal files |
| Platform guides | `guides/browser.md`, `node.md`, `web-workers.md` | examples, entry points, Node engine and browser-safe source |
| Camera and image pipeline | `guides/camera-reading.md`, `image-pipeline.md` | detector metadata, image modules, `examples/read.html`, security limits |
| Rendering and performance | `guides/performance.md`, `api/rendering.md` | renderer options, pixel limits and actual smoke checks |
| Security and licensing | `guides/security.md`, `guides/licensing.md` | `SECURITY.md`, `LICENSE`, `NOTICE.md`, `licenses/*` |
| FAQ and troubleshooting | `faq.md`, `troubleshooting.md` | public API, platform guides, security and release boundaries |
| Practical recipes | `examples/*` | the two canonical HTML examples and public API snippets |
| Release verification | `release-verification.md` | lockfile, `.github/ci/`, workflows, bundles, checksums and attestations |
| Navigation and search | `docs/index.md`, page front matter if a site is added | only pages that really exist |

Pages may link to README and project files, but they must not quietly copy a
second, conflicting API reference. If a detail changes, update the source and
then update the owned page in the same documentation cycle.

## Navigation hierarchy

The eventual landing page should follow this reading order:

1. **Start here** — what the SDK is, install choices and a first round trip.
2. **Use the API** — encoding, decoding, rendering, TypeScript and subpaths.
3. **Choose a format** — capability matrix first, then format-specific notes.
4. **Connect it to your app** — browser, Node, Web Worker, camera and image input.
5. **Ship with confidence** — limits, security, licensing and release checks.
6. **Copy a recipe** — focused examples for the common workflows.

The navigation generator must omit missing pages rather than linking to a wish
list. A broken “Coming soon” link is still a broken link wearing a tiny hat.

## Writing and example rules

- Write all repository documentation in fluent, informal English.
- Keep paragraphs short and use Markdown tables, notes and code fences where
  they make a decision easier to scan.
- Every substantial example must include complete imports, the expected result,
  and the relevant failure or limit case.
- Keep JavaScript and TypeScript examples in sync; comments in code stay English.
- Use the public package entry points and documented subpaths. Do not import an
  internal file merely because it is convenient for a snippet.
- Use relative links for repository files and complete HTTPS links for external
  references. Never publish Windows paths in documentation.
- Describe the actual image shape (`{ data, width, height }`) and camera profile
  constraints. Do not imply that every browser grants camera access or that a
  single frame proves a symbol is valid.
- Distinguish encoding, decoding, detection, rendering and validation. “Works”
  is not a substitute for saying which of those operations is supported.
- Mark experimental, profile-specific, write-only and parent-bound behavior.
- Keep legal language factual and scoped. Link the relevant file; do not turn
  an engineering inventory into a patent opinion.

## Version and synchronization policy

`package.json` is the primary version source. A release consistency pass must
compare it with `package-lock.json`, `src/index.js` and generated bundles, the
release tag, README/PLAN references, and `llms.txt` where a version is shown.

The policy is:

1. change the version once in the package metadata;
2. regenerate the documented/generated artefacts through the project tools;
3. update release-facing prose only where the version is intentionally shown;
4. run type, API, package, zero-dependency and diff-whitespace checks;
5. inspect the staged file list and commit as Sythos before publication.

Documentation pages should avoid hard-coded patch versions in examples unless a
release-verification page explicitly describes a historical release. CDN
examples must follow the current release procedure or use a clearly marked
placeholder. `docs/` is repository documentation and is not added to the npm
tarball automatically; changing that boundary requires an explicit packaging
decision.

## Security, legal and provenance boundaries

The security guide must mirror `SECURITY.md`: ordinary reproducible decoder,
rendering and documentation bugs can use Issues after security impact is ruled
out; code execution, data exposure, package/CI compromise, host compromise or
an input-validation trust-boundary bypass must use the private channel, with
High/Critical reports also sent to `devsec@sythos.net`.

The licensing guide must point to `LICENSE`, `NOTICE.md` and the specific files
under `licenses/`. It must preserve these boundaries:

- the distributed runtime has no third-party barcode code or runtime dependency;
- independent implementations may be used as black-box test oracles;
- consultative material is not shipped source code;
- specification, patent and trademark notes are an engineering inventory, not
  legal advice;
- DENSO SQRC and Face Authentication SQRC are not included in this MIT SDK.

The release guide must explain that a green CI job is not, by itself, proof of
the archive contents or provenance. It should describe the actual package,
checksum and attestation verification steps only after those steps are present
and tested in the workflows.

## Documentation site delivery (M7–M10 implemented)

The repository is now configured to publish the same `docs/` tree as a GitHub
Pages site using **MkDocs Material**. This is a documentation delivery layer,
not a second source tree:

- `docs/` remains the canonical Markdown content;
- the root `mkdocs.yml` owns navigation, theme, site metadata and strict link
  checking;
- `tools/check-docs.mjs` checks local Markdown targets, navigation coverage,
  registry counts and README/llms release references before the site build;
- `.github/workflows/docs-pages.yml` deploys on pushes to `main` when `docs/**`,
  `mkdocs.yml`, the documentation requirements or the documentation checker
  change, so a documentation edit updates Pages automatically;
- `.github/workflows/docs-pages-pr.yml` runs a build/link check for pull
  requests without publishing or requesting deploy permissions;
- the workflow pins its actions and installs MkDocs Material as a CI-only
  dependency, leaving the SDK package at zero runtime dependencies;
- generated site files stay in the Pages deployment channel and are not copied
  into the npm tarball unless a separate packaging decision says otherwise.

M7 is complete when link, navigation and registry consistency checks are
available. M8 is complete when README, PLAN and machine-readable release
references point readers to the same documentation surface. M9 is complete
when the MkDocs Material configuration and quality workflow are checked in.
M10 is complete: the first public Pages deployment succeeded through workflow
`32900310547`, and consumer-side HTTP 200 checks passed for the home page, API,
format catalogue, recipes, FAQ and troubleshooting routes. This proves that
the site is publicly served; it does not by itself prove that every external
crawler has indexed it.

## M0 exit criteria

M0 is complete when all of the following are true:

- the source inventory identifies the runtime, types, exports, capabilities,
  examples, security, legal and release authorities;
- every planned page has one clear owner and source map;
- the navigation tree and version policy are explicit;
- technical, security and legal boundaries are written down;
- the architecture file passes `git diff --check`;
- no M1 user-facing page has been created.

M1 consumes this contract by establishing `docs/index.md`,
`docs/getting-started.md` and `docs/installation.md` as the first user-facing
foundation. The next milestone is M2, which may build the detailed API
reference. This file intentionally does not duplicate those guides.
