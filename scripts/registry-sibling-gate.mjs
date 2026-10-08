#!/usr/bin/env node
// RR-55, applied to core's registry shard: the registry checks verify the packages already on npm, and one of them runs a
// sibling's own harness from its checkout (`node ../opf-editor/test/json-editor-browser.mjs ... registry-consumer`). On a
// pull request (or its merge-queue run) with `Depends-On: OpenPresentation/<sibling>#N`, that checkout is the sibling pull
// request, and a sibling that declares `"opf": { "requiresUnreleasedCore": "X.Y.Z" }` has rewritten its harness for a core
// that is not on npm yet. Run against the published core it cannot even bundle. This gate skips exactly that sibling
// harness, with a ::notice::, while the published core the registry consumer installed is lower than X.Y.Z: the same rule
// the siblings apply to their own packed install. It never skips on push, the nightly run or a manual run (the lock's
// siblings are released, and a release deletes the field), so main and releases keep the hard gate.
//
//   node scripts/registry-sibling-gate.mjs <sibling checkout> <registry consumer>   prints `run` or `skip`
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions, isVersion, unreleasedCoreOf } from './release-train.mjs';

/** Events on which a Depends-On sibling replaces the lock's (ecosystem-refs). */
export const DEPENDS_ON_EVENTS = new Set(['pull_request', 'merge_group']);

/** { run, message }: whether the sibling's harness runs against the registry consumer. */
export function decideSiblingHarness({ sibling, declared, installed, event }) {
  if (declared === null) return { run: true };
  if (!isVersion(declared)) throw new Error(`${sibling} declares opf.requiresUnreleasedCore ${JSON.stringify(declared)}, which is not a version`);
  if (!isVersion(installed ?? '')) throw new Error(`cannot read the published @openpresentation/opf the registry consumer installed (${JSON.stringify(installed)})`);
  if (compareVersions(installed, declared) >= 0) return { run: true, message: `${sibling} declares opf.requiresUnreleasedCore ${declared}; the published core ${installed} satisfies it, so its harness runs` };
  if (!DEPENDS_ON_EVENTS.has(event)) throw new Error(`${sibling} declares opf.requiresUnreleasedCore ${declared} but the published core is ${installed}, on a ${event || 'local'} run: only a pull request or merge-queue run with Depends-On may skip its registry harness; publish core ${declared} or roll the lock back to a released sibling`);
  return { run: false, message: `RR-55: ${sibling} (Depends-On) declares opf.requiresUnreleasedCore ${declared} and the registry consumer installed the published @openpresentation/opf ${installed}, so its harness, rewritten for the unreleased core, is skipped against the published packages. Every other registry check still runs; push to main and releases run it.` };
}

export function siblingGate(siblingDir, consumerDir, event = process.env.GITHUB_EVENT_NAME ?? '') {
  const manifest = JSON.parse(readFileSync(path.join(siblingDir, 'package.json'), 'utf8'));
  const core = path.join(consumerDir, 'node_modules', '@openpresentation', 'opf', 'package.json');
  const installed = existsSync(core) ? JSON.parse(readFileSync(core, 'utf8')).version : null;
  return decideSiblingHarness({ sibling: manifest.name ?? path.basename(siblingDir), declared: unreleasedCoreOf(manifest), installed, event });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [siblingDir, consumerDir] = process.argv.slice(2);
  if (!siblingDir || !consumerDir) {
    console.error('Usage: node scripts/registry-sibling-gate.mjs <sibling checkout> <registry consumer>');
    process.exit(2);
  }
  try {
    const result = siblingGate(path.resolve(siblingDir), path.resolve(consumerDir));
    if (result.message) console.error(result.run ? result.message : `::notice title=Registry sibling harness skipped::${result.message}`);
    console.log(result.run ? 'run' : 'skip');
  } catch (error) {
    console.error(`::error title=Registry sibling harness::${error.message}`);
    process.exit(1);
  }
}
