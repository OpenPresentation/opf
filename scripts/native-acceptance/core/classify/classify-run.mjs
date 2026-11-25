#!/usr/bin/env node
// NT-04c: classify a native run directory and write <run>/classify.json.
//
//   node scripts/native-acceptance/core/classify/classify-run.mjs --run <dir> --known <known/<target>.json>
//        [--baseline <runs/<version>/<target>.json>] [--sheets] [--known-before <opf version>]
//        [--look deck#slide,deck#slide] [--look-file <json>]
//
// --look and --look-file name slides a change touched (the `native:` slides of unreleased changelog fragments; the
// runner passes them): each is new whatever its score. The file holds an array of "deck#slide" or { deck, slide, reason }.
// Prints the counts and every new slide and finding. --sheets writes a labeled sheet (NT-04a's slideSheet) per new slide
// into <run>/sheets/. --known-before uses only the known records first seen before that OPF version.
// Exit: 0 nothing new, 1 something new (someone looks, then records it or fixes it), 2 the run directory is unusable.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slideSheet } from '../compare/sheet.mjs';
import { classifyRun, UnusableRun } from './classify.mjs';
import { readBaseline } from './summary.mjs';

export function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      const next = argv[++index];
      if (next === undefined) throw new UnusableRun(`${arg} needs a value`);
      return next;
    };
    if (arg === '--run') options.run = value();
    else if (arg === '--known') options.known = value();
    else if (arg === '--baseline') options.baseline = value();
    else if (arg === '--known-before') options.knownBefore = value();
    else if (arg === '--sheets') options.sheets = true;
    else if (arg === '--look') options.look = [...(options.look ?? []), ...value().split(',').filter(Boolean)];
    else if (arg === '--look-file') options.lookFile = value();
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new UnusableRun(`unknown argument ${arg}`);
  }
  return options;
}

const USAGE = 'usage: classify-run.mjs --run <dir> --known <file> [--baseline <summary.json>] [--sheets] [--known-before <opf version>] [--look deck#slide,...] [--look-file <json>]';

/** Runs the command; returns the exit code. `log` receives every printed line. */
export async function main(argv, { log = console.log } = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    log(error.message);
    return 2;
  }
  if (options.help) {
    log(USAGE);
    return 0;
  }
  if (!options.run || !options.known) {
    log(USAGE);
    return 2;
  }
  let classified;
  try {
    const known = JSON.parse(readFileSync(options.known, 'utf8'));
    const baseline = options.baseline ? readBaseline(options.baseline) : null;
    const look = [...(options.look ?? []), ...(options.lookFile ? JSON.parse(readFileSync(options.lookFile, 'utf8')) : [])];
    classified = classifyRun({ runDir: options.run, known, baseline, options: { knownBefore: options.knownBefore, look } });
  } catch (error) {
    log(error instanceof UnusableRun || error.code === 'ENOENT' ? `unusable: ${error.message}` : `unusable: ${error.stack ?? error.message}`);
    return 2;
  }
  const { counts } = classified;
  log(`${counts.files} files; slides: ${Object.entries(counts.slides).map(([name, count]) => `${count} ${name}`).join(', ')}`);
  log(`file findings: ${counts.findings['known-present']} known-present, ${counts.findings.new} new; known-gone: ${classified.knownGone.length}`);
  for (const file of classified.files) {
    for (const slide of file.slides.filter((item) => item.class === 'new')) {
      log(`new: ${file.id} slide ${slide.index} (score ${slide.score}${slide.direction ? `, ${slide.direction}` : ''}): ${slide.reasons.join('; ')}`);
      if (options.sheets && slide.score !== null) {
        const written = await slideSheet(options.run, file.id, slide.index, { caption: slide.reasons.join('; ') });
        log(`  sheet: ${path.relative(options.run, written)}`);
      }
    }
    for (const finding of file.findings.filter((item) => item.class === 'new')) log(`new: ${file.id} ${finding.kind}: ${finding.text}`);
  }
  return counts.new > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error.stack ?? error.message);
      process.exit(2);
    },
  );
}
