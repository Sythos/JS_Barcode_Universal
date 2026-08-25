# Licensing and provenance

Sythos Barcode Universal is distributed under the [MIT License](https://github.com/Sythos/JS_Barcode_Universal/blob/main/LICENSE).
This page explains what that statement covers, where engineering provenance is
recorded and where it deliberately stops. It is an engineering guide, not a
patent opinion, trademark clearance or legal advice.

## The effective license

The root LICENSE file contains the complete MIT grant, notice requirement and
warranty disclaimer. It grants permission to use, copy, modify, publish,
distribute, sublicense and sell the original software, subject to the MIT
notice and disclaimer.

The effective package metadata says:

~~~json
{
  "license": "MIT",
  "sideEffects": false,
  "engines": { "node": ">=24" }
}
~~~

The metadata is a convenient summary. The complete legal text in
[LICENSE](https://github.com/Sythos/JS_Barcode_Universal/blob/main/LICENSE) is the authority.

## What ships in the package

The files list in package.json defines the intended published surface:

- src/ — stable JavaScript facades, compiled JavaScript and TypeScript
  source/declarations;
- bundle/ — the committed IIFE and ESM browser bundles;
- examples/ — browser integration examples;
- licenses/ — format-specific engineering inventories;
- LICENSE, NOTICE.md, README.md, AI_USAGE.md and llms.txt — legal,
  provenance, project and machine-readable context.

The published SDK has no dependencies or optionalDependencies. TypeScript is a
development-only dependency used to compile and check this repository; the
exact version is recorded in both package.json and package-lock.json. An
application consuming the package does not need to install TypeScript just to
run the JavaScript SDK.

## Original implementation and generated output

The TypeScript implementation and the compiled JavaScript runtime integration
are original Sythos work. The stable JavaScript facades and browser bundles
are generated or maintained release artifacts of that same implementation;
they are not separate third-party libraries with a second license.

The repository publishes readable source and declarations so a consumer can
inspect the API and the generated runtime. npm run build:ts regenerates the
compiled JavaScript, while npm run types and npm run types:api check the source
and public declaration surface.

## Standards, symbologies and technical references

The project implements barcode symbologies from published technical
descriptions. A standard's text remains copyrighted by its publisher and is
not reproduced or redistributed here. A format name, mathematical rule or
publicly described encoding value is not itself a third-party source file.

That distinction is useful, but it is not a universal legal conclusion. The
format inventories in [licenses/](https://github.com/Sythos/JS_Barcode_Universal/tree/main/licenses/) record the known
specification, patent and trademark questions for each supported format. The
root LICENSE appendix consolidates the same review labels. Entries marked
[TO VERIFY] or [LEGAL REVIEW] must stay visible; removing a marker requires a
documented source and appropriate review.

## Third-party tools and black-box verification

Independent implementations and public technical materials may be used for
engineering review, fixture generation or black-box comparison. The repository
records that activity in [NOTICE.md](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md), including the
distinction between consulting or invoking a tool and incorporating its code.

The project does not copy third-party barcode implementation source code into
the published SDK. Independent barcode libraries used as oracles, including
their source and tables, are not runtime dependencies and are not shipped in
the package. Normative or public values may still be represented in original
Sythos structures: for example, [NOTICE.md](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md) attributes the
PDF417 pattern-order table transcribed from the AIM USS-PDF417 Appendix H /
Table H1 reference. That attributed engineering input is not a copied barcode
library. The independent tools' licenses remain their own licenses; the MIT
license of this repository does not relicense them.

TypeScript is different in role but not in the dependency rule: it is a
development-only compiler and public type checker, not barcode logic and not a
runtime dependency of this SDK. Its license is recorded by npm metadata in the
lockfile and does not change the license of the generated Sythos runtime.

## Format-specific boundaries

The format files are intentionally honest about uncertainty:

| Boundary | Project position |
| --- | --- |
| QR Code, Data Matrix, Aztec and supported 1D/GS1 paths | Original Sythos implementation, distributed under MIT, with format-specific provenance and review labels in licenses/. |
| PDF417 and MicroPDF417 families | The runtime implementations are original Sythos work. PDF417 pattern ordering includes the attributed AIM USS-PDF417 Appendix H / Table H1 engineering input; independent libraries such as ZXing, bwip-js and Zint are verification tools only, and their source and tables are not shipped. The associated inventories retain their legal-review markers. |
| Sythos Canvas QR profile | A Sythos profile. It is not DENSO FrameQR compatibility, certification or a license to use the DENSO product format. |
| SQRC and Face Authentication SQRC | Excluded from this MIT SDK because the project records the DENSO licensing boundary in PLAN.md. A consumer needs the appropriate DENSO rights and a separate adaptation. |
| Unresolved or proprietary formats | Not included merely because a similar name is familiar. The exclusion is documented instead of silently implying permission. |

The capability registry also separates writing from reading. A format being
listed by the SDK does not turn a trademark into a product name, grant a patent
license or promise interoperability with a proprietary profile.

## Trademarks and naming

Format names may be used descriptively to tell users what the SDK reads or
writes. They do not imply sponsorship, endorsement, certification or ownership
by the named rights holder. The package name is descriptive and is not named
after a third-party barcode mark.

The format inventories record known marks and uncertainty. If a distribution,
marketing page or product name goes beyond descriptive use, obtain a separate
trademark review rather than treating the MIT license as a branding clearance.

## What the MIT license does not promise

The MIT grant does not promise:

- that every consumer use is free of patent, trademark or regulatory duties;
- that a published standard may be copied in full;
- that a third-party tool or its output is relicensed under MIT;
- that a symbol is certified by ISO, GS1, DENSO WAVE or another rights holder;
- that an application may ignore its own privacy, security or data-handling
  obligations.

Use the repository files as an engineering record and ask qualified counsel
about a commercially sensitive deployment. “MIT” describes this project's
copyright license; it is not a magic wand for every legal question around a
barcode ecosystem.

## Keeping the record aligned

When a supported format, development tool, generated artifact or verification
oracle changes, update the relevant licenses/* file, NOTICE.md and the
package/release documentation in the same change. Keep package.json and
package-lock.json synchronized. Do not add a runtime dependency just to reuse
a test oracle: the zero-runtime-dependency boundary is part of the SDK's
published contract.

For reproducibility, integrity checks and consumer-side verification of a
release, see [release-verification.md](../release-verification.md). For
vulnerability reporting, see [SECURITY.md](https://github.com/Sythos/JS_Barcode_Universal/blob/main/SECURITY.md).
