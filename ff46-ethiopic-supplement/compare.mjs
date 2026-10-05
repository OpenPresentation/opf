// FF-46 / opf#375: check the native reads in out/ against manifest.json. node compare.mjs (no dependencies).
// Writes out/compare.md and out/compare.json. Exit code 1 when an `after` deck (or a control) fails.
import {existsSync, readFileSync, writeFileSync} from 'node:fs';

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
    const file = deck.files[build], name = file.file.replace(/\.pptx$/, ''), report = read(name), problems = [], notes = [];
    if (!report) problems.push('no read (out/<deck>.json missing)');
    else if (report.stage !== 'done') problems.push(`stage ${report.stage}${report.error ? `: ${report.error}` : ''}`);
    if (report?.stage === 'done') {
      const fonts = list(report.fonts);
      if (fonts.includes('')) problems.push('Presentation.Fonts lists an empty name');
      const foreign = fonts.filter(font => !deck.expect.fonts.includes(font));
      if (foreign.length) problems.push(`Presentation.Fonts lists ${foreign.map(font => JSON.stringify(font)).join(', ')} outside the deck's fonts`);
      if (deck.expect.family) {
        const runs = list(report.slides).flatMap(slide => list(slide.shapes)).flatMap(shape => list(shape.runs)).filter(run => typeof run.text === 'string' && run.text.includes(deck.text.split(' ')[0]));
        if (!runs.length) problems.push('no run holds the script sample');
        const names = [...new Set(runs.map(run => run.name))];
        if (names.length !== 1 || names[0] !== deck.expect.family) problems.push(`runs read Name ${names.map(value => JSON.stringify(value)).join(', ')}, expected "${deck.expect.family}"`);
      }
      notes.push(`fonts ${JSON.stringify(fonts)}`);
    }
    notes.push(`file ${deck.script} entry major/minor ${file.themeScript.major}/${file.themeScript.minor}`);
    // `before` builds of a changed deck are the opf#375 baseline: they are expected to list the language default.
    const baselineExpected = build === 'before' && deck.changed;
    const status = problems.length ? (baselineExpected ? 'BASELINE (expected fail)' : 'FAIL') : (baselineExpected ? 'PASS (baseline did not reproduce; record it)' : 'PASS');
    if (status === 'FAIL') failed = true;
    results[name] = {status, problems, notes};
    rows.push(`| ${name} | ${status} | ${problems.join('<br>') || ''} | ${notes.join('<br>')} |`);
  }
  if (!deck.changed) {
    const [before, after] = [read(deck.files.before.file.replace(/\.pptx$/, '')), read(deck.files.after.file.replace(/\.pptx$/, ''))];
    const strip = report => report && JSON.stringify({fonts: report.fonts, designs: report.designs, slides: list(report.slides).map(({png, ...slide}) => slide)});
    const same = Boolean(before && after) && strip(before) === strip(after);
    if (!same) failed = true;
    rows.push(`| ${id} before = after | ${same ? 'PASS' : 'FAIL'} | byte-identical files (sha256 ${deck.files.after.sha256.slice(0, 12)}); native reads ${same ? 'equal' : 'differ'} | |`);
  }
}
const md = `# FF-46 theme script supplement (opf#375): native read\n\n${manifest.pass.map(line => `- ${line}`).join('\n')}\n\n| Deck | Result | Problems | Read |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`;
writeFileSync(new URL('./out/compare.md', import.meta.url), md);
writeFileSync(new URL('./out/compare.json', import.meta.url), `${JSON.stringify(results, null, 2)}\n`);
console.log(md);
process.exit(failed ? 1 : 0);
