#!/usr/bin/env node
// MR-30: the `verify` aggregator of .github/workflows/ci.yml (docs/programs/monorepo/README.md, section 4).
//
// `verify` is the one required check. It `needs` every job of ci.yml and runs always; this script decides its verdict from
// the `needs` context and the scope's `jobs` map (scripts/ci-scope.mjs):
//   - a job the scope selected (tier full or contract) must have succeeded;
//   - a job the scope skipped must be skipped (a skipped-by-scope job counts as success; one that ran anyway must have succeeded);
//   - a job that is not in the scope's map must have succeeded (the `slow` call, when the label full-ci asked for it, and
//     any job added to ci.yml later: a new job is a gate until someone says otherwise), except that a job named in
//     OPTIONAL may also be skipped;
//   - a job the scope names but `verify` does not depend on is a failure (the workflow and the scope drifted apart);
//   - `scope` itself must have succeeded, and its output must parse: anything unreadable fails closed.
// Skipped otherwise, cancelled and failed are all failures: a required check that goes green because its jobs were skipped
// is the failure this script exists to prevent.
//
//   NEEDS='<toJSON(needs)>' JOBS='<needs.scope.outputs.jobs>' node scripts/ci-verify.mjs [--optional slow,other]
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * @param {{ needs: Record<string, { result: string }>, jobs: Record<string, string>|null, optional?: string[] }} input
 * @returns {{ ok: boolean, problems: string[], rows: { job: string, expected: string, result: string, ok: boolean }[] }}
 */
export function verdict({ needs, jobs, optional = [] }) {
  const problems = [];
  const rows = [];
  const record = (job, expected, result, ok) => {
    rows.push({ job, expected, result, ok });
    if (!ok) problems.push(`${job}: expected ${expected}, got ${result}`);
  };
  const resultOf = (job) => needs?.[job]?.result ?? 'missing';
  if (resultOf('scope') !== 'success') problems.push(`scope: expected success, got ${resultOf('scope')} (verify cannot tell what was meant to run)`);
  if (!jobs || typeof jobs !== 'object' || Array.isArray(jobs)) {
    problems.push('the scope output `jobs` is missing or unreadable');
    return { ok: false, problems, rows };
  }
  for (const [job, tier] of Object.entries(jobs)) {
    if (!(job in (needs ?? {}))) {
      record(job, tier === 'skip' ? 'skipped' : 'success', 'not a dependency of verify', false);
      continue;
    }
    const result = resultOf(job);
    if (tier === 'skip') record(job, 'skipped by scope', result, result === 'skipped' || result === 'success');
    else record(job, 'success', result, result === 'success');
  }
  for (const job of Object.keys(needs ?? {})) {
    if (job === 'scope' || job in jobs) continue;
    const result = resultOf(job);
    record(job, optional.includes(job) ? 'success or skipped' : 'success', result, result === 'success' || (optional.includes(job) && result === 'skipped'));
  }
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
  const optional = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--optional') optional.push(...(argv[++index] ?? '').split(',').map((name) => name.trim()).filter(Boolean));
    else throw new Error(`unknown argument ${argv[index]}`);
  }
  const result = verdict({ needs: parseJson(env.NEEDS ?? '', {}), jobs: parseJson(env.JOBS ?? '', null), optional });
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
