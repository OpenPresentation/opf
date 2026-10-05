// FF-05 / opf-pptx#168: check the native reads in out/ against manifest.json. node compare.mjs (no dependencies).
// Writes out/compare.md and out/compare.json. Exit code 1 when an `after` deck fails.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'));
const read = name => {
  const file = new URL(`./out/${name}.json`, import.meta.url);
  // PowerShell's Set-Content -Encoding UTF8 writes a BOM.
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')) : null;
};
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
const rows = [], results = {};
let failed = false;
for (const [id, deck] of Object.entries(manifest.decks)) {
  for (const build of ['before', 'after']) {
    const file = deck.files[build];
    if (!file) continue;
    const name = file.file.replace(/\.pptx$/, ''), report = read(name), problems = [], notes = [];
    if (!report) problems.push('no read (out/<deck>.json missing)');
    else if (report.stage !== 'done') problems.push(`stage ${report.stage}${report.error ? `: ${report.error}` : ''}`);
    if (report?.stage === 'done') {
      const fonts = list(report.fonts);
      if (fonts.includes('')) problems.push('Presentation.Fonts lists an empty name');
      const foreign = fonts.filter(font => !deck.expect.fonts.includes(font));
      if (foreign.length) problems.push(`Presentation.Fonts lists ${foreign.map(font => JSON.stringify(font)).join(', ')} outside the deck's fonts`);
      const designs = list(report.designs);
      list(report.slides).forEach((slide, index) => {
        const expected = deck.expect.slides[index];
        if (!expected) return;
        const runs = list(slide.shapes).flatMap(shape => list(shape.runs)).filter(run => typeof run.text === 'string' && [...expected.script].some(char => /[^\s\p{Script=Latin}\p{P}\d]/u.test(char) && run.text.includes(char)));
        if (!runs.length) problems.push(`slide ${index + 1}: no run holds the script sample`);
        const read = [...new Set(runs.map(run => run[expected.slot]))];
        if (read.length !== 1 || read[0] !== expected.family) problems.push(`slide ${index + 1}: ${expected.slot} reads ${read.map(value => JSON.stringify(value)).join(', ')}, expected "${expected.family}"`);
        if (build === 'after' && slide.designIndex !== expected.master) problems.push(`slide ${index + 1}: design ${slide.designIndex} (${slide.design}), expected master ${expected.master}`);
        const notesRead = [...new Set(list(slide.notes).flatMap(shape => list(shape.runs)).map(run => `${run.nameFarEast}/${run.nameComplexScript}`))];
        if (notesRead.length) notes.push(`slide ${index + 1} notes ea/cs ${notesRead.join(', ')}`);
      });
      if (build === 'after') {
        const expectedMasters = Math.max(...deck.expect.slides.map(slide => slide.master));
        if (designs.length !== expectedMasters) problems.push(`${designs.length} designs, expected ${expectedMasters}`);
      }
      notes.push(`fonts ${JSON.stringify(fonts)}`, `designs ${designs.map(design => `${design.index}:${design.name} ea=${design.themeFonts?.minor?.eastAsian} cs=${design.themeFonts?.minor?.complexScript}`).join('; ')}`);
    }
    // `before` builds of a/a2 are the opf-pptx#168 baseline: they are expected to read slide 1's family from slide 2 on.
    const baselineExpected = build === 'before' && deck.files.before.sha256 !== deck.files.after.sha256;
    const status = problems.length ? (baselineExpected ? 'BASELINE (expected fail)' : 'FAIL') : 'PASS';
    if (status === 'FAIL') failed = true;
    results[name] = {status, problems, notes};
    rows.push(`| ${name} | ${status} | ${problems.join('<br>') || ''} | ${notes.join('<br>')} |`);
  }
  if (deck.files.before && deck.files.before.sha256 === deck.files.after.sha256) {
    const [before, after] = [read(deck.files.before.file.replace(/\.pptx$/, '')), read(deck.files.after.file.replace(/\.pptx$/, ''))];
    const strip = report => report && JSON.stringify({fonts: report.fonts, designs: report.designs, slides: list(report.slides).map(({png, ...slide}) => slide)});
    const same = Boolean(before && after) && strip(before) === strip(after);
    if (!same) failed = true;
    rows.push(`| ${id} before = after | ${same ? 'PASS' : 'FAIL'} | byte-identical files (sha256 ${deck.files.after.sha256.slice(0, 12)}); native reads ${same ? 'equal' : 'differ'} | |`);
  }
}
const md = `# FF-05 per-slide script fonts (opf-pptx#168): native read\n\n${manifest.pass.map(line => `- ${line}`).join('\n')}\n\n| Deck | Result | Problems | Read |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`;
writeFileSync(new URL('./out/compare.md', import.meta.url), md);
writeFileSync(new URL('./out/compare.json', import.meta.url), `${JSON.stringify(results, null, 2)}\n`);
console.log(md);
process.exit(failed ? 1 : 0);
