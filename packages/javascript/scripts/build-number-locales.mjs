#!/usr/bin/env node
// LH-106: writes src/number-locale-data.ts, the locale data every number OPF generates is drawn with (src/numerals.ts).
//
// The engines run on Node 22, 24 and 26, in browsers and on edge runtimes, whose ICU versions disagree on some of this data
// (CLDR moves a separator or a default numbering system now and then), and exact golden hashes depend on the drawn text. So
// the engines never ask `Intl` while they draw: this script asks it once, on the maintainer's runtime, and the table it writes
// is the format's own. `test/numerals.mjs` compares the table with the running `Intl` and fails on the ICU version the table
// was made with when they disagree; rerun this script on purpose (with a changelog fragment) to take newer CLDR data.
//
//   node packages/javascript/scripts/build-number-locales.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'src', 'number-locale-data.ts');

const script = (character) => {
  // The ISO 15924 code of a digit's script, from the Unicode property escapes the runtime has.
  for (const [code, name] of SCRIPTS) if (new RegExp(`^\\p{Script=${name}}$`, 'u').test(character)) return code;
  return undefined;
};
const SCRIPTS = Object.entries({
  Adlm: 'Adlam', Ahom: 'Ahom', Arab: 'Arabic', Bali: 'Balinese', Beng: 'Bengali', Bhks: 'Bhaiksuki', Brah: 'Brahmi', Cakm: 'Chakma', Cham: 'Cham',
  Deva: 'Devanagari', Diak: 'Dives_Akuru', Gong: 'Gunjala_Gondi', Gonm: 'Masaram_Gondi', Gujr: 'Gujarati', Guru: 'Gurmukhi', Hmng: 'Pahawh_Hmong',
  Hmnp: 'Nyiakeng_Puachue_Hmong', Java: 'Javanese', Kali: 'Kayah_Li', Kawi: 'Kawi', Khmr: 'Khmer', Knda: 'Kannada', Lana: 'Tai_Tham', Laoo: 'Lao',
  Lepc: 'Lepcha', Limb: 'Limbu', Mlym: 'Malayalam', Modi: 'Modi', Mong: 'Mongolian', Mroo: 'Mro', Mtei: 'Meetei_Mayek', Mymr: 'Myanmar', Nagm: 'Nag_Mundari',
  Newa: 'Newa', Nkoo: 'Nko', Olck: 'Ol_Chiki', Orya: 'Oriya', Osma: 'Osmanya', Rohg: 'Hanifi_Rohingya', Saur: 'Saurashtra', Shrd: 'Sharada',
  Sind: 'Khudawadi', Sinh: 'Sinhala', Sora: 'Sora_Sompeng', Sund: 'Sundanese', Takr: 'Takri', Talu: 'New_Tai_Lue', Taml: 'Tamil', Telu: 'Telugu',
  Thai: 'Thai', Tibt: 'Tibetan', Tirh: 'Tirhuta', Tnsa: 'Tangsa', Vaii: 'Vai', Wara: 'Warang_Citi', Wcho: 'Wancho',
});

// The numbering systems OPF draws: those whose ten digits are consecutive code points of one script (not the CJK `hanidec`,
// not the mathematical, full-width, segmented or outlined digit sets, which are no language's own digits).
const systems = {};
for (const system of Intl.supportedValuesOf('numberingSystem')) {
  const digits = [...new Intl.NumberFormat(`en-u-nu-${system}`, {useGrouping: false}).format(1234567890)].map((character) => character.codePointAt(0));
  const zero = digits[9];
  if (!digits.slice(0, 9).every((code, index) => code === zero + index + 1)) continue;
  if (system === 'latn') { systems[system] = [zero, 'Latn']; continue; }
  const code = script(String.fromCodePoint(zero));
  if (code) systems[system] = [zero, code];
}

// LH-106 (vetoable, 2026-11-12): the separators OPF writes with these digits, where they differ from CLDR, so that a number OPF draws
// as text and a number PowerPoint draws in a native chart agree. PowerPoint 16.0.20527 draws a chart format code with the Arabic-Indic
// numeral shape (`[$-2000000]#,##0.00`) as "٤,٥٠٠.٠٠": Arabic-Indic digits with the Latin comma and period (and `0%` with the Latin
// percent sign), where CLDR writes "٤٬٥٠٠٫٠٠". With the Persian shape (`[$-3000000]`) it draws "۴٬۵۰۰٫۰۰" and "٪", as CLDR does.
// The list is written into the table (`NUMBER_SEPARATOR_OVERRIDES`), which test/numerals.test.mjs applies when it compares with Intl.
const POWERPOINT_SEPARATORS = {arab: {decimal: '.', group: ','}};

