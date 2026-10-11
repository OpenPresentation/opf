// opf#323 (0.18 run): turns the native read-outs into compare.json and compare.md, one section per item, against each item's pass
// criterion. No Office: it only reads files. Run with Node 24 from this folder:
//   node compare.mjs [--native native/attempt-1] [--only ff12,ff27,ff46,ff13] [--ff13 ff13/attempt-<stamp>] [--out compare.json] [--md compare.md]
//
// Criteria (opf#323):
//   RR-05 / FF-12  each deck's Presentation.Fonts names only its chosen families, theme references resolve to them, and any other name
//                  fails. Accepted reading of 2026-10-05: a theme-only East Asian or complex-script family may be absent from
//                  Presentation.Fonts (reported "soft"); every Latin family the runs draw must be listed.
//   FF-27          after an in-memory insert and a move, the slide numbers follow the new order, and the date field shows the host date
//                  in the chosen format (not the cached export date).
//   FF-46 / RR-17  names as FF-12, the run script slot names the deck's family, every exported line box reads one native line, no
//                  native-only overflow past the box (0.5 pt), and native / preview ink width within the FF-46 tolerances on lines of
//                  at least 200 pt (finding when native is > 1 % wider or the preview > 20 % wider). Image scores are reported only.
//   FF-13          the OPC audit of the saved copy shows exactly the chosen fonts (Carlito) embedded, and the source is unchanged.
import {existsSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {unzipSync, strFromU8} from 'fflate';
import sharp from 'sharp';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const nativeRoot = path.resolve(ROOT, opt('--native', 'native/attempt-1'));
const only = new Set(opt('--only', 'ff12,ff27,ff46,ff13').split(','));
// attempt-2 (opf#361): --only ff46sa,probe38; attempt-3: --only probe38b
const outJson = path.resolve(ROOT, opt('--out', 'compare.json'));
const outMd = path.resolve(ROOT, opt('--md', 'compare.md'));
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const TOL = {lineOverflowPt: 0.5, realFontWiderThanReplacement: 0.01, previewWiderThanRealFont: 0.2, longLinePt: 200, imageClose: 0.02, imageReview: 0.06};
const lc = s => String(s ?? '').trim().toLowerCase();
const empty = s => s === null || s === undefined || String(s).trim() === '';
const readJson = file => { try { return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return null; } };
const median = values => { if (!values.length) return null; const s = [...values].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const round = (v, d = 4) => v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d;

function runRecord(set, id) {
  const dir = path.join(nativeRoot, set, id);
  return {dir, run: readJson(path.join(dir, `${id}.run.json`)), read: readJson(path.join(dir, `${id}.json`)), fields: readJson(path.join(dir, `${id}.fields.json`))};
}

/** Every text shape of a native slide, groups flattened. */
const flatShapes = shapes => (shapes ?? []).flatMap(s => [s, ...flatShapes(s.children)]);
const shapeRuns = s => [...(s.paragraphs ?? []), ...(s.table?.cells ?? []).flatMap(c => c.paragraphs ?? [])].flatMap(p => p.runs ?? []);

// ------------------------------------------------------------------ names (FF-12, FF-46) ------------------------------------------------------------------
// PowerPoint reports a run whose slot follows the theme as a theme reference (+mn-cs, +mj-lt, +mn-ea). It is resolved through the
// read-out's slide-master theme slots (the decks have one slide master). A reference to a slot the file leaves empty (cs, and ea where
// no East Asian font is chosen) is the FF-05 / FF-49 design (opf-pptx checkTypefaces allowEmptyThemeScripts): counted, not failed.
// A reference that cannot be resolved (no theme read, unknown slot) fails.
const THEME_REF = /^[+](mj|mn)-(lt|ea|cs)$/i;
function resolveName(name, theme) {
  if (empty(name) || !String(name).startsWith('+')) return {name, kind: 'direct'};
  const m = THEME_REF.exec(String(name).trim());
  if (!m || !theme) return {name, kind: 'unresolved'};
  const value = theme[m[1].toLowerCase() === 'mj' ? 'major' : 'minor']?.[{lt: 'latin', ea: 'eastAsian', cs: 'complexScript'}[m[2].toLowerCase()]];
  if (value === undefined || value === null) return {name, kind: 'unresolved'};
  return empty(value) ? {name: '', kind: 'empty-slot', ref: name} : {name: value, kind: 'theme', ref: name};
}
const runNames = (r, theme) => ['name', 'nameFarEast', 'nameComplexScript'].map(key => ({key, ...resolveName(r.font?.[key], theme)}));
function nameChecks(d, read) {
  const expected = new Set(d.expectedFonts.map(lc));
  const native = (read.presentationFonts ?? []).map(f => f.name).filter(n => !empty(n));
  const nativeSet = new Set(native.map(lc));
  const extras = native.filter(n => !expected.has(lc(n)));
  const missingRequired = d.requiredFonts.filter(n => !nativeSet.has(lc(n)));
  const missingSoft = d.softFonts.filter(n => !nativeSet.has(lc(n)));
  const slots = [];
  for (const [label, want, got] of [['master', d.theme, read.theme], ['notes master', d.notesTheme, read.notesTheme]]) {
    if (!want) continue;
    for (const role of ['major', 'minor']) for (const [slot, key] of [['latin', 'latin'], ['ea', 'eastAsian'], ['cs', 'complexScript']]) {
      const w = want[role][slot] ?? '', g = got?.[role]?.[key] ?? null;
      slots.push({theme: label, slot: `${role}.${slot}`, expected: w, native: g, ok: g !== null && lc(w) === lc(g)});
    }
  }
  const foreignRuns = [], unresolved = [], refs = {};
  let runs = 0;
  for (const slide of read.slides ?? []) for (const s of flatShapes(slide.shapes)) for (const r of shapeRuns(s)) {
    runs++;
    for (const n of runNames(r, read.theme)) {
      if (n.ref || n.kind === 'unresolved') { const k = `${n.ref ?? n.name} -> ${n.kind === 'empty-slot' ? '(empty slot)' : n.kind === 'unresolved' ? 'UNRESOLVED' : n.name}`; refs[k] = (refs[k] ?? 0) + 1; }
      if (n.kind === 'unresolved') { if (unresolved.length < 20) unresolved.push({slide: slide.index, shape: s.name, slot: n.key, name: n.name}); continue; }
      if (!empty(n.name) && !expected.has(lc(n.name)) && foreignRuns.length < 20) foreignRuns.push({slide: slide.index, shape: s.name, slot: n.key, name: n.name, ...(n.ref ? {via: n.ref} : {}), text: r.text?.slice(0, 40)});
    }
  }
  return {
    presentationFonts: {ok: extras.length === 0 && missingRequired.length === 0, native, expected: d.expectedFonts, required: d.requiredFonts, soft: d.softFonts, extras, missingRequired, missingSoftAccepted: missingSoft},
    themeSlots: {ok: slots.length > 0 && slots.every(s => s.ok), slots},
    runNames: {ok: foreignRuns.length === 0 && unresolved.length === 0, runs, foreign: foreignRuns, unresolvedThemeReferences: unresolved, themeReferences: refs},
  };
}

function runHealth(d, rec, kind = 'read') {
  const body = kind === 'fields' ? rec.fields : rec.read;
  const problems = [], notes = [];
  if (!rec.run) problems.push('no run.json (deck not run)');
  else if (rec.run.status !== 'completed') problems.push(`run ${rec.run.status}, exit ${rec.run.exitCode}`);
  else if (rec.run.exitCode === null || rec.run.exitCode === undefined) {
    // attempt-1 harness bug: run-deck.ps1 did not cache the child's handle, so ExitCode read $null. A completed run counts as successful
    // only when its read-out is present and parsed (checked below); the missing exit code is recorded as a harness note.
    if (body) notes.push('harness: exit code not captured (run-deck.ps1 before the handle fix); success taken from status completed and the parsed read-out');
  } else if (rec.run.exitCode !== 0) problems.push(`run completed, exit ${rec.run.exitCode}`);
  if (!body) problems.push('no native read-out');
  else {
    if (body.stage !== 'done') problems.push(`stage ${body.stage}`);
    if (body.error) problems.push(`error: ${body.error}`);
    if (body.truncated) problems.push('truncated');
    if (body.deckSha256 && body.deckSha256 !== d.sha256) problems.push('sha256 differs from the manifest');
    if (kind === 'read' && body.readOnly !== undefined && body.readOnly !== -1 && body.readOnly !== true) problems.push(`not read-only (${body.readOnly})`);
    if (kind === 'read' && (body.slides?.length ?? 0) !== d.slides) problems.push(`read ${body.slides?.length ?? 0} of ${d.slides} slides`);
  }
  return {ok: problems.length === 0, problems, notes, elapsedMs: body?.elapsedMs ?? null, startedPowerPoint: body?.startedPowerPoint ?? null, readErrors: body?.readErrors?.length ?? null};
}

// ------------------------------------------------------------------ FF-12 ------------------------------------------------------------------
function compareFf12() {
  const set = manifest.sets.ff12;
  const decks = [];
  for (const [id, d] of Object.entries(set?.decks ?? {})) {
    const rec = runRecord('ff12', id);
    const health = runHealth(d, rec);
    const entry = {id, covers: d.covers, health, checks: null, verdict: 'MISSING'};
    if (rec.read) {
      const checks = nameChecks(d, rec.read);
      // Per-slide override (07): the slide's own family is read back on that slide's runs.
      if (d.expectedSlideFamilies) {
        const rows = Object.entries(d.expectedSlideFamilies).map(([slide, families]) => {
          const names = new Set(flatShapes(rec.read.slides.find(s => s.index === Number(slide))?.shapes).flatMap(s => shapeRuns(s).map(r => lc(resolveName(r.font?.name, rec.read.theme).name))));
          return {slide: Number(slide), expected: families, ok: families.every(f => names.has(lc(f)))};
        });
        checks.slideFamilies = {ok: rows.every(r => r.ok), rows};
      }
      // Content presence, reported: charts, tables and notes as exported.
      const presence = d.perSlide.map(ps => {
        const slide = rec.read.slides.find(s => s.index === ps.index);
        const shapes = flatShapes(slide?.shapes);
        return {slide: ps.index, charts: [ps.charts, shapes.filter(s => s.hasChart).length], tables: [ps.tables, shapes.filter(s => s.hasTable).length], notes: [!!ps.notesText, !empty(slide?.notes)]};
      });
      checks.content = {ok: presence.every(p => p.charts[0] === p.charts[1] && p.tables[0] === p.tables[1] && p.notes[0] === p.notes[1]), gated: false, rows: presence};
      entry.checks = checks;
      const gated = ['presentationFonts', 'themeSlots', 'runNames', 'slideFamilies'].filter(k => checks[k]);
      entry.verdict = health.ok && gated.every(k => checks[k].ok) ? 'PASS' : 'FAIL';
    }
    decks.push(entry);
  }
  return {item: 'RR-05 / FF-12', criterion: 'Presentation.Fonts names only the chosen families (Latin run families listed; theme-only script families may be absent), theme slots of the slide and notes masters resolve to them, and no run names another family.', decks,
    summary: {decks: decks.length, pass: decks.filter(d => d.verdict === 'PASS').length, fail: decks.filter(d => d.verdict === 'FAIL').length, missing: decks.filter(d => d.verdict === 'MISSING').length}};
}

// ------------------------------------------------------------------ FF-27 ------------------------------------------------------------------
const PP = {slideNumber: 13, footer: 15, date: 16};
function compareFf27() {
  const set = manifest.sets.ff27;
  const decks = [];
  for (const [id, d] of Object.entries(set?.decks ?? {})) {
    const rec = runRecord('ff27', id);
    const health = runHealth(d, rec, 'fields');
    const entry = {id, covers: d.covers, health, steps: [], verdict: 'MISSING'};
    const f = rec.fields;
    if (f) {
      const fmt = d.fields.date.format, wantDate = f.clock?.expectedEnUS?.[fmt];
      const cached = d.perSlide[0].shapes.flatMap(s => s.fields).find(x => /^datetime/.test(x.type))?.cachedText;
      for (const step of f.steps ?? []) {
        const rows = step.after.map((slide, i) => {
          const texts = slide.shapes.map(s => ({name: s.name, ph: s.placeholderType, text: String(s.text ?? '').trim()}));
          const title = texts.find(t => /^OPF heading/.test(t.name))?.text ?? null;
          const numbers = [];
          for (const t of texts) {
            if (t.ph === PP.slideNumber || (id === '01-footer-fields' && /part 2 line 0$/.test(t.name))) { const m = /(\d+)\s*$/.exec(t.text); if (m) numbers.push({shape: t.name, text: t.text, value: Number(m[1])}); }
            const page = /^Page (\d+) of (\d+)$/.exec(t.text); if (page) numbers.push({shape: t.name, text: t.text, value: Number(page[1]), fixedCount: Number(page[2])});
          }
          const dedup = [...new Map(numbers.map(n => [n.shape + n.text, n])).values()];
          const dates = texts.filter(t => t.ph === PP.date || /\d{4}$/.test(t.text) && !/^Page/.test(t.text) && !/^OPF heading/.test(t.name) && /\b(19|20)\d{2}\b/.test(t.text) && !/Slide \d/.test(t.text)).map(t => t.text);
          return {position: i + 1, slideId: slide.slideId, title, numbers: dedup, numbersOk: dedup.length > 0 && dedup.every(n => n.value === i + 1), dates,
            dateOk: dates.length > 0 && dates.every(t => t === wantDate), dateIsCached: dates.some(t => t === cached), headersFooters: slide.headersFooters};
        });
        entry.steps.push({step: step.step, operation: step.operation, slideCount: step.slideCount, order: rows.map(r => r.title), rows,
          numbersOk: rows.every(r => r.numbersOk), dateOk: rows.every(r => r.dateOk), dateCachedAnywhere: rows.some(r => r.dateIsCached)});
      }
      const expectedSteps = ['initial', 'after-duplicate', 'after-move'];
      const hasAll = expectedSteps.every(s => entry.steps.some(x => x.step === s));
      const hf = entry.steps.flatMap(s => s.rows.map(r => r.headersFooters)).filter(Boolean);
      entry.dateField = {format: fmt, expectedToday: wantDate, cachedExportText: cached, hostDate: f.clock?.localDate, culture: f.clock?.culture,
        nativeFormatCodes: [...new Set(hf.map(h => h.dateFormat))], useFormat: [...new Set(hf.map(h => h.dateUseFormat))], expectedPpFormat: d.fields.date.ppFormat};
      entry.verdict = health.ok && hasAll && entry.steps.every(s => s.numbersOk && s.dateOk) ? 'PASS' : 'FAIL';
      if (!hasAll) entry.missingSteps = expectedSteps.filter(s => !entry.steps.some(x => x.step === s));
      if (d.note) entry.note = d.note;
    }
    decks.push(entry);
  }
  return {item: 'FF-27', criterion: 'After Slides(1).Duplicate() and Slides(last).MoveTo(1), in memory, every slide-number field reads its new position, and every live date field reads the host date in the chosen en-US format (never the cached export date).', decks,
    summary: {decks: decks.length, pass: decks.filter(d => d.verdict === 'PASS').length, fail: decks.filter(d => d.verdict === 'FAIL').length, missing: decks.filter(d => d.verdict === 'MISSING').length}};
}

// ------------------------------------------------------------------ FF-46 ------------------------------------------------------------------
async function raw(file) { const {data, info} = await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject: true}); return {data, width: info.width, height: info.height, channels: info.channels}; }
/** Horizontal ink extent (px) inside a band; null when the band is empty or the ink touches the search window (clipped). */
function inkExtent(img, band) {
  const {data, width, channels} = img;
  const y0 = Math.max(0, Math.floor(band.y0)), y1 = Math.min(img.height - 1, Math.ceil(band.y1)), x0 = Math.max(0, Math.floor(band.x0)), x1 = Math.min(width - 1, Math.ceil(band.x1));
  if (y1 <= y0 || x1 <= x0) return null;
  const counts = new Map();
  for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 3) { const o = (y * width + x) * channels, key = ((data[o] >> 4) << 8) | ((data[o + 1] >> 4) << 4) | (data[o + 2] >> 4); counts.set(key, (counts.get(key) ?? 0) + 1); }
  const bgKey = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const bg = [((bgKey >> 8) & 15) * 16 + 8, ((bgKey >> 4) & 15) * 16 + 8, (bgKey & 15) * 16 + 8];
  let first = -1, last = -1;
  for (let x = x0; x <= x1; x++) {
    let ink = 0;
    for (let y = y0; y <= y1; y++) { const o = (y * width + x) * channels; if (Math.max(Math.abs(data[o] - bg[0]), Math.abs(data[o + 1] - bg[1]), Math.abs(data[o + 2] - bg[2])) > 64) ink++; }
    if (ink > 0) { if (first < 0) first = x; last = x; }
  }
  if (first < 0) return null;
  return {left: first, right: last, width: last - first + 1, clipped: first <= x0 || last >= x1};
}
async function imageScore(a, b) {
  const small = async f => (await sharp(f).removeAlpha().greyscale().resize(160, 90, {fit: 'fill'}).raw().toBuffer());
  const [x, y] = await Promise.all([small(a), small(b)]);
  let sum = 0; for (let i = 0; i < x.length; i++) sum += Math.abs(x[i] - y[i]);
  const score = sum / x.length / 255;
  return {score: round(score), band: score < TOL.imageClose ? 'close' : score < TOL.imageReview ? 'review' : 'far'};
}
const SCRIPT_TEXT = /[^\u0000-ɏ -⁯\s\d\p{P}]/u;

