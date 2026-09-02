# Excluded and intentionally out-of-scope formats

An absent format ID is intentional. The SDK prefers a clear “not implemented”
boundary over a detector that returns plausible-looking but wrong data.
`listFormats()` is the authoritative way to discover what the current runtime
can create and read.

## DENSO-licensed formats

The following formats are deliberately **not included** in this MIT SDK:

| Format | Reason | What the user would need |
| --- | --- | --- |
| SQRC | DENSO format with licensing and proprietary data rules outside this project’s MIT implementation. | An appropriate DENSO licence and a separate licensed adaptation. |
| Face Authentication SQRC | DENSO format with authentication semantics and licensing outside this SDK. | An appropriate DENSO licence and a separate licensed integration. |
| Native DENSO FrameQR | Proprietary format; the public material does not provide the complete interoperable implementation contract used here. | DENSO’s licensed generation/reading software or a licensed adaptation. |

The SDK’s `frameqr` entry is the separate non-certified
`sythos-canvas-qr/1` profile described in [Sythos Canvas QR](frameqr-profile.md).
It is not a fallback name for DENSO FrameQR.

Official DENSO references for the excluded SQRC formats:

- [DENSO SQRC](https://www.denso-wave.com/en/system/qr/product/sqrc.html)
- [DENSO Face Authentication SQRC](https://www.denso-wave.com/en/system/qr/product/facesqrc.html)

## Related formats not currently implemented

These names do not appear as supported IDs in the current registry:

| Format or feature | Current status |
| --- | --- |
| QR Code Model 1 | Deliberately unimplemented; the current evidence set lacks the complete placement figures and fixtures needed for a trustworthy writer and reader. |
| Data Matrix Rectangular Extension (DMRE) | Not included; the implementation covers classic ECC 200 square and rectangular symbols. |
| GS1 DataBar Expanded Stacked | Not included; its multi-row layout is a separate physical grammar. |
| Micro QR ECI | Outside the current Micro QR API scope. |
| Micro QR FNC1 / GS1 | Outside the current Micro QR API scope. |
| Micro QR Structured Append | Outside the current Micro QR API scope. |
| Full ISO/IEC 24723 composite variants | The shipped `gs1composite` entry is a bounded Sythos profile; complete certified interoperability and every normative layout remain outside scope. |

These are scope statements, not claims that the formats are impossible to
implement. A future implementation would need its own source audit, fixtures,
interoperability checks, security review and licence/provenance entry before it
could be added to the registry.

## Proprietary or unclear-status formats

The root [`LICENSE`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/LICENSE) deliberately excludes the following from
the current distribution because they are proprietary, licence-encumbered or
not sufficiently clear to redistribute with confidence:

- Digimarc Barcode
- VeriCode / VSCode
- DataGlyphs
- Snowflake Code
- ShotCode
- Microsoft Tag
- Bokode: a live MIT patent ([US8366003B2](https://patents.google.com/patent/US8366003B2), active through 2030) was later confirmed for this one — see [`docs/guides/legal-exclusions.md`](https://sythos.github.io/JS_Barcode_Universal/guides/legal-exclusions/) for the licensing-side detail; kept in this list too since the same "no complete implementable spec" gap that put it here originally still applies independently.
- Softstrip
- Codablock A (the Code-39-based stacked sibling of the already-implemented
  Codablock-F): a real, structurally distinct symbology — different row
  indicator scheme, mod-43 checksum, Code 39 rather than Code 128 rows —
  not just an older name for Codablock-F. Its only known standard citation
  is AIM USA's 1994 "TSC052 — Codablock A (39)," which could not be found
  published anywhere (not on AIM's site, not archived, not mirrored); no
  major open-source barcode library (Zint, BWIPP, OkapiBarcode) implements
  it either, which corroborates the same access problem rather than an
  oversight. Secondary sources describe only high-level parameters (row
  count, mod-43 checksum), not the row-indicator bit encoding or full
  checksum construction needed to implement it without guessing.
- Code 49: the originating patent (US 4,794,239) is expired and the
  normative ANSI/AIM BC6-2000 specification is genuinely public — its row
  structure, checksum formulas (weighted sums modulo 2401) and character
  set were fully verified from the spec's own pages. The blocker is
  narrower and unusual: the spec's own Appendix F, which maps each of the
  2401 possible symbol-character values to its physical bar/space
  pattern, prints only a 260-row sample and states plainly that "a
  reference diskette containing this table, and the programs necessary to
  generate it, is available from AIM USA" — meaning even the *generation
  algorithm*, not just the complete data, is a paid/request-only
  deliverable, not something derivable from the public specification.
  Reverse-engineering an exact rule from the 260-row sample was attempted
  and did not yield one reproducible with confidence across the full
  range. Zint hardcodes a complete 2401-entry table without documenting
  how it was obtained; this project only ever uses independent
  implementations as black-box verification oracles, never as a source
  to copy code or data tables from (see `NOTICE.md`), and the fact that
  even Zint's own author needed to hardcode rather than compute the table
  is itself evidence no simple closed-form generator exists publicly.
- Ultracode
- WeChat Mini Program Code (小程序码, also called a "sunflower code"): a
  genuinely distinct 2D symbology, not a skinned QR code — a ring-shaped
  layout (positioning points plus a radial ray/petal data region, three
  capacities of 36/54/72 rays) with Reed-Solomon-style error correction
  and a central logo area. Tencent does not publish the bit-level format
  anywhere; the most detailed public reverse-engineering effort found
  explicitly describes its own work as incomplete, with the mapping from
  mask patterns and ray-count/ECC-level to metadata bits still unresolved.
  No independent open-source project generates or decodes the actual
  ray-pattern raster offline (the one plausible-looking GitHub hit turns
  out to just wrap an ordinary square-QR library for a different purpose).
  Separately, and decisively on its own: the ring/dot/arc/positioning-
  point/logo architecture this class of code shares is explicitly claimed
  by an active, broad patent — US12204967B2 (Alipay.com Co., Ltd.,
  granted 2025, active through 2042) — plus further active patents from
  other assignees in the same design space (e.g. CN113487001A). Even
  setting IP risk aside, the code is functionally coupled to Tencent's
  backend: the only generation path Tencent itself exposes is a
  server-side API requiring a registered Mini Program AppID, so an
  independently-generated code has no legitimate real-world target to
  launch — closer to a URL-shortener's opaque short code than a
  self-contained symbology.

The list is maintained together with the legal-review notes in
[`NOTICE.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md) and the per-format inventory under
[`licenses/`](https://github.com/Sythos/JS_Barcode_Universal/tree/main/licenses/). Removing a format from this page requires the
same evidence and documentation update as adding it to the runtime.

## Unsupported variants are not “almost supported”

A format family can be present while a variant remains out of scope. Examples:

- `datamatrix` does not mean DMRE;
- `gs1databar14` does not mean every GS1 DataBar layout; Limited, Stacked,
  Stacked Omnidirectional and Expanded are separate explicit IDs, while
  Expanded Stacked remains outside scope;
- `gs1composite` is the bounded Sythos profile, not a promise of complete
  ISO/IEC 24723 certification or every external scanner's composite dialect;
- `microqr` does not mean every Micro QR optional feature;
- `pdf417` does not mean Compact PDF417 or MicroPDF417;
- `frameqr` does not mean DENSO FrameQR;
- EAN-2/EAN-5 do not become standalone symbols merely because their registry
  entries are readable.

Keep the application’s `formats` allow-list narrow and validate decoded data at
the application boundary. If a required format is not in `listFormats()`, the
safe answer is to use a separately licensed/validated implementation rather
than guessing from a similar-looking symbol.

## Adding a future format

A future addition should update, in one atomic change:

1. the JavaScript runtime and TypeScript declarations;
2. `listFormats()` and the package exports;
3. focused tests, black-box checks and real-device evidence where relevant;
4. the per-format licence/provenance file and [`NOTICE.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md);
5. this catalogue, [`PLAN.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/PLAN.md), the README and machine-readable
   release metadata.

Until all of those are green, the format belongs on this page rather than in
the supported registry.
