#!/usr/bin/env node
// MR-30: open, update or close the one tracking issue of a scheduled or main-branch workflow
// (docs/programs/monorepo/README.md, section 4: "A nightly failure opens an issue automatically and never blocks PRs").
//
//   NEEDS='<toJSON(needs)>' GH_TOKEN=... node scripts/ci-report-issue.mjs --label nightly-red --title "Nightly checks are red"
//
// The jobs in NEEDS decide: any `failure` or `cancelled` (an incomplete nightly is missing coverage, not a pass) opens the
// issue labeled --label, or adds a comment to the one already open; when every job succeeded or was skipped, an open issue
// gets a "green again" comment and is closed. --ignore names jobs that are advisory (they are listed but never count).
// Uses only the workflow's own GITHUB_TOKEN (`issues: write`) through the `gh` CLI: no App, no polling.
//   --dry-run   print what would be done and call nothing
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** The jobs of a `needs` object that count as failed. */
export function failing(needs, ignore = []) {
  return Object.entries(needs ?? {})
    .filter(([job, value]) => !ignore.includes(job) && (value?.result === 'failure' || value?.result === 'cancelled'))
    .map(([job, value]) => ({ job, result: value.result }));
}

export function messageFor({ failed, event, sha, runUrl, label }) {
  const list = failed.map(({ job, result }) => `- \`${job}\`: ${result}`).join('\n');
  const short = (sha ?? '').slice(0, 9);
  return {
    red: `The ${event || 'scheduled'} run is red at ${short}: ${runUrl}\n\n${list}\n\nThis issue is opened and closed by the workflow (label \`${label}\`); it never blocks a pull request. Fix forward or revert, then the next green run closes it.`,
    green: `Green again on ${event || 'a scheduled run'} at ${short}: ${runUrl}.`,
  };
}

/**
 * @param {{ needs: object, ignore?: string[], label: string, title: string, repo: string, sha?: string, runUrl?: string, event?: string, gh: (args: string[]) => string }} input
 * `gh(args)` runs the GitHub CLI and returns stdout; the return value says what was done.
 */
export function report({ needs, ignore = [], label, title, repo, sha, runUrl, event, gh }) {
  const failed = failing(needs, ignore);
  const open = gh(['api', `repos/${repo}/issues?labels=${encodeURIComponent(label)}&state=open&per_page=1`, '--jq', '.[0].number // empty']).trim();
  const text = messageFor({ failed, event, sha, runUrl, label });
  if (failed.length > 0) {
    if (open) {
      gh(['api', `repos/${repo}/issues/${open}/comments`, '-f', `body=${text.red}`]);
      return { action: 'commented', issue: open, failed };
    }
    gh(['api', `repos/${repo}/issues`, '-f', `title=${title}`, '-f', `body=${text.red}`, '-f', `labels[]=${label}`]);
    return { action: 'opened', issue: null, failed };
  }
  if (open) {
    gh(['api', `repos/${repo}/issues/${open}/comments`, '-f', `body=${text.green}`]);
    gh(['api', '-X', 'PATCH', `repos/${repo}/issues/${open}`, '-f', 'state=closed']);
    return { action: 'closed', issue: open, failed };
  }
  return { action: 'none', issue: null, failed };
}

function ghCli(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`gh ${args.slice(0, 2).join(' ')} failed (${result.status}): ${result.stderr.trim()}`);
  return result.stdout;
}

export function run(argv, env = process.env, gh = ghCli) {
  const options = { ignore: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} needs a value`);
      return argv[index];
    };
    if (arg === '--label') options.label = value();
    else if (arg === '--title') options.title = value();
    else if (arg === '--ignore') options.ignore.push(...value().split(',').map((name) => name.trim()).filter(Boolean));
    else if (arg === '--dry-run') options.dryRun = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  if (!options.label || !options.title) throw new Error('--label and --title are required');
  let needs;
  try {
    needs = JSON.parse(env.NEEDS ?? '');
  } catch {
    throw new Error('NEEDS must be the JSON of the needs context (toJSON(needs))');
  }
  const repo = env.GITHUB_REPOSITORY ?? env.REPO;
  if (!repo) throw new Error('GITHUB_REPOSITORY is not set');
  const runUrl = env.RUN_URL ?? `${env.GITHUB_SERVER_URL ?? 'https://github.com'}/${repo}/actions/runs/${env.GITHUB_RUN_ID ?? ''}`;
  const calls = [];
  const exec = options.dryRun ? (args) => { calls.push(args); return args[1]?.includes('/issues?') ? (env.DRY_RUN_OPEN ?? '') : ''; } : gh;
  const result = report({ needs, ignore: options.ignore, label: options.label, title: options.title, repo, sha: env.GITHUB_SHA, runUrl, event: env.EVENT ?? env.GITHUB_EVENT_NAME, gh: exec });
  return { ...result, calls };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = run(process.argv.slice(2));
    console.log(`ci-report-issue: ${result.action}${result.issue ? ` #${result.issue}` : ''}${result.failed.length ? ` (${result.failed.map(({ job }) => job).join(', ')})` : ''}`);
    for (const call of result.calls) console.log(`  gh ${call.join(' ')}`);
  } catch (error) {
    console.error(`ci-report-issue: ${error.message}`);
    process.exit(2);
  }
}
