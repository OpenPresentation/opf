#!/usr/bin/env node
// RR-107: release.yml's `watch` job judges the finished npm-publish.yml run by its jobs, not by the run's conclusion. The npm
// publication (plan, build, publish, verify, the GitHub release notes) decides: any of them not green fails the release, and the
// sites are not bumped. The Claude Desktop bundle (mcpb, assets) is a release asset attached after the packages are live: its
// failure is reported as "assets missing" (a warning, a step summary line, `assets=missing` in GITHUB_OUTPUT and the
// release-assets-missing issue that npm-publish.yml's report job opens) and never stops the site bumps.
//
//   gh run view <id> --json jobs > jobs.json
//   node scripts/release-publish-run.mjs jobs.json        exit 0 when the publication is green, 1 when it is not
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** The `name:` of each npm-publish.yml job on the publication path (a real release runs every one of them). */
export const PUBLICATION_JOBS = ['plan', 'build and pack', 'publish', 'verify the registry', 'GitHub release'];
/** The `name:` of each npm-publish.yml job that makes or attaches the release assets. */
export const ASSET_JOBS = ['MCP bundle', 'attach the MCP bundle'];

/** `jobs`: the `jobs` array of `gh run view --json jobs`. A job that is missing or not `success` counts as not green. */
export function judgePublishRun(jobs) {
  const conclusion = new Map((jobs ?? []).map(({ name, conclusion: value }) => [name, value || 'incomplete']));
  const notGreen = (names) => names.filter((name) => conclusion.get(name) !== 'success').map((name) => ({ name, conclusion: conclusion.get(name) ?? 'missing' }));
  const failed = notGreen(PUBLICATION_JOBS);
  const assetsMissing = notGreen(ASSET_JOBS);
  return { published: failed.length === 0, failed, assetsMissing };
}

export function main(argv = process.argv.slice(2), env = process.env, log = console.log) {
  if (argv.length !== 1) throw new Error('usage: release-publish-run.mjs <gh run view --json jobs output>');
  const { jobs } = JSON.parse(readFileSync(argv[0], 'utf8'));
  const result = judgePublishRun(jobs);
  const list = (entries) => entries.map(({ name, conclusion }) => `${name} (${conclusion})`).join(', ');
  const lines = [];
  if (result.published) lines.push('The npm publication is complete: all seven packages are published and verified, and the GitHub release exists.');
  else lines.push(`::error title=Release::the publish run is not green: ${list(result.failed)}`);
  if (result.assetsMissing.length) lines.push(`::warning title=Release assets missing::the MCP bundle assets were not attached: ${list(result.assetsMissing)}. The packages are live; re-run the failed job of the publish run, which attaches only the missing files.`);
  for (const line of lines) log(line);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${lines.map((line) => line.replace(/^::\w+ title=[^:]*::/u, '- ')).join('\n')}\n`);
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `assets=${result.assetsMissing.length ? 'missing' : 'attached'}\n`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!main().published) process.exitCode = 1;
  } catch (error) {
    console.error(`release-publish-run: ${error.message ?? error}`);
    process.exitCode = 2;
  }
}
