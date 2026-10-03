// RR-52: golden PNG hashes are only comparable inside the image CI uses. The regenerate-goldens workflow calls this
// guard first and refuses to regenerate anywhere else (a laptop, a self-hosted runner, a bare hosted runner, a
// container whose image is not the one .github/workflows/ci.yml pins).
//
//   node scripts/golden-pinned-image.mjs            # exits 1 with the reasons when this is not the pinned image
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFromCiWorkflow } from './ecosystem-pins.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Pure: every input is passed in, so the refusal logic is testable without a container.
export function pinnedImageProblems({ env, platform, osRelease, inContainer, pinnedImage, playwrightVersion }) {
  const problems = [];
  if (env.GITHUB_ACTIONS !== 'true') problems.push('not running in GitHub Actions');
  if (env.RUNNER_ENVIRONMENT !== 'github-hosted') problems.push(`runner environment is ${JSON.stringify(env.RUNNER_ENVIRONMENT ?? null)}, not github-hosted`);
  if (platform !== 'linux') problems.push(`platform is ${platform}, not linux`);
  if (!/^VERSION_CODENAME=noble$/m.test(osRelease ?? '')) problems.push('the OS is not Ubuntu noble');
  if (!inContainer) problems.push('not running in a container job');
  if (env.OPF_PLAYWRIGHT_IMAGE !== pinnedImage) problems.push(`job image ${JSON.stringify(env.OPF_PLAYWRIGHT_IMAGE ?? null)} is not the image ci.yml pins (${pinnedImage})`);
  if (env.PLAYWRIGHT_BROWSERS_PATH !== '/ms-playwright') problems.push('PLAYWRIGHT_BROWSERS_PATH is not the Playwright image location /ms-playwright');
  const tag = /playwright:v(\d+\.\d+\.\d+)-/.exec(pinnedImage)?.[1];
  if (playwrightVersion !== undefined && playwrightVersion !== tag) problems.push(`installed playwright ${playwrightVersion} does not match the pinned image ${tag}`);
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { image } = readFromCiWorkflow(readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8'));
  let playwrightVersion;
  try { playwrightVersion = createRequire(path.join(root, 'package.json'))('playwright/package.json').version; } catch { /* not installed yet */ }
  const problems = pinnedImageProblems({
    env: process.env, platform: process.platform, pinnedImage: image, playwrightVersion,
    osRelease: existsSync('/etc/os-release') ? readFileSync('/etc/os-release', 'utf8') : '',
    inContainer: existsSync('/.dockerenv') || (existsSync('/proc/1/cgroup') && /docker|containerd|kubepods/.test(readFileSync('/proc/1/cgroup', 'utf8'))),
  });
  if (problems.length) {
    console.error(`Refusing to regenerate goldens outside the pinned Playwright image:\n${problems.map(problem => `  - ${problem}`).join('\n')}\nGoldens are regenerated only by the regenerate-goldens workflow in ${image}.`);
    process.exit(1);
  }
  console.log(`Pinned image confirmed: ${image}`);
}
