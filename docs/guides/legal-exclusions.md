# Formats not included for legal or licensing reasons

This page collects, in one place, every format this SDK does **not**
implement specifically because of a licensing, patent, trademark, or
issuing-authority barrier — not because a specification was unavailable
or a reverse-engineering attempt fell short. Those *technical* exclusions
(Codablock A, Code 49, Softstrip, Ultracode, and the scope
statements in [Excluded and out-of-scope formats](../formats/excluded-formats.md))
are catalogued separately; nothing here restates them. Bokode was
originally catalogued there too, on "unclear status" grounds — it moved
to this page once an active, on-topic patent was found for it (see below).

The distinction matters for anyone evaluating whether a missing format
is worth requesting: a technical gap can close if a spec surfaces or a
reverse-engineering effort succeeds, while the formats below are excluded
by design and would need a genuinely different relationship with a
rights holder (a license, a registration, or — for AADHAAR — cryptographic
material only a government authority holds) before they could ever be
added.

This is an engineering assessment, not legal advice.

| Format | Rights holder / authority | Why it is not implemented |
| --- | --- | --- |
| SQRC | DENSO WAVE | Proprietary DENSO format with licensing and data rules outside this project's MIT scope. See [DENSO SQRC](https://www.denso-wave.com/en/system/qr/product/sqrc.html). |
| Face Authentication SQRC | DENSO WAVE | Proprietary DENSO format with authentication semantics and licensing outside this SDK. See [DENSO Face Authentication SQRC](https://www.denso-wave.com/en/system/qr/product/facesqrc.html). |
| Native DENSO FrameQR | DENSO WAVE | Proprietary product; public material does not provide the complete interoperable contract this SDK requires before implementing a format. This SDK's own `frameqr` id is the separate, non-certified [Sythos Canvas QR profile](../formats/frameqr-profile.md) — not a substitute or fallback name for DENSO's product. |
| Digimarc Barcode | Digimarc Corporation | Proprietary. |
| VeriCode / VSCode | Veritec Inc. | Proprietary. |
| DataGlyphs | Xerox | Proprietary. |
| Snowflake Code | Marconi Data Systems | Proprietary. |
| ShotCode | (proprietary) | Proprietary. |
| Microsoft Tag | Microsoft | Proprietary, discontinued. |
| WeChat Mini Program Code (小程序码, "sunflower code") | Tencent | A genuinely distinct ring-shaped symbology (unlike AR Code and SPARQCode below, which are not distinct formats at all) — but the shared ring/dot/arc/positioning-point/logo architecture this class of code uses is explicitly claimed by an active patent, [US12204967B2](https://patents.google.com/patent/US12204967B2/en) (Alipay.com Co., Ltd., granted 2025, active through 2042), and further active patents from other assignees occupy the same design space. Independently of the patent question, the format is also functionally coupled to Tencent's own backend: the only generation path Tencent exposes even to legitimate Mini Program owners is a server-side API tied to a registered AppID, so a self-built code has no legitimate real-world target to launch. See [Excluded and out-of-scope formats](../formats/excluded-formats.md) for the technical (unpublished bit-level spec) side of this same exclusion. |
| AADHAAR Secure QR Code | UIDAI (Unique Identification Authority of India) | Not a symbology question at all: the payload structure itself is not secret, but a QR code only verifies as a genuine Aadhaar credential when signed with UIDAI's own private key, which no third party holds or can obtain. Building an *unsigned* structured-data encoder — the same kind of helper this SDK provides for AAMVA driver's-license data, Swiss QR-bill, SEPA QR, and vCard, under [`payloads/`](../formats/qr-family.md) — would be functionally inert for Aadhaar's real purpose while producing something that visually resembles a genuine Indian government identity document. That risk profile is materially different from, and worse than, AAMVA's openly-specified, freely-issuable data format, so it was deliberately left out rather than built. |

## Additional formats found via a broader review

The table above was built from formats already known to this project's
existing exclusion inventory. A separate pass cross-checked every
barcode/2D-code name on Wikipedia's ["Barcode"](https://en.wikipedia.org/wiki/Barcode)
article against what this SDK implements, looking specifically for
formats blocked by a **verified, currently active** license, patent or
royalty barrier — not merely obscure, undocumented, or hard to find.
Several formats initially surfaced by that review turned out, on
verification, not to belong here: the specific patents found for
CyberCode, Cauzin Softstrip, and Nintendo e-Reader dot code have all
expired; the patent initially found for Spotify Codes had been refused
(a different, later Spotify AB patent, linked below, is genuinely
active); Apple's App Clip Code format has no clear patent behind it and
an unofficial reverse-engineered implementation already exists, closer to
this project's *technical* exclusions than a licensing one; and High
Capacity Color Barcode is Microsoft Tag's research name, already listed
above. Each row below was independently confirmed active before being
included.

| Format | NO-GO type | Source |
| --- | --- | --- |
| Spotify Codes | Patent | [US10133974B2](https://patents.google.com/patent/US10133974B2/en) — "Machine-readable code," Spotify AB, active through 2037 |
| Snapcode (Snapchat / Snap Inc.) | Patent | [US9111164B1](https://patents.google.com/patent/US9111164B1/en) — "Custom functional patterns for optical barcodes," Snap Inc., active through 2035 |
| Bokode | Patent | [US8366003B2](https://patents.google.com/patent/US8366003B2) — Massachusetts Institute of Technology, active through 2030 |
| NaviLens | Patent | [ES1316576U](https://patents.google.com/patent/ES1316576U/en) — "Code for packaging, products or documents," Nuevos Sistemas Tecnológicos SL (NaviLens's own registered owner), active through 2034 |

## AR Code and SPARQCode: not exclusions, because they were never formats

Two other names investigated during this same review turned out not to
belong on this page at all, and are noted here only to head off the
question: **"AR Code"** is marketing language for an ordinary QR code
used as an AR-content marker, with no distinct encoding of its own — see
[Excluded and out-of-scope formats](../formats/excluded-formats.md) for
the research. **"SPARQCode"** likewise names a curated set of
already-public payload conventions (structured text for URLs, phone
numbers, WiFi configuration, contact cards, and similar) carried inside
an ordinary QR code, not a bit-level format its creator (MSKYNET, Inc.)
invented — this SDK implements those same public conventions directly,
via [`encodeSPARQCode`](../formats/qr-family.md). Neither name required a
license decision, because in both cases there was never a proprietary
format to license.
