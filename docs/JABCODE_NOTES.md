# JAB Code — status notes

Internal engineering notes for `src/ts/jabcode/` (`docs/formats/jabcode.md`
is the user-facing page; this file is excluded from the published
documentation site via `mkdocs.yml` `exclude_docs`). This records what was
built, how it was verified, and — the most important part — what could
*not* be verified and why, so a future reader does not mistake "this
project's own round trip passes" for "this interoperates with real JAB
Code readers."

## Scope: the reference's own "default mode"

JAB Code's full specification (ISO/IEC 23634:2022, paywalled — no free
copy exists) covers multiple colour counts, multiple ECC levels, an
8-pattern mask-optimisation search, 7 text-compaction modes with a
dynamic-programming optimal-sequence analyzer, metadata Part I/II encoding
and placement, and cascaded multi-symbol codes. Implementing all of that
from scratch is comparable in scope to implementing QR or Data Matrix from
scratch.

This module instead targets the reference implementation's own
`isDefaultMode` fast path: `color_number == 8` and `ECC level == 3`
(`DEFAULT_ECC_LEVEL`), which the reference itself special-cases to skip
metadata Part I/II entirely and fix the mask to type 7 unconditionally —
eliminating the two most error-prone subsystems (metadata bit-packing and
mask-penalty scoring) while remaining a genuine, real configuration of the
format, not an invented simplification. On top of that, this module
encodes everything in byte mode only, skipping the 7-mode compaction
analyzer — the reference's own comment on `encodeData` notes byte mode can
always encode any input, so this is a capacity/efficiency gap, not a
correctness one. Single master symbol only, no cascaded slaves.

## What was built

- **`pseudo-random.ts` — `JabRandom`.** The format's own 64-bit LCG +
  Mersenne-Twister-style tempering PRNG, which both the encoder and
  decoder must derive an identical sequence from (LDPC matrix
  construction, data interleaving) with no other synchronization
  mechanism. See "The PRNG bit-exactness question" below.
- **`ldpc.ts`.** Gallager-construction LDPC: parity-check matrix
  construction from the shared PRNG, Gauss-Jordan elimination over GF(2),
  systematic generator-matrix encoding, and an iterative hard-decision
  bit-flipping decoder. Ported index-for-index from the reference's
  `ldpc.c` rather than restructured, specifically to minimize the risk of
  a subtle divergence from a from-scratch reading. The reference's
  soft-decision (log-likelihood/belief-propagation) decoder and the
  metadata-ecc matrix variant (`wr<=0`) are not implemented — out of scope
  along with metadata itself.
