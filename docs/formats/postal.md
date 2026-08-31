# Postal 4-state formats

Sythos Barcode Universal includes a small, dependency-free postal family. These
symbols are not one interchangeable barcode: every postal operator chose its
own bar-state alphabet, framing rules and payload envelope. The SDK keeps those
boundaries explicit while sharing one strict height-coded raster reader.

## Supported formats

| Format | Runtime id | Write | Read | Payload contract |
| --- | --- | :---: | :---: | --- |
| USPS POSTNET | `postnet` | ✅ | ✅ | 5, 9 or 11 body digits; a Mod-10 check digit is generated and verified. |
| USPS PLANET | `planet` | ✅ | ✅ | 11 or 13 body digits; a Mod-10 check digit is generated and verified. |
| Royal Mail 4-State Customer Code | `rm4scc` | ✅ | ✅ | Upper-case letters and digits; a Royal Mail check character is generated and verified. |
| KIX | `kix` | ✅ | ✅ | Dutch postal alphabet (`0–9`, `A–Z`); no check character is added. |
| Australia Post 4-State | `auspost` | ✅ | ✅ | Two-digit FCC + eight-digit DPID + optional customer data, with RS(4) parity. |
| Japan Post 4-State | `japanpost` | ✅ | ✅ | Digits, upper-case letters and `-`; the fixed symbol carries padding and a Mod-19 check. |
| USPS Intelligent Mail Barcode | `imb` | ✅ | ✅ | The four legal 20-, 25-, 29- and 31-digit routing/ZIP payload lengths. |

All seven entries are reported as `canWrite: true` and `canRead: true` by
`listFormats()`. The reader returns the canonical id shown above even when an
alias was requested.

## Writing

The family is available from the `oned` subpath and through the root
`encode()` dispatcher:

```js
import {
  encodeAustraliaPost,
  encodeIMB,
  encodeJapanPost,
  encodeKIX,
  encodePlanet,
  encodePostnet,
  encodeRM4SCC,
} from '@sythos/js_barcode_universal/oned';

const postnet = encodePostnet('12345');
const planet = encodePlanet('12345678901');
const royalMail = encodeRM4SCC('HELLO1');
const kix = encodeKIX('123ABC');
const japan = encodeJapanPost('12ABC-9');
const australia = encodeAustraliaPost('5956439111ABC');
const intelligentMail = encodeIMB('01234567094987654321');
```

The root dispatcher accepts the same ids:

```js
import { encode, toImageData } from '@sythos/js_barcode_universal';

const matrix = encode('12345', { format: 'postnet' });
const image = toImageData(matrix, {
  scale: 3,
  margin: 24,
  barHeight: 72,
});
```

Linear encoders return a compact `BitMatrix`; the renderer supplies the print
height and quiet zone. A postal matrix uses one light module between adjacent
bars so a raster reader can measure the state transitions without relying on a
particular device pixel size.

### POSTNET and PLANET

POSTNET accepts a five-, nine- or eleven-digit body. PLANET accepts an eleven-
or thirteen-digit body. The writer appends the operator's Mod-10 check bar
automatically. To supply a complete value that already includes the check bar,
pass `checkDigit: true`; the final digit is then verified before it is reused:

```js
const checked = encode('123455', {
  format: 'postnet',
  checkDigit: true,
});
```

The decoder validates the check bar and returns only the body (`12345` in the
example), with `checkDigit: true` in the result metadata. Half-height POSTNET
and PLANET bars are aligned to the lower edge of the eight-module postal
profile, as required by their physical grammar.

### RM4SCC

RM4SCC accepts upper-case letters and digits. A check character is generated
from the row and column sums of the payload. Most callers pass the body and let
the writer append it:

```js
const code = encodeRM4SCC('SW1A1AA');
```

When a complete body plus check character is supplied, `checkDigit: true`
requires that character to match. Lower-case input and punctuation are rejected
at the API boundary instead of becoming an accidental bar pattern.

### KIX

KIX uses the Dutch 4-state alphabet for digits and upper-case letters. It has no
check character, so `checkDigit` is `false` in a decoded result. KIX is still
structurally strict: every four-state glyph must be complete and the image must
not be truncated.

```js
const kix = encodeKIX('1234ABCD');
```

### Japan Post

