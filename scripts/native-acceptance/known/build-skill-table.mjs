// NT-03: write the Keynote table of skills/opf-export/SKILL.md from scripts/native-acceptance/known/keynote.json.
//
//   node scripts/native-acceptance/known/build-skill-table.mjs           rewrite the text between the native-known markers
//   node scripts/native-acceptance/known/build-skill-table.mjs --check   fail when it differs from a fresh build (drift)
//
// Change the records, never the table by hand; the section heading and the paragraphs around the markers stay hand-written.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadKnown, markedText, ROOT, renderSkillTable, replaceMarkedText, SKILL_FILE } from './known.mjs';

const check = process.argv.includes('--check');
const target = 'keynote';
const known = loadKnown(target);
const generated = renderSkillTable(known.records, target);
const text = readFileSync(SKILL_FILE, 'utf8');
const relative = path.relative(ROOT, SKILL_FILE);

if (check) {
  const current = markedText(text, target);
  if (current === null) {
    console.error(`${relative}: the native-known:${target} markers are missing`);
    process.exit(1);
  }
  if (current !== generated) {
    console.error(`${relative}: the ${target} table differs from ${target}.json; run pnpm build:native-known`);
    process.exit(1);
  }
  console.log(`${relative}: the ${target} table matches ${known.records.filter((record) => record.skill).length} records`);
} else {
  const next = replaceMarkedText(text, generated, target);
  if (next !== text) writeFileSync(SKILL_FILE, next);
  console.log(`${relative}: ${next === text ? 'unchanged' : 'rewritten'}`);
}