- **`byte-mode.ts`.** The byte-mode segment format: a shift-to-byte-mode
  code, a self-describing length prefix (4 bits, or 4+13 for payloads over
  15 bytes), then the raw bytes. Bit-exact against the reference's
  `encodeData`/`decodeData` byte-mode branch; the mode-switching wrapper
  needed to chain segments past 8207 bytes is not implemented (see
  `docs/formats/jabcode.md` for why that limit is not reachable in
  practice at any real side-version's capacity).
- **`tables.ts`.** Palette, finder/alignment core colours, the
  alignment-pattern position tables, and the master-symbol
  metadata/palette-swatch walk (`nextMetadataModuleInMaster`), all fixed
  to `color_number=8` rather than kept general.
- **`matrix.ts`.** Module placement: finder pattern (3 nested rings × 4
  corners, colour-rotated by ring parity), alignment patterns (diamond
  markers, alternating orientation), colour-palette swatches, and the
  data area (column-major placement, mask type 7 applied inline). Ported
  index-for-index from the reference's `createMatrix`, restricted to the
  master symbol.
- **`index.ts` — `encodeJABCode`/`decodeJABCode`/`decodeJABCodeMatrix`.**
  Orchestration, reusing this project's own already-verified
  `PerspectiveTransform` (`src/ts/image/perspective.ts`) and
  `PolychromeMatrix`/`toColorImageData`/`classifyGrid`
  (`src/ts/color/`) — the same known-geometry decode approach as KarTrak,
  not live detection or live palette calibration.

## The PRNG bit-exactness question

JAB Code's LDPC construction needs the encoder and decoder to derive an
*identical* pseudo-random sequence from a shared seed. The PRNG's core
(64-bit LCG state advance, Mersenne-Twister-style tempering on the upper
32 bits) is exact integer arithmetic — reproduced with `BigInt`, verified
by first-principles reasoning to be bit-for-bit deterministic across
runtimes, no different from any other integer algorithm ported this
session. The one place float32 precision genuinely matters is the
range-reduction formula that turns a raw PRNG output into a bounded
random index: `(int)((float)prng() / (float)UINT32_MAX * range)`. This is
reproduced with `Math.fround` at each single-precision operation boundary
(`pseudo-random.ts`'s `nextIndex`) — IEEE-754 float32 arithmetic is fully
specified and deterministic across C and JS, so this is believed to be a
faithful translation, not an approximation.

**This could not be confirmed against the real reference.** No C compiler
was available in this environment to build the actual `jabcode` library as
a decode oracle, and a search for a pre-built WASM port
(`TMSSassen/JABCodeJS`) found only the JS glue wrapper with no committed
`.wasm` binary — a dead end. Verification here is therefore
**self-consistency only**: this module's own encoder and decoder agree
with each other (see Testing below), which proves internal correctness
but not interoperability with a real JAB Code reader or the real reference
encoder. If a working reference build ever becomes available, re-verifying
the PRNG sequence and a full symbol against it is the natural next step.

## A real bug this process found (and how)

Self-consistency testing is not a formality — it caught a genuine,
non-obvious indexing bug. `GaussJordan`'s `column_arrangement` array is
sized by `capacity` in the reference (`calloc(capacity, ...)`), not by the
matrix's row count (`nb_pcb`); an initial port sized it by row count
instead. On a JS typed array, writing past the end is a silent no-op —
no exception, no out-of-bounds error — so the bug did not surface until a
clean (zero-corruption) LDPC round trip was checked bit-for-bit and failed
27 of 101 parity rows. The fix was a one-line array-size correction; the
lesson generalizes to the rest of this module: **silent out-of-bounds on a
typed array standing in for a C fixed-size array is the specific hazard
in a line-for-line C port**, worth an explicit check (compare every
`calloc(N, ...)` against the corresponding typed-array length) rather than
trusting that a wrong size will announce itself.

## Testing (self-consistency only — see the gap above)

`test/jabcode.test.js` round-trips: a range of payload sizes, the exact
15/16-byte byte-mode length-prefix boundary, a payload near a version-32
symbol's real capacity ceiling, a payload large enough to span multiple
LDPC sub-blocks (the reference's own >2700-bit block-splitting), a handful
of deliberately flipped data modules (hard-decision error correction), and
the full raw-image pipeline (`toColorImageData` → known corners →
`classifyGrid` → decode) at a realistic module scale. All pass. Ad hoc
testing during development additionally confirmed: LDPC alone recovers
from ~1% random bit corruption at realistic block sizes (though a very
small block, e.g. gross capacity under ~100 bits, has too little
redundancy to correct even a single flipped bit — an inherent property of
a sparse code at that size, not a bug, and not reachable at any real
side-version's capacity); and image decoding is reliable from 3 pixels per
module upward, with 2px/module an unreliable edge case consistent with
`docs/COLOR_PIPELINE_NOTES.md`'s finding that geometric/sampling precision
is generally the binding constraint, not colour classification itself.

## What is still needed before this is real-world ready

1. **A reference oracle.** Building the real `jabcode` C library (or
   finding/building a working WASM port) and cross-checking this module's
   LDPC matrices, byte-mode bitstream and rendered symbol against it,
   bit-for-bit, is the single most valuable next step — everything above
   is self-consistent but unconfirmed against the format's actual
   ecosystem.
2. **Real-world validation.** As with KarTrak, an actual printed symbol
   photographed under realistic conditions and decoded through this
   pipeline — synthetic raster tests cannot stand in for this.
3. **A detector.** `decodeJABCode` requires known corners, like
   `classifyGrid` itself; locating a JAB Code symbol in an arbitrary photo
   is unbuilt.
4. **The skipped subsystems**, roughly in order of likely value: text-mode
   compaction (capacity efficiency for short text-heavy payloads), other
   colour counts/ECC levels, metadata Part I/II (needed for any symbol a
   real reader would recognize, since this module's symbols are only
   self-describing to this module — a real JAB Code reader has no way to
   learn the colour count, ECC parameters or symbol version from the
   symbol itself in default mode, since Part I/II is exactly where that
   information normally lives), mask optimisation, and cascaded slave
   symbols.
