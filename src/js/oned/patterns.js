/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */
/**
 * Pattern tables for the linear symbologies.
 *
 * Every table here is a published fact about a symbology, expressed in this
 * project's own notation and validated by structural invariants rather than
 * trusted. `validateTables()` at the bottom asserts the properties each
 * symbology guarantees — module counts, wide-element counts, uniqueness — and
 * the test suite runs it. A transcription slip that breaks an invariant fails
 * the build; the invariants are chosen so that most single-character slips do.
 *
 * Two notations appear:
 *
 *   width strings  "212222"  — element widths in modules, bar first, then
 *                              alternating space/bar. Used by Code 128, 93,
 *                              Codabar, ITF, Code 39, Code 11.
 *   module strings "0001101" — one character per module, 1 = dark. Used by
 *                              EAN/UPC, where every element is a whole number
 *                              of modules out of a fixed 7.
 *
 * @module oned/patterns
 */
/* ------------------------------------------------------------------ *
 * EAN / UPC
 * ------------------------------------------------------------------ */
/** Odd-parity ("L") digit patterns, 7 modules each. */
export const EAN_L = [
    '0001101', '0011001', '0010011', '0111101', '0100011',
    '0110001', '0101111', '0111011', '0110111', '0001011',
];
/** Even-parity ("G") patterns: the R pattern reversed. */
export const EAN_G = EAN_L.map((p) => [...p].reverse().map((b) => (b === '1' ? '0' : '1')).join(''));
/** Right-hand ("R") patterns: the L pattern complemented. */
export const EAN_R = EAN_L.map((p) => [...p].map((b) => (b === '1' ? '0' : '1')).join(''));
/**
 * Which parity set each of the six left-hand EAN-13 digits uses, indexed by
 * the first digit. This is how the thirteenth digit is carried without a
 * thirteenth symbol position.
 */
export const EAN13_PARITY = [
    'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
    'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
];
/** UPC-E parity patterns, indexed by check digit. Used when the number system is 0. */
export const UPCE_PARITY = [
    'EEEOOO', 'EEOEOO', 'EEOOEO', 'EEOOOE', 'EOEEOO',
    'EOOEEO', 'EOOOEE', 'EOEOEO', 'EOEOOE', 'EOOEOE',
];
export const EAN_START_END = '101';
export const EAN_MIDDLE = '01010';
export const UPCE_END = '010101';
/* ------------------------------------------------------------------ *
 * Code 39
 * ------------------------------------------------------------------ */
/**
 * Code 39 is "three of nine": nine elements per character, of which exactly
 * three are wide. `n` and `w` below are narrow and wide; elements alternate
 * bar, space, bar, ... starting and ending with a bar.
 */
export const CODE39 = {
    '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
    '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
    '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', 'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw',
    'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn',
    'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn',
    'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww',
    'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn',
    'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn', 'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw',
    'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn',
    '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '$': 'nwnwnwnnn',
    '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn',
};
/** Character set for the optional modulo-43 check digit; '*' is excluded. */
export const CODE39_CHECK_SET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%';
/** Two-character escapes giving Code 39 the full ASCII range. */
export const CODE39_EXTENDED = (() => {
    const map = new Array(128);
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 26; i++) {
        map[i + 1] = '$' + upper[i]; // SOH..SUB
        map[i + 65] = upper[i]; // A-Z
        map[i + 97] = '+' + upper[i]; // a-z
    }
    for (let i = 0; i < 10; i++)
        map[i + 48] = String(i);
    map[0] = '%U';
    for (let i = 27; i <= 31; i++)
        map[i] = '%' + upper[i - 27 + 0]; // ESC..US -> %A..%E
    const symbols = {
        32: ' ', 33: '/A', 34: '/B', 35: '/C', 36: '/D', 37: '/E', 38: '/F',
        39: '/G', 40: '/H', 41: '/I', 42: '/J', 43: '/K', 44: '/L', 45: '-',
        46: '.', 47: '/O', 58: '/Z', 59: '%F', 60: '%G', 61: '%H', 62: '%I',
        63: '%J', 64: '%V', 91: '%K', 92: '%L', 93: '%M', 94: '%N', 95: '%O',
        96: '%W', 123: '%P', 124: '%Q', 125: '%R', 126: '%S', 127: '%T',
    };
    for (const [code, seq] of Object.entries(symbols))
        map[Number(code)] = seq;
    return map;
})();
/* ------------------------------------------------------------------ *
 * Code 93
 * ------------------------------------------------------------------ */
