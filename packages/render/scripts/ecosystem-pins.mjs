// RR-50 (the seam RR-52 left): the regenerate-goldens workflow must rebuild the same coordinated source graph that
// .github/workflows/ci.yml tests. Neither keeps a copy of the pins:
//   - the commits of OpenPresentation/opf, opf-pptx and opf-editor come from core's bot-owned ecosystem.lock.json,
//     read through OpenPresentation/opf/.github/actions/ecosystem-refs@main (its `lock_file` output is --lock here),
//   - the golden baseline is the `golden-override` input of that step in ci.yml when a renderer pull request selects
//     its own baseline directory, and otherwise the lock's golden,
//   - the digest-pinned Playwright container still comes from ci.yml.
// The output shape is the one RR-52 defined (opf, opf_pptx, opf_editor, image, baseline, baseline_directory), plus
// golden_source (override or lock). baseline_directory is empty when the baseline is not a renderer directory (the
// lock's golden lives in another checkout); regenerate-goldens then refuses (--require-renderer-baseline).
//
//   node scripts/ecosystem-pins.mjs --lock <ecosystem.lock.json> [--workflow .github/workflows/ci.yml] [--github-output] [--require-renderer-baseline]
import assert from 'node:assert/strict';
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHA = /^[0-9a-f]{40}$/;

// What ci.yml itself still pins: the Playwright image, and the renderer's own golden selection (if any). It must not
// pin a sibling by hand: every OpenPresentation checkout reads the ecosystem-refs step.
export function readFromCiWorkflow(text) {
  const image = /^\s*container:\s*(mcr\.microsoft\.com\/playwright:\S+@sha256:[0-9a-f]{64})\s*$/m.exec(text)?.[1];
  assert.ok(image, 'ci.yml has no digest-pinned Playwright container');
  assert.match(text, /^\s*uses:\s*OpenPresentation\/opf\/\.github\/actions\/ecosystem-refs@main\s*$/m, 'ci.yml does not read core\'s ecosystem.lock.json through OpenPresentation/opf/.github/actions/ecosystem-refs@main');
  assert.match(text, /^\s*consumer:\s*opf-render\s*$/m, 'ci.yml: the ecosystem-refs step must name consumer: opf-render');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!/^\s*repository:\s*OpenPresentation\//.test(line)) return;
    for (const next of lines.slice(index + 1, index + 6)) {
      assert.doesNotMatch(next, /^\s*ref:\s*[0-9a-f]{7,40}\s*(#.*)?$/, `ci.yml:${index + 1}: ${line.trim()} is pinned by hand; read it from the ecosystem-refs step`);
    }
  });
  assert.doesNotMatch(text, /^\s*OPF_GOLDEN_BASELINE:/m, 'ci.yml selects OPF_GOLDEN_BASELINE by hand; use the golden-override input of the ecosystem-refs step');
  const goldenOverride = /^\s*golden-override:\s*(?:'([^']*)'|"([^"]*)"|([^\s#'"]*))\s*(?:#.*)?$/m.exec(text);
  const override = goldenOverride ? (goldenOverride[1] ?? goldenOverride[2] ?? goldenOverride[3] ?? '') : '';
  return { image, goldenOverride: override };
}

export function readLockRefs(lock) {
  for (const name of ['opf', 'opf-pptx', 'opf-editor']) assert.match(lock?.repositories?.[name]?.sha ?? '', SHA, `the ecosystem lock has no full SHA for OpenPresentation/${name}`);
  assert.ok(lock.golden?.repository && lock.golden?.path, 'the ecosystem lock has no golden');
  return { opf: lock.repositories.opf.sha, 'opf-pptx': lock.repositories['opf-pptx'].sha, 'opf-editor': lock.repositories['opf-editor'].sha, golden: `${lock.golden.repository}/${lock.golden.path}` };
}

export function readPins({ lock, workflowText }) {
  const { image, goldenOverride } = readFromCiWorkflow(workflowText);
  const refs = readLockRefs(lock);
  const baseline = goldenOverride || refs.golden;
  // The selection may still be named like the old single file (`<name>.sha256.json`); the baseline is the directory `<name>/`.
  const baselineDirectory = baseline.startsWith('opf-render/') ? baseline.replace(/^opf-render\//, '').replace(/\.sha256\.json$/, '') : '';
  return { opf: refs.opf, 'opf-pptx': refs['opf-pptx'], 'opf-editor': refs['opf-editor'], image, baseline, baselineDirectory, goldenSource: goldenOverride ? 'override' : 'lock' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  const lockFile = option('--lock') ?? process.env.ECOSYSTEM_LOCK_FILE;
  assert.ok(lockFile, 'Pass --lock <ecosystem.lock.json> (the lock_file output of OpenPresentation/opf/.github/actions/ecosystem-refs)');
  const pins = readPins({
    lock: JSON.parse(readFileSync(path.resolve(lockFile), 'utf8')),
    workflowText: readFileSync(path.resolve(option('--workflow') ?? path.join(root, '.github/workflows/ci.yml')), 'utf8'),
  });
  if (args.includes('--github-output')) {
    assert.ok(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is not set');
    appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(pins).map(([key, value]) => `${key.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/-/g, '_').toLowerCase()}=${value}\n`).join(''));
  }
  console.log(JSON.stringify(pins, null, 2));
  if (args.includes('--require-renderer-baseline') && !pins.baselineDirectory) {
    console.error(`The selected golden baseline ${pins.baseline} (${pins.goldenSource}) is not a renderer baseline directory, so there is nothing in this repository to regenerate. Copy it to test/golden/<name>.sha256.json, split it into test/golden/<name>/ with "node scripts/golden-migrate.mjs migrate --remove", select that directory with the golden-override input of the ecosystem-refs step in .github/workflows/ci.yml, then run regenerate-goldens again.`);
    process.exit(1);
  }
}
