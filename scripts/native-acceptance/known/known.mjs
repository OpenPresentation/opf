// NT-03: known differences of a native application as data (scripts/native-acceptance/known/<target>.json), validated by
// known.schema.json, and the skill table generated from the records with skill: true.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../..');
export const SCHEMA_FILE = path.join(HERE, 'known.schema.json');
export const SKILL_FILE = path.join(ROOT, 'skills/opf-export/SKILL.md');
export const markers = (target) => ({ start: `<!-- native-known:${target}:start -->`, end: `<!-- native-known:${target}:end -->` });

const require = createRequire(path.join(ROOT, 'packages/javascript/package.json'));
const Ajv = require('ajv');

let validator;
/** Returns the schema errors of a known-differences file as strings (empty when it is valid). */
export function validateKnown(data) {
  validator ??= new Ajv({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true }).compile(JSON.parse(readFileSync(SCHEMA_FILE, 'utf8')));
  if (validator(data)) return [];
  return validator.errors.map((error) => `${error.instancePath || '/'} ${error.message}${error.params ? ` ${JSON.stringify(error.params)}` : ''}`);
}

/** Reads and validates <target>.json; throws with every schema error. */
export function loadKnown(target = 'keynote') {
  const file = path.join(HERE, `${target}.json`);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const errors = validateKnown(data);
  if (errors.length) throw new Error(`${path.relative(ROOT, file)} does not match known.schema.json:\n${errors.join('\n')}`);
  return data;
}

const compareVersions = (a, b) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};
const list = (items) => (items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const cell = (text) => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');

const APPLICATION = { keynote: 'Keynote' };

/** The generated text between the skill's markers: one sentence on the versions the rows were seen in, and the table. */
export function renderSkillTable(records, target = 'keynote') {
  const rows = records.filter((record) => record.skill);
  const seen = rows.flatMap((record) => [record.firstSeen, record.lastSeen]);
  const applications = [...new Set(seen.map((version) => version.application))].sort(compareVersions);
  const opf = [...new Set(seen.map((version) => version.opf))].sort(compareVersions);
  const name = APPLICATION[target] ?? target;
  const releases = opf.length === 1 ? opf[0] : `${opf[0]} to ${opf.at(-1)}`;
  return [
    `These rows were seen in ${name} ${list(applications)}, opening the PPTX export of OPF ${releases}.`,
    '',
    `| What the deck has | What an author sees in ${name} | What to do |`,
    '| --- | --- | --- |',
    ...rows.map((record) => `| ${cell(record.title)} | ${cell(record.sees)} | ${cell(record.workaround ?? 'None')} |`),
  ].join('\n');
}

/** The text between the markers in a skill file, or null when the markers are missing. */
export function markedText(text, target = 'keynote') {
  const { start, end } = markers(target);
  const from = text.indexOf(start);
  const to = text.indexOf(end);
  if (from < 0 || to < from) return null;
  return text.slice(from + start.length, to).replace(/^\n/, '').replace(/\n$/, '');
}

/** The skill file with the text between the markers replaced. */
export function replaceMarkedText(text, generated, target = 'keynote') {
  const { start, end } = markers(target);
  const from = text.indexOf(start);
  const to = text.indexOf(end);
  if (from < 0 || to < from) throw new Error(`the markers ${start} and ${end} are missing`);
  return `${text.slice(0, from + start.length)}\n${generated}\n${text.slice(to)}`;
}