async function compareFf46(setName = 'ff46') {
  const set = manifest.sets[setName];
  const decks = [];
  for (const [id, d] of Object.entries(set?.decks ?? {})) {
    const rec = runRecord(setName, id);
    const health = runHealth(d, rec);
    const entry = {id, family: d.family, language: d.language, status: d.status, probe: d.probe, health, verdict: 'MISSING'};
    decks.push(entry);
    if (!rec.read) continue;
    const read = rec.read;
    entry.names = nameChecks(d, read);
    const px = (read.slideSize?.exportWidth ?? 1280) / (read.slideSize?.widthPt ?? 960);
    const lines = [], ink = [], drawn = [], images = [];
    for (const ps of d.perSlide) {
      const slide = read.slides.find(s => s.index === ps.index);
      if (!slide) continue;
      const nativeShapes = flatShapes(slide.shapes);
      const nativePng = slide.png ? path.join(rec.dir, slide.png) : null;
      const previewPng = d.previews?.[ps.index - 1] ? path.join(ROOT, 'previews', setName, d.previews[ps.index - 1]) : null;
      const havePngs = nativePng && previewPng && existsSync(nativePng) && existsSync(previewPng);
      const [nimg, pimg] = havePngs ? await Promise.all([raw(nativePng), raw(previewPng)]) : [null, null];
      if (havePngs) images.push({slide: ps.index, ...(nimg.width === pimg.width && nimg.height === pimg.height ? await imageScore(nativePng, previewPng) : {band: 'size-mismatch'})});
      for (const shape of ps.shapes) {
        const n = nativeShapes.find(s => s.name === shape.name);
        if (!n) { lines.push({slide: ps.index, shape: shape.name, missing: true}); continue; }
        // Script slot: the slide's text in the family's script must be named with the deck's family on the native run.
        if (!d.probe && d.family) for (const r of shapeRuns(n)) if (SCRIPT_TEXT.test(r.text ?? '') || d.status === 'code-table') {
          const names = runNames(r, read.theme).map(n => lc(n.name));
          if (d.status === 'code-table' && !shape.runs.some(x => lc(x.latin) === lc(d.family) && x.text === r.text)) continue;
          drawn.push({slide: ps.index, shape: shape.name, text: r.text?.slice(0, 30), ok: names.includes(lc(d.family)), names: [r.font?.name, r.font?.nameFarEast, r.font?.nameComplexScript]});
        }
        const box = shape.box;
        const nl = n.lines ?? [];
        const left = nl.length ? Math.min(...nl.map(l => l.boundLeft)) : null, right = nl.length ? Math.max(...nl.map(l => l.boundLeft + l.boundWidth)) : null;
        const overflow = left === null ? null : Math.max(0, box.x - left, right - (box.x + box.w));
        const row = {slide: ps.index, shape: shape.name, boxLeft: round(box.x, 2), boxWidth: round(box.w, 2), lineCount: n.lineCount, overflowPt: round(overflow, 2), maxFill: right === null ? null : round((right - left) / box.w)};
        // Ink: the same composed line in both PNGs, searched from a quarter box left of the box to a quarter box right of it.
        if (nimg && pimg) {
          const band = {y0: box.y * px + 1, y1: (box.y + box.h) * px - 1, x0: (box.x - box.w * 0.25) * px, x1: (box.x + box.w * 1.25) * px};
          const a = inkExtent(nimg, band), b = inkExtent(pimg, band);
          if (a && b) {
            const nativeWidthPt = a.width / px, previewWidthPt = b.width / px;
            const pastBox = e => Math.max(0, box.x * px - e.left, e.right - (box.x + box.w) * px) / px;
            ink.push({slide: ps.index, shape: shape.name, previewWidthPt: round(previewWidthPt, 2), nativeWidthPt: round(nativeWidthPt, 2), clipped: a.clipped || b.clipped, ratio: round(nativeWidthPt / previewWidthPt), nativeInkPastBoxPt: round(pastBox(a), 2), previewInkPastBoxPt: round(pastBox(b), 2)});
            row.compositionOverflow = pastBox(b) > TOL.lineOverflowPt;
          }
        }
        lines.push(row);
      }
    }
    const multi = lines.filter(l => !l.missing && l.lineCount !== 1);
    const nativeOnly = lines.filter(l => !l.missing && l.overflowPt > TOL.lineOverflowPt && !l.compositionOverflow);
    const usable = ink.filter(r => !r.clipped && r.ratio !== null);
    const long = usable.filter(r => r.previewWidthPt >= TOL.longLinePt);
    const longMedian = median(long.map(r => r.ratio)), anyMedian = median(usable.map(r => r.ratio));
    entry.lines = {shapes: lines.length, missing: lines.filter(l => l.missing).length, singleLine: lines.filter(l => l.lineCount === 1).length, multiLine: multi.map(l => `${l.slide}:${l.shape} (${l.lineCount})`), nativeOnlyOverflow: nativeOnly.map(l => ({slide: l.slide, shape: l.shape, overflowPt: l.overflowPt})), compositionOverflow: lines.filter(l => l.compositionOverflow).length, rows: lines};
    entry.drawn = {runs: drawn.length, ok: drawn.filter(x => x.ok).length, fails: drawn.filter(x => !x.ok).slice(0, 10)};
    entry.ink = {boxes: usable.length, longLines: long.length, longMedianRatio: round(longMedian), medianRatio: round(anyMedian), minRatio: round(Math.min(...usable.map(r => r.ratio))), maxRatio: round(Math.max(...usable.map(r => r.ratio))), rows: ink};
    entry.images = images;
    const reasons = [];
    if (!health.ok) reasons.push(...health.problems);
    if (!entry.names.presentationFonts.ok) reasons.push(`Presentation.Fonts extras ${entry.names.presentationFonts.extras.join(', ') || '-'} missing ${entry.names.presentationFonts.missingRequired.join(', ') || '-'}`);
    if (!entry.names.themeSlots.ok) reasons.push('theme slots differ');
    if (!entry.names.runNames.ok) reasons.push('a run names another family');
    if (entry.drawn.runs && entry.drawn.ok < entry.drawn.runs) reasons.push(`${entry.drawn.runs - entry.drawn.ok} script runs not in ${d.family}`);
    if (multi.length) reasons.push(`${multi.length} boxes wrap natively`);
    if (nativeOnly.length) reasons.push(`${nativeOnly.length} boxes overflow only natively (max ${Math.max(...nativeOnly.map(l => l.overflowPt))} pt)`);
    const ratio = longMedian ?? anyMedian;
    if (ratio !== null && ratio > 1 + TOL.realFontWiderThanReplacement) reasons.push(`native ink ${ratio} of the preview: the real font is wider`);
    if (ratio !== null && ratio < 1 - TOL.previewWiderThanRealFont) reasons.push(`native ink ${ratio} of the preview: the preview is wider`);
    entry.reasons = reasons;
    entry.verdict = !health.ok || !entry.names.presentationFonts.ok || !entry.names.themeSlots.ok || !entry.names.runNames.ok ? 'FAIL' : reasons.length ? 'FINDING' : 'PASS';
  }
  // Per family: every non-probe deck that names it.
  const families = {};
  for (const e of decks) {
    if (e.probe || !e.family) continue;
    const f = (families[e.family] ??= {family: e.family, status: e.status, decks: [], outcome: null, reasons: []});
    f.decks.push(e.id);
    f.reasons.push(...(e.reasons ?? []).map(r => `${e.id}: ${r}`));
    const order = {MISSING: 3, FAIL: 2, FINDING: 1, PASS: 0};
    f.outcome = f.outcome === null || order[e.verdict] > order[f.outcome] ? e.verdict : f.outcome;
    f.longMedianRatio = e.ink?.longMedianRatio ?? f.longMedianRatio ?? null;
  }
  return {item: 'FF-46 / RR-17', criterion: 'Names as FF-12; the script runs name the deck family; every exported line box reads one native line; no native-only overflow past the box (> 0.5 pt); native / preview ink on lines of at least 200 pt within 0.80 to 1.01. Image scores are reported, not gated.', tolerances: TOL, decks,
    families: Object.values(families).sort((a, b) => a.family.localeCompare(b.family)),
    summary: {decks: decks.length, pass: decks.filter(d => d.verdict === 'PASS').length, finding: decks.filter(d => d.verdict === 'FINDING').length, fail: decks.filter(d => d.verdict === 'FAIL').length, missing: decks.filter(d => d.verdict === 'MISSING').length,
      familiesPass: Object.values(families).filter(f => f.outcome === 'PASS').length, families: Object.keys(families).length}};
}