Japan Post accepts digits, upper-case letters and a dash. Letters are expanded
into the format's two-group representation, unused groups are padded, and a
Mod-19 check group is added:

```js
const japan = encodeJapanPost('123-ABC');
```

The decoder removes padding and reconstructs the original text. It rejects a
wrong check group, an invalid alphabet value, a missing two-module start/stop
frame or a partially captured 67-state symbol.

### Australia Post

Australia Post starts with a two-digit Format Control Code (FCC) followed by
the eight-digit DPID. The FCC selects the legal symbol length. Remaining
capacity is customer data, protected by the format's GF(64) Reed–Solomon
parity.

Customer data can be encoded as the public character alphabet (the default) or
as compact numeric pairs:

```js
const characterData = encodeAustraliaPost('5956439111ABC', {
  customerEncoding: 'character',
});

const numericData = encodeAustraliaPost('595643911112345', {
  customerEncoding: 'numeric',
});
```

`custinfoenc` is accepted as a compatibility alias. On decode, the reader tries
both public alphabets when no preference is supplied. Applications that know
the producer's mode should pass `customerEncoding: 'character'` or
`'numeric'`; this avoids treating an ambiguous clean raster as a different
customer-data spelling.

The decoded text includes the FCC and DPID, followed by the recovered customer
data. Unsupported FCC values, over-capacity customer data, invalid characters
and parity failures produce no result.

### USPS Intelligent Mail (IMb / OneCode)

IMb carries 20, 25, 29 or 31 decimal digits. The writer validates the exact
length, computes the 11-bit frame check sequence and maps the resulting
codewords to the 65 four-state bars. `onecode` and `usps-onecode` are aliases
for the canonical `imb` id:

```js
const imb = encode('01234567094987654321', { format: 'onecode' });
```

The reader reconstructs the codeword envelope, verifies the frame check
sequence and returns the original digit string. It does not return a partial
ZIP/routing fragment when one or more bars are missing. The 31-digit profile is
decoded only when its routing envelope and frame check are self-consistent.

## Reading images

All postal readers are available through the normal RGBA image boundary:

```js
import { decode, toImageData } from '@sythos/js_barcode_universal';

const image = toImageData(encode('HELLO1', { format: 'rm4scc' }), {
  scale: 4,
  margin: 32,
  barHeight: 96,
});

const [result] = decode(image, { formats: ['rm4scc'] });
console.log(result?.format, result?.text, result?.checkDigit);
// rm4scc HELLO1 true
```

The image path first classifies the four bar heights, then validates the exact
start/stop frame, glyph alphabet and format-specific checksum. A symbol that
is clipped, ambiguous, damaged or not one of the requested formats returns an
empty array. The same rule applies when the image contains convincing-looking
noise: plausible text is not promoted to application data without structural
proof.

For camera capture, opt into the stricter profile:

```js
const hits = decode(cameraFrame, {
  formats: ['postnet', 'imb'],
  profile: 'camera',
  tryHarder: true,
});
```

The camera profile requires a measurable quiet zone on both sides of the bars
and a complete, coherent symbol. Postal decoding uses the supported fixed
orientation retry policy; it does not promise arbitrary projective distortion,
curved media, severe glare or multiple overlapping symbols.

## Aliases and result ids

| Alias | Canonical result id |
| --- | --- |
| `usps-postnet` | `postnet` |
| `usps-planet` | `planet` |
| `royalmail`, `royal-mail` | `rm4scc` |
| `australia-post`, `australiapost` | `auspost` |
| `japan-post` | `japanpost` |
| `onecode`, `usps-onecode` | `imb` |

The aliases are convenience selectors, not new symbologies. A result's
`format` is always the canonical id so applications can use a stable switch.

## Verification and licensing boundary

The implementation is original Sythos TypeScript with generated JavaScript and
no runtime dependency. Public format descriptions were used to implement the
state alphabets, checks and geometry. BWIPP/bwip-js output was invoked only as
an independent black-box validation oracle; no third-party source, lookup table
or runtime package is copied into or shipped by the SDK. The exact provenance,
patent and trademark review boundary is recorded in
[`licenses/postal.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/postal.license)
and [`NOTICE.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md).
Format names remain descriptive and do not
claim postal-operator certification.
