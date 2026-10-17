// RR-95: each skill is installed on its own, so each SKILL.md carries the same short glossary. This keeps the six copies
// identical, and keeps the PPTX per-line caveat at the top of the opf-export skill.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const skills = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills');
const skillFiles = readdirSync(skills, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(skills, entry.name, 'SKILL.md'));
const glossaryOf = (text) => /<!-- glossary:start -->([\s\S]*?)<!-- glossary:end -->/.exec(text)?.[1];

test('every skill carries the same glossary, near its top', () => {
  assert.ok(skillFiles.length >= 6, 'six skills');
  const first = glossaryOf(readFileSync(skillFiles[0], 'utf8'));
  assert.ok(first, `${skillFiles[0]} has a glossary`);
  for (const term of ['Furniture', 'Composition', 'Implicit blocks', 'Promoted region', 'Catalog record', 'Reflow', 'Provenance']) assert.match(first, new RegExp(`\\*\\*${term}\\*\\*`));
  for (const file of skillFiles) {
    const text = readFileSync(file, 'utf8');
    assert.equal(glossaryOf(text), first, `${path.relative(skills, file)} has the shared glossary`);
    const second = text.indexOf('\n## ', text.indexOf('\n## ') + 1); // opf-export opens with its PPTX caveat section
    assert.ok(text.indexOf('<!-- glossary:start -->') < second, `${path.relative(skills, file)}: the glossary comes near the top`);
  }
});

test('the opf-export skill states the PPTX per-line limit before the first conversion command', () => {
  const text = readFileSync(path.join(skills, 'opf-export', 'SKILL.md'), 'utf8');
  const caveat = text.indexOf('one text box for each wrapped line');
  assert.ok(caveat > 0, 'the caveat is present');
  assert.ok(caveat < text.indexOf('## Files: `convert`'), 'the caveat comes before the convert section');
});
