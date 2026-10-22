// MR-31: `pnpm golden:update`, the one way the raster golden of the examples corpus is regenerated. It replaces core's
// regenerate-core-golden workflow and the renderer's regenerate-goldens workflow (and their helper scripts).
//
//   pnpm golden:update            # in .github/workflows/golden.yml (the pinned Playwright image): render, rewrite the decks that moved
//   pnpm golden:update --local    # anywhere: render and write the review candidate only (artifacts/golden/), never the baseline
//
// The corpus is the repository's `examples/` (through core's examples export) and the baseline is the renderer's default
// selection for this checkout (packages/render/scripts/default-baseline.mjs). A run keeps only the changed slides and the
// review sheets under packages/render/artifacts/golden/ (OPF_GOLDEN_ARTIFACTS=changed), then, unless --local, rewrites only the
// per-deck files whose hashes differ and writes diff.json. The comparison stays exact (no tolerance), at the baseline's scale.
// A reviewer looks at the changed slides before approving; the promotion is evidence, never an approval.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageManagerInvocation } from './package-manager.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RENDER = '@openpresentation/opf-render';

/** Why the baseline may not be rewritten here, or undefined. Pure: every input is passed in. */
export function refusal({ env, platform, local }) {
  if (local) return undefined;
  const problems = [];
  if (env.GITHUB_ACTIONS !== 'true') problems.push('not running in GitHub Actions');
  if (platform !== 'linux') problems.push(`platform is ${platform}, not linux`);
  if (env.PLAYWRIGHT_BROWSERS_PATH !== '/ms-playwright') problems.push('not the pinned Playwright image (PLAYWRIGHT_BROWSERS_PATH is not /ms-playwright)');
  return problems.length ? `Refusing to rewrite the golden baseline:\n${problems.map((problem) => `  - ${problem}`).join('\n')}\nGoldens are rewritten by the golden workflow (.github/workflows/golden.yml) in the pinned Playwright image; use --local to write a review candidate only.` : undefined;
}

/** The pnpm steps of one run, in order. */
export function steps({ local }) {
  const run = (script) => ['--filter', RENDER, '--fail-if-no-match', 'run', script];
  return local ? [run('golden:update')] : [run('golden:update'), run('golden:promote')];
}

function main(argv) {
  const local = argv.includes('--local');
  const problem = refusal({ env: process.env, platform: process.platform, local });
  if (problem) {
    console.error(problem);
    return 1;
  }
  const env = { ...process.env, OPF_GOLDEN_ARTIFACTS: process.env.OPF_GOLDEN_ARTIFACTS ?? 'changed' };
  for (const args of steps({ local })) {
    const invocation = packageManagerInvocation('pnpm', args);
    const result = spawnSync(invocation.command, invocation.args, { cwd: root, env, stdio: 'inherit' });
    if (result.status !== 0) return result.status ?? 1;
  }
  console.log(local ? 'Review candidate written under packages/render/artifacts/golden/ (the baseline is untouched).' : 'Baseline rewritten; diff.json and the review sheets are under packages/render/artifacts/golden/.');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
