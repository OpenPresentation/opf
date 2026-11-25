// NT-04c: classify every slide of a native run against the known differences (known/<target>.json) and the baseline
// summary of an earlier run (runs/<opf version>/<target>.json). README.md beside this file says the rule in plain words.
//
// Per slide, with score = the picture difference against OPF's preview (NT-04a) and T = CALIBRATION.threshold:
//   a change names the slide (options.look)           -> new, whatever the score
//   no picture pair                                   -> not-compared
//   score <= T                                        -> same; a record that names the slide makes it known-gone
//   the baseline reviewed the slide and the score moved more than CALIBRATION.tolerance
//                                                     -> new, with a direction (up or down)
//   an open record names the slide                    -> known-present with those record ids
//   the baseline reviewed the slide (class other than new) and the score is within the tolerance
//                                                     -> known-present with the baseline's ids (the ambient ids when it had none)
//   otherwise                                         -> new
// File-level findings: open not done; an import-warning line; a failed import of the application's copy; object-outcome
// counts (kind x outcome) that differ from the baseline's while the exported objects per kind are the same. Each is
// known-present when a record or the baseline covers it, else new.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateResult, validateRun } from '../result/result.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const require = createRequire(path.join(root, 'packages/javascript/package.json'));

/**
 * The two numbers of the rule, calibrated on the 0.36.0 Keynote round (Keynote 16.0, macOS 26.6.2, 1,286 hand-graded slides;
 * README.md "Calibration" has the method and the full numbers).
 * threshold: no slide the round graded small or wrong scored at or below 0.005 (lowest: 0.00511, a SmartArt fallback
 *   picture; lowest wrong: 0.00771, a footer behind a picture); the slides graded same scored 0.0089 to 0.0708 (median
 *   0.015), because Keynote substitutes Helvetica for Aptos on nearly every slide. A higher T would call graded differences
 *   same and report their records gone; review of the slides above T is carried by the baseline instead.
 * tolerance: Keynote drew byte-identical pictures when the round opened 692 slides (layouts, languages, matrix) a second
 *   time (warnings-rerun), so the run-to-run noise is 0. 0.002 is the band NT-04a accepted between two implementations of
 *   the score on the same pictures, left as headroom for another Mac's color conversion; it is about one short word of
 *   1280 x 720.
 */
export const CALIBRATION = Object.freeze({ threshold: 0.005, tolerance: 0.002 });

export const CLASSES = Object.freeze(['same', 'known-present', 'known-gone', 'new', 'not-compared']);
/** One letter per class, for the summary's `classes` string. */
export const LETTERS = Object.freeze({ same: 's', 'known-present': 'k', 'known-gone': 'g', new: 'n', 'not-compared': '-' });
export const CLASS_OF_LETTER = Object.freeze(Object.fromEntries(Object.entries(LETTERS).map(([name, letter]) => [letter, name])));

/**
 * Export variants that are one export under two names: the qualification corpus calls `--body-text native` "native-body",
 * the rounds' decks and the known records call it "native".
 */
export const VARIANT_ALIASES = Object.freeze({ 'native-body': 'native' });
/** Features of a record with a scope that change how slides look everywhere: these are the ambient ids. */
export const AMBIENT_FEATURES = Object.freeze(['fonts', 'text', 'languages']);

const round5 = (value) => (value === null || value === undefined ? null : Math.round(value * 1e5) / 1e5);
const asList = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** True when a record's place names this export: an absent variant means default (known.schema.json says so). */
export function sameExport(placeVariant, fileVariant) {
  const named = placeVariant ?? 'default';
  return named === fileVariant || VARIANT_ALIASES[fileVariant] === named;
}