// ------------------------------------------------------------------ opf#361 lineAscent probe (RR-38 method) ------------------------------------------------------------------
// For each probe line box: the native PNG (2880 px wide) is read in the box's band; ink = dark pixels on the white slide. Two baseline
// estimates, in em of the font size below the box top: (a) RR-38 baseline.mjs, the last pixel row whose ink count is at least 35 % of the
// band's peak row; (b) the most common ink-bottom row over the ink columns. lineAscent = the median over 18, 24 and 32 pt of (a) on
// regular single lines; bold and the mixed line are reported beside it (lineAscentMixed = the mixed median). The native Lines() bounds of
// the box are recorded for reference. The controls must reproduce their known values within 0.03 em, or the probe is not trusted.
// Control references re-derived with THIS estimator from the native PNGs they came from (measure/rr38-reproduce.mjs,
// measure/baseline-attempt1.mjs). The policy's Arabic Typesetting 0.70 came from RR-38's earlier estimator; RR-38's own native PNGs
// (2560 px, 18 / 24 / 32 pt) read 0.743 / 0.745 / 0.746 with this one. Angsana New 0.85 and Sakkal Majalla 0.78 came from 1280 px FF-46 PNGs
// (one pixel = 0.04 em at 18.75 pt); those same attempt-1 PNGs read 0.84 to 0.85 and 0.75 to 0.77 here, so they stay as references.
const CONTROL_REFERENCE = {
  'Arabic Typesetting': {value: 0.745, source: 'RR-38 native PNGs (probe-slide-1..3, 2560 px), bottom edge of the last row with >= 35 % of the peak row; policy 0.70 used an earlier estimator'},
  'Angsana New': {value: 0.85, source: 'FF-46 run 2026-10-05 (opf#361 comment); attempt-1 PNGs re-read 0.841 title / 0.848 body'},
  'Sakkal Majalla': {value: 0.78, source: 'FF-46 run 2026-10-05 (opf#361 comment); attempt-1 PNGs re-read 0.767 title / 0.752 to 0.766 body'},
};
async function compareProbe38(setName = 'probe38') {
  const set = manifest.sets[setName];
  const rows = [];
  for (const [id, d] of Object.entries(set?.decks ?? {})) {
    const rec = runRecord(setName, id);
    const health = runHealth(d, rec);
    if (!rec.read) { rows.push({deck: id, missing: true, health}); continue; }
    for (const slide of d.layout) {
      const ns = rec.read.slides.find(s => s.index === slide.slide);
      if (!ns?.png) { rows.push({deck: id, slide: slide.slide, missing: 'png'}); continue; }
      const img = await raw(path.join(rec.dir, ns.png));
      const k = img.width / (rec.read.slideSize?.widthPt ?? 960);
      const dark = (x, y) => { const o = (y * img.width + x) * img.channels; return img.data[o] + img.data[o + 1] + img.data[o + 2] < 3 * 128; };
      for (const row of slide.rows) {
        const b = row.box, y0 = Math.max(0, Math.round((b.y - 2) * k)), y1 = Math.min(img.height - 1, Math.round((b.y + b.h + 6) * k)), x0 = Math.round(b.x * k), x1 = Math.min(img.width - 1, Math.round((b.x + b.w) * k));
        const counts = [], bottoms = new Map();
        for (let y = y0; y <= y1; y++) { let n = 0; for (let x = x0; x <= x1; x++) if (dark(x, y)) n++; counts.push([y, n]); }
        for (let x = x0; x <= x1; x++) { let last = -1; for (let y = y0; y <= y1; y++) if (dark(x, y)) last = y; if (last >= 0) bottoms.set(last, (bottoms.get(last) ?? 0) + 1); }
        const peak = Math.max(...counts.map(c => c[1]));
        const shape = flatShapes(ns.shapes).find(s => s.name === row.name);
        const line = shape?.lines?.[0];
        if (!peak) { rows.push({deck: id, ...row, size: slide.size, noInk: true}); continue; }
        const a = counts.filter(c => c[1] >= peak * 0.35).at(-1)[0];
        const modeBottom = [...bottoms.entries()].sort((p, q) => q[1] - p[1])[0][0];
        // Headline scripts (Devanagari): the peak row is the headline in the upper part of the ink, so the 35 % rule stops inside the
        // stems. There the baseline is the mode of the ink bottoms of the columns that reach more than 0.15 em below the peak row.
        const inked = counts.filter(c => c[1] > 0), peakY = counts.find(c => c[1] === peak)[0];
        const headline = (peakY - inked[0][0]) / (inked.at(-1)[0] - inked[0][0]) < 0.4;
        const stems = new Map();
        if (headline) for (let x = x0; x <= x1; x++) { let last = -1; for (let y = y0; y <= y1; y++) if (dark(x, y)) last = y; if (last > peakY + 0.15 * slide.size * k) stems.set(last, (stems.get(last) ?? 0) + 1); }
        const stemBottom = headline && stems.size ? [...stems.entries()].sort((p, q) => q[1] - p[1])[0][0] : null;
        // The baseline is the bottom edge of the last ink row (ink of a glyph sitting on the baseline ends just above it).
        const em = y => round(((y + 1) / k - b.y) / slide.size, 3);
        rows.push({deck: id, name: row.name, family: row.family, weight: row.weight, kind: row.kind, size: slide.size, known: row.known,
          baselineEmPeak35: em(a), baselineEmModeBottom: em(modeBottom), headlineScript: headline, baselineEmStemBottom: stemBottom === null ? null : em(stemBottom), baselineEm: stemBottom === null ? em(a) : em(stemBottom), nativeLineCount: shape?.lineCount ?? null,
          boundTopPt: line ? round(line.boundTop - b.y, 2) : null, boundHeightEm: line ? round(line.boundHeight / slide.size, 3) : null,
          names: shape?.paragraphs?.[0]?.runs?.map(r => [r.font?.name, r.font?.nameFarEast, r.font?.nameComplexScript]) ?? null});
      }
    }
  }
  const families = {};
  for (const r of rows.filter(r => r.family && r.baselineEm !== undefined)) {
    const f = (families[r.family] ??= {family: r.family, known: r.known ?? null, single: [], bold: [], mixed: [], modeSingle: []});
    if (r.kind === 'mixed') f.mixed.push(r.baselineEm); else if (r.weight === 'bold') f.bold.push(r.baselineEm); else { f.single.push(r.baselineEm); f.modeSingle.push(r.baselineEmModeBottom); }
  }
  const out = Object.values(families).map(f => {
    const lineAscent = median(f.single), mixed = median(f.mixed);
    return {family: f.family, perSize: {single: f.single, bold: f.bold, mixed: f.mixed, singleModeBottom: f.modeSingle},
      lineAscent: lineAscent === null ? null : Math.round(lineAscent * 100) / 100, lineAscentMixed: mixed === null ? null : Math.round(mixed * 100) / 100,
      boldMedian: round(median(f.bold), 3), control: f.known === null ? null : (() => { const ref = CONTROL_REFERENCE[f.family] ?? {value: f.known}; return {known: f.known, reference: ref.value, referenceSource: ref.source ?? 'as built', ok: median(f.single) !== null && Math.abs(median(f.single) - ref.value) <= 0.03}; })()};
  });
  return {item: 'opf#361 lineAscent probe (RR-38 method)', criterion: 'Baseline below the line-box top in em: the bottom edge of the last ink row with at least 35 % of the peak row (for a headline script such as Devanagari: the mode of the stem bottoms), median over 18, 24 and 32 pt (regular single lines = lineAscent, mixed line = lineAscentMixed). The controls (Angsana New 0.85, Sakkal Majalla 0.78, Arabic Typesetting 0.745 as re-derived from the RR-38 native PNGs) must reproduce within 0.03 em, or the probe values are not used.',
    controlsOk: out.filter(f => f.control).length > 0 && out.filter(f => f.control).every(f => f.control.ok), families: out, rows};
}

