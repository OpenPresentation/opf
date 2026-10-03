// RR-52 seam for RR-50. The regenerate-goldens workflow must rebuild the same coordinated source graph that
// .github/workflows/ci.yml tests, so it reads the pins from there instead of keeping a second copy:
//   - the sibling checkout refs (OpenPresentation/opf, opf-pptx, opf-editor),
//   - the pinned Playwright container image,
//   - the selected golden baseline (OPF_GOLDEN_BASELINE).
// When RR-50 lands, the bot-owned ecosystem.lock.json records the sibling refs and the golden set each renderer SHA
// expects; replace `readFromCiWorkflow()` below with a read of that lock and keep the output shape.
//
//   node scripts/ecosystem-pins.mjs [--workflow .github/workflows/ci.yml] [--github-output]
import assert from 'node:assert/strict';
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function readFromCiWorkflow(text) {
  const lines = text.split(/\r?\n/);
  const refs = {};
  for (let index = 0; index < lines.length; index++) {
    const repository = /^\s*repository:\s*OpenPresentation\/([\w.-]+)\s*$/.exec(lines[index]);
    if (!repository) continue;
    for (let next = index + 1; next < Math.min(lines.length, index + 6); next++) {
      const ref = /^\s*ref:\s*([0-9a-f]{40})\s*$/.exec(lines[next]);
      if (ref) { refs[repository[1]] = ref[1]; break; }
    }
  }
  for (const name of ['opf', 'opf-pptx', 'opf-editor']) assert.match(refs[name] ?? '', /^[0-9a-f]{40}$/, `ci.yml pins no full SHA for OpenPresentation/${name}`);
  const image = /^\s*container:\s*(mcr\.microsoft\.com\/playwright:\S+@sha256:[0-9a-f]{64})\s*$/m.exec(text)?.[1];
  assert.ok(image, 'ci.yml has no digest-pinned Playwright container');
  const baseline = /^\s*OPF_GOLDEN_BASELINE:\s*\$\{\{\s*github\.workspace\s*\}\}\/(\S+)\s*$/m.exec(text)?.[1];
  assert.ok(baseline, 'ci.yml selects no OPF_GOLDEN_BASELINE');
  // The selection may still be named like the old single file (`<name>.sha256.json`); the baseline is the directory `<name>/`.
  const baselineDirectory = baseline.replace(/^opf-render\//, '').replace(/\.sha256\.json$/, '');
  return { opf: refs.opf, 'opf-pptx': refs['opf-pptx'], 'opf-editor': refs['opf-editor'], image, baseline, baselineDirectory };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  const pins = readFromCiWorkflow(readFileSync(path.resolve(option('--workflow') ?? path.join(root, '.github/workflows/ci.yml')), 'utf8'));
  if (args.includes('--github-output')) {
    assert.ok(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is not set');
    appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(pins).map(([key, value]) => `${key.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/-/g, '_').toLowerCase()}=${value}\n`).join(''));
  }
  console.log(JSON.stringify(pins, null, 2));
}
