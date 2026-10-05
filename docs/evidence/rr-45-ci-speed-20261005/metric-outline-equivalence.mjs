// RR-45 (opf#368, item 2) equivalence harness: runs the previous and the new metric-outline check on all 96 cases,
// unmutated and under mutations that make ink leave the cell, and compares verdicts and mask pixels.
// Usage: node equivalence.mjs <opf checkout> <old script path (git show origin/main:scripts/test-metric-outline-browser.mjs)> <out dir>
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync, rmSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const [opf, oldScript, outDir] = process.argv.slice(2);
const sharp = createRequire(path.resolve(opf, '../opf-render/package.json'))('sharp');
const versions = {old: readFileSync(oldScript, 'utf8'), new: readFileSync(path.join(opf, 'scripts/test-metric-outline-browser.mjs'), 'utf8')};
const mutations = {
  none: source => source,
  // the accepted cell shrinks by 3 px on every side: ink near any edge now leaves it
  'cell-inset-3px': source => source.replace(/cell:item\.box,/, 'cell:{x:item.box.x+3,y:item.box.y+3,width:item.box.width-6,height:item.box.height-6},'),
  // every mask's text moves 40 px right: real ink painted outside the cell on the right-hand side
  'ink-shift-40px': source => source.replace("clone.style.fill='#fff';", "clone.style.fill='#fff';clone.setAttribute('transform','translate(40 0)');"),
  // every mask's text moves 200 px down: ink below the cell
  'ink-shift-down-200px': source => source.replace("clone.style.fill='#fff';", "clone.style.fill='#fff';clone.setAttribute('transform','translate(0 200)');"),
};
const summary = {};
for (const [mutation, apply] of Object.entries(mutations)) {
  const reports = {};
  for (const [version, source] of Object.entries(versions)) {
    const mutated = apply(source);
    if (mutation !== 'none' && mutated === source) throw new Error(`${mutation} did not apply to ${version}`);
    const script = path.join(opf, 'scripts', `.equivalence-${version}-${mutation}.mjs`), out = path.join(outDir, `${mutation}-${version}`);
    rmSync(out, {recursive: true, force: true}); mkdirSync(out, {recursive: true});
    writeFileSync(script, mutated);
    const started = Date.now();
    const run = spawnSync(process.execPath, [script, out], {cwd: opf, encoding: 'utf8'});
    rmSync(script);
    const seconds = (Date.now() - started) / 1000;
    reports[version] = {report: JSON.parse(readFileSync(path.join(out, 'report.json'), 'utf8')), status: run.status, seconds, out};
    console.log(`${mutation} ${version}: exit ${run.status} in ${seconds.toFixed(1)} s`);
  }
  const {old: a, new: b} = reports;
  const verdicts = report => Object.fromEntries(report.results.map(result => [result.id, result.failures]));
  const va = verdicts(a.report), vb = verdicts(b.report);
  const ids = Object.keys(va);
  const differing = ids.filter(id => JSON.stringify(va[id]) !== JSON.stringify(vb[id]));
  const failing = ids.filter(id => va[id].length);
  // Per part: the old pixel count and outside list against the new ink/outside booleans.
  let parts = 0, partMismatch = 0;
  for (const [index, result] of a.report.results.entries()) {
    const other = b.report.results[index];
    if (other.id !== result.id) throw new Error('case order differs');
    result.ink.forEach((ink, i) => {
      parts++;
      const next = other.ink[i];
      if (next.path !== ink.path || next.ink !== ink.pixels > 0 || next.outside !== ink.outside.length > 0) partMismatch++;
    });
  }
  // Pixels: every old per-part mask PNG against the same region of the new per-case screenshot.
  let pixelParts = 0, pixelMismatch = 0;
  if (mutation === 'none' || mutation === 'ink-shift-40px') for (const [index, result] of a.report.results.entries()) {
    const other = b.report.results[index];
    if (!result.ink.length) continue;
    const grid = await sharp(path.join(b.out, other.masks.file)).removeAlpha().raw().toBuffer({resolveWithObject: true});
    for (const [i, ink] of result.ink.entries()) {
      const before = await sharp(path.join(a.out, ink.file)).removeAlpha().raw().toBuffer({resolveWithObject: true});
      const region = other.ink[i].region;
      const after = await sharp(grid.data, {raw: {width: grid.info.width, height: grid.info.height, channels: 3}}).extract(region).raw().toBuffer();
      pixelParts++;
      if (before.info.width !== region.width || before.info.height !== region.height || !before.data.equals(after)) pixelMismatch++;
    }
  }
  summary[mutation] = {cases: ids.length, casesWithFailures: failing.length, failureLines: Object.values(va).flat().length, verdictsDiffer: differing.length,
    parts, partVerdictsDiffer: partMismatch, pixelComparedParts: pixelParts, pixelDifferentParts: pixelMismatch,
    exit: {old: a.status, new: b.status}, seconds: {old: a.seconds, new: b.seconds}, sampleFailure: failing.length ? `${failing[0]}: ${va[failing[0]][0]}` : null};
  console.log(JSON.stringify(summary[mutation]));
}
writeFileSync(path.join(outDir, 'equivalence.json'), JSON.stringify(summary, null, 2) + '\n');