// ------------------------------------------------------------------ FF-13 ------------------------------------------------------------------
function eotIdentity(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 82) return {format: 'unknown', error: 'too short'};
  const magic = v.getUint16(34, true);
  if (magic !== 0x504c) return {format: 'not-eot', magic: magic.toString(16)};
  const fontDataSize = v.getUint32(4, true), version = v.getUint32(8, true), flags = v.getUint32(12, true), italic = bytes[27], weight = v.getUint32(28, true), fsType = v.getUint16(32, true);
  // EOT 0x00020001/2 header: ... Reserved1-4 (64..79), Padding1 (80..81), FamilyNameSize (82..83), FamilyName (UTF-16LE) at 84.
  const nameSize = v.getUint16(82, true);
  const raw = Buffer.from(bytes.subarray(84, 84 + nameSize)).toString('utf16le');
  return {format: 'eot', version: `0x${version.toString(16)}`, flags, fontDataSize, weight, italic: italic === 1, fsType, family: raw.replace(/\u0000+$/, ''), familyRaw: JSON.stringify(raw)};
}
function compareFf13() {
  const base = path.join(ROOT, 'ff13');
  const chosen = ['Carlito'];
  let dir = opt('--ff13', null);
  if (!dir && existsSync(base)) dir = readdirSync(base).filter(n => n.startsWith('attempt-')).sort().map(n => path.join(base, n)).at(-1);
  if (!dir || !existsSync(dir)) return {item: 'FF-13', verdict: 'MISSING', note: 'no attempt directory (run helpers\\ff13-supervise.ps1)'};
  dir = path.resolve(ROOT, dir);
  const report = readJson(path.join(dir, 'report.json')), supervisor = readJson(path.join(dir, 'supervisor.json')), registration = readJson(path.join(dir, 'font-registration.json'));
  const failures = [], warnings = [];
  if (!supervisor) failures.push('no supervisor.json');
  else if (supervisor.child?.status !== 'completed') failures.push(`worker ${supervisor.child?.status} exit ${supervisor.child?.exitCode}`);
  else if (supervisor.child?.exitCode === null || supervisor.child?.exitCode === undefined) { if (report) warnings.push('harness: worker exit code not captured (ff13-supervise.ps1 before the handle fix); success taken from status completed and report.json'); else failures.push('worker exit code not captured and no report.json'); }
  else if (supervisor.child.exitCode !== 0) failures.push(`worker exit ${supervisor.child.exitCode}`);
  if (!report) failures.push('no report.json');
  else {
    if (!report.saved) failures.push(`no copy saved (stage ${report.stage}${report.error ? `: ${report.error}` : ''})`);
    if (report.sourceSha256Before !== report.sourceSha256After) failures.push('the source changed');
    const before = (report.fontsBeforeSave ?? []).map(f => f.name);
    if (before.some(n => !chosen.includes(n))) failures.push(`Presentation.Fonts before save lists ${before.join(', ')}`);
    const reopened = report.fontsAfterReopen ?? [];
    if ((supervisor?.probes ?? []).every(p => p.resolved !== 'Carlito')) warnings.push('harness: the System.Drawing probe never resolved Carlito, also during registration (GDI+ caches its font list at first use in the supervisor process, so a probe after AddFontResourceExW does not see it); AddFontResourceExW returned 1 for every face, and the saved copy is the evidence');
    if (reopened.some(f => chosen.includes(f.name) && f.embedded === 0)) warnings.push(`diagnostic reopen: PowerPoint does not report ${chosen.join(', ')} as embedded (${JSON.stringify(reopened)}); the OPC audit is the criterion`);
  }
  const opc = {failures: [], typefaces: [], parts: [], embedTrueTypeFonts: null, saveSubsetFonts: null};
  const copy = path.join(dir, 'copy.pptx');
  if (existsSync(copy)) {
    const files = unzipSync(readFileSync(copy));
    const pres = strFromU8(files['ppt/presentation.xml']);
    opc.embedTrueTypeFonts = /embedTrueTypeFonts="1"/.test(pres); opc.saveSubsetFonts = /saveSubsetFonts="1"/.test(pres);
    const rels = strFromU8(files['ppt/_rels/presentation.xml.rels'] ?? new Uint8Array());
    const target = rid => /Target="([^"]+)"/.exec(new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*>`).exec(rels)?.[0] ?? '')?.[1];
    for (const ef of pres.matchAll(/<p:embeddedFont>([\s\S]*?)<\/p:embeddedFont>/g)) {
      const typeface = /<p:font\b[^>]*typeface="([^"]+)"/.exec(ef[1])?.[1];
      opc.typefaces.push(typeface);
      for (const st of ef[1].matchAll(/<p:(regular|bold|italic|boldItalic)\b[^>]*r:id="([^"]+)"/g)) {
        const name = `ppt/${target(st[2])}`.replace('ppt/../', '');
        const bytes = files[name];
        const identity = bytes ? eotIdentity(bytes) : {error: 'part missing'};
        opc.parts.push({name, style: st[1], typeface, relId: st[2], size: bytes?.length ?? null, identity});
        if (!bytes) opc.failures.push(`${name}: missing`);
        else if (identity.format === 'eot' && identity.family !== typeface) opc.failures.push(`${name}: identifies as ${identity.familyRaw}, not ${typeface}`);
      }
    }
    const fontParts = Object.keys(files).filter(n => n.startsWith('ppt/fonts/'));
    const listed = new Set(opc.parts.map(p => p.name));
    for (const n of fontParts) if (!listed.has(n)) opc.failures.push(`${n}: font part not in the embedded-font list`);
    if (!opc.embedTrueTypeFonts) opc.failures.push('presentation.xml has no embedTrueTypeFonts="1"');
    const set = [...new Set(opc.typefaces)];
    if (set.length !== chosen.length || set.some(t => !chosen.includes(t))) opc.failures.push(`embedded typefaces ${set.join(', ') || 'none'}; expected exactly ${chosen.join(', ')}`);
    const styles = new Set(opc.parts.map(p => p.style));
    for (const s of ['regular', 'bold', 'italic', 'boldItalic']) if (!styles.has(s)) warnings.push(`no ${s} part (PowerPoint embeds the styles the deck uses)`);
  } else if (report?.saved) failures.push('copy.pptx missing');
  failures.push(...opc.failures);
  return {item: 'FF-13', criterion: 'One supervised SaveAs of a copy with EmbedTrueTypeFonts into a fresh directory; the OPC audit shows exactly the chosen fonts (Carlito) embedded, and the source is unchanged.', attempt: path.basename(dir), verdict: failures.length ? 'FAIL' : 'PASS', failures, warnings,
    nativeFonts: {beforeSave: report?.fontsBeforeSave ?? null, afterReopen: report?.fontsAfterReopen ?? null}, powerpoint: report?.powerpoint ?? null, probes: supervisor?.probes ?? null, registration: registration?.faces?.map(f => ({file: f.file, sha256: f.sha256, added: f.added, removed: f.removed})) ?? null, opc};
}

