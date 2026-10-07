// RR-52: the regenerate-goldens guard refuses every environment except the pinned Playwright container, and the
// workflow, the guard and ci.yml agree on that image.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFromCiWorkflow, readLockRefs, readPins } from '../scripts/ecosystem-pins.mjs';
import { pinnedImageProblems } from '../scripts/golden-pinned-image.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ci = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
const pins = readFromCiWorkflow(ci);
const good = {
  env: { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted', OPF_PLAYWRIGHT_IMAGE: pins.image, PLAYWRIGHT_BROWSERS_PATH: '/ms-playwright' },
  platform: 'linux', osRelease: 'NAME="Ubuntu"\nVERSION_CODENAME=noble\n', inContainer: true, pinnedImage: pins.image, playwrightVersion: '1.63.0',
};
assert.deepEqual(pinnedImageProblems(good), []);
const refuses = (change, pattern) => assert.match(pinnedImageProblems({ ...good, ...change, env: { ...good.env, ...change.env } }).join('\n'), pattern);
refuses({ env: { GITHUB_ACTIONS: undefined } }, /not running in GitHub Actions/);
refuses({ env: { RUNNER_ENVIRONMENT: 'self-hosted' } }, /not github-hosted/);
refuses({ platform: 'darwin' }, /not linux/);
refuses({ osRelease: 'VERSION_CODENAME=jammy\n' }, /not Ubuntu noble/);
refuses({ inContainer: false }, /not running in a container job/);
refuses({ env: { OPF_PLAYWRIGHT_IMAGE: 'mcr.microsoft.com/playwright:v1.62.0-noble' } }, /not the image ci\.yml pins/);
refuses({ env: { PLAYWRIGHT_BROWSERS_PATH: undefined } }, /\/ms-playwright/);
refuses({ playwrightVersion: '1.62.0' }, /does not match the pinned image/);
// The real script refuses on this machine unless it is in fact the pinned container.
const run = spawnSync(process.execPath, [path.join(root, 'scripts/golden-pinned-image.mjs')], { encoding: 'utf8', env: { PATH: process.env.PATH } });
assert.equal(run.status, 1);
assert.match(run.stderr, /Refusing to regenerate goldens outside the pinned Playwright image/);

// The workflow runs only in the image ci.yml pins, takes it from the same digest, and runs the guard before anything else.
const workflow = readFileSync(path.join(root, '.github/workflows/regenerate-goldens.yml'), 'utf8');
assert.ok(workflow.includes(`image: ${pins.image}`), 'regenerate-goldens.yml must run in the image ci.yml pins');
assert.ok(workflow.includes(`OPF_PLAYWRIGHT_IMAGE: ${pins.image}`), 'The job env repeats the image the guard compares with ci.yml');
assert.ok(workflow.indexOf('golden-pinned-image.mjs') < workflow.indexOf('npm ci'), 'The guard runs before any install');
assert.equal(/runs-on:\s*(\S+)/.exec(workflow)[1], /runs-on:\s*(\S+)/.exec(ci)[1], 'The workflow uses the runner label of the ci.yml package job');
// RR-50: ci.yml pins no sibling and no golden by hand; its golden-override is empty (the lock's golden), a renderer
// baseline directory (legacy .sha256.json name accepted), or, for a coordinated release, a reviewed core fixture
// (opf/scripts/fixtures/<name>.sha256.json; core's roller adopts it as the lock's golden).
assert.match(pins.goldenOverride, /^$|^opf-render\/test\/golden\/[\w.-]+$|^opf\/scripts\/fixtures\/[\w.-]+\.sha256\.json$/, 'ci.yml golden-override is empty, a renderer baseline directory or a core fixture');
const lock = {
  version: 1,
  repositories: { opf: { sha: '1'.repeat(40) }, 'opf-render': { sha: '2'.repeat(40) }, 'opf-pptx': { sha: '3'.repeat(40) }, 'opf-editor': { sha: '4'.repeat(40) } },
  golden: { repository: 'opf', path: 'scripts/fixtures/opf-examples-png.audience-ids.sha256.json' },
};
const withOverride = value => ci.replace(/^(\s*golden-override:).*$/m, `$1 ${value}`);
assert.deepEqual(readPins({ lock, workflowText: withOverride("''") }), {
  opf: '1'.repeat(40), 'opf-pptx': '3'.repeat(40), 'opf-editor': '4'.repeat(40), image: pins.image,
  baseline: 'opf/scripts/fixtures/opf-examples-png.audience-ids.sha256.json', baselineDirectory: '', goldenSource: 'lock',
});
const own = readPins({ lock, workflowText: withOverride('opf-render/test/golden/opf-examples-png.cover-centering.sha256.json') });
assert.equal(own.baseline, 'opf-render/test/golden/opf-examples-png.cover-centering.sha256.json');
assert.equal(own.baselineDirectory, 'test/golden/opf-examples-png.cover-centering');
assert.equal(own.goldenSource, 'override');
assert.throws(() => readFromCiWorkflow(ci.replace(/ref: \$\{\{ steps\.refs\.outputs\.opf \}\}/, 'ref: da45b2e29812efbf67829f2fe987ef76858990f7')), /pinned by hand/);
assert.throws(() => readFromCiWorkflow(`${ci}\n    env:\n      OPF_GOLDEN_BASELINE: x\n`), /OPF_GOLDEN_BASELINE by hand/);
assert.throws(() => readLockRefs({ repositories: { opf: { sha: 'main' } } }), /no full SHA/);
const workflowPins = workflow.indexOf('ecosystem-pins.mjs --lock');
assert.ok(workflowPins > workflow.indexOf('actions/ecosystem-refs@main'), 'regenerate-goldens reads the lock the ecosystem-refs action resolves');
assert.ok(workflow.includes('--require-renderer-baseline'), 'regenerate-goldens refuses a baseline outside the renderer');
console.log('Golden pinned-image guard passed: eight refusals, the real script refuses here, workflow and ci.yml pin the same image; the pins come from the ecosystem lock.');
