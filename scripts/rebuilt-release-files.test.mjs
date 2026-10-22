import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {REBUILT, assertReproducible, isRebuilt, rebuiltBytes, rebuiltTree} from './rebuilt-release-files.mjs';

const config = {prefix: 'dist/', install: ['npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']], build: ['node', ['scripts/build.mjs']]};
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], {cwd, encoding: 'utf8'}).trim();

/** A package whose committed dist/ is stale: its build turns src/index.txt into dist/index.js and dist/extra.js. */
async function fixture() {
  const base = await mkdtemp(path.join(tmpdir(), 'rebuilt-release-'));
  const repo = path.join(base, 'repo');
  await mkdir(path.join(repo, 'scripts'), {recursive: true});
  await mkdir(path.join(repo, 'src'));
  await mkdir(path.join(repo, 'dist'));
  await writeFile(path.join(repo, 'package.json'), JSON.stringify({name: 'fixture-editor', version: '1.0.0'}));
  await writeFile(path.join(repo, 'package-lock.json'), JSON.stringify({name: 'fixture-editor', version: '1.0.0', lockfileVersion: 3, requires: true, packages: {'': {name: 'fixture-editor', version: '1.0.0'}}}));
  await writeFile(path.join(repo, 'src/index.txt'), 'replaceDocument');
  await writeFile(path.join(repo, 'scripts/build.mjs'), [
    "import {appendFileSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';",
    "if (process.env.BUILD_COUNTER) appendFileSync(process.env.BUILD_COUNTER, 'built\\n');",
    "mkdirSync('dist', {recursive: true});",
    "writeFileSync('dist/index.js', `export default '${readFileSync('src/index.txt', 'utf8')}';\\n`);",
    "writeFileSync('dist/extra.js', 'export {};\\n');",
  ].join('\n'));
  await writeFile(path.join(repo, 'dist/index.js'), "export default '';\n"); // committed before the source change
  git(repo, 'init', '-q');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'release');
  return {base, repo, ref: git(repo, 'rev-parse', 'HEAD'), cacheRoot: path.join(base, 'cache')};
}
const built = "export default 'replaceDocument';\n";

test('a stale committed dist/ does not matter: the rebuild supplies the expected bytes', async () => {
  const {base, repo, ref, cacheRoot} = await fixture();
  try {
    assert.equal((await rebuiltBytes({repo: 'fixture', checkout: repo, ref, file: 'dist/index.js', cacheRoot, config})).toString(), built);
    assert.equal(git(repo, 'show', `${ref}:dist/index.js`), "export default '';");
    await assertReproducible({repo: 'fixture', checkout: repo, ref, file: 'dist/index.js', installed: Buffer.from(built), cacheRoot, config});
    await assertReproducible({repo: 'fixture', checkout: repo, ref, file: 'dist/extra.js', installed: Buffer.from('export {};\n'), cacheRoot, config});
  } finally {
    await rm(base, {recursive: true, force: true});
  }
});

test('a tarball that differs from the rebuild fails with a message naming the file and ref', async () => {
  const {base, repo, ref, cacheRoot} = await fixture();
  try {
    const failure = (installed, file = 'dist/index.js') => assertReproducible({repo: 'fixture', checkout: repo, ref, file, installed: Buffer.from(installed), cacheRoot, config});
    await assert.rejects(failure(built + '// tampered\n'), (error) => error.message.includes('Published fixture file dist/index.js is not a reproducible build of fixture@' + ref) && /rebuilt sha256 [0-9a-f]{64}/.test(error.message));
    // The committed (stale) bytes are no longer accepted for build output: only a reproducible build is.
    await assert.rejects(failure("export default '';\n"), /not a reproducible build/);
    await assert.rejects(failure('x', 'dist/not-built.js'), /is not produced by rebuilding fixture@/);
  } finally {
    await rm(base, {recursive: true, force: true});
  }
});

test('the build runs once per gitHead (cached), without the committed dist/, and refuses a ref that is not a full SHA', async () => {
  const {base, repo, ref, cacheRoot} = await fixture();
  const counter = path.join(base, 'counter.txt');
  process.env.BUILD_COUNTER = counter;
  try {
    const first = await rebuiltTree({repo: 'fixture', checkout: repo, ref, cacheRoot, config});
    const second = await rebuiltTree({repo: 'fixture', checkout: repo, ref, cacheRoot, config});
    assert.equal(first, second);
    assert.equal((await readFile(counter, 'utf8')).trim().split('\n').length, 1);
    await assert.rejects(rebuiltTree({repo: 'fixture', checkout: repo, ref: 'HEAD', cacheRoot, config}), /Missing immutable verification ref/);
  } finally {
    delete process.env.BUILD_COUNTER;
    await rm(base, {recursive: true, force: true});
  }
});

test('a failing build is reported with its output and leaves no half-built cache entry', async () => {
  const {base, repo, ref, cacheRoot} = await fixture();
  try {
    const broken = {...config, build: ['node', ['scripts/missing.mjs']]};
    await assert.rejects(rebuiltTree({repo: 'fixture', checkout: repo, ref, cacheRoot, config: broken}), /failed \(exit 1\)/);
    assert.equal((await rebuiltBytes({repo: 'fixture', checkout: repo, ref, file: 'dist/index.js', cacheRoot, config})).toString(), built);
  } finally {
    await rm(base, {recursive: true, force: true});
  }
});

test('only opf-editor build output is rebuilt; every other file is compared with the commit', () => {
  assert.ok(isRebuilt('opf-editor', 'dist/index.js'));
  assert.ok(isRebuilt('opf-editor', 'dist/styles.css'));
  assert.ok(!isRebuilt('opf-editor', 'package.json'));
  assert.ok(!isRebuilt('opf-editor', 'README.md'));
  assert.ok(!isRebuilt('opf-render', 'dist/index.js'));
  assert.ok(!isRebuilt('opf', 'dist/index.js'));
  assert.deepEqual(REBUILT['opf-editor'].install, ['npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']]);
  assert.deepEqual(REBUILT['opf-editor'].build, ['node', ['scripts/build.mjs']]);
});