// ------------------------------------------------------------------ output ------------------------------------------------------------------
const result = {schema: 'opf323-compare/v1', generated: new Date().toISOString(), native: path.relative(ROOT, nativeRoot).replace(/\\/g, '/'), packages: manifest.built.packages, items: {}};
if (only.has('ff12')) result.items.ff12 = compareFf12();
if (only.has('ff27')) result.items.ff27 = compareFf27();
if (only.has('ff46')) result.items.ff46 = await compareFf46();
if (only.has('ff46sa')) {
  // The five shipping families with the rule factors applied (scratch policy patch). Same criterion as FF-46: the ink median should now
  // sit near 1 and no box may overflow only natively.
  result.items.ff46sa = await compareFf46('ff46sa');
  result.items.ff46sa.item = 'FF-46 / opf#361 factor-applied re-run';
  result.items.ff46sa.patchedPolicy = manifest.sets.ff46sa?.patchedPolicy ?? null;
}
if (only.has('probe38')) result.items.probe38 = await compareProbe38();
if (only.has('probe38b')) {
  // Attempt 3: no controls deck; the single lines cross-check against attempt 2's corrected controls (compare-attempt-2-probe-corrected.json).
  const r = await compareProbe38('probe38b');
  const ATTEMPT2_SINGLE = {'Angsana New': 0.833, 'Sakkal Majalla': 0.761, 'Arabic Typesetting': 0.741};
  for (const f of r.families) { const ref = ATTEMPT2_SINGLE[f.family]; const v = median(f.perSize.single); f.control = ref === undefined ? null : {known: ref, reference: ref, referenceSource: 'attempt-2 corrected single-line median', ok: v !== null && Math.abs(v - ref) <= 0.03}; }
  r.controlsOk = r.families.every(f => !f.control || f.control.ok);
  r.item = 'opf#361 lineAscent probe, attempt 3 (mixed lines)';
  result.items.probe38b = r;
}
if (only.has('ff13')) result.items.ff13 = compareFf13();
// Relative paths only: no absolute host path leaves this script.
const scrub = value => JSON.parse(JSON.stringify(value).split(JSON.stringify(ROOT).slice(1, -1)).join('<set>'));
writeFileSync(outJson, `${JSON.stringify(scrub(result), null, 1)}\n`);

