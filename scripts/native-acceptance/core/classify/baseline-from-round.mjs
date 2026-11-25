#!/usr/bin/env node
// NT-04c: a one-time importer. It writes a baseline summary (native-summary.schema.json) from run directories of a recorded
// round (apps/keynote/import-recorded.mjs, then core/compare/compare-run.mjs and core/roundtrip/roundtrip-run.mjs) and that
// round's hand grades, so the 0.36.0 Keynote round, graded by people looking at sheets before the classifier existed, is the
// first baseline (runs/0.36.0/keynote.json). Later baselines are written from a reviewed classify.json (README.md).
//
//   node scripts/native-acceptance/core/classify/baseline-from-round.mjs --run <dir> [--run <dir> ...] --known <file>
//        --out <summary.json> [--grades <grades.json> ...] [--ungraded reviewed] [--known-before <opf version>] [--note <text>]
//
// A graded slide's class: grade "same" -> same; "small" or "wrong" -> known-present with the open records that name the
// slide (`where`) or carry the row's finding id; with none of those and a known text "font substituted" -> known-present
// with the ambient records (the missing fonts); with none at all -> known-present without ids, and the slide is listed
// ("reviewed, no record"). A hidden slide has no picture: not-compared. --ungraded reviewed takes every slide without a
// grade as reviewed: same at or below the threshold, else known-present with the ambient ids (the plain rule used to replay
// an earlier release as a baseline); without it an ungraded slide is an error.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { fileId } from '../result/result.mjs';
import { activeRecords, ambientIds, CALIBRATION, readRun, recordsNaming, VARIANT_ALIASES } from './classify.mjs';
import { summarize, writeSummary } from './summary.mjs';

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/**
 * The file id a grades.json row refers to among `ids`. The round wrote the deck and variant two ways: deck "layouts-lots",
 * mode "native"; or deck "diagrams~picture", mode "picture" (corpus variants). Mode "native" of a corpus deck is the export
 * the qualification manifest calls "native-body".
 */
export function gradedFileId(row, ids) {
  const [deck, named] = row.deck.split('~');
  const variant = named ?? String(row.mode).split('~')[0];
  const candidates = [fileId(deck, variant), ...Object.entries(VARIANT_ALIASES).filter(([, alias]) => alias === variant).map(([name]) => fileId(deck, name))];
  return candidates.find((id) => ids.has(id)) ?? null;
}

/**
 * The classified files of a set of results from grades.
 *   classesFromGrades({ results, grades, known, ungraded, threshold, knownBefore }) -> { classified, unplaced, unmatched, ties }
 * `unplaced`: graded slides placed without a record id or without a picture, with why. `unmatched`: grade rows no file
 * has. `ties`: record id -> ["<fileId>#<slide>"], what the grades tie to each record.
 */
export function classesFromGrades({ results, grades = [], known, ungraded = null, threshold = CALIBRATION.threshold, knownBefore }) {
  const records = activeRecords(known, { knownBefore });
  const byFinding = new Map();
  for (const record of records) if (record.finding) byFinding.set(record.finding, record.id);
  const ambient = ambientIds(records);
  const ids = new Set(results.map((result) => result.file.id));
  const graded = new Map();
  const unmatched = [];
  for (const row of grades) {
    const id = gradedFileId(row, ids);
    if (id === null) unmatched.push(row);
    else graded.set(`${id}#${row.slide}`, row);
  }
  const unplaced = [];
  const ties = {};
  const classified = results.map((result) => {
    const slides = result.slides.map((slide) => {
      const score = slide.compare?.score ?? null;
      const row = graded.get(`${result.file.id}#${slide.index}`);
      const where = `${result.file.id}#${slide.index}`;
      const place = (cls, knownIds = []) => {
        for (const id of knownIds) {
          ties[id] ??= [];
          ties[id].push(where);
        }
        return { index: slide.index, class: cls, score, known: knownIds };
      };
      if (!row) {
        if (ungraded !== 'reviewed') throw new Error(`baseline-from-round: ${where} has no grade (pass --ungraded reviewed to take ungraded slides as reviewed)`);
        if (score === null) return place('not-compared');
        return score <= threshold ? place('same') : place('known-present', ambient);
      }
      if (score === null) {
        unplaced.push({ slide: where, grade: row.grade, why: `no picture pair (${slide.compare?.note ?? 'not compared'}): not-compared` });
        return place('not-compared');
      }
      if (row.grade === 'same') return place('same');
      const named = new Set(recordsNaming(records, result.file, slide.index));
      for (const finding of String(row.finding).split(/[;,]\s*/u).filter(Boolean)) {
        if (byFinding.has(finding)) named.add(byFinding.get(finding));
      }
      if (named.size > 0) return place('known-present', [...named]);
      if (/font substituted/iu.test(row.known)) return place('known-present', ambient);
      const said = [row.finding && `finding ${row.finding} has no open record`, row.known && `known "${row.known}"`, row.what && `"${row.what}"`].filter(Boolean).join('; ');
      unplaced.push({ slide: where, grade: row.grade, why: `reviewed, no record: ${said}` });
      return place('known-present');
    });
    return { id: result.file.id, slides };
  });
  return { classified, unplaced, unmatched, ties };
}

export function parseArgs(argv) {
  const options = { runs: [], grades: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      const next = argv[++index];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      return next;
    };
    if (arg === '--run') options.runs.push(value());
    else if (arg === '--grades') options.grades.push(value());
    else if (arg === '--known') options.known = value();
    else if (arg === '--out') options.out = value();
    else if (arg === '--ungraded') options.ungraded = value();
    else if (arg === '--known-before') options.knownBefore = value();
    else if (arg === '--note') options.note = value();
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

function main(argv) {
  const options = parseArgs(argv);
  if (options.help || options.runs.length === 0 || !options.known || !options.out) {
    console.log('usage: baseline-from-round.mjs --run <dir> [--run <dir> ...] --known <file> --out <summary.json> [--grades <grades.json> ...] [--ungraded reviewed] [--known-before <opf version>] [--note <text>]');
    return options.help ? 0 : 2;
  }
  const runs = options.runs.map((dir) => readRun(dir));
  const [first] = runs;
  for (const other of runs.slice(1)) {
    for (const key of ['target', 'application', 'system', 'opf']) {
      if (JSON.stringify(other.run[key]) !== JSON.stringify(first.run[key])) throw new Error(`baseline-from-round: the runs differ in ${key}`);
    }
  }
  const results = runs.flatMap((item) => item.results);
  const grades = options.grades.flatMap((file) => readJson(file));
  const known = readJson(options.known);
  const { classified, unplaced, unmatched, ties } = classesFromGrades({ results, grades, known, ungraded: options.ungraded ?? null, knownBefore: options.knownBefore });
  const finished = runs.map((item) => item.run.finished).sort().at(-1);
  const run = { ...first.run, finished, tier: null };
  const summary = summarize({ run, results, classified, note: options.note, settings: CALIBRATION });
  writeSummary(options.out, summary);
  console.log(`${summary.counts.files} files; slides: ${Object.entries(summary.counts.slides).map(([name, count]) => `${count} ${name}`).join(', ')}; ${grades.length} grade rows`);
  for (const row of unmatched) console.log(`unmatched grade: ${row.deck} ${row.mode} slide ${row.slide}`);
  for (const item of unplaced) console.log(`placed without a record: ${item.slide} (${item.grade}): ${item.why}`);
  console.log(`ties: ${JSON.stringify(Object.fromEntries(Object.entries(ties).map(([id, list]) => [id, list.length])))}`);
  return unmatched.length > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
}