const compareVersions = (a, b) => {
  const x = String(a).split('.').map(Number);
  const y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

/**
 * The records the rule uses: open ones only (a retired difference that shows again is new), optionally only those first
 * seen before an OPF version (`knownBefore`, to replay an earlier release's knowledge).
 */
export function activeRecords(known, { knownBefore } = {}) {
  return (known?.records ?? []).filter((record) => record.status === 'open' && (!knownBefore || compareVersions(record.firstSeen.opf, knownBefore) < 0));
}

export const ambientIds = (records) => records.filter((record) => record.scope && AMBIENT_FEATURES.includes(record.feature)).map((record) => record.id);

/** The ids of the records whose `where` names deck, variant and slide. */
export function recordsNaming(records, { deck, variant }, slide) {
  return records.filter((record) => record.where.some((place) => place.deck === deck && place.slide === slide && sameExport(place.variant, variant))).map((record) => record.id);
}

/** The records that name the file at all (any slide). */
const recordsNamingFile = (records, { deck, variant }) => records.filter((record) => record.where.some((place) => place.deck === deck && sameExport(place.variant, variant)));

// "Unsupported media were removed. Slide Layout(s): Cover, …": the layouts and slides are a separate field of a warning line
// (NT-01), so a record's warning is compared without them.
const warningHead = (text) =>
  String(text)
    .split(/\s+Slide(?: Layout)?\(s\):/u)[0]
    .replace(/\s+/gu, ' ')
    .trim();

/** The ids of the records that explain an import-warning line. */
export function recordsExplaining(records, line) {
  const head = warningHead(line.text);
  return records.filter((record) => asList(record.warning).some((text) => warningHead(text) === head)).map((record) => record.id);
}

function* flatObjects(objects) {
  for (const object of objects ?? []) {
    yield object;
    if (object.objects) yield* flatObjects(object.objects);
  }
}

/** Object outcomes counted by "<kind>.<outcome>" (only determined outcomes), keys sorted; null when the round trip has not run. */
export function outcomeCounts(result) {
  const counts = {};
  for (const slide of result.slides) {
    for (const object of flatObjects(slide.objects)) {
      if (object.outcome === null || object.outcome === undefined) continue;
      const key = `${object.kind}.${object.outcome}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  const keys = Object.keys(counts).sort();
  return keys.length === 0 ? null : Object.fromEntries(keys.map((key) => [key, counts[key]]));
}

function outcomeDelta(before, now) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(now)])].sort();
  return keys.filter((key) => (before[key] ?? 0) !== (now[key] ?? 0)).map((key) => `${key} ${before[key] ?? 0} -> ${now[key] ?? 0}`);
}

const REVIEWED = new Set(['same', 'known-present', 'known-gone']);

/**
 * One slide by the rule. `base` is the baseline's slide ({ class, score, known }) or null, `baseOpf` the baseline's OPF
 * version, `look` the reason a change names the slide (or null).
 */
export function classifySlide({ score, named, base, baseOpf = null, ambient, threshold, tolerance, look = null }) {
  const theBaseline = baseOpf ? `the ${baseOpf} baseline` : 'the baseline';
  if (look) return { class: 'new', known: named, reasons: [`named by a change: ${look}`] };
  if (score === null || score === undefined) return { class: 'not-compared', known: [], reasons: [] };
  if (score <= threshold) {
    if (named.length > 0) return { class: 'known-gone', known: named, reasons: [`score ${score} <= ${threshold}: the named records no longer show`] };
    return { class: 'same', known: [], reasons: [] };
  }
  const reviewed = base && REVIEWED.has(base.class) && base.score !== null && base.score !== undefined;
  if (reviewed && round5(Math.abs(score - base.score)) > tolerance) {
    const direction = score > base.score ? 'up' : 'down';
    return { class: 'new', known: named, direction, reasons: [`moved since ${theBaseline}: ${base.score} → ${score}`] };
  }
  if (named.length > 0) return { class: 'known-present', known: named, reasons: ['a known record names this slide'] };
  if (reviewed) {
    const known = base.known?.length ? base.known : ambient;
    return { class: 'known-present', known, reasons: [`reviewed in ${theBaseline} (${base.class}, score ${base.score}), unchanged within ${tolerance}`] };
  }
  if (!base) return { class: 'new', known: [], reasons: [`score ${score} > ${threshold}, no record names this slide and the baseline does not have it`] };
  if (base.class === 'new') return { class: 'new', known: [], reasons: [`score ${score} > ${threshold}, no record names this slide and the baseline left it new`] };
  return { class: 'new', known: [], reasons: [`score ${score} > ${threshold}, no record names this slide and the baseline did not compare it`] };
}

/** The import error's code: the text before the first colon of `resave.import.error` ("invalid-chart-cache: …"). */
export const importCode = (error) => {
  const match = /^([a-z0-9-]+)(?::|$)/u.exec(String(error ?? '').trim());
  return match ? match[1] : null;
};

/** Exported objects per kind: the outcome counts summed over the four outcomes. */
export function kindTotals(outcomes) {
  const totals = {};
  for (const [key, count] of Object.entries(outcomes ?? {})) {
    const kind = key.split('.')[0];
    totals[kind] = (totals[kind] ?? 0) + count;
  }
  return totals;
}
const sameCounts = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? 0) === (b[key] ?? 0));
};

/** The slides a change names, from "deck#slide" strings or { deck, slide, reason } objects: Map "<deck>#<slide>" -> reason. */
export function lookList(items = []) {
  const map = new Map();
  for (const item of items) {
    const value = typeof item === 'string' ? { deck: item.split('#')[0], slide: Number(item.split('#')[1]) } : item;
    if (!value.deck || !Number.isInteger(value.slide) || value.slide < 1) throw new Error(`look: "${typeof item === 'string' ? item : JSON.stringify(item)}" is not deck#slide`);
    map.set(`${value.deck}#${value.slide}`, value.reason ?? 'listed to look at');
  }
  return map;
}

/**
 * Classifies results in memory (pure; the tests call this).
 *   classifyResults({ results, known, baseline, options: { threshold, tolerance, knownBefore, look } })
 * `baseline` is readBaseline's value or null; `options.look` the slides a change names ("deck#slide" or { deck, slide, reason },
 * every variant of the deck). Returns the classify.json value without run facts.
 */
export function classifyResults({ results, known, baseline = null, options = {} }) {
  const threshold = options.threshold ?? CALIBRATION.threshold;
  const tolerance = options.tolerance ?? CALIBRATION.tolerance;
  const records = activeRecords(known, options);
  const ids = new Set(records.map((record) => record.id));
  const ambient = ambientIds(records);
  const look = lookList(options.look);
  const baseOpf = baseline?.opf?.version ?? null;
  const baseWarnings = new Set((baseline?.warnings ?? []).map((line) => warningHead(line.text)));
  const files = [];
  const knownGone = [];
  for (const result of results) {
    const { id, deck, variant } = result.file;
    const base = baseline?.files.get(id) ?? null;
    const slides = result.slides.map((slide) => {
      const score = slide.compare ? round5(slide.compare.score) : null;
      const named = recordsNaming(records, result.file, slide.index);
      const baseSlide = base ? (base.slides[slide.index - 1] ?? null) : null;
      const baseKnown = baseSlide ? { ...baseSlide, known: baseSlide.known.filter((known) => ids.has(known)) } : null;
      const classified = classifySlide({ score, named, base: baseKnown, baseOpf, ambient, threshold, tolerance, look: look.get(`${deck}#${slide.index}`) ?? null });
      if (classified.class === 'not-compared') classified.reasons = !slide.compare ? [slide.picture ? 'not compared yet (the compare step has not run)' : 'no picture of this slide'] : [slide.compare.note];
      for (const record of classified.class === 'known-gone' ? classified.known : []) knownGone.push({ record, deck, variant, slide: slide.index });
      const entry = { index: slide.index, class: classified.class, score, known: classified.known, reasons: classified.reasons };
      if (classified.direction) entry.direction = classified.direction;
      return entry;
    });
    const findings = [];
    const notes = [];
    const open = result.verbs.open;
    if (open.status !== 'done') {
      const covered = base && base.open === open.status;
      findings.push({ kind: 'open', class: covered ? 'known-present' : 'new', known: [], text: `open ${open.status}${open.message ? `: ${open.message}` : ''}`, reasons: [covered ? `the baseline's open was ${base.open} too` : 'the baseline does not have this file with that status'] });
    }
    for (const line of open.warnings.lines) {
      const explaining = recordsExplaining(records, line);
      const inBaseline = baseWarnings.has(warningHead(line.text));
      const cls = explaining.length > 0 || inBaseline ? 'known-present' : 'new';
      const reasons = explaining.length > 0 ? ['a known record explains this warning'] : inBaseline ? ["the baseline's warnings have this line"] : ['no record explains this warning and the baseline does not have it'];
      findings.push({ kind: 'warning', class: cls, known: explaining, text: line.text, reasons });
    }
    const imported = result.verbs.resave.import;
    if (imported?.status === 'failed') {
      const code = importCode(imported.error);
      const covering = recordsNamingFile(records, result.file)
        .filter((record) => code && record.importError === code)
        .map((record) => record.id);
      const inBaseline = base?.import === 'failed' && base.importError === code;
      const cls = covering.length > 0 || inBaseline ? 'known-present' : 'new';
      const reasons =
        covering.length > 0 ? [`a known record names this file with importError ${code}`] : inBaseline ? [`the baseline's import of this file failed the same way (${code})`] : [`no record names this file with importError ${code ?? '(no code)'} and the baseline's import did not fail that way`];
      findings.push({ kind: 'import', class: cls, known: covering, text: imported.error ?? 'import failed', reasons });
    }
    const outcomes = outcomeCounts(result);
    if (outcomes && base?.outcomes) {
      if (sameCounts(kindTotals(base.outcomes), kindTotals(outcomes))) {
        const delta = outcomeDelta(base.outcomes, outcomes);
        if (delta.length > 0) findings.push({ kind: 'outcomes', class: 'new', known: [], text: `object outcomes differ from the baseline: ${delta.join(', ')}`, reasons: delta });
      } else notes.push('content changed since the baseline; outcome counts not compared');
    }
    files.push({ id, deck, variant, open: open.status, slides, findings, notes, outcomes });
  }
  const counts = { files: files.length, slides: Object.fromEntries(CLASSES.map((name) => [name, 0])), findings: { 'known-present': 0, new: 0 } };
  for (const file of files) {
    for (const slide of file.slides) counts.slides[slide.class] += 1;
    for (const finding of file.findings) counts.findings[finding.class] += 1;
  }
  counts.new = counts.slides.new + counts.findings.new;
  return { settings: { threshold, tolerance, knownBefore: options.knownBefore ?? null, look: look.size }, counts, files: files.map(({ outcomes, ...file }) => file), knownGone, outcomes: Object.fromEntries(files.map((file) => [file.id, file.outcomes])) };
}

export const classifySchema = JSON.parse(readFileSync(path.join(here, 'native-classify.schema.json'), 'utf8'));
let validator;
/** Checks a classify.json value against native-classify.schema.json. Returns { ok, errors }. */
export function validateClassify(value) {
  if (!validator) {
    const Ajv = require('ajv/dist/2020.js').default;
    validator = new Ajv({ strict: false, allErrors: true, allowUnionTypes: true }).compile(classifySchema);
  }
  const ok = validator(value);
  return { ok, errors: ok ? [] : validator.errors.map((error) => `${error.instancePath || '/'}: ${error.message}`) };
}

/** A run directory that cannot be classified: exit 2. */
export class UnusableRun extends Error {}

/** Reads run.json and every result.json of a run directory, validated; throws UnusableRun when it cannot. */
export function readRun(runDir) {
  const runFile = path.join(runDir ?? '', 'run.json');
  if (!runDir || !existsSync(runFile)) throw new UnusableRun(`no run.json in ${runDir}`);
  const run = readJson(runFile);
  const checked = validateRun(run);
  if (!checked.ok) throw new UnusableRun(`run.json is not valid:\n${checked.errors.join('\n')}`);
  if (run.check.status !== 'ready') throw new UnusableRun(`the run was refused: ${run.check.reasons.join('; ') || 'no reason given'}`);
  const results = run.files.map((entry) => {
    const file = path.join(runDir, entry.result);
    if (!existsSync(file)) throw new UnusableRun(`${entry.result} is missing`);
    const result = readJson(file);
    const valid = validateResult(result);
    if (!valid.ok) throw new UnusableRun(`${entry.result} is not valid:\n${valid.errors.join('\n')}`);
    return result;
  });
  const pictures = results.flatMap((result) => result.slides.filter((slide) => slide.picture));
  if (pictures.length > 0 && pictures.every((slide) => !slide.compare)) throw new UnusableRun('no slide has been compared yet: run core/compare/compare-run.mjs first');
  return { run, results };
}

/**
 * Classifies a run directory and writes <run>/classify.json.
 *   classifyRun({ runDir, known, baseline, options }) -> the classify.json value
 * `known` is the parsed known/<target>.json, `baseline` readBaseline's value or null.
 */
export function classifyRun({ runDir, known, baseline = null, options = {} }) {
  const { run, results } = readRun(runDir);
  if (known && known.target !== run.target) throw new UnusableRun(`the known records are for ${known.target}, the run for ${run.target}`);
  if (baseline && baseline.target !== run.target) throw new UnusableRun(`the baseline is for ${baseline.target}, the run for ${run.target}`);
  const { outcomes, ...classified } = classifyResults({ results, known, baseline, options });
  const value = {
    schemaVersion: 1,
    target: run.target,
    application: run.application,
    opf: run.opf,
    tier: run.tier,
    baseline: baseline ? { opf: baseline.opf.version, date: baseline.date } : null,
    ...classified,
  };
  const valid = validateClassify(value);
  if (!valid.ok) throw new Error(`classify.json would not be valid:\n${valid.errors.join('\n')}`);
  writeFileSync(path.join(runDir, 'classify.json'), `${JSON.stringify(value, null, 2)}\n`);
  return value;
}
