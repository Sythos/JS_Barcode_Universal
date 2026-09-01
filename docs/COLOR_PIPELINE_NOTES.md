# Colour-aware rendering/decoding — status notes

Internal engineering notes, not a user-facing capability yet. Excluded from
the published documentation site (`mkdocs.yml` `exclude_docs`). This
records why this exists, what was built, what was measured, and what is
still missing before any format could ship on top of it.

## Why this exists

`docs/formats/excluded-formats.md`'s "Architecturally out of scope"
section explains that KarTrak ACI (and any other colour-coded symbology)
cannot be represented through this SDK's existing pipeline: `BitMatrix`,
every renderer and the generic image reader's binarizer are strictly
monochrome by design. This is a first pass at the infrastructure a
colour-aware format would need, built and tested in isolation from the
rest of the SDK so nothing already shipped is put at risk.

**Status: experimental, not wired into the public API.** No format uses
this. It is not exported from `src/ts/index.ts`, not in `package.json`
`exports`, not registered in `ONED_FORMATS`. The source files ship in the
npm tarball only because `package.json`'s `files` list includes all of
`src/ts` wholesale — they are not importable through any documented
subpath, and `tools/bundle.mjs` (which walks the graph from the real entry
point) never reaches them, so `bundle/` and the public surface are
unaffected.

## What was built

Three new modules under `src/ts/color/`, deliberately parallel to and
independent from the existing monochrome pipeline rather than a
retrofit of it:

- **`matrix.ts` — `PolychromeMatrix`.** The colour equivalent of
  `BitMatrix`: one small palette-index per module (`Uint8Array`-backed, up
  to 16 colours) instead of one bit. Same `get`/`set`/`clone`/`withMargin`
  shape as `BitMatrix` so it reads familiarly, but genuinely a separate
  type — retrofitting colour into `BitMatrix` itself would put every one
  of the ~85 already-shipped format modules that depend on its binary
  contract at risk, for a format that may never ship.
- **`render.ts` — `toColorImageData`.** The colour equivalent of
  `render/image-data.ts`'s `toImageData`: draws each module in its actual
  palette colour instead of a fixed dark/light pair.
- **`classify.ts` — `classifyGrid`.** The colour equivalent of
  `image/grid-sampler.ts`'s `sampleGridVoting`: given a *known* module grid
  geometry (a `PerspectiveTransform`, the same primitive every other
  format's detector already produces), samples an averaging window per
  module in the **raw, not binarized** RGBA image and nearest-colour
  matches it against the palette in plain Euclidean RGB space.

## What was measured (synthetic testing only — see the gap below)

Round-tripped a synthetic 26×13 grid (KarTrak's real 13-row × 2-stripe
shape) through `toColorImageData` → `classifyGrid`, using KarTrak's real
four colours (blue, white, red, black), with the true grid geometry known
exactly (no detection involved — see below):

| Degradation | Result |
| --- | --- |
| Clean render | 0 mismatches / 338 modules |
| Colour tint ±15 to ±35 per channel (simulated lighting/white-balance shift) | 0 mismatches |
| Extreme tint (+60/−50/+30 and +80/+20/−60 per channel) | 0 mismatches / 6,760 modules across 20 seeds |
| Box blur, 2 and 4 passes (simulated defocus/print bleed) | 0 mismatches |
| Random per-pixel noise, amplitude 20–90 | 0 mismatches / 6,760 modules across 20 seeds |
| Combined tint + blur + noise | 0 mismatches |
| 1 px transform shift (of a 100 px module pitch) | 0 mismatches / 3,380 modules across 10 seeds |
| 3 px transform shift | 0 mismatches |
| **5 px transform shift (half a module)** | **68.08% mismatch — catastrophic** |
| **Scale error +2%** | **5.03% mismatch — already meaningfully degraded** |
| **Scale error +5% / −5%** | **~50% mismatch — catastrophic** |

## The honest takeaway

Colour classification itself, given accurate geometry, is very robust —
KarTrak's four reference colours are far apart in RGB space, so lighting
shifts, print noise and blur that would worry a real deployment barely
move the numbers. **Geometric precision, not colour, is the dominant
failure mode**: a half-module positioning error or a few percent of scale
error is already catastrophic. This is not a new problem specific to
colour — every 2D format in this SDK (QR, Data Matrix, Aztec, ...) already
has to solve "find the symbol and its exact geometry in an arbitrary
photo" via a dedicated `detect*` module before its sampler ever runs. What
this work confirms is that colour classification does not make that
problem harder than it already is elsewhere in this codebase — but it also
does not make it easier or optional.

**No colour-aware detector exists.** `classifyGrid` only classifies a grid
whose corners are already known. Locating a KarTrak-style plate in an
arbitrary photograph — position, rotation, scale, and doing so reliably
under real print wear/dirt/lighting, the exact conditions that caused AAR
to abandon the real system by 1977 — is unbuilt and is the largest
remaining piece of work. All of the numbers above come from synthetic
raster manipulation of a self-generated image; nothing here has been
printed, photographed, or scanned by a real camera. That is exactly the
"field feedback" this evaluation is waiting on before deciding whether to
build a detector and a real format on top of this.

## Update: KarTrak ACI has since shipped on top of this (M21)

`src/ts/kartrak/` now exists, with `encodeKarTrak`/`decodeKarTrak`/
`detectKarTrak` published at the `@sythos/js_barcode_universal/kartrak`
subpath — see `docs/formats/kartrak.md`. It stays outside
`encode()`/`decode()`/`listFormats()` deliberately: those are built around
`BitMatrix`, and KarTrak's `PolychromeMatrix` output is a genuinely
different type, not a gap to be closed later. `detectKarTrak` implements
item 1 below in its narrowest honest form — an axis-aligned bounding-box
search, no rotation/skew correction — which is enough to round-trip a
rendered image but not to find a plate in an arbitrary photo. Building it
surfaced two real detector bugs the earlier synthetic testing on this page
did not exercise (an absolute-distance background threshold that broke
under a uniform lighting tint, and a background reference colour close
enough to white that ordinary pixel noise crossed the boundary); both are
fixed and covered by `test/kartrak.test.js`. What follows is what is still
genuinely missing.

## What is still needed before this is real-world ready

1. Rotation/perspective correction for the detector — `detectKarTrak` only
   handles an axis-aligned plate against a roughly uniform background.
2. Real-world validation: an actual printed sample, photographed under
   realistic conditions, decoded through this pipeline — synthetic
   raster tests, including KarTrak's own test suite, cannot stand in for
   this.
3. A decision on whether the classifier's plain-Euclidean-RGB approach is
   good enough, or needs a perceptually-aware colour space (e.g. Lab) —
   not resolvable without real photographs to test against.
4. Only once 1-3 hold up: consider whether KarTrak (or a future
   colour-coded format) belongs in the counted registry at all — that
   would need `encode()`/`decode()` to accept a non-`BitMatrix` result
   type, a real architectural change, not a per-format addition.
