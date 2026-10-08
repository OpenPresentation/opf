// RR-55: the one rule for a check that runs through a package that is not on npm yet. A coordinated breaking change (a
// core line and its sibling pull requests, Depends-On) declares what it needs before it is published; while what is
// installed from npm does not satisfy that, the checks that can only run through the published package skip with a
// ::notice:: on a pull request or merge-queue run, and every other check still runs. On push, the nightly run, a manual
// run, a release or a local run an unmet requirement is an error, never a skip, so main and releases keep the hard gate.
//
// Users: scripts/registry-sibling-gate.mjs (a Depends-On sibling's harness against the published core) and the CLI's
// render/export/import tests (packages/cli/test/files.mjs, packed-files.mjs) against the published opf-render and opf-pptx.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { compareVersions, floorOf, isVersion } from './release-train.mjs';

/** Events on which a coordinated change may still wait for a publish (ecosystem-refs honours Depends-On on them). */
export const SKIP_EVENTS = new Set(['pull_request', 'merge_group']);

/** Whether `version` satisfies `range` (`^X.Y.Z`, `~X.Y.Z`, `>=X.Y.Z`, `=X.Y.Z` or `X.Y.Z`; npm caret rules for 0.x). */
export function satisfies(version, range) {
  if (!isVersion(version)) throw new Error(`not a version: ${JSON.stringify(version)}`);
  const floor = floorOf(range);
  if (!floor) throw new Error(`unsupported range: ${JSON.stringify(range)}`);
  if (compareVersions(version, floor.version) < 0) return false;
  const [major, minor, patch] = version.split(/[.-]/).map(Number), [fMajor, fMinor, fPatch] = floor.version.split(/[.-]/).map(Number);
  // A prerelease satisfies only a range whose floor is a prerelease of the same version (npm semantics).
  if (version.includes('-') && !(floor.version.includes('-') && `${major}.${minor}.${patch}` === `${fMajor}.${fMinor}.${fPatch}`)) return false;
  switch (floor.operator) {
    case '^': return fMajor > 0 ? major === fMajor : fMinor > 0 ? major === 0 && minor === fMinor : major === 0 && minor === 0 && patch === fPatch;
    case '~': return major === fMajor && minor === fMinor;
    case '>=': return true;
    default: return compareVersions(version, floor.version) === 0;
  }
}

/**
 * Whether a check that runs through `subject` runs. `met` says whether the installed `installed` satisfies `required`.
 * Returns { run: true } or { run: false, message } on a pull request or merge-queue run; throws on any other event.
 */
export function gate({ subject, required, installed, met, event = process.env.GITHUB_EVENT_NAME ?? '', what = 'the checks that run through it' }) {
  if (met) return { run: true };
  const unmet = `${subject} needs ${required}, and the installed published version is ${installed ?? 'missing'}`;
  if (!SKIP_EVENTS.has(event)) throw new Error(`${unmet}, on a ${event || 'local'} run: only a pull request or merge-queue run may skip ${what} (RR-55); publish ${required} first`);
  return { run: false, message: `RR-55: ${unmet}, so ${what} skip on this ${event} run. Every other check still runs; push to main and releases run them.` };
}

/** Prints the notice of a skip and says whether to run. */
export function report(result) {
  if (!result.run) console.log(`::notice title=Unreleased dependency::${result.message}`);
  return result.run;
}

/**
 * The CLI's optional peers that `executable` (the CLI entry the tests run) resolves, checked against the CLI's declared
 * peer ranges: { run, message?, peers: [{ name, range, installed }] }. `installedVersions` overrides the resolution (the
 * packed-install test installs exact versions it names itself).
 */
export function cliPeerGate({ cliRoot, executable, names, installedVersions = {}, event }) {
  const manifest = JSON.parse(readFileSync(path.join(cliRoot, 'package.json'), 'utf8'));
  const require = createRequire(executable);
  const peers = names.map((name) => {
    const range = manifest.peerDependencies?.[name];
    if (!range) throw new Error(`@openpresentation/cli declares no peer range for ${name}`);
    let installed = installedVersions[name];
    if (installed === undefined) {
      try { installed = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8')).version; } catch { installed = null; }
    }
    return { name, range, installed, met: installed !== null && satisfies(installed, range) };
  });
  const unmet = peers.filter((peer) => !peer.met);
  if (!unmet.length) return { run: true, peers };
  const result = gate({
    subject: '@openpresentation/cli',
    required: unmet.map((peer) => `${peer.name}@${peer.range}`).join(' and '),
    installed: unmet.map((peer) => `${peer.name} ${peer.installed ?? 'missing'}`).join(', '),
    met: false,
    event,
    what: 'its render, export and import tests (they run through the published peers)',
  });
  return { ...result, peers };
}