const describe = (tag) => {
  const format = new Intl.NumberFormat(tag, {maximumFractionDigits: 12});
  const system = format.resolvedOptions().numberingSystem;
  const parts = format.formatToParts(1234567.891);
  const decimal = POWERPOINT_SEPARATORS[system]?.decimal ?? parts.find((part) => part.type === 'decimal')?.value ?? '.';
  const group = POWERPOINT_SEPARATORS[system]?.group ?? parts.find((part) => part.type === 'group')?.value ?? ',';
  // The sizes of the groups 1234567 falls into, in characters (a digit outside the BMP is one): the primary group (the last) and the
  // secondary one (the others): 33 for thousands, 32 for the Indian lakh and crore, 22 for Toki Pona.
  const sizes = parts.filter((part) => part.type === 'integer').map((part) => [...part.value].length);
  const primary = sizes.at(-1), grouping = `${primary}${sizes.length > 2 ? sizes.at(-2) : primary}`;
  // The digits a number has before it groups: one more than the primary group (1000), or two (Spanish: 1000, 10.000).
  const probe = 10 ** primary;
  const minimum = new Intl.NumberFormat(tag).formatToParts(probe).some((part) => part.type === 'group') ? '1' : '2';
  // The Latin symbols the locale uses when its tag asks for Latin digits (`ar-SA-u-nu-latn`).
  const latn = system === 'latn' ? undefined : describe(`${tag}-u-nu-latn`);
  const own = `${system}|${decimal}|${group}|${grouping}|${minimum}`;
  return latn ? `${own}|${latn.split('|')[1]}|${latn.split('|')[2]}` : own;
};
const resolves = (tag, language) => {
  try { return new Intl.NumberFormat(tag).resolvedOptions().locale.split('-')[0] === language; } catch { return false; }
};

// Every language the runtime has number data for: the two- and three-letter codes whose locale resolves to themselves.
const letters = [...'abcdefghijklmnopqrstuvwxyz'];
const languages = [];
for (const a of letters) for (const b of letters) { if (resolves(a + b, a + b)) languages.push(a + b); for (const c of letters) if (resolves(a + b + c, a + b + c)) languages.push(a + b + c); }
const names = new Intl.DisplayNames(['en'], {type: 'region', fallback: 'code'});
const regions = [];
for (const a of letters) for (const b of letters) { const region = (a + b).toUpperCase(); if (names.of(region) !== region) regions.push(region); }
const scripts = [...new Set(['Latn', 'Cyrl', 'Arab', 'Deva', 'Beng', 'Hans', 'Hant', ...Object.values(systems).map(([, code]) => code)])];

const ROOT = describe('en');
const table = {'': ROOT};
const lookup = (language, script, region) => (script && region && table[`${language}-${script}-${region}`]) ?? (region && table[`${language}-${region}`]) ?? (script && table[`${language}-${script}`]) ?? table[language] ?? ROOT;
for (const language of languages) {
  const own = describe(language);
  if (own !== ROOT) table[language] = own;
  for (const script of scripts) {
    const tag = `${language}-${script}`;
    if (!new Intl.NumberFormat(tag).resolvedOptions().locale.includes(`-${script}`)) continue;
    const entry = describe(tag);
    if (entry !== lookup(language)) table[tag] = entry;
  }
  for (const region of regions) {
    const tag = `${language}-${region}`;
    const entry = describe(tag);
    if (entry !== lookup(language, undefined, region)) table[tag] = entry;
  }
}

const literal = (text) => JSON.stringify(text).replace(/[\u0080-￿]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
const lines = [
  '// Generated by packages/javascript/scripts/build-number-locales.mjs from the runtime\'s Intl data; rerun it rather than editing this file.',
  '// LH-106: the locale data every number OPF generates is drawn with (see numerals.ts). test/numerals.mjs checks it against Intl.',
  '',
  `/** The ICU and CLDR versions this table was read from. */`,
  `export const NUMBER_LOCALE_SOURCE = {icu: ${literal(process.versions.icu)}, cldr: ${literal(process.versions.cldr ?? '')}} as const;`,
  '',
  '/** The separators the table writes for a numbering system instead of CLDR\'s, as PowerPoint draws its numeral shape (see the generator). */',
  `export const NUMBER_SEPARATOR_OVERRIDES: Readonly<Record<string, {readonly decimal: string; readonly group: string}>> = ${JSON.stringify(POWERPOINT_SEPARATORS)};`,
  '',
  '/** Each numbering system with ten consecutive digits: the code point of its digit zero (its digits follow it) and the ISO 15924 script of its digits. */',
  'export const NUMBERING_SYSTEMS: Readonly<Record<string, readonly [zero: number, script: string]>> = {',
  ...Object.entries(systems).map(([system, [zero, code]]) => `  ${system}: [0x${zero.toString(16)}, ${literal(code)}],`),
  '};',
  '',
  '/**',
  ' * The number data of each locale that differs from the one it falls back to (`language-Script-REGION`, `language-REGION`,',
  ' * `language-Script`, `language`, then the root `\'\'`): `system|decimal|group|grouping|minimum` with the default numbering system,',
  ' * its decimal and group separators, the primary and secondary group sizes (`33` thousands, `32` the Indian lakh and crore) and how',
  ' * many digits more than the primary group a number needs to group (1: 1,000; 2: 1000 but 10.000), then, for a locale whose own',
  ' * digits are not Latin, `|decimal|group` with Latin digits.',
  ' */',
  'export const NUMBER_LOCALES: Readonly<Record<string, string>> = {',
  ...Object.entries(table).map(([key, value]) => `  ${literal(key)}: ${literal(value)},`),
  '};',
  '',
];
fs.writeFileSync(out, lines.join('\n'));
console.log(`${path.relative(process.cwd(), out)}: ${Object.keys(systems).length} numbering systems, ${Object.keys(table).length} locales (ICU ${process.versions.icu}).`);