const L = [`# opf#323 native compare (0.18 packages)`, '', `Generated ${result.generated} from \`${result.native}\`. Packages: ${Object.entries(result.packages).map(([k, v]) => `\`${k}\` ${v}`).join(', ')}.`, ''];
const it = result.items;
if (it.ff12) {
  L.push('## RR-05 / FF-12', '', `Criterion: ${it.ff12.criterion}`, '', `**${it.ff12.summary.pass} PASS, ${it.ff12.summary.fail} FAIL, ${it.ff12.summary.missing} not run** of ${it.ff12.summary.decks}.`, '', '| Deck | Verdict | Presentation.Fonts (native) | Extras | Missing required | Soft, absent (accepted) | Theme slots | Runs | Run health |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const d of it.ff12.decks) { const c = d.checks; L.push(`| ${d.id} | ${d.verdict} | ${c?.presentationFonts.native.join(', ') ?? '-'} | ${c?.presentationFonts.extras.join(', ') || '-'} | ${c?.presentationFonts.missingRequired.join(', ') || '-'} | ${c?.presentationFonts.missingSoftAccepted.join(', ') || '-'} | ${c ? (c.themeSlots.ok ? 'ok' : 'FAIL') : '-'} | ${c ? (c.runNames.ok ? `ok (${c.runNames.runs})` : `FAIL ${c.runNames.foreign.map(f => f.name).join(', ')}`) : '-'} | ${d.health.ok ? 'ok' : d.health.problems.join('; ')} |`); }
  L.push('');
}
if (it.ff27) {
  L.push('## FF-27', '', `Criterion: ${it.ff27.criterion}`, '', `**${it.ff27.summary.pass} PASS, ${it.ff27.summary.fail} FAIL, ${it.ff27.summary.missing} not run** of ${it.ff27.summary.decks}.`, '');
  for (const d of it.ff27.decks) {
    L.push(`### ${d.id}: ${d.verdict}`, '', d.covers ?? '', '');
    if (d.dateField) L.push(`Date field: format \`${d.dateField.format}\`, host date ${d.dateField.hostDate} (${d.dateField.culture}), expected "${d.dateField.expectedToday}", cached at export "${d.dateField.cachedExportText}"; HeadersFooters.DateAndTime.Format ${d.dateField.nativeFormatCodes.join(', ')} (expected ${d.dateField.expectedPpFormat} where the date is the dt placeholder).`, '');
    L.push('| Step | Operation | Order | Slide numbers read | Numbers follow order | Date text | Date ok |', '| --- | --- | --- | --- | --- | --- | --- |');
    for (const s of d.steps) L.push(`| ${s.step} | ${s.operation || '-'} | ${s.order.map(t => String(t).replace(' slide', '')).join(', ')} | ${s.rows.map(r => r.numbers.map(n => n.text).join(' / ')).join('; ')} | ${s.numbersOk ? 'yes' : 'NO'} | ${[...new Set(s.rows.flatMap(r => r.dates))].join(', ')} | ${s.dateOk ? 'yes' : 'NO'} |`);
    if (d.note) L.push('', d.note);
    if (!d.health.ok) L.push('', `Run health: ${d.health.problems.join('; ')}`);
    L.push('');
  }
}
for (const [key, title] of [['ff46', 'FF-46 / RR-17'], ['ff46sa', 'FF-46 / opf#361 factor-applied re-run']]) if (it[key]) {
  const s = it[key].summary;
  L.push(`## ${title}`, '', ...(key === 'ff46sa' ? [`Patched policy rows (scratch, not committed): ${JSON.stringify(it[key].patchedPolicy)}`, ''] : []), `Criterion: ${it[key].criterion}`, '', `Decks: **${s.pass} PASS, ${s.finding} FINDING, ${s.fail} FAIL, ${s.missing} not run** of ${s.decks}. Families: ${s.familiesPass} of ${s.families} pass.`, '',
    '| Family | Outcome | Long-line ink (native / preview) | Reasons |', '| --- | --- | ---: | --- |');
  for (const f of it[key].families) L.push(`| ${f.family} | ${f.outcome} | ${f.longMedianRatio ?? '-'} | ${f.reasons.join('; ') || '-'} |`);
  L.push('', '| Deck | Verdict | Names | Lines (single / boxes) | Native-only overflow | Ink median (long) | Images close / review / far |', '| --- | --- | --- | --- | --- | --- | --- |');
  for (const d of it[key].decks) L.push(`| ${d.id} | ${d.verdict} | ${d.names ? (d.names.presentationFonts.ok && d.names.themeSlots.ok && d.names.runNames.ok ? 'ok' : 'FAIL') : '-'} | ${d.lines ? `${d.lines.singleLine} / ${d.lines.shapes}` : '-'} | ${d.lines?.nativeOnlyOverflow.length ?? '-'} | ${d.ink ? `${d.ink.medianRatio ?? '-'} (${d.ink.longMedianRatio ?? '-'})` : '-'} | ${d.images ? ['close', 'review', 'far'].map(b => d.images.filter(i => i.band === b).length).join(' / ') : '-'} |`);
  L.push('');
}
for (const pk of ['probe38', 'probe38b']) if (it[pk]) {
  L.push(`## ${it[pk].item}`, '', `Criterion: ${it[pk].criterion}`, '', `Controls / cross-check: ${it[pk].controlsOk ? 'reproduce their reference values' : '**do NOT reproduce their reference values; do not use the probe values**'}.`, '',
    '| Family | lineAscent (single, regular) | lineAscentMixed | Bold median | Single per size (18 / 24 / 32) | Mixed per size | Control |', '| --- | ---: | ---: | ---: | --- | --- | --- |');
  for (const f of it[pk].families) L.push(`| ${f.family} | ${f.lineAscent ?? '-'} | ${f.lineAscentMixed ?? '-'} | ${f.boldMedian ?? '-'} | ${f.perSize.single.join(' / ')} | ${f.perSize.mixed.join(' / ') || '-'} | ${f.control ? `reference ${f.control.reference}: ${f.control.ok ? 'ok' : 'OFF'}` : '-'} |`);
  L.push('');
}
if (it.ff13) {
  L.push('## FF-13', '', `Criterion: ${it.ff13.criterion ?? ''}`, '', `**${it.ff13.verdict}**${it.ff13.attempt ? ` (attempt ${it.ff13.attempt})` : ''}.${it.ff13.note ? ` ${it.ff13.note}` : ''}`, '');
  if (it.ff13.opc) { L.push(`Embedded typefaces: ${[...new Set(it.ff13.opc.typefaces)].join(', ') || 'none'}; parts: ${it.ff13.opc.parts.map(p => `${p.name} (${p.style}, ${p.identity?.family ?? '?'}, ${p.size} bytes)`).join('; ') || 'none'}.`, ''); }
  for (const f of it.ff13.failures ?? []) L.push(`- FAIL: ${f}`);
  for (const w of it.ff13.warnings ?? []) L.push(`- warning: ${w}`);
  L.push('');
}
writeFileSync(outMd, `${L.join('\n')}\n`);
console.log(Object.entries(result.items).map(([k, v]) => `${k}: ${v.summary ? JSON.stringify(v.summary) : v.verdict ?? (k.startsWith('probe38') ? `controls ${v.controlsOk ? 'ok' : 'OFF'}; ${v.families.map(f => `${f.family} ${f.lineAscent}/${f.lineAscentMixed}`).join(', ')}` : '')}`).join('\n'));