/** Nine modules per character across six elements. */
export const CODE93 = {
    '0': '131112', '1': '111213', '2': '111312', '3': '111411', '4': '121113',
    '5': '121212', '6': '121311', '7': '111114', '8': '131211', '9': '141111',
    'A': '211113', 'B': '211212', 'C': '211311', 'D': '221112', 'E': '221211',
    'F': '231111', 'G': '112113', 'H': '112212', 'I': '112311', 'J': '122112',
    'K': '132111', 'L': '111123', 'M': '111222', 'N': '111321', 'O': '121122',
    'P': '131121', 'Q': '212112', 'R': '212211', 'S': '211122', 'T': '211221',
    'U': '221121', 'V': '222111', 'W': '112122', 'X': '112221', 'Y': '122121',
    'Z': '123111', '-': '121131', '.': '311112', ' ': '311211', '$': '321111',
    '/': '112131', '+': '113121', '%': '211131',
    // The four shift characters. Their conventional names -- ($) (%) (/) (+) --
    // collide with the literal single-character entries above, so they take
    // distinct multi-character keys. Writing the bare symbols here would create
    // duplicate object keys, which JavaScript collapses silently: the table
    // would end up three entries short, with no error raised anywhere.
    'S$': '121221',
    'S%': '312111',
    'S/': '311121',
    'S+': '122211',
};
/**
 * Symbol values 0..46 in order, as keys into {@link CODE93}. An array rather
 * than a string, because the four shift characters have multi-character keys.
 */
export const CODE93_VALUES = [
    ...'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%',
    'S$', 'S%', 'S/', 'S+',
];
export const CODE93_START_STOP = '111141';
/* ------------------------------------------------------------------ *
 * Code 128
 * ------------------------------------------------------------------ */
/**
 * All 107 symbol patterns. Eleven modules each across six elements; the stop
 * pattern is the sole exception at thirteen modules across seven.
 *
 * The eleven-module invariant is checked below and catches the overwhelming
 * majority of transcription slips, since almost any single-digit change to a
 * pattern breaks the sum.
 */
export const CODE128 = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213',
    '122312', '132212', '221213', '221312', '231212', '112232', '122132',
    '122231', '113222', '123122', '123221', '223211', '221132', '221231',
    '213212', '223112', '312131', '311222', '321122', '321221', '312212',
    '322112', '322211', '212123', '212321', '232121', '111323', '131123',
    '131321', '112313', '132113', '132311', '211313', '231113', '231311',
    '112133', '112331', '132131', '113123', '113321', '133121', '313121',
    '211331', '231131', '213113', '213311', '213131', '311123', '311321',
    '331121', '312113', '312311', '332111', '314111', '221411', '431111',
    '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114',
    '413111', '241112', '134111', '111242', '121142', '121241', '114212',
    '124112', '124211', '411212', '421112', '421211', '212141', '214121',
    '412121', '111143', '111341', '131141', '114113', '114311', '411113',
    '411311', '113141', '114131', '311141', '411131', '211412', '211214',
    '211232', '2331112',
];
export const CODE128_START_A = 103;
export const CODE128_START_B = 104;
export const CODE128_START_C = 105;
export const CODE128_STOP = 106;
export const CODE128_FNC1 = 102;
export const CODE128_FNC2 = 97;
export const CODE128_FNC3 = 96;
export const CODE128_FNC4_A = 101;
export const CODE128_FNC4_B = 100;
export const CODE128_SHIFT = 98;
export const CODE128_CODE_A = 101;
export const CODE128_CODE_B = 100;
export const CODE128_CODE_C = 99;
/* ------------------------------------------------------------------ *
 * Interleaved 2 of 5
 * ------------------------------------------------------------------ */
