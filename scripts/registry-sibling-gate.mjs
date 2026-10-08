#!/usr/bin/env node
// RR-55, applied to core's registry shard: the registry checks verify the packages already on npm, and one of them runs a
// sibling's own harness from its checkout (`node ../opf-editor/test/json-editor-browser.mjs ... registry-consumer`). On a
// pull request (or its merge-queue run) with `Depends-On: OpenPresentation/<sibling>#N`, that checkout is the sibling pull
// request, and a sibling that declares `"opf": { "requiresUnreleasedCore": "X.Y.Z" }` has rewritten its harness for a core
// that is not on npm yet. This gate skips exactly that sibling harness, with a ::notice::, while the published core the
// registry consumer installed is lower than X.Y.Z. The rule is scripts/unreleased-gate.mjs (shared with the CLI's peer
// tests): never a skip on push, the nightly run, a manual run (other than the roller's candidate) or a release, so main and releases keep the hard gate.
//
//   node scripts/registry-sibling-gate.mjs <sibling checkout> <registry consumer>   prints `run` or `skip`
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions, isVersion, unreleasedCoreOf } from './release-train.mjs';
import { SKIP_EVENTS, gate } from './unreleased-gate.mjs';

/** Events on which a Depends-On sibling replaces the lock's (ecosystem-refs). */
export const DEPENDS_ON_EVENTS = SKIP_EVENTS;

/** { run, message }: whether the sibling's harness runs against the registry consumer. */
export function decideSiblingHarness({ sibling, declared, installed, event, ref }) {
  if (declared === null) return { run: true };
  if (!isVersion(declared)) throw new Error(`${sibling} declares opf.requiresUnreleasedCore ${JSON.stringify(declared)}, which is not a version`);
  if (!isVersion(installed ?? '')) throw new Error(`cannot read the published @openpresentation/opf the registry consumer installed (${JSON.stringify(installed)})`);
  return gate({
    subject: `${sibling} (Depends-On, opf.requiresUnreleasedCore)`,
    required: `@openpresentation/opf ${declared}`,
    installed,
    met: compareVersions(installed, declared) >= 0,
    event,
    ref,
    what: 'its harness against the published packages',
  });
}

export function siblingGate(siblingDir, consumerDir, event = process.env.GITHUB_EVENT_NAME ?? '', ref = process.env.GITHUB_REF ?? '') {
  const manifest = JSON.parse(readFileSync(path.join(siblingDir, 'package.json'), 'utf8'));
  const core = path.join(consumerDir, 'node_modules', '@openpresentation', 'opf', 'package.json');
  const installed = existsSync(core) ? JSON.parse(readFileSync(core, 'utf8')).version : null;
  return decideSiblingHarness({ sibling: manifest.name ?? path.basename(siblingDir), declared: unreleasedCoreOf(manifest), installed, event, ref });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [siblingDir, consumerDir] = process.argv.slice(2);
  if (!siblingDir || !consumerDir) {
    console.error('Usage: node scripts/registry-sibling-gate.mjs <sibling checkout> <registry consumer>');
    process.exit(2);
  }
  try {
    const result = siblingGate(path.resolve(siblingDir), path.resolve(consumerDir));
    if (!result.run) console.error(`::notice title=Registry sibling harness skipped::${result.message}`);
    console.log(result.run ? 'run' : 'skip');
  } catch (error) {
    console.error(`::error title=Registry sibling harness::${error.message}`);
    process.exit(1);
  }
}
