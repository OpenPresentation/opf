// MR-34: the set of published packages the registry-facing consumers test (the nightly `registry` job, slow-checks' published
// matrix and installed parity). It replaces `release-plan.json`: the set is whatever the `latest` dist-tag of each of the six
// packages names on npm (or another tag, OPF_REGISTRY_TAG, for example `next` for a release candidate), not a file somebody edits.
//
// The consumers want the old plan's shape, so `registryPlan()` returns it:
//   packages             the five packages that were versioned together before the shared line (core, renderer, editor, PPTX, CLI)
//   independentPackages  the gallery (its own version until 0.26.0, the same version after it)
//   verificationRefs     <repository key> -> the commit the published version was built from: the registry's `gitHead`, which a
//                        release stamps (scripts/stamp-githead.mjs). A commit of one of the archived repositories (opf-render,
//                        opf-pptx, opf-editor, gallery) is not in this repository's object database; it is translated to the
//                        commit this repository imported it as (docs/programs/monorepo/commit-map/<repository>.txt), whose tree
//                        holds that package under packages/<directory>/.
//   exampleRefs          the editor's commit, as before
//
// `treePath(key, file)` is the path of a file of that release commit inside this repository: the old repositories' root-relative
// paths (`test/x.mjs`) become `packages/<directory>/test/x.mjs`; core's are already root-relative (the archived core repository
// is this repository's own history).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The six packages: repository key (as the old plan named it), npm name and the directory of the package in this repository. */
export const SET = Object.freeze([
  { key: 'opf', name: '@openpresentation/opf', directory: 'packages/javascript', rootRelative: true },
  { key: 'opf-render', name: '@openpresentation/opf-render', directory: 'packages/render' },
  { key: 'opf-editor', name: '@openpresentation/opf-editor', directory: 'packages/editor' },
  { key: 'opf-pptx', name: '@openpresentation/opf-pptx', directory: 'packages/pptx' },
  { key: 'cli', name: '@openpresentation/cli', directory: 'packages/cli', rootRelative: true },
  { key: 'gallery', name: '@openpresentation/gallery', directory: 'packages/gallery' },
]);
const byKey = (key) => {
  const entry = SET.find((item) => item.key === key);
  if (!entry) throw new Error(`unknown repository key ${key}`);
  return entry;
};

const FULL_SHA = /^[0-9a-f]{40}$/;
const VERSION = /^\d+\.\d+\.\d+$/;

/** The path of `file` of release `key` inside this repository's tree (see the header). */
export function treePath(key, file) {
  const entry = byKey(key);
  const relative = file.replace(/^\.\//, '');
  return entry.rootRelative ? relative : `${entry.directory}/${relative}`;
}

/** `old -> new` from a commit map file (a header line, then `<old sha> <new sha>` lines); undefined when the commit is not mapped. */
export function mapCommit(sha, mapText) {
  for (const line of mapText.split(/\r?\n/)) {
    const [from, to] = line.trim().split(/\s+/);
    if (from === sha && FULL_SHA.test(to ?? '')) return to;
  }
  return undefined;
}

const hasCommit = (sha, cwd) => spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd, stdio: 'ignore' }).status === 0;

/**
 * The commit of this repository that holds release commit `sha` of repository `key`: `sha` itself when this repository has it
 * (core's own history, or a commit of the shared line), else its mapped import. Throws when neither exists, naming the fix.
 */
export function resolveRef(key, sha, { cwd = root, exists = hasCommit, readMap = (name) => readFileSync(path.join(cwd, 'docs/programs/monorepo/commit-map', `${name}.txt`), 'utf8') } = {}) {
  if (!FULL_SHA.test(sha ?? '')) throw new Error(`${key}: the registry's gitHead is not a full commit SHA: ${JSON.stringify(sha)}`);
  if (exists(sha, cwd)) return sha;
  let mapped;
  try {
    mapped = mapCommit(sha, readMap(key));
  } catch {
    // no map for this key (core and the CLI are this repository's own history)
  }
  if (mapped && exists(mapped, cwd)) return mapped;
  throw new Error(`${key}: release commit ${sha} is not in this checkout and is not in docs/programs/monorepo/commit-map/${key}.txt; fetch the full history (git fetch --unshallow)`);
}

/** `npm view <spec> version gitHead --json` as { version, gitHead }. */
export function npmView(spec) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['view', spec, 'version', 'gitHead', '--json', '--prefer-online'], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.error || result.status !== 0) throw new Error(`cannot read ${spec} from npm: ${result.error?.message ?? (result.stderr.trim() || `npm exited ${result.status}`)}`);
  const data = JSON.parse(result.stdout);
  return { version: data.version, gitHead: data.gitHead };
}

/**
 * The published set: the registry's `tag` of each package. `overrides` ("<name>@<version>", comma or space separated;
 * default OPF_REGISTRY_OVERRIDES) replaces single packages, for example a patch release the tag does not name yet.
 * `view(spec)` is injectable for tests. `refs: false` leaves each verification ref as the registry's raw gitHead (no translation, no
 * history needed): for a consumer that only wants the versions.
 */
export function registryPlan({ tag = process.env.OPF_REGISTRY_TAG || 'latest', overrides = process.env.OPF_REGISTRY_OVERRIDES ?? '', view = npmView, resolve = resolveRef, refs = true } = {}) {
  const pinned = new Map();
  for (const spec of String(overrides).split(/[\s,]+/).filter(Boolean)) {
    const at = spec.lastIndexOf('@');
    const name = spec.slice(0, at);
    if (!SET.some((item) => item.name === name)) throw new Error(`OPF_REGISTRY_OVERRIDES names ${name}, which is not one of ${SET.map((item) => item.name).join(', ')}`);
    pinned.set(name, spec.slice(at + 1));
  }
  const plan = { tag, packages: [], independentPackages: [], verificationRefs: {}, exampleRefs: {} };
  for (const entry of SET) {
    const { version, gitHead } = view(`${entry.name}@${pinned.get(entry.name) ?? tag}`);
    if (!VERSION.test(version ?? '')) throw new Error(`${entry.name}@${tag} is ${JSON.stringify(version)}, not an exact release version`);
    (entry.key === 'gallery' ? plan.independentPackages : plan.packages).push({ name: entry.name, version });
    plan.verificationRefs[entry.key] = refs ? resolve(entry.key, gitHead) : gitHead;
  }
  plan.exampleRefs['opf-editor'] = plan.verificationRefs['opf-editor'];
  return plan;
}

// node scripts/registry-plan.mjs                prints the set as JSON
// node scripts/registry-plan.mjs ref <key>      the registry's gitHead of one package (opf, opf-render, opf-editor, opf-pptx, cli, gallery), untranslated
// node scripts/registry-plan.mjs version <key>  its published version
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, key] = process.argv.slice(2);
    const plan = registryPlan({ refs: command === undefined });
    if (command === 'ref') console.log(plan.verificationRefs[byKey(key).key]);
    else if (command === 'version') console.log([...plan.packages, ...plan.independentPackages].find((item) => item.name === byKey(key).name).version);
    else if (command === undefined) console.log(JSON.stringify(plan, null, 2));
    else throw new Error('usage: registry-plan.mjs [ref|version <key>]');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