/** Five elements per digit, exactly two of them wide. */
export const ITF = [
    'nnwwn', 'wnnnw', 'nwnnw', 'wwnnn', 'nnwnw',
    'wnwnn', 'nwwnn', 'nnnww', 'wnnwn', 'nwnwn',
];
/* ------------------------------------------------------------------ *
 * Codabar
 * ------------------------------------------------------------------ */
/** Seven elements per character. */
export const CODABAR = {
    '0': 'nnnnnww', '1': 'nnnnwwn', '2': 'nnnwnnw', '3': 'wwnnnnn',
    '4': 'nnwnnwn', '5': 'wnnnnwn', '6': 'nwnnnnw', '7': 'nwnnwnn',
    '8': 'nwwnnnn', '9': 'wnnwnnn', '-': 'nnnwwnn', '$': 'nnwwnnn',
    ':': 'wnnnwnw', '/': 'wnwnnnw', '.': 'wnwnwnn', '+': 'nnwnwnw',
    'A': 'nnwwnwn', 'B': 'nwnwnnw', 'C': 'nnnwnww', 'D': 'nnnwwwn',
};
export const CODABAR_START_STOP = 'ABCD';
/* ------------------------------------------------------------------ *
 * Code 11
 * ------------------------------------------------------------------ */
/** Five elements per character, one or two of them wide. */
export const CODE11 = {
    '0': 'nnnnw', '1': 'wnnnw', '2': 'nwnnw', '3': 'wwnnn', '4': 'nnwnw',
    '5': 'wnwnn', '6': 'nwwnn', '7': 'nnnww', '8': 'wnnwn', '9': 'wnnnn',
    '-': 'nnwnn',
};
export const CODE11_START_STOP = 'nnwwn';
/* ------------------------------------------------------------------ *
 * MSI / Plessey
 * ------------------------------------------------------------------ */
/** Each bit of a digit becomes a bar pair: 1 is wide-then-narrow, 0 the reverse. */
export const MSI_BIT = { 0: '100', 1: '110' };
export const MSI_START = '110';
export const MSI_STOP = '1001';
/* ------------------------------------------------------------------ *
 * Structural validation
 * ------------------------------------------------------------------ */
/**
 * Assert every invariant these tables are supposed to satisfy.
 *
 * This is the first of the correctness mechanisms described in NOTICE.md:
 * the tables are redundant with the symbology rules, so the rules can check
 * the tables. Called from the test suite; cheap enough to call anywhere.
 *
 * @returns {string[]} Problems found; empty means all invariants hold.
 */
