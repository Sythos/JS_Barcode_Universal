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
- Bokode
- Softstrip
- Ultracode

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

## Architecturally out of scope

Unlike the rest of this page, these are not licence or evidence gaps —
they are excluded because the format's data carrier is fundamentally
incompatible with this SDK's monochrome `BitMatrix`/image pipeline, not
because a review is pending:

| Format | Why it does not fit |
| --- | --- |
| KarTrak ACI (AAR Automatic Car Identification) | A 1967-77 railroad rolling-stock ID system: data is carried by which of four *colours* (blue, white, red, black) appears in each of thirteen stacked stripe pairs on a large plate bolted to a railcar, read trackside by red/blue photomultiplier tubes under a xenon arc light at up to 60 mph — not a black/white module pattern. This SDK's `BitMatrix`, every renderer (`toImageData`/`toPNG`/`toSVG`) and the generic image reader's binarizer are all strictly monochrome by design; there is no colour channel to encode into or decode from. Representing KarTrak would need a genuinely new colour-aware rendering and decoding pipeline, not a new format module — a different, much larger project than adding a symbology within the existing architecture. (Separately: the system itself was withdrawn by AAR around 1977 for reliability problems in real trackside use, so even a from-scratch colour pipeline would be reviving a symbology its own standards body abandoned as unworkable.) |

A future colour-aware rendering path (should one ever be built for a
different reason) would need its own architectural proposal before this
entry could move off this page — not just a per-format licence/provenance
entry like everything else here.

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
