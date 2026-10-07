// RR-55: the release plan can name a CLI whose optional peers (opf-render, opf-pptx) the plan's own render and pptx do
// not satisfy: CLI 0.11.0 declares `^0.13.1` and `^0.13.2` while the plan names 0.14.0. Installing it beside them then
// fails with ERESOLVE, and its commands call the previous sibling APIs, so the registry scripts that pair the plan's
// CLI with the plan's libraries skip it, with the notice below, until the plan names a CLI whose peer ranges the plan's
// libraries satisfy (`release-train prep cli`). That is the exact condition; no version heuristic and no shim. The
// peer ranges are read from the registry (`npm view <cli>@<version> peerDependencies --json`); a failed read is an
// error, never a silent skip.
import { spawnSync } from 'node:child_process';

const CLI = '@openpresentation/cli';
const PEERS = { '@openpresentation/opf-render': 'opf-render', '@openpresentation/opf-pptx': 'opf-pptx' };

// ---------------------------------------------------------------------------------------------------------------
// A small exact semver range check: x.y.z, partial and x-ranges, ^ and ~, comparators (>=, >, <=, <, =), hyphen ranges
// and `||`. Anything else throws. A pre-release version satisfies no range.

const PART = String.raw`(0|[1-9]\d*|[xX*])`;
const PARTIAL = new RegExp(String.raw`^v?${PART}(?:\.${PART}(?:\.${PART})?)?(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$`);

function parsePartial(text) {
  const match = PARTIAL.exec(text);
  if (!match) throw new Error(`Unsupported version or range: ${text}`);
  const parts = [match[1], match[2], match[3]].map((part) => (part === undefined || /[xX*]/.test(part) ? undefined : Number(part)));
  // A wildcard hides everything after it.
  for (let i = 1; i < 3; i += 1) if (parts[i - 1] === undefined) parts[i] = undefined;
  return parts;
}

function compare(a, b) {
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

const fill = (parts) => parts.map((part) => part ?? 0);

/** [lower inclusive, upper exclusive or null] of one term: a partial version, optionally with ^ or ~. */
function bounds(prefix, text) {
  const parts = parsePartial(text);
  const [major, minor, patch] = parts;
  if (major === undefined) return [[0, 0, 0], null];
  const lower = fill(parts);
  if (prefix === '^') {
    if (major !== 0) return [lower, [major + 1, 0, 0]];
    if (minor === undefined) return [lower, [1, 0, 0]];
    if (minor !== 0) return [lower, [0, minor + 1, 0]];
    if (patch === undefined) return [lower, [0, 1, 0]];
    return [lower, [0, 0, patch + 1]];
  }
  if (prefix === '~') return [lower, minor === undefined ? [major + 1, 0, 0] : [major, minor + 1, 0]];
  // No prefix: an exact version, or an x-range.
  if (minor === undefined) return [lower, [major + 1, 0, 0]];
  if (patch === undefined) return [lower, [major, minor + 1, 0]];
  return [lower, [major, minor, patch + 1]];
}

function satisfiesComparatorSet(version, set) {
  const tokens = set.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  // "a - b"
  if (tokens.length === 3 && tokens[1] === '-') {
    const low = bounds('', tokens[0])[0];
    const [high, highUpper] = bounds('', tokens[2]);
    return compare(version, low) >= 0 && (highUpper ? compare(version, highUpper) < 0 : compare(version, high) <= 0);
  }
  // "^1.2.3", ">=1.0.0", "> 1.0.0" (the operator and the version may be separate tokens)
  const terms = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (/^(>=|<=|>|<|=)$/.test(tokens[i])) {
      terms.push(tokens[i] + (tokens[i + 1] ?? ''));
      i += 1;
    } else terms.push(tokens[i]);
  }
  return terms.every((term) => {
    const [, op = '', text] = /^(\^|~|>=|<=|>|<|=)?(.+)$/.exec(term);
    if (op === '^' || op === '~' || op === '' || op === '=') {
      const [low, high] = bounds(op === '=' ? '' : op, text);
      return compare(version, low) >= 0 && (!high || compare(version, high) < 0);
    }
    const [low, high] = bounds('', text);
    if (op === '>=') return compare(version, low) >= 0;
    if (op === '>') return high ? compare(version, high) >= 0 : compare(version, low) > 0;
    if (op === '<') return compare(version, low) < 0;
    return high ? compare(version, high) < 0 : compare(version, low) <= 0; // <=
  });
}

/** True when `version` (a release such as "0.14.0") satisfies the npm `range`. Throws for syntax this check does not know. */
export function satisfies(version, range) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
  const parsed = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0];
  // Evaluate every set, so an unsupported range throws even for a pre-release version.
  const results = String(range).split('||').map((set) => satisfiesComparatorSet(parsed, set));
  return match !== null && results.some(Boolean);
}

// ---------------------------------------------------------------------------------------------------------------

const versionOf = (plan, name) => plan.packages.find((item) => item.name === name)?.version;

/** The peer ranges the registry holds for @openpresentation/cli@<version>; `{}` when it declares none. Throws when npm fails. */
export function npmPeers(version) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['view', `${CLI}@${version}`, 'peerDependencies', '--json'], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.error || result.status !== 0) throw new Error(`Cannot read the peer ranges of ${CLI}@${version} from npm: ${result.error?.message ?? (result.stderr.trim() || `npm exited ${result.status}`)}`);
  const text = result.stdout.trim();
  if (!text) return {};
  return JSON.parse(text) ?? {};
}

/**
 * The peers of the plan's CLI that the plan's libraries do not satisfy: `[{ name, short, range, planned }]`, empty when
 * the CLI runs beside them. `readPeers(cliVersion)` returns the CLI's `peerDependencies` (injectable for tests).
 */
export async function cliPeerMismatches(plan, { readPeers = npmPeers } = {}) {
  const cli = versionOf(plan, CLI);
  if (!cli) return [];
  const peers = (await readPeers(cli)) ?? {};
  const mismatches = [];
  for (const [name, short] of Object.entries(PEERS)) {
    const range = peers[name];
    const planned = versionOf(plan, name);
    if (range === undefined || planned === undefined) continue;
    if (!satisfies(planned, range)) mismatches.push({ name, short, range, planned });
  }
  return mismatches;
}

/** The notice a script prints when it skips the plan's CLI, or null when the CLI runs. */
export async function cliSkipNotice(plan, options) {
  const mismatches = await cliPeerMismatches(plan, options);
  if (!mismatches.length) return null;
  const requires = mismatches.map((item) => `${item.short} ${item.range}`).join(', ');
  const has = mismatches.map((item) => `${item.short} ${item.planned}`).join(', ');
  return `release plan's CLI ${versionOf(plan, CLI)} requires ${requires}; the plan has ${has}: skipped until a compatible CLI is in the plan`;
}

/** The plan's packages that can be installed together: without the CLI while its peer ranges conflict with the plan's libraries. */
export async function installablePackages(plan, options) {
  return (await cliPeerMismatches(plan, options)).length ? plan.packages.filter((item) => item.name !== CLI) : plan.packages;
}
