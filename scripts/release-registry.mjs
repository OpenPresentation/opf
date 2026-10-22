// MR-40: the registry half of scripts/release.mjs: version arithmetic, a minimal npm registry client, and the check of one
// published package (registry manifest, gitHead, dist-tag, lockstep ranges, SLSA provenance, signatures).
//
// The verification logic is the one the retired release train had (RR-51), without its GitHub API reads: the monorepo
// has one repository, one tag (`vX.Y.Z`) and one publisher workflow (`npm-publish.yml`), so the expected provenance is a
// constant and the expected commit is an argument.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const REPOSITORY = 'https://github.com/OpenPresentation/opf';
export const PUBLISH_WORKFLOW = '.github/workflows/npm-publish.yml';
export const SLSA = 'https://slsa.dev/provenance/v1';
const NOT_YET_SERVED = /\bnotarget\b|No matching version found/i;

// ---------------------------------------------------------------------------------------------------------------------
// Versions: SemVer without build metadata (a release tag never carries `+`).

const NUMERIC = '(?:0|[1-9]\\d*)';
const PRERELEASE_IDENTIFIER = `(?:${NUMERIC}|\\d*[A-Za-z-][0-9A-Za-z-]*)`;
const VERSION = new RegExp(`^(${NUMERIC})\\.(${NUMERIC})\\.(${NUMERIC})(?:-(${PRERELEASE_IDENTIFIER}(?:\\.${PRERELEASE_IDENTIFIER})*))?$`);

export const isVersion = (text) => typeof text === 'string' && VERSION.test(text);
export const isPrerelease = (version) => Boolean(VERSION.exec(version)?.[4]);

