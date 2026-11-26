// NT-04c: the small committed summary of a classified native run (runs/<opf version>/<target>.json), schema
// native-summary.schema.json, and readBaseline, which turns one back into the lookup the classifier uses.
//
// Per file one line: { id, sha256, open, slideCount, scores: [..], classes: "skgn-", known: { "<slide>": [ids] },
// import?, importError?, outcomes? }. The exported objects per kind are the outcome counts summed per kind, so they need no
// field of their own. classes has one letter per slide (s same, k known-present, g known-gone, n new, - not-compared);
// scores are rounded to 5 places, null where the slide was not compared.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASS_OF_LETTER, CLASSES, importCode, LETTERS, outcomeCounts } from './classify.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const require = createRequire(path.join(root, 'packages/javascript/package.json'));

export const summarySchema = JSON.parse(readFileSync(path.join(here, 'native-summary.schema.json'), 'utf8'));
let validator;
/** Checks a summary against native-summary.schema.json and what the schema cannot say. Returns { ok, errors }. */
export function validateSummary(value) {
  if (!validator) {
    const Ajv = require('ajv/dist/2020.js').default;
    validator = new Ajv({ strict: false, allErrors: true, allowUnionTypes: true }).compile(summarySchema);
  }
  const errors = validator(value) ? [] : validator.errors.map((error) => `${error.instancePath || '/'}: ${error.message}`);
  if (errors.length === 0) {
    const seen = new Set();
    value.files.forEach((file, position) => {
      if (seen.has(file.id)) errors.push(`/files/${position}/id: "${file.id}" is listed twice`);
      seen.add(file.id);
      if (file.classes.length !== file.scores.length) errors.push(`/files/${position}: ${file.classes.length} classes but ${file.scores.length} scores`);
      if (file.slideCount !== null && file.slideCount !== file.scores.length) errors.push(`/files/${position}: slideCount ${file.slideCount} but ${file.scores.length} scores`);
      for (const slide of Object.keys(file.known)) {
        if (Number(slide) > file.classes.length) errors.push(`/files/${position}/known/${slide}: the file has ${file.classes.length} slides`);
      }
    });
  }
  return { ok: errors.length === 0, errors };
}

const round5 = (value) => (value === null || value === undefined ? null : Math.round(value * 1e5) / 1e5);

/**
 * The summary of classified results.
 *   summarize({ run, results, classified, date?, note?, settings }) -> summary
 * `run` is the run.json value (target, application, system, opf, tier, finished), `results` the result.json values,
 * `classified` the classify.json `files` (matched by id), `settings` the classify settings.
 */
export function summarize({ run, results, classified, date, note, settings }) {
  const byId = new Map(classified.map((file) => [file.id, file]));
  const warnings = new Map();
  const counts = { files: results.length, slides: Object.fromEntries(CLASSES.map((name) => [name, 0])) };
  const files = results.map((result) => {
    const file = byId.get(result.file.id);
    if (!file) throw new Error(`summarize: ${result.file.id} was not classified`);
    for (const text of new Set(result.verbs.open.warnings.lines.map((line) => line.text))) warnings.set(text, (warnings.get(text) ?? 0) + 1);
    const known = {};
    for (const slide of file.slides) {
      counts.slides[slide.class] += 1;
      if (slide.known.length > 0) known[slide.index] = slide.known;
    }
    const entry = {
      id: result.file.id,
      sha256: result.file.sha256,
      open: result.verbs.open.status,
      slideCount: result.slides.length,
      scores: file.slides.map((slide) => round5(slide.score)),
      classes: file.slides.map((slide) => LETTERS[slide.class]).join(''),
      known,
    };
    if (result.verbs.resave.import) entry.import = result.verbs.resave.import.status;
    if (result.verbs.resave.import?.status === 'failed' && importCode(result.verbs.resave.import.error)) entry.importError = importCode(result.verbs.resave.import.error);
    const outcomes = outcomeCounts(result);
    if (outcomes) entry.outcomes = outcomes;
    return entry;
  });
  const summary = {
    schemaVersion: 1,
    target: run.target,
    application: run.application,
    system: run.system,
    opf: run.opf,
    tier: run.tier ?? null,
    date: date ?? String(run.finished).slice(0, 10),
  };
  if (note) summary.note = note;
  summary.settings = { threshold: settings.threshold, tolerance: settings.tolerance };
  summary.counts = counts;
  summary.warnings = [...warnings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([text, count]) => ({ text, files: count }));
  summary.files = files;
  return summary;
}

/** The summary as text: the head pretty-printed, one line per warning and per file (small diffs between releases). */
export function formatSummary(summary) {
  const { warnings, files, ...head } = summary;
  const headText = JSON.stringify(head, null, 2).replace(/\n\}$/u, '');
  const list = (items) => (items.length === 0 ? '[]' : `[\n${items.map((item) => `    ${JSON.stringify(item)}`).join(',\n')}\n  ]`);
  return `${headText},\n  "warnings": ${list(warnings)},\n  "files": ${list(files)}\n}\n`;
}

export function writeSummary(file, summary) {
  const valid = validateSummary(summary);
  if (!valid.ok) throw new Error(`the summary is not valid:\n${valid.errors.join('\n')}`);
  writeFileSync(file, formatSummary(summary));
}

/** A parsed summary as the classifier reads it: `files` a Map of id -> { open, import, outcomes, slides: [{ class, score, known }] }. */
export function baselineOf(summary) {
  const valid = validateSummary(summary);
  if (!valid.ok) throw new Error(`the baseline is not a valid summary:\n${valid.errors.join('\n')}`);
  const files = new Map(
    summary.files.map((file) => [
      file.id,
      {
        open: file.open,
        import: file.import ?? null,
        importError: file.importError ?? null,
        outcomes: file.outcomes ?? null,
        slides: [...file.classes].map((letter, position) => ({ class: CLASS_OF_LETTER[letter], score: file.scores[position], known: file.known[position + 1] ?? [] })),
      },
    ]),
  );
  return { ...summary, files };
}

/** Reads and validates a committed summary for use as a baseline. */
export function readBaseline(file) {
  return baselineOf(JSON.parse(readFileSync(file, 'utf8')));
}