export function validateTables() {
    const problems = [];
    const sum = (s) => [...s].reduce((a, c) => a + Number(c), 0);
    const countWide = (s) => [...s].filter((c) => c === 'w').length;
    // --- EAN/UPC: 7 modules per digit; L odd parity; R the complement of L;
    // G the reverse of R. All 30 patterns distinct.
    for (let d = 0; d < 10; d++) {
        for (const [name, table] of [['L', EAN_L], ['G', EAN_G], ['R', EAN_R]]) {
            if (table[d].length !== 7)
                problems.push(`EAN ${name}${d}: ${table[d].length} modules, expected 7`);
        }
        const darkL = [...EAN_L[d]].filter((c) => c === '1').length;
        if (darkL % 2 === 0)
            problems.push(`EAN L${d}: even parity, expected odd`);
        const darkG = [...EAN_G[d]].filter((c) => c === '1').length;
        if (darkG % 2 !== 0)
            problems.push(`EAN G${d}: odd parity, expected even`);
        if (EAN_L[d][0] !== '0' || EAN_L[d][6] !== '1') {
            problems.push(`EAN L${d}: must start with a space and end with a bar`);
        }
    }
    const eanAll = new Set([...EAN_L, ...EAN_G, ...EAN_R]);
    if (eanAll.size !== 30)
        problems.push(`EAN: ${eanAll.size} distinct patterns, expected 30`);
    // --- EAN-13 parity: first row all-L, every row six characters, all distinct.
    if (EAN13_PARITY[0] !== 'LLLLLL')
        problems.push('EAN-13 parity[0] must be LLLLLL');
    if (new Set(EAN13_PARITY).size !== 10)
        problems.push('EAN-13 parity rows are not distinct');
    for (const [i, row] of EAN13_PARITY.entries()) {
        if (row.length !== 6)
            problems.push(`EAN-13 parity[${i}]: ${row.length} entries, expected 6`);
    }
    // --- Code 39: nine elements, exactly three wide, all patterns distinct.
    for (const [ch, p] of Object.entries(CODE39)) {
        if (p.length !== 9)
            problems.push(`Code39 '${ch}': ${p.length} elements, expected 9`);
        if (countWide(p) !== 3)
            problems.push(`Code39 '${ch}': ${countWide(p)} wide, expected 3`);
    }
    if (new Set(Object.values(CODE39)).size !== Object.keys(CODE39).length) {
        problems.push('Code39: duplicate patterns');
    }
    if (CODE39_CHECK_SET.length !== 43) {
        problems.push(`Code39 check set: ${CODE39_CHECK_SET.length} characters, expected 43`);
    }
    // --- Code 93: nine modules across six elements, all patterns distinct.
    for (const [ch, p] of Object.entries(CODE93)) {
        if (p.length !== 6)
            problems.push(`Code93 '${ch}': ${p.length} elements, expected 6`);
        if (sum(p) !== 9)
            problems.push(`Code93 '${ch}': ${sum(p)} modules, expected 9`);
    }
    if (new Set(Object.values(CODE93)).size !== Object.keys(CODE93).length) {
        problems.push('Code93: duplicate patterns');
    }
    if (CODE93_VALUES.length !== 47) {
        problems.push(`Code93 values: ${CODE93_VALUES.length}, expected 47`);
    }
    if (Object.keys(CODE93).length !== 47) {
        problems.push(`Code93 table: ${Object.keys(CODE93).length} entries, expected 47 ` +
            '(duplicate object keys collapse silently — check the shift characters)');
    }
    if (new Set(CODE93_VALUES).size !== CODE93_VALUES.length) {
        problems.push('Code93: duplicate entries in the value order');
    }
    for (const ch of CODE93_VALUES) {
        if (!CODE93[ch])
            problems.push(`Code93: value character '${ch}' has no pattern`);
    }
    // --- Code 128: 107 patterns, 11 modules each, stop 13. All distinct.
    if (CODE128.length !== 107) {
        problems.push(`Code128: ${CODE128.length} patterns, expected 107`);
    }
    for (const [i, p] of CODE128.entries()) {
        const expected = i === CODE128_STOP ? 13 : 11;
        const elements = i === CODE128_STOP ? 7 : 6;
        if (sum(p) !== expected)
            problems.push(`Code128 [${i}] "${p}": ${sum(p)} modules, expected ${expected}`);
        if (p.length !== elements)
            problems.push(`Code128 [${i}] "${p}": ${p.length} elements, expected ${elements}`);
        if ([...p].some((c) => c === '0' || Number(c) > 4)) {
            problems.push(`Code128 [${i}] "${p}": element width out of range 1-4`);
        }
    }
    if (new Set(CODE128).size !== CODE128.length)
        problems.push('Code128: duplicate patterns');
    // --- ITF: five elements, exactly two wide, ten distinct patterns.
    for (const [d, p] of ITF.entries()) {
        if (p.length !== 5)
            problems.push(`ITF ${d}: ${p.length} elements, expected 5`);
        if (countWide(p) !== 2)
            problems.push(`ITF ${d}: ${countWide(p)} wide, expected 2`);
    }
    if (new Set(ITF).size !== 10)
        problems.push('ITF: duplicate patterns');
    // --- Codabar: seven elements, all distinct.
    for (const [ch, p] of Object.entries(CODABAR)) {
        if (p.length !== 7)
            problems.push(`Codabar '${ch}': ${p.length} elements, expected 7`);
    }
    if (new Set(Object.values(CODABAR)).size !== Object.keys(CODABAR).length) {
        problems.push('Codabar: duplicate patterns');
    }
    // --- Code 11: five elements, all distinct.
    for (const [ch, p] of Object.entries(CODE11)) {
        if (p.length !== 5)
            problems.push(`Code11 '${ch}': ${p.length} elements, expected 5`);
    }
    if (new Set(Object.values(CODE11)).size !== Object.keys(CODE11).length) {
        problems.push('Code11: duplicate patterns');
    }
    return problems;
}
