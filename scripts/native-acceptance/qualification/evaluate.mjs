#!/usr/bin/env node
// Grade a native run of the qualification corpus against manifest.json. Reads <out>/build.json (build.mjs) and <out>/<app>/<file>.json
// with its slide PNGs (run-powerpoint-windows.ps1), and writes:
//   <out>/<app>/sheets/<file>-<n>.png   OPF's preview | the app's slide | their difference, for the reviewer
//   <out>/<app>/roundtrip/<file>.json   the app's saved copy imported through `opf convert`
//   <out>/<app>/results.json and results.md   per file and per feature: pass, fail, review or not run, with the reasons
//
//   node scripts/native-acceptance/qualification/evaluate.mjs --out <dir> [--app powerpoint] [--no-sheets] [--no-roundtrip]
//
// Automatic verdicts cover what the object model can tell (opened, slide count, overflow, shrink autofit, SmartArt, charts, tables,
// connectors, footer fields, the import round trip). The visual comparison is reported as a difference score and a sheet; its verdict
// is the reviewer's, recorded in the manifest run notes, never inferred from the score.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest, pptxName } from './build.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const cli = path.join(root, 'packages/cli/dist/index.js');

export function parseArgs(argv) {
  const options = { app: 'powerpoint', sheets: true, roundtrip: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') options.out = argv[++index];
    else if (arg === '--app') options.app = argv[++index];
    else if (arg === '--no-sheets') options.sheets = false;
    else if (arg === '--no-roundtrip') options.roundtrip = false;
    else throw new Error(`Unknown argument ${arg}`);
  }
  if (!options.out) throw new Error('--out <dir> is required');
  return options;
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
const list = (value) => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]);

/** Every shape of a slide, depth first, groups and SmartArt included. */
export function flatten(shapes) {
  const out = [];
  const walk = (shape) => { out.push(shape); for (const child of list(shape.children)) walk(child); };
  for (const shape of list(shapes)) walk(shape);
  return out;
}

/** Facts about one probed slide that the checks read. */
export function slideFacts(slide) {
  const top = list(slide.shapes);
  const all = flatten(top);
  // SmartArt nodes measure their own text inside the drawing; a node that PowerPoint lays out is not a text box OPF sized.
  const insideSmartArt = new Set(top.filter((shape) => shape.smartArt).flatMap((shape) => flatten(list(shape.children))));
  const overflow = all.filter((shape) => shape.text && list(shape.text.overflow).length && !insideSmartArt.has(shape))
    .map((shape) => ({ name: shape.name, text: shape.text.text.slice(0, 60), sides: list(shape.text.overflow), box: shape.box, bound: shape.text.bound, font: shape.text.font, size: shape.text.maxSize }));
  const shrink = all.filter((shape) => shape.text && shape.text.autoSize === 2).map((shape) => ({ name: shape.name, text: shape.text.text.slice(0, 60) }));
  return {
    smartArt: top.filter((shape) => shape.smartArt).map((shape) => ({ name: shape.name, ...shape.smartArt })),
    charts: all.filter((shape) => shape.chart).map((shape) => shape.chart),
    tables: all.filter((shape) => shape.table).map((shape) => shape.table),
    connectors: all.filter((shape) => shape.connector).map((shape) => shape.connector),
    pictures: all.filter((shape) => shape.type === 13).length,
    autoShapes: all.filter((shape) => (shape.type === 1 || shape.type === 5) && !insideSmartArt.has(shape)).length,
    edits: list(slide.smartArtEdits),
    footer: slide.footer,
    overflow,
    shrink,
  };
}

