#!/usr/bin/env node
// NT-12: `pnpm check:native-coverage` runs the four corpus rules of coverage.mjs on the repository and fails with what
// to do. Reads deck sources only (no build, no application).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLists, runChecks } from './coverage.mjs';
import { computeUnits, loadInputs } from './units.mjs';

export function summary({ analysis, rules }, lists) {
  const release = analysis.tiers.release;
  const lines = [
    `(a) known places: ${rules.known.failing.length} records have no place the release tier runs, ${lists.pending.records?.length ?? 0} on the pending list`,
    `(b) schema: ${release.covered.schema ?? 0} of ${analysis.totals.schema} locations on a corpus slide, ${rules.schema.gaps} not shown`,
    `(c) earned place: ${analysis.dominated.length} decks add no unit of their own, ${rules.dominated.unearned.length} of them named by no known record or feature`,
    `(d) budgets: ${Object.entries(analysis.tiers)
      .map(([tier, figures]) =>
        Object.entries(figures.time)
          .map(([application, { minutes, budgetMinutes }]) => `${application} ${tier} ${figures.size.files} files, ${figures.size.slides} slides, ${minutes.toFixed(1)} of ${budgetMinutes} min`)
          .join('; '),
      )
      .join('; ')}`,
  ];
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inputs = loadInputs();
  const lists = readLists();
  const result = runChecks(computeUnits(inputs), inputs, lists);
  console.log(`check:native-coverage\n${summary(result, lists)}`);
  if (result.problems.length) {
    console.error(`\n${result.problems.length} problem${result.problems.length === 1 ? '' : 's'}:\n${result.problems.map((problem) => `- ${problem}`).join('\n')}`);
    console.error('\nRun `pnpm report:native-coverage` for the whole picture; docs/native-testing.md, "Coverage and budgets", says how to add a deck or a slide.');
    process.exitCode = 1;
  }
}
