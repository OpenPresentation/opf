#!/usr/bin/env node
// FR-10: writes src/date-name-data.ts, the month and weekday names and the long date pattern of each language the gallery lists, which the
// date tokens of a date variable's `format` and of a header or footer `dateFormat` draw (src/date-names.ts).
//
// As build-number-locales.mjs does for numbers: the engines run on Node 22, 24 and 26, in browsers and on edge runtimes, whose ICU versions
// disagree on some of this data, and exact golden hashes depend on the drawn text. So the engines never ask `Intl` while they draw: this
// script asks it once, on the maintainer's runtime, and the table it writes is the format's own. `test/date-names.test.mjs` compares the
// table with the running `Intl` and fails on the runtime the table was made with (the same ICU version, CLDR version and Node major: two
// Node majors with one ICU version can disagree) when they disagree; on any other runtime it reports what differs. Rerun this script on
// purpose (with a changelog fragment) to take newer CLDR data.
//
//   node packages/javascript/scripts/build-date-names.mjs [languages directory | tags.json] [out.ts]
//
// Per language, one string of six lists joined by '~', each list joined by '|':
//   0 long month names, format form (after a day: "5 марта")   1 short month names, format form
//   2 long month names, stand-alone ("март 2026"), '' when equal to 0   3 short stand-alone, '' when equal to 1
//   4 long weekday names (Sunday first)   5 short weekday names
// and a second map of the language's long date pattern in OPF's date tokens (yyyy, MMMM, M, MM, d, dd, quoted literals).
// Regional variants equal to their base language are left out; languages the runtime has no data for are listed, not stored.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const input = process.argv[2] ?? path.join(here, '..', '..', 'gallery', 'catalog', 'languages');
const out = process.argv[3] ?? path.join(here, '..', 'src', 'date-name-data.ts');
const tags = fs.statSync(input).isDirectory()
  ? fs.readdirSync(input).filter((file) => file.endsWith('.json')).map((file) => JSON.parse(fs.readFileSync(path.join(input, file), 'utf8')).bcp47)
  : JSON.parse(fs.readFileSync(input, 'utf8'));
const unique = [...new Set(tags.filter(Boolean))].sort();
const supported = unique.filter((tag) => Intl.DateTimeFormat.supportedLocalesOf([tag]).length > 0);
const missing = unique.filter((tag) => !supported.includes(tag));

const months = [...Array(12)].map((_, month) => new Date(Date.UTC(2026, month, 15)));
const days = [...Array(7)].map((_, day) => new Date(Date.UTC(2026, 2, 1 + day))); // 2026-03-01 is a Sunday
const format = (tag, options, date) => new Intl.DateTimeFormat(tag, {timeZone: 'UTC', ...options}).format(date);
const part = (tag, options, date, type) => new Intl.DateTimeFormat(tag, {timeZone: 'UTC', ...options}).formatToParts(date).find((p) => p.type === type)?.value;
const join = (list) => list.join('|');

const names = {};
for (const tag of supported) {
  // After a day, a language that counts its months (ja, zh, ko) has the number as the month part and the counter ("月") as a literal: the
  // names are then the whole label ("3月"), which is what a stand-alone month prints too.
  const label = (options, d) => { const month = part(tag, {...options, day: 'numeric'}, d, 'month'); return /^\d+$/.test(month) ? format(tag, options, d) : month; };
  const M = join(months.map((d) => label({month: 'long'}, d)));
  const m = join(months.map((d) => label({month: 'short'}, d)));
  const L = join(months.map((d) => format(tag, {month: 'long'}, d)));
  const l = join(months.map((d) => format(tag, {month: 'short'}, d)));
  const E = join(days.map((d) => format(tag, {weekday: 'long'}, d)));
  const e = join(days.map((d) => format(tag, {weekday: 'short'}, d)));
  names[tag] = [M, m, L === M ? '' : L, l === m ? '' : l, E, e].join('~');
}

// The long date pattern, in OPF's date tokens. Letters in literals are quoted; an era (one language) is dropped.
const sample = new Date(Date.UTC(2026, 2, 5));
const token = ({type, value}) => {
  if (type === 'day') return value.length > 1 ? 'dd' : 'd';
  if (type === 'month') return /^\d+$/.test(value) ? (value.length > 1 ? 'MM' : 'M') : 'MMMM';
  if (type === 'year') return 'yyyy';
  if (type === 'literal') return /[A-Za-z']/.test(value) ? `'${value.replace(/'/g, "''")}'` : value;
  return ''; // era and anything else
};
const patterns = {};
for (const tag of supported) {
  patterns[tag] = new Intl.DateTimeFormat(tag, {dateStyle: 'long', timeZone: 'UTC'}).formatToParts(sample).map(token).join('').replace(/\s{2,}/g, ' ').trim();
}

for (const map of [names, patterns]) {
  for (const tag of Object.keys(map)) {
    const base = tag.split('-')[0];
    if (base !== tag && map[base] === map[tag]) delete map[tag];
  }
}

const nodeMajor = process.versions.node.split('.')[0];
const source = [
  '// Generated by packages/javascript/scripts/build-date-names.mjs from the runtime\'s Intl data; rerun it rather than editing this file.',
  '// FR-10: the month and weekday names and the long date pattern of each language the gallery lists (see date-names.ts). test/date-names.test.mjs checks it against Intl.',
  '',
  '/** The runtime this table was read from: its ICU and CLDR versions and its Node major (two Node majors with one ICU version can disagree). */',
  `export const DATE_NAME_SOURCE = {icu: ${JSON.stringify(process.versions.icu)}, cldr: ${JSON.stringify(process.versions.cldr)}, node: ${JSON.stringify(nodeMajor)}} as const;`,
  '',
  '/** Languages the gallery lists that the runtime had no date data for: they draw English names. */',
  `export const DATE_NAMES_MISSING: readonly string[] = ${JSON.stringify(missing)};`,
  '',
  '/** Six \'|\'-joined lists per language, joined by \'~\': long and short months (format form), their stand-alone forms (\'\' when equal), long and short weekdays (Sunday first). */',
  `export const DATE_NAMES: Readonly<Record<string, string>> = ${JSON.stringify(names)};`,
  '',
  '/** Each language\'s long date pattern in OPF\'s date tokens. */',
  `export const DATE_PATTERNS: Readonly<Record<string, string>> = ${JSON.stringify(patterns)};`,
  '',
].join('\n');

fs.writeFileSync(out, source);
console.log(JSON.stringify({icu: process.versions.icu, cldr: process.versions.cldr, node: nodeMajor, languages: unique.length, stored: Object.keys(names).length, missing, bytes: Buffer.byteLength(source)}));