async function imageDiff(sharp, preview, native, sheet) {
  const size = { width: 640, height: 360 };
  const load = (file) => sharp(file).flatten({ background: '#ffffff' }).resize(size.width, size.height, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const [a, b] = await Promise.all([load(preview), load(native)]);
  let sum = 0, changed = 0;
  const diff = Buffer.alloc(a.length);
  for (let index = 0; index < a.length; index += 3) {
    const d = Math.max(Math.abs(a[index] - b[index]), Math.abs(a[index + 1] - b[index + 1]), Math.abs(a[index + 2] - b[index + 2]));
    sum += d; if (d > 48) changed += 1;
    diff[index] = diff[index + 1] = diff[index + 2] = 255 - Math.min(255, d * 3);
  }
  const pixels = a.length / 3;
  if (sheet) {
    const raw = (buffer) => sharp(buffer, { raw: { ...size, channels: 3 } }).png().toBuffer();
    const [left, middle, right] = await Promise.all([raw(a), raw(b), raw(diff)]);
    await sharp({ create: { width: size.width * 3 + 20, height: size.height, channels: 3, background: '#808080' } })
      .composite([{ input: left, left: 0, top: 0 }, { input: middle, left: size.width + 10, top: 0 }, { input: right, left: size.width * 2 + 20, top: 0 }]).png().toFile(sheet);
  }
  return { mean: Number((sum / pixels / 255).toFixed(4)), changed: Number((changed / pixels).toFixed(4)) };
}

function roundtrip(saved, target) {
  try {
    execFileSync(process.execPath, [cli, 'convert', saved, target, '--force'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 });
    const deck = readJson(target);
    const text = JSON.stringify(deck);
    return { ok: true, slides: deck.slides?.length ?? 0, shapes: (text.match(/"shape":/g) ?? []).length, arrangements: (text.match(/"arrangement":/g) ?? []).length, layouts: [...new Set((deck.slides ?? []).map((slide) => slide.layout).filter(Boolean))], diagrams: (text.match(/"diagram":/g) ?? []).length, overlays: (deck.slides ?? []).reduce((count, slide) => count + (slide.shapes?.length ?? 0), 0) };
  } catch (error) {
    return { ok: false, error: String(error.stderr || error.stdout || error.message).slice(0, 600) };
  }
}

/** One feature check on one file's probe: { status: pass|fail|review|not-run, detail }. */
export function gradeCheck(check, feature, probe, facts) {
  const slides = feature.slides ?? facts.map((_, index) => index + 1);
  const at = (n) => facts[n - 1];
  const fail = (detail) => ({ status: 'fail', detail });
  const pass = (detail = '') => ({ status: 'pass', detail });
  if (!probe?.opened) return check === 'opens' ? fail(probe?.error ?? 'did not open') : { status: 'not-run', detail: 'the file did not open' };
  const expect = feature.expect ?? {};
  switch (check) {
    case 'opens': return pass(`${probe.openSeconds}s`);
    case 'slides': {
      // The preview leaves hidden slides out; the app lists them.
      const visible = list(probe.slides).filter((slide) => !slide.hidden).length || probe.slideCount;
      return visible === probe.previewSlides ? pass(`${visible}${visible !== probe.slideCount ? ` visible of ${probe.slideCount}` : ''}`) : fail(`${visible} visible slides, preview ${probe.previewSlides}`);
    }
    case 'noOverflow': {
      const bad = slides.flatMap((n) => (at(n)?.overflow ?? []).map((o) => `s${n} "${o.text}" ${o.sides.join('+')}`));
      return bad.length ? fail(bad.slice(0, 6).join('; ') + (bad.length > 6 ? ` (+${bad.length - 6})` : '')) : pass();
    }
    case 'noShrink': {
      const bad = slides.flatMap((n) => (at(n)?.shrink ?? []).map((o) => `s${n} "${o.text}"`));
      return bad.length ? fail(bad.slice(0, 6).join('; ')) : pass();
    }
    case 'smartArt': {
      const problems = [];
      for (const n of slides) {
        const slide = at(n);
        if (!slide?.smartArt.length) { problems.push(`s${n}: no SmartArt`); continue; }
        const art = slide.smartArt[0];
        const want = list(expect.nodes)[slides.indexOf(n)];
        if (want !== undefined && art.nodes !== want) problems.push(`s${n}: ${art.nodes} nodes, want ${want}`);
        const layout = list(expect.layouts)[slides.indexOf(n)];
        if (layout && !String(art.layout ?? '').toLowerCase().includes(layout.toLowerCase()) && !String(art.layoutId ?? '').toLowerCase().includes(layout.toLowerCase())) problems.push(`s${n}: layout ${art.layout} (${art.layoutId}), want ${layout}`);
        if (art.texts.some((text) => !text.trim())) problems.push(`s${n}: an empty node`);
        const edit = slide.edits[0];
        if (edit && (edit.error || !edit.sizesKept)) problems.push(`s${n}: node edit ${edit.error ?? `sizes ${edit.sizesBefore.join('/')} -> ${edit.sizesAfter.join('/')}`}`);
      }
      return problems.length ? fail(problems.join('; ')) : pass(slides.map((n) => `s${n} ${at(n).smartArt[0].layout} ${at(n).smartArt[0].nodes}`).join(', '));
    }
    case 'noSmartArt': {
      const bad = slides.filter((n) => at(n)?.smartArt.length);
      return bad.length ? fail(`SmartArt on ${bad.map((n) => `s${n}`).join(', ')}`) : pass();
    }
    case 'nativeChart': {
      const bad = slides.filter((n) => !at(n)?.charts.length);
      return bad.length ? fail(`no native chart on ${bad.map((n) => `s${n}`).join(', ')}`) : pass(slides.map((n) => `s${n} ${at(n).charts.map((c) => c.type).join('+')}`).join(', '));
    }
    case 'nativeTable': {
      const bad = slides.filter((n) => !at(n)?.tables.length || !at(n).tables.every((t) => t.edit));
      return bad.length ? fail(`no editable native table on ${bad.map((n) => `s${n}`).join(', ')}`) : pass();
    }
    case 'connectors': {
      const min = expect.connectors ?? 1;
      const bad = slides.filter((n) => (at(n)?.connectors ?? []).filter((c) => c.begin && c.end).length < min);
      return bad.length ? fail(bad.map((n) => `s${n}: ${at(n)?.connectors.filter((c) => c.begin && c.end).length ?? 0} glued of ${at(n)?.connectors.length ?? 0}`).join('; ')) : pass(slides.map((n) => `s${n} ${at(n).connectors.length}`).join(', '));
    }
    case 'shapes': {
      const min = expect.shapes ?? 1;
      const bad = slides.filter((n) => (at(n)?.autoShapes ?? 0) < min);
      return bad.length ? fail(bad.map((n) => `s${n}: ${at(n)?.autoShapes ?? 0} shapes`).join('; ')) : pass();
    }
    case 'footer': {
      const problems = [];
      for (const [index, n] of slides.entries()) {
        const want = list(expect.footer)[index];
        if (!want) continue;
        const footer = at(n)?.footer ?? {};
        for (const key of ['footer', 'slideNumber', 'date']) if (key in want && Boolean(footer[key]) !== want[key]) problems.push(`s${n}: ${key} ${footer[key]}, want ${want[key]}`);
      }
      if (expect.renumber) {
        const before = list(probe.renumber?.before), moved = list(probe.renumber?.moved);
        const byId = new Map(before.map((entry) => [entry.slideId, list(entry.numbers).join('|')]));
        const changed = moved.filter((entry) => list(entry.numbers).length && byId.get(entry.slideId) !== list(entry.numbers).join('|'));
        if (!changed.length) problems.push('no slide-number placeholder changed when slide 1 moved to the end');
      }
      return problems.length ? fail(problems.join('; ')) : pass();
    }
    default: return { status: 'not-run', detail: `${check} is graded by the reviewer` };
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const out = path.resolve(options.out);
  const manifest = loadManifest();
  const build = readJson(path.join(out, 'build.json'));
  const appDir = path.join(out, options.app);
  const run = existsSync(path.join(appDir, 'run.json')) ? readJson(path.join(appDir, 'run.json')) : {};
  const sharp = createRequire(path.join(root, 'packages/render/package.json'))('sharp');
  for (const sub of ['sheets', 'roundtrip']) mkdirSync(path.join(appDir, sub), { recursive: true });
  const files = {};
  for (const deck of build.decks) {
    for (const variant of deck.variants) {
      const name = path.basename(variant.pptx, '.pptx');
      const probeFile = path.join(appDir, `${name}.json`);
      if (!existsSync(probeFile)) continue;
      const probe = readJson(probeFile);
      const facts = list(probe.slides).map(slideFacts);
      const visual = [];
      let shown = 0;
      for (let n = 1; n <= (probe.slideCount ?? 0); n += 1) {
        // The preview numbers visible slides only; the CLI pads {n} to the largest slide number (slide-01.png of ten slides).
        if (list(probe.slides)[n - 1]?.hidden) { visual.push({ slide: n, hidden: true }); continue; }
        shown += 1;
        const preview = [1, 2, 3].map((width) => path.join(out, 'preview', deck.id, `slide-${String(shown).padStart(width, '0')}.png`)).find((file) => existsSync(file)) ?? '';
        const native = path.join(appDir, name, `slide-${n}.png`);
        if (!existsSync(preview) || !existsSync(native)) { visual.push({ slide: n, missing: true }); continue; }
        visual.push({ slide: n, ...(await imageDiff(sharp, preview, native, options.sheets ? path.join(appDir, 'sheets', `${name}-${n}.png`) : undefined)) });
      }
      const saved = path.join(appDir, 'saved', `${name}.pptx`);
      const trip = options.roundtrip && existsSync(saved) ? roundtrip(saved, path.join(appDir, 'roundtrip', `${name}.json`)) : undefined;
      files[name] = { deck: deck.id, variant: variant.name, sha256: variant.sha256, probe, facts, visual, roundtrip: trip };
    }
  }
  const generic = ['opens', 'slides', 'noOverflow', 'noShrink'];
  const fileRows = Object.entries(files).map(([name, file]) => ({ name, ...Object.fromEntries(generic.map((check) => [check, gradeCheck(check, {}, file.probe, file.facts)])), roundtrip: file.roundtrip ? (file.roundtrip.ok ? { status: 'pass', detail: `${file.roundtrip.slides} slides` } : { status: 'fail', detail: file.roundtrip.error }) : { status: 'not-run', detail: '' }, worstVisual: file.visual.reduce((worst, entry) => (entry.mean > (worst?.mean ?? -1) ? entry : worst), undefined) }));
  const features = (manifest.features ?? []).map((feature) => {
    const name = pptxName({ id: feature.deck }, { name: feature.variant ?? 'default' }).replace(/\.pptx$/, '');
    const file = files[name];
    const checks = Object.fromEntries((feature.checks ?? []).map((check) => {
      if (feature.pending) return [check, { status: 'not-run', detail: feature.pending }];
      if (!file) return [check, { status: 'not-run', detail: `${name} was not probed` }];
      if (check === 'roundtrip') {
        const trip = file.roundtrip;
        if (!trip) return [check, { status: 'not-run', detail: 'no saved copy' }];
        if (!trip.ok) return [check, { status: 'fail', detail: trip.error }];
        const want = feature.expect?.roundtrip ?? {};
        const problems = Object.entries(want).filter(([key, value]) => (Array.isArray(value) ? !value.every((entry) => trip[key]?.includes(entry)) : (trip[key] ?? 0) < value)).map(([key, value]) => `${key} ${JSON.stringify(trip[key])}, want ${JSON.stringify(value)}`);
        return [check, problems.length ? { status: 'fail', detail: problems.join('; ') } : { status: 'pass', detail: `shapes ${trip.shapes}, arrangements ${trip.arrangements}, overlays ${trip.overlays}, diagrams ${trip.diagrams}` }];
      }
      if (check === 'visual') {
        const slides = feature.slides ?? file.visual.map((entry) => entry.slide);
        return [check, { status: 'review', detail: slides.map((n) => { const v = file.visual[n - 1]; return v ? `s${n} ${v.mean}/${v.changed}` : `s${n} ?`; }).join(', ') }];
      }
      return [check, gradeCheck(check, feature, file.probe, file.facts)];
    }));
    const statuses = Object.values(checks).map((entry) => entry.status);
    const status = statuses.includes('fail') ? 'fail' : statuses.every((entry) => entry === 'not-run') ? 'not-run' : statuses.includes('review') ? 'review' : statuses.includes('not-run') ? 'partial' : 'pass';
    return { id: feature.id, title: feature.title, changes: feature.changes, file: name, slides: feature.slides, status, checks, ...(feature.manual ? { manual: feature.manual } : {}) };
  });
  writeFileSync(path.join(appDir, 'results.json'), `${JSON.stringify({ environment: run.environment, build: { revision: build.revision, opfVersion: build.opfVersion }, files: fileRows, features, detail: Object.fromEntries(Object.entries(files).map(([name, file]) => [name, { visual: file.visual, roundtrip: file.roundtrip, overflow: file.facts.flatMap((f, i) => f.overflow.map((o) => ({ slide: i + 1, ...o }))), smartArt: file.facts.flatMap((f, i) => f.smartArt.map((s) => ({ slide: i + 1, layout: s.layout, layoutId: s.layoutId, nodes: s.nodes }))) }])) }, null, 2)}\n`);
  const cell = (entry) => (entry ? `${entry.status}${entry.detail ? ` (${String(entry.detail).replaceAll('|', '/').slice(0, 160)})` : ''}` : '');
  const lines = [`# ${options.app} qualification results`, '', `Build ${build.revision.slice(0, 9)} (OPF ${build.opfVersion}); ${run.environment ? `PowerPoint ${run.environment.productVersion} (build ${run.environment.powerPointBuild}), ${run.environment.windows}` : ''}`, '',
    '| Feature | Status | Checks |', '| --- | --- | --- |',
    ...features.map((feature) => `| ${feature.id}: ${feature.title} | ${feature.status} | ${Object.entries(feature.checks).map(([check, entry]) => `${check}: ${cell(entry)}`).join('<br>')} |`),
    '', '| File | Opens | Slides | Overflow | Shrink | Round trip | Worst visual (mean/changed) |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...fileRows.map((row) => `| ${row.name} | ${cell(row.opens)} | ${cell(row.slides)} | ${cell(row.noOverflow)} | ${cell(row.noShrink)} | ${cell(row.roundtrip)} | ${row.worstVisual ? `s${row.worstVisual.slide} ${row.worstVisual.mean}/${row.worstVisual.changed}` : ''} |`)];
  writeFileSync(path.join(appDir, 'results.md'), `${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
