#!/usr/bin/env node
// NT-04b: the round-trip step over one run directory in the NT-01 format (core/result/README.md).
//
//   node scripts/native-acceptance/core/roundtrip/roundtrip-run.mjs <run dir> --inputs <input root> [--no-import] [--json]
//
// Per file: inspect the exported .pptx (<input root>/<result.file.path>) and the application's copy
// (files/<id>/resaved.pptx), compute what every exported object became, merge that into result.json, import the copy
// with OPF (verbs.resave.import), validate, and write result.json back. Prints a table of kind by outcome over all files.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateResult } from '../result/result.mjs';
import { importResaved } from './import.mjs';
import { countOutcomes, mergeOutcomes, OUTCOME_NAMES, objectOutcomes } from './outcomes.mjs';

function resultFiles(runDir) {
  const runFile = path.join(runDir, 'run.json');
  if (existsSync(runFile)) return JSON.parse(readFileSync(runFile, 'utf8')).files.map((file) => path.join(runDir, file.result));
  const files = path.join(runDir, 'files');
  return readdirSync(files)
    .sort()
    .map((id) => path.join(files, id, 'result.json'))
    .filter(existsSync);
}

/**
 * roundTripRun(runDir, inputRoot, { importCopies = true, importer = importResaved }) -> { files: [{ id, status, import, objects }], records }
 * status: "done", or "not-run" with a reason when the file has no copy. records: every outcome record with its file and
 * `row` (the kind; "text (empty box)" and "hidden slide" apart), for counting.
 */
export function roundTripRun(runDir, inputRoot, { importCopies = true, importer = importResaved } = {}) {
  const files = [];
  const records = [];
  for (const resultFile of resultFiles(runDir)) {
    const result = JSON.parse(readFileSync(resultFile, 'utf8'));
    const folder = path.dirname(resultFile);
    const exported = path.join(inputRoot, result.file.path);
    const resave = result.verbs.resave;
    const copy = path.join(folder, resave.path ?? 'resaved.pptx');
    const entry = { id: result.file.id };
    if (resave.status !== 'done' || !existsSync(copy)) {
      entry.status = 'not-run';
      entry.reason = resave.status !== 'done' ? `resave ${resave.status}` : 'no resaved.pptx';
      resave.import = { status: 'not-run', error: `no copy to import (${entry.reason})` };
    } else if (!existsSync(exported)) {
      entry.status = 'not-run';
      entry.reason = `the exported file ${result.file.path} is not under the input root`;
      resave.import = importCopies ? importer(copy) : { status: 'not-run', error: 'import not asked for' };
    } else {
      const outcomes = objectOutcomes(exported, copy, { target: result.target });
      mergeOutcomes(result, outcomes);
      // Empty text boxes are their own row: dropping a blank line loses nothing visible.
      for (const record of outcomes.objects) records.push({ ...record, file: entry.id, row: record.empty ? 'text (empty box)' : record.kind });
      for (const slide of outcomes.slides) if (slide.hidden) records.push({ file: entry.id, slide: slide.index, kind: 'hidden slide', row: 'hidden slide', label: 'hidden slide', outcome: slide.hidden.outcome });
      entry.status = 'done';
      entry.objects = outcomes.objects.length;
      entry.added = outcomes.added.length;
      resave.import = importCopies ? importer(copy) : { status: 'not-run', error: 'import not asked for' };
    }
    entry.import = resave.import;
    const { ok, errors } = validateResult(result);
    if (!ok) throw new Error(`${resultFile}: ${errors.join('; ')}`);
    writeFileSync(resultFile, `${JSON.stringify(result, null, 2)}\n`);
    files.push(entry);
  }
  return { files, records };
}

/** A plain-text table of kind by outcome. */
export function formatTable(counts) {
  const header = ['kind', ...OUTCOME_NAMES];
  const rows = Object.entries(counts).map(([kind, row]) => [kind, ...OUTCOME_NAMES.map((outcome) => String(row[outcome] ?? 0))]);
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map((row) => row[column].length)));
  const line = (cells) => cells.map((cell, column) => (column === 0 ? cell.padEnd(widths[column]) : cell.padStart(widths[column]))).join('  ');
  return [line(header), ...rows.map(line)].join('\n');
}

function main(argv) {
  const args = [...argv];
  const take = (flag) => {
    const at = args.indexOf(flag);
    if (at < 0) return undefined;
    const [, value] = args.splice(at, 2);
    return value;
  };
  const has = (flag) => {
    const at = args.indexOf(flag);
    if (at >= 0) args.splice(at, 1);
    return at >= 0;
  };
  const inputs = take('--inputs');
  const importCopies = !has('--no-import');
  const json = has('--json');
  const [runDir] = args;
  if (!runDir || !inputs) {
    console.error('usage: roundtrip-run.mjs <run dir> --inputs <input root> [--no-import] [--json]');
    return 2;
  }
  const { files, records } = roundTripRun(path.resolve(runDir), path.resolve(inputs), { importCopies });
  const counts = countOutcomes(records, 'row');
  if (json) {
    console.log(JSON.stringify({ files, counts, labels: countOutcomes(records, 'label') }, null, 2));
    return 0;
  }
  console.log(formatTable(counts));
  const failed = files.filter((file) => file.import?.status === 'failed');
  console.log(`\n${files.length} files, ${files.filter((file) => file.status === 'done').length} compared; import: ${files.filter((file) => file.import?.status === 'imported').length} imported, ${failed.length} failed, ${files.filter((file) => file.import?.status === 'not-run').length} not run`);
  for (const file of failed) console.log(`  ${file.id}: ${file.import.error}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
