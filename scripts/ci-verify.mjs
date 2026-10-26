#!/usr/bin/env node
// MR-30: the `verify` aggregator of .github/workflows/ci.yml (docs/programs/monorepo/README.md, section 4).
//
// `verify` is the one required check. It `needs` `scope` and `check` (the one matrix job that holds every leg of every job the
// scope selected, so a job the scope did not select has no leg and no "skipped" check) and runs always; this script decides its
// verdict from the `needs` context, the scope's `jobs` map and its `legs` (scripts/ci-scope.mjs):
//   - a job the scope selected (tier full or contract) must have at least one leg in the matrix, and `check`, the aggregate of
//     every leg, must have succeeded (one red, cancelled or skipped leg makes it not succeed);
//   - a job the scope skipped must have no leg (a leg for it means the workflow and the scope drifted apart);
//   - any other job in `needs` (a job added to ci.yml later: a new job is a gate until someone says otherwise) must have succeeded;
//   - `scope` itself must have succeeded, `check` must be a dependency, and the scope's outputs must parse: anything unreadable
//     fails closed.
// Skipped, cancelled and failed are all failures: a required check that goes green because its jobs never ran is the failure this
// script exists to prevent.
//
//   NEEDS='<toJSON(needs)>' JOBS='<needs.scope.outputs.jobs>' LEGS='<needs.scope.outputs.legs>' node scripts/ci-verify.mjs
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * @param {{ needs: Record<string, { result: string }>, jobs: Record<string, string>|null, legs: { job: string }[]|null }} input
 * @returns {{ ok: boolean, problems: string[], rows: { job: string, expected: string, result: string, ok: boolean }[] }}
 */
export function verdict({ needs, jobs, legs }) {
  const problems = [];
  const rows = [];
  const record = (job, expected, result, ok) => {
    rows.push({ job, expected, result, ok });
    if (!ok) problems.push(`${job}: expected ${expected}, got ${result}`);
  };
  const resultOf = (job) => needs?.[job]?.result ?? 'missing';
  if (resultOf('scope') !== 'success') problems.push(`scope: expected success, got ${resultOf('scope')} (verify cannot tell what was meant to run)`);
  let unreadable = false;
  if (!jobs || typeof jobs !== 'object' || Array.isArray(jobs)) {
    problems.push('the scope output `jobs` is missing or unreadable');
    unreadable = true;
  }
  if (!Array.isArray(legs) || legs.some((leg) => typeof leg?.job !== 'string')) {
    problems.push('the scope output `legs` is missing or unreadable');
    unreadable = true;
  }
  if (unreadable) return { ok: false, problems, rows };
  if (legs.length === 0) problems.push('the scope selected no leg at all (an empty matrix runs nothing)');
  if (!('check' in (needs ?? {}))) problems.push('check: not a dependency of verify');
  const checkResult = resultOf('check');
  for (const [job, tier] of Object.entries(jobs)) {
    const count = legs.filter((leg) => leg.job === job).length;
    if (tier === 'skip') record(job, 'no leg (skipped by scope)', count === 0 ? 'no leg' : `${count} leg${count === 1 ? '' : 's'}`, count === 0);
    else if (count === 0) record(job, 'success', 'no leg in the matrix', false);
    else record(job, 'success', checkResult, checkResult === 'success');
  }
  for (const job of new Set(legs.map((leg) => leg.job))) {
    if (!(job in jobs)) record(job, 'a job the scope names', 'a leg of a job it does not', false);
  }
  for (const job of Object.keys(needs ?? {})) {
    if (job === 'scope' || job === 'check') continue;
    record(job, 'success', resultOf(job), resultOf(job) === 'success');
  }
  if (checkResult !== 'success' && !rows.some((row) => !row.ok && row.result === checkResult)) problems.push(`check: expected success, got ${checkResult}`);
  return { ok: problems.length === 0, problems, rows };
}

export function renderMarkdown({ ok, problems, rows }) {
  const lines = [`### verify: ${ok ? 'every job the scope selected passed' : 'FAILED'}`, '', '| Job | Expected | Result |', '| --- | --- | --- |'];
  for (const row of rows) lines.push(`| ${row.job} | ${row.expected} | ${row.result}${row.ok ? '' : ' (wrong)'} |`);
  if (problems.length > 0) lines.push('', ...problems.map((problem) => `- ${problem}`));
  return `${lines.join('\n')}\n`;
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function run(argv, env = process.env) {
  if (argv.length > 0) throw new Error(`unknown argument ${argv[0]}`);
  const result = verdict({ needs: parseJson(env.NEEDS ?? '', {}), jobs: parseJson(env.JOBS ?? '', null), legs: parseJson(env.LEGS ?? '', null) });
  const markdown = renderMarkdown(result);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, markdown);
  return { ...result, markdown };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = run(process.argv.slice(2));
    process.stdout.write(result.markdown);
    for (const problem of result.problems) console.log(`::error title=verify::${problem}`);
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(`ci-verify: ${error.message}`);
    process.exit(2);
  }
}