export function parseVersion(text) {
  const match = typeof text === 'string' ? VERSION.exec(text) : null;
  if (!match) throw new Error(`not a release version: ${text}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] ?? '' };
}

const numeric = (a, b) => (a.length !== b.length ? (a.length < b.length ? -1 : 1) : a === b ? 0 : a < b ? -1 : 1);

/** -1, 0 or 1 by SemVer precedence (a prerelease sorts below its release). */
export function compareVersions(a, b) {
  const x = VERSION.exec(a);
  const y = VERSION.exec(b);
  if (!x || !y) throw new Error(`not a release version: ${!x ? a : b}`);
  for (let i = 1; i <= 3; i += 1) {
    const order = numeric(x[i], y[i]);
    if (order) return order;
  }
  if (x[4] === y[4]) return 0;
  if (!x[4]) return 1;
  if (!y[4]) return -1;
  const left = x[4].split('.');
  const right = y[4].split('.');
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    if (left[i] === undefined) return -1;
    if (right[i] === undefined) return 1;
    if (left[i] === right[i]) continue;
    const l = /^\d+$/.test(left[i]);
    const r = /^\d+$/.test(right[i]);
    if (l && r) return numeric(left[i], right[i]);
    if (l !== r) return l ? -1 : 1;
    return left[i] < right[i] ? -1 : 1;
  }
  return 0;
}

/** The highest of `versions`, or undefined. */
export const highest = (versions) => versions.filter(isVersion).sort(compareVersions).at(-1);

// ---------------------------------------------------------------------------------------------------------------------
// A small exact semver range check (MR-34: it was the release plan's CLI-peer check): x.y.z, partial and x-ranges, ^ and ~, comparators (>=, >, <=, <, =), hyphen ranges
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

// ---------------------------------------------------------------------------------------------------------------------
// The registry

export function run(command, args, options = {}) {
  // npm is npm.cmd on Windows, which only a shell starts; the arguments here are fixed words and checked versions.
  const shell = process.platform === 'win32' && command === 'npm';
  const settings = { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options };
  const result = shell ? spawnSync([command, ...args].join(' '), { ...settings, shell: true }) : spawnSync(command, args, settings);
  if (result.error) throw result.error;
  return result;
}

/** A minimal npm registry client on fetch. `manifest` is null for a version the registry does not have. */
export function npmRegistry({ registry = 'https://registry.npmjs.org', fetchImpl = globalThis.fetch, exec = run } = {}) {
  const encode = (name) => name.replace('/', '%2f');
  async function get(url) {
    const response = await fetchImpl(url, { headers: { accept: 'application/json', 'cache-control': 'no-cache' } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GET ${url}: HTTP ${response.status}`);
    return response.json();
  }
  return {
    manifest: (name, version) => get(`${registry}/${encode(name)}/${version}`),
    distTags: async (name) => (await get(`${registry}/-/package/${encode(name)}/dist-tags`)) ?? {},
    attestations: (url) => get(url),
    /** `npm audit signatures` on a scratch project that installs exactly name@version. */
    auditSignatures(name, version, { scratch } = {}) {
      const dir = mkdtempSync(path.join(scratch ?? os.tmpdir(), 'release-audit-'));
      try {
        writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify({ name: 'release-audit', private: true, dependencies: { [name]: version } }, null, 2)}\n`);
        const install = exec('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--omit=peer', '--registry', registry], { cwd: dir });
        if (install.status !== 0) {
          const output = `${install.stderr}\n${install.stdout}`;
          return { ok: false, pending: NOT_YET_SERVED.test(output), error: `npm install failed: ${(install.stderr || install.stdout).trim().split('\n').slice(-3).join(' ')}` };
        }
        const audit = exec('npm', ['audit', 'signatures', '--json', '--include-attestations', '--registry', registry], { cwd: dir });
        try {
          return { ok: audit.status === 0, report: JSON.parse(audit.stdout) };
        } catch {
          return { ok: false, error: `npm audit signatures printed no JSON (exit ${audit.status}): ${(audit.stderr || audit.stdout).trim().slice(0, 300)}` };
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// verify one published package

/**
 * Retries `probe` while it reports { pending: true } (npm has not propagated what the packument already names) every
 * `pollSeconds` for at most `waitMinutes`. Anything else, including a present-but-wrong result, returns at once.
 */
async function settle(deps, what, probe, { waitMinutes = 0, pollSeconds = 30 } = {}) {
  const deadline = deps.now() + waitMinutes * 60_000;
  for (;;) {
    const result = await probe();
    if (!result.pending) return result;
    if (deps.now() >= deadline) return { ...result, timedOut: waitMinutes > 0 };
    deps.log(`waiting for npm to propagate ${what} (${result.detail})...`);
    await deps.sleep(pollSeconds * 1000);
  }
}

const pendingNote = (result, waitMinutes) => (result.timedOut ? ` (still not propagated after ${waitMinutes} min)` : '');

/**
 * Checks one published package. `deps` is { npm, now, sleep, log, scratch? }; `pkg` is { name, changelog? }; `expect` is
 * { version, commit, tag (`vX.Y.Z`), distTag, siblings: [names of the six], changelogHas?: (pkg, version) => boolean }.
 * Returns { ok, checks: [{ name, ok, detail }] }.
 *
 * The attestation bundle and the scratch install behind `npm audit signatures` lag the packument by minutes on a fresh
 * publish (HTTP 404 / notarget). With `waitMinutes` > 0 only those two are retried while they report "not yet there"; a bundle
 * that is there but wrong, or an invalid signature, fails at once.
 */
export async function verifyPackage(deps, pkg, expect, { auditSignatures = true, waitMinutes = 0, pollSeconds = 30 } = {}) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });
  const patience = { waitMinutes, pollSeconds };
  const { version, commit, tag, distTag } = expect;
  const manifest = await deps.npm.manifest(pkg.name, version);
  if (!manifest) {
    add('npm version', false, `${pkg.name}@${version} is not on the registry`);
    return { ok: false, checks };
  }
  add('npm version', manifest.version === version, `${pkg.name}@${manifest.version}, integrity ${manifest.dist?.integrity ?? 'none'}`);
  add('gitHead', Boolean(commit) && manifest.gitHead === commit, `gitHead ${manifest.gitHead ?? 'missing'} ${manifest.gitHead === commit ? '=' : '!='} release commit ${commit}`);

  const tags = await deps.npm.distTags(pkg.name);
  add('dist-tag', tags[distTag] === version, `${distTag} is ${tags[distTag] ?? 'unset'}${tags[distTag] === version ? '' : `, expected ${version}`}`);

  // A published manifest never carries a workspace: specifier, and every sibling range is the lockstep floor ^X.Y.Z (D12, D14).
  const ranges = [];
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, range] of Object.entries(manifest[field] ?? {})) {
      if (/^(workspace|catalog):/.test(range)) ranges.push(`${field} ${name} is ${range}`);
      else if (expect.siblings.includes(name) && range !== `^${version}`) ranges.push(`${field} ${name} is ${range}, expected ^${version}`);
    }
  }
  add('lockstep ranges', ranges.length === 0, ranges.length ? ranges.join('; ') : 'every sibling range is ^<this version>, no workspace: specifier');

  if (expect.changelogHas) add('changelog', expect.changelogHas(pkg, version), `the package changelog has a ${version} section`);

  const attestations = manifest.dist?.attestations;
  add('dist.attestations', attestations?.provenance?.predicateType === SLSA, attestations ? `${attestations.provenance?.predicateType ?? 'no provenance predicate'} (${attestations.url})` : 'the registry lists no attestations');
  if (attestations?.url) {
    const fetched = await settle(
      deps,
      `the attestation bundle of ${pkg.name}@${version}`,
      async () => {
        const bundle = await deps.npm.attestations(attestations.url);
        return bundle ? { bundle } : { pending: true, detail: `HTTP 404 from ${attestations.url}` };
      },
      patience,
    );
    const slsa = (fetched.bundle?.attestations ?? []).find((entry) => entry.predicateType === SLSA);
    if (fetched.pending) add('SLSA provenance', false, `the attestation bundle is not served yet (HTTP 404)${pendingNote(fetched, waitMinutes)}`);
    else if (!slsa) add('SLSA provenance', false, 'no SLSA provenance in the attestation bundle');
    else {
      const statement = JSON.parse(Buffer.from(slsa.bundle.dsseEnvelope.payload, 'base64').toString('utf8'));
      const workflow = statement.predicate?.buildDefinition?.externalParameters?.workflow ?? {};
      const source = statement.predicate?.buildDefinition?.resolvedDependencies?.[0]?.digest?.gitCommit;
      const integrity = manifest.dist?.integrity?.startsWith('sha512-') ? Buffer.from(manifest.dist.integrity.slice(7), 'base64').toString('hex') : null;
      const subject = statement.subject?.[0]?.digest?.sha512;
      const problems = [];
      if (workflow.repository !== REPOSITORY) problems.push(`repository ${workflow.repository}`);
      if (workflow.path !== PUBLISH_WORKFLOW) problems.push(`workflow ${workflow.path}`);
      if (workflow.ref !== `refs/tags/${tag}`) problems.push(`ref ${workflow.ref}`);
      if (!commit || source !== commit) problems.push(`source commit ${source}`);
      if (!integrity || subject !== integrity) problems.push('subject digest differs from dist.integrity');
      const run = statement.predicate?.runDetails?.metadata?.invocationId;
      add('SLSA provenance', problems.length === 0, problems.length ? `does not match: ${problems.join(', ')}` : `built by ${PUBLISH_WORKFLOW} on refs/tags/${tag} from ${source.slice(0, 12)}${run ? ` (${run})` : ''}`);
    }
  }
  if (auditSignatures) {
    const audit = await settle(
      deps,
      `${pkg.name}@${version} for \`npm audit signatures\``,
      async () => {
        const result = deps.npm.auditSignatures(pkg.name, version, { scratch: deps.scratch });
        return result.pending ? { ...result, detail: result.error } : result;
      },
      patience,
    );
    if (!audit.report) add('npm audit signatures', false, `${audit.error}${pendingNote(audit, waitMinutes)}`);
    else {
      const own = (audit.report.verified ?? []).find((entry) => entry.name === pkg.name && entry.version === version);
      const invalid = audit.report.invalid ?? [];
      const missing = audit.report.missing ?? [];
      const ok = audit.ok && invalid.length === 0 && missing.length === 0 && Boolean(own?.attestations);
      add('npm audit signatures', ok, `${(audit.report.verified ?? []).length} verified, ${invalid.length} invalid, ${missing.length} missing; ${pkg.name}@${version} ${own?.attestations ? 'has a verified attestation' : 'has no verified attestation'}`);
    }
  }
  return { ok: checks.every((check) => check.ok), checks };
}

export function formatVerify(pkg, version, result) {
  return [`${pkg.name}@${version}: ${result.ok ? 'verified' : 'NOT verified'}`, ...result.checks.map((check) => `  ${check.ok ? 'ok  ' : 'FAIL'} ${check.name}: ${check.detail}`)].join('\n');
}
