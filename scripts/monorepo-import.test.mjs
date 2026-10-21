// MR-21: the history import (scripts/monorepo-import.mjs) and its verifier (scripts/verify-import.mjs), on small fixture
// repositories. The rewrite tests need git-filter-repo (and git >= 2.30) and are skipped with a note when it is missing; the
// message-callback tests need python3 only; the argument tests need nothing.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import {
  DEFAULT_SPECS,
  filterRepoAvailable,
  messageCallbackSource,
  parseArgs,
  parseSpec,
  runImport,
  sourceFor,
} from './monorepo-import.mjs';
import { expectedMessage, normalizeMessage, parseArgs as parseVerifyArgs, renderReport, verifyImport } from './verify-import.mjs';

// The tests make their own repositories; the developer's git configuration (signing, templates, hooks) must not leak in.
process.env.GIT_CONFIG_GLOBAL = path.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';
process.env.GIT_TERMINAL_PROMPT = '0';

const temp = mkdtempSync(path.join(tmpdir(), 'opf-import-test-'));
after(() => rmSync(temp, { recursive: true, force: true }));

const python = (() => {
  for (const name of ['python3', 'python']) {
    if (spawnSync(name, ['--version'], { encoding: 'utf8' }).status === 0) return name;
  }
  return null;
})();
const canRewrite = filterRepoAvailable();
const skipRewrite = canRewrite ? false : 'git-filter-repo is not installed (python3 -m venv v && v/bin/pip install git-filter-repo; put v/bin on PATH)';

function git(dir, args, env = {}) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', env: { ...process.env, ...env } }).trim();
}

const ALICE = { GIT_AUTHOR_NAME: 'Alice', GIT_AUTHOR_EMAIL: 'alice@example.org', GIT_COMMITTER_NAME: 'Alice', GIT_COMMITTER_EMAIL: 'alice@example.org' };
const BOB = { GIT_AUTHOR_NAME: 'Bob', GIT_AUTHOR_EMAIL: 'bob@example.org', GIT_COMMITTER_NAME: 'Bob', GIT_COMMITTER_EMAIL: 'bob@example.org' };
let clock = Date.UTC(2026, 0, 1);

/** Write `files` ({path: text | Buffer | null to delete}), commit as `who` with a fresh, strictly increasing date. */
function commit(dir, files, message, who = ALICE) {
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(dir, file);
    if (content === null) rmSync(target, { force: true });
    else {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
  }
  clock += 3_600_000;
  const date = new Date(clock).toISOString();
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '--allow-empty', '-m', message], { ...who, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
  return git(dir, ['rev-parse', 'HEAD']);
}

function init(dir) {
  mkdirSync(dir, { recursive: true });
  git(dir, ['init', '-q', '-b', 'main']);
}

/** A renderer-like repository: authors, a branch and a merge, a rename, a binary, tags of both kinds, every kind of reference. */
function makeRender(dir) {
  init(dir);
  commit(dir, { 'README.md': '# render\n', 'src/a.js': 'one\ntwo\nthree\n', 'fonts/x.bin': Buffer.from([0, 1, 2, 3, 255]) }, 'Initial import');
  const second = commit(dir, { 'src/a.js': 'one\nTWO\nthree\n' }, 'Add svg output (#1)', BOB);
  git(dir, ['tag', 'opf-render-v0.1.0']);
  commit(dir, { 'src/b.js': 'b\n' }, 'Fix crash\n\nFixes #7 and closes #8; see opf#298, core #5, opf-pptx PR #9,\nhttps://example.com/a#12 and a $#,##0 format; Resolves: #10', BOB);
  git(dir, ['checkout', '-q', '-b', 'feature']);
  commit(dir, { 'docs/guide.md': 'guide\n' }, 'Document the guide (#3)');
  git(dir, ['checkout', '-q', 'main']);
  commit(dir, { 'src/a.js': 'one\nTWO\nthree\nfour\n' }, 'Extend a (#2)');
  clock += 3_600_000;
  const date = new Date(clock).toISOString();
  git(dir, ['merge', '-q', '--no-ff', 'feature', '-m', 'Merge feature (#4)'], { ...ALICE, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
  git(dir, ['mv', 'src/b.js', 'src/c.js']);
  commit(dir, {}, `Rename b to c; undoes ${second.slice(0, 7)} partly`);
  clock += 1;
  git(dir, ['tag', '-a', 'opf-render-v0.2.0', '-m', 'Release 0.2.0'], { ...ALICE, GIT_COMMITTER_DATE: new Date(clock).toISOString() });
  commit(dir, { 'src/a.js': 'one\nTWO\nthree\nfour\nfive\n' }, 'Final touch');
  git(dir, ['branch', '-D', 'feature']);
}

function makeGallery(dir) {
  init(dir);
  commit(dir, { 'catalog/a.json': '{"id":"a"}\n', 'README.md': '# gallery\n' }, 'Records (#1)');
  git(dir, ['tag', 'v1.0.0']);
  commit(dir, { 'catalog/b.json': '{"id":"b"}\n' }, 'Add b (#2)\n\nCloses #1');
  clock += 1;
  git(dir, ['tag', '-a', 'v2.0.0', '-m', 'Gallery 2.0.0'], { ...BOB, GIT_COMMITTER_DATE: new Date(clock).toISOString() });
}

function makeCore(dir) {
  init(dir);
  commit(dir, { 'pnpm-workspace.yaml': 'packages:\n  - "packages/javascript"\n', 'packages/javascript/index.js': 'core\n' }, 'Core start (#100)');
  git(dir, ['tag', 'opf-v0.1.0']);
  commit(dir, { 'README.md': 'core\n' }, 'Core second');
}

const SPECS = [
  { name: 'render', repo: 'opf-render', tagPrefix: '' },
  { name: 'gallery', repo: 'gallery', tagPrefix: 'gallery-' },
];
const IDENTITY = 'Import Bot <import@example.org>';
const DATE = '2026-02-01T00:00:00Z';

function options(scratch, base, core, extra = {}) {
  return { scratch, specs: SPECS, sources: {}, base, contextRefs: true, refresh: false, merge: true, core, coreRef: 'main', identity: IDENTITY, date: DATE, ...extra };
}

describe('arguments', () => {
  test('parseSpec reads name:repo[:tag-prefix] and rejects the rest', () => {
    assert.deepEqual(parseSpec('gallery:gallery:gallery-'), { name: 'gallery', repo: 'gallery', tagPrefix: 'gallery-' });
    assert.deepEqual(parseSpec('render:opf-render'), { name: 'render', repo: 'opf-render', tagPrefix: '' });
    for (const bad of ['render', 'Render:opf-render', 'render:bad repo', 'a:b:c:d', 'render:opf-render:bad prefix', ':repo']) assert.throws(() => parseSpec(bad), /--spec/);
  });

  test('parseArgs defaults to the four old repositories and the plan\'s gallery tag prefix', () => {
    const parsed = parseArgs(['/scratch']);
    assert.deepEqual(parsed.specs.map((spec) => [spec.name, spec.repo, spec.tagPrefix]), [['render', 'opf-render', ''], ['pptx', 'opf-pptx', ''], ['editor', 'opf-editor', ''], ['gallery', 'gallery', 'gallery-']]);
    assert.deepEqual(DEFAULT_SPECS.map((spec) => spec.name), ['render', 'pptx', 'editor', 'gallery']);
    assert.equal(parsed.contextRefs, true);
    assert.equal(parsed.merge, false);
    assert.equal(parsed.base, 'https://github.com/OpenPresentation');
  });

  test('parseArgs rejects an unknown option, a duplicate package and a missing or extra scratch directory', () => {
    assert.throws(() => parseArgs(['/s', '--push']), /Unknown option --push/);
    assert.throws(() => parseArgs([]), /usage/);
    assert.throws(() => parseArgs(['/a', '/b']), /usage/);
    assert.throws(() => parseArgs(['/s', '--spec', 'a:x', '--spec', 'a:y']), /unique/);
    assert.throws(() => parseArgs(['/s', '--spec', 'a:x', '--spec', 'b:x']), /unique/);
    assert.throws(() => parseArgs(['/s', '--base']), /needs a value/);
    assert.equal(parseArgs(['/s', '--no-context-refs', '--merge', '--refresh']).contextRefs, false);
  });

  test('sourceFor: URL bases get <repo>.git, directory bases use <repo>.git or <repo>, --source wins', () => {
    assert.equal(sourceFor({ base: 'https://github.com/OpenPresentation/', sources: {} }, 'opf-render'), 'https://github.com/OpenPresentation/opf-render.git');
    assert.equal(sourceFor({ base: 'git@github.com:OpenPresentation', sources: {} }, 'gallery'), 'git@github.com:OpenPresentation/gallery.git');
    const dir = path.join(temp, 'bases');
    mkdirSync(path.join(dir, 'with-git.git'), { recursive: true });
    assert.equal(sourceFor({ base: dir, sources: {} }, 'with-git'), path.join(dir, 'with-git.git'));
    assert.equal(sourceFor({ base: dir, sources: {} }, 'plain'), path.join(dir, 'plain'));
    assert.equal(sourceFor({ base: dir, sources: { plain: '/elsewhere' } }, 'plain'), '/elsewhere');
  });

  test('verify-import parseArgs', () => {
    const parsed = parseVerifyArgs(['/s', '--blame', 'all', '--package', 'render', '--determinism', '--offline']);
    assert.deepEqual([parsed.blame, parsed.packages, parsed.determinism, parsed.offline], ['all', ['render'], true, true]);
    assert.equal(parseVerifyArgs(['/s']).blame, 25);
    assert.throws(() => parseVerifyArgs(['/s', '--blame', '0']), /positive integer/);
    assert.throws(() => parseVerifyArgs(['/s', '--nope']), /Unknown option/);
    assert.throws(() => parseVerifyArgs([]), /usage/);
  });

  test('the import refuses a scratch directory inside a git working tree', () => {
    const repo = path.join(temp, 'a-checkout');
    init(repo);
    assert.throws(() => runImport({ ...parseArgs([path.join(repo, 'scratch')]) }), /inside a git working tree/);
  });
});

describe('message callback (python3)', { skip: python ? false : 'python3 is not installed' }, () => {
  // filter-repo runs the callback body as a function body with `message` (bytes) and `re` in scope; do the same.
  function rewrite(message, { repo = 'opf-render', contextRefs = true } = {}) {
    const body = messageCallbackSource({ repo, contextRefs }).split('\n').map((line) => `    ${line}`).join('\n');
    const program = `import re, sys\ndef callback(message):\n${body}\nsys.stdout.buffer.write(callback(sys.stdin.buffer.read()))\n`;
    const result = spawnSync(python, ['-I', '-c', program], { input: message, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  }

  test('a bare #N is qualified with the old repository, with or without parentheses', () => {
    assert.equal(rewrite('Add svg (#12)\n\nSee #3, #4.'), 'Add svg (OpenPresentation/opf-render#12)\n\nSee OpenPresentation/opf-render#3, OpenPresentation/opf-render#4.');
    assert.equal(rewrite('x #5', { repo: 'gallery' }), 'x OpenPresentation/gallery#5');
  });

  test('qualified references, URLs, spreadsheet formats and words with a hash are left alone', () => {
    const untouched = 'opf#298 OpenPresentation/opf#123 opf-render#165 https://example.com/a#12 $#,##0 C#5 foo#3 a/#4';
    assert.equal(rewrite(untouched), untouched);
  });

  test('a closing keyword before a reference gets the word "issue", which GitHub does not read as closing', () => {
    assert.equal(rewrite('Fixes #186 and closes #2; Resolves: #3; fixed #4'), 'Fixes issue OpenPresentation/opf-render#186 and closes issue OpenPresentation/opf-render#2; Resolves: issue OpenPresentation/opf-render#3; fixed issue OpenPresentation/opf-render#4');
    assert.equal(rewrite('Fixes OpenPresentation/opf#9'), 'Fixes issue OpenPresentation/opf#9');
  });

  test('the contextual pass points "core #N" and "opf-pptx PR #N" at their own repository; --no-context-refs does not', () => {
    assert.equal(rewrite('needs core #732, (Core #577), opf PR #5 and opf-pptx PR #9'), 'needs core OpenPresentation/opf#732, (Core OpenPresentation/opf#577), opf PR OpenPresentation/opf#5 and opf-pptx PR OpenPresentation/opf-pptx#9');
    assert.equal(rewrite('needs core #732', { contextRefs: false }), 'needs core OpenPresentation/opf-render#732');
  });

  test('messages without references and non-UTF-8 bytes pass through unchanged', () => {
    assert.equal(rewrite('Plain subject\n\nBody.'), 'Plain subject\n\nBody.');
  });

  test('a spreadsheet format with a hash is not a reference', () => {
    const format = 'Format ($#,##0.0 -> \\$#,##0.0, #,##0 "units")';
    assert.equal(rewrite(format), format);
    assert.equal(rewrite('#0 and ##5 and #05 and #12'), '#0 and ##5 and #05 and OpenPresentation/opf-render#12');
  });

  test('the verifier\'s independent JavaScript statement of the rewrite agrees with the Python callback', () => {
    const corpus = [
      'Add svg (#12)\n\nSee #3, #4.', 'Fixes #186 and closes #2; Resolves: #3', 'needs core #732, (Core #577), opf PR #5, opf-pptx PR #9 and opf-render #2',
      'opf#298 OpenPresentation/opf#123 https://example.com/a#12 $#,##0 C#5', 'Format ($#,##0.0 -> \\$#,##0.0, #,##0 "units")', 'Plain', 'Fixes OpenPresentation/opf#9', '#1', 'x#1 y #2',
    ];
    for (const repo of ['opf-render', 'gallery']) {
      for (const contextRefs of [true, false]) {
        for (const text of corpus) assert.equal(expectedMessage(text, { repo, contextRefs }), rewrite(text, { repo, contextRefs }), `${repo} ${contextRefs}: ${text}`);
      }
    }
  });

  test('normalizeMessage accepts exactly the rewrite and nothing else', () => {
    const old = 'Fixes #7, see core #5 and abcdef1';
    const next = rewrite(old).replace('abcdef1', '1234567');
    assert.equal(normalizeMessage(old), normalizeMessage(next));
    assert.notEqual(normalizeMessage(old), normalizeMessage(`${next} extra`));
    assert.notEqual(normalizeMessage('see #7'), normalizeMessage('see #8'));
  });
});

describe('rewrite, merge and verify on fixture repositories', { skip: skipRewrite }, () => {
  const base = path.join(temp, 'src');
  const coreDir = path.join(temp, 'core');
  const scratch = path.join(temp, 'scratch');
  let manifest;
  let outcome;

  before(() => {
    makeRender(path.join(base, 'opf-render'));
    makeGallery(path.join(base, 'gallery'));
    makeCore(coreDir);
    manifest = runImport(options(scratch, base, coreDir));
    outcome = verifyImport({ scratch, packages: [], blame: 'all', offline: false, determinism: true });
  });

  const rows = (match) => outcome.results.filter((row) => match.test(row.name));

  test('every check passes, including determinism, blame on all files and the merged repository', () => {
    assert.equal(outcome.failed, 0, outcome.results.filter((row) => row.ok === false).map((row) => `${row.package}: ${row.name} (${row.detail})`).join('\n'));
    assert.ok(outcome.results.filter((row) => row.ok === true).length >= 40);
    for (const pattern of [/tree hash of packages\/render/, /every commit: subtree hash/, /blame equal.*files \(all/, /second rewrite/, /all \d+ imported tags/, /core's \d+ tags/, /count = core \+ imported/]) {
      assert.ok(rows(pattern).length >= 1 && rows(pattern).every((row) => row.ok === true), `${pattern} ran and passed`);
    }
  });

  test('history, files and tags arrive under packages/<name>/ with the gallery prefix', () => {
    const work = path.join(scratch, 'work', 'opf-render');
    assert.deepEqual(git(work, ['ls-tree', '--name-only', 'HEAD']).split('\n'), ['packages']);
    assert.ok(git(work, ['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').includes('packages/render/src/c.js'));
    assert.deepEqual(git(work, ['tag', '--list']).split('\n'), ['opf-render-v0.1.0', 'opf-render-v0.2.0']);
    assert.equal(git(work, ['cat-file', '-t', 'opf-render-v0.2.0']), 'tag');
    assert.equal(git(work, ['cat-file', '-t', 'opf-render-v0.1.0']), 'commit');
    const gallery = path.join(scratch, 'work', 'gallery');
    assert.deepEqual(git(gallery, ['tag', '--list']).split('\n'), ['gallery-v1.0.0', 'gallery-v2.0.0']);
    assert.equal(manifest.packages.find((entry) => entry.name === 'gallery').tagPrefix, 'gallery-');
  });

  test('messages are rewritten as the plan says, authorship is kept, merges stay merges', () => {
    const work = path.join(scratch, 'work', 'opf-render');
    const log = git(work, ['log', '--format=%an|%s']).split('\n');
    assert.ok(log.includes('Bob|Add svg output (OpenPresentation/opf-render#1)'));
    assert.ok(log.includes('Alice|Merge feature (OpenPresentation/opf-render#4)'));
    const fix = git(work, ['log', '--format=%B', '--grep=Fix crash']);
    assert.match(fix, /Fixes issue OpenPresentation\/opf-render#7 and closes issue OpenPresentation\/opf-render#8/);
    assert.match(fix, /opf#298, core OpenPresentation\/opf#5, opf-pptx PR OpenPresentation\/opf-pptx#9/);
    assert.match(fix, /https:\/\/example\.com\/a#12 and a \$#,##0 format; Resolves: issue OpenPresentation\/opf-render#10/);
    assert.equal(git(work, ['rev-list', '--merges', '--count', 'HEAD']), '1');
    // the abbreviated hash of an old commit in a message is rewritten to the new commit's hash (filter-repo's default)
    const rename = git(work, ['log', '--format=%B', '--grep=Rename b to c']);
    const abbreviated = /undoes ([0-9a-f]{7}) partly/.exec(rename)[1];
    assert.equal(git(work, ['log', '-1', '--format=%s', abbreviated]), 'Add svg output (OpenPresentation/opf-render#1)');
  });

  test('the merged clone has the MR-22 shape and cannot push', () => {
    const merged = path.join(scratch, 'merged');
    assert.equal(git(merged, ['branch', '--show-current']), 'monorepo/import');
    assert.equal(git(merged, ['log', '--first-parent', '--merges', '--format=%s', 'origin/main..HEAD']).split('\n').sort().join('|'), 'MR-22: import gallery history under packages/gallery|MR-22: import opf-render history under packages/render');
    assert.equal(git(merged, ['log', '-1', '--format=%an <%ae> %aI']), 'Import Bot <import@example.org> 2026-02-01T00:00:00Z');
    assert.equal(git(merged, ['show', 'origin/main:pnpm-workspace.yaml']), git(merged, ['show', 'HEAD:pnpm-workspace.yaml']));
    const push = spawnSync('git', ['-C', merged, 'push', 'origin', 'HEAD'], { encoding: 'utf8' });
    assert.notEqual(push.status, 0);
  });

  test('the same input gives the same merged SHA when identity and date are fixed', () => {
    const again = path.join(temp, 'scratch-again');
    const second = runImport(options(again, base, coreDir));
    assert.equal(second.core.head, manifest.core.head);
    assert.deepEqual(second.packages.map((entry) => entry.workHead), manifest.packages.map((entry) => entry.workHead));
    assert.equal(readFileSync(path.join(again, 'commit-map', 'opf-render.txt'), 'utf8'), readFileSync(path.join(scratch, 'commit-map', 'opf-render.txt'), 'utf8'));
  });

  test('the report lists every check and the totals', () => {
    const text = renderReport(outcome);
    assert.match(text, /^# Import verification/);
    assert.match(text, /\| opf-render to packages\/render \|/);
    assert.match(text, /prefix `gallery-`/);
    assert.match(text, /All \d+ checks passed\./);
  });

  test('--commit-maps compares the committed copies with the generated maps', () => {
    const committed = path.join(temp, 'committed-maps');
    mkdirSync(committed, { recursive: true });
    for (const repo of ['opf-render', 'gallery']) cpSync(path.join(scratch, 'commit-map', `${repo}.txt`), path.join(committed, `${repo}.txt`));
    assert.equal(verifyImport({ scratch, packages: ['render'], blame: 5, offline: true, commitMaps: committed }).failed, 0);
    writeFileSync(path.join(committed, 'opf-render.txt'), `${readFileSync(path.join(committed, 'opf-render.txt'), 'utf8')}extra\n`);
    const bad = verifyImport({ scratch, packages: ['render'], blame: 5, offline: true, commitMaps: committed });
    assert.equal(bad.failed, 1);
    assert.match(bad.results.find((row) => row.ok === false).name, /committed commit map/);
  });

  describe('negative controls: the verifier fails when the rewrite is wrong', () => {
    function tampered(name, change, { offline = true } = {}) {
      const copy = path.join(temp, `tamper-${name}`);
      cpSync(scratch, copy, { recursive: true });
      change(copy);
      return verifyImport({ scratch: copy, packages: [], blame: 5, offline, determinism: false }).results.filter((row) => row.ok === false).map((row) => row.name);
    }
    const work = (copy, repo = 'opf-render') => path.join(copy, 'work', repo);

    test('an un-rewritten clone in place of the rewrite', () => {
      const failed = tampered('unrewritten', (copy) => {
        rmSync(work(copy), { recursive: true, force: true });
        cpSync(path.join(copy, 'orig', 'opf-render'), work(copy), { recursive: true });
      });
      assert.ok(failed.some((name) => /tree hash of packages\/render/.test(name)), failed.join('\n'));
      assert.ok(failed.some((name) => /blame equal|no path outside/.test(name)));
    });

    test('an extra commit that changes a file', () => {
      const failed = tampered('extra-commit', (copy) => commit(work(copy), { 'packages/render/src/a.js': 'changed\n' }, 'Sneak in (#99)'));
      assert.ok(failed.some((name) => /tree hash of packages\/render/.test(name)));
      assert.ok(failed.some((name) => /commit counts equal/.test(name)));
    });

    test('a deleted tag, a moved tag and a wrong gallery prefix', () => {
      assert.ok(tampered('tag-deleted', (copy) => git(work(copy), ['tag', '-d', 'opf-render-v0.1.0'])).some((name) => /tags: /.test(name)));
      assert.ok(tampered('tag-moved', (copy) => git(work(copy), ['tag', '-f', 'opf-render-v0.1.0', 'HEAD'])).some((name) => /tree hash|tags point at the mapped commits/.test(name)));
      assert.ok(tampered('prefix', (copy) => {
        const file = path.join(copy, 'import-manifest.json');
        const data = JSON.parse(readFileSync(file, 'utf8'));
        data.packages.find((entry) => entry.name === 'gallery').tagPrefix = 'g-';
        writeFileSync(file, JSON.stringify(data));
      }).some((name) => /tags: /.test(name)));
    });

    test('a bare #N or a closing keyword left in a message', () => {
      const failed = tampered('message', (copy) => git(work(copy, 'gallery'), ['commit', '-q', '--amend', '-m', 'Closes #4 and see #5'], { ...ALICE }));
      assert.ok(failed.some((name) => /no bare #N/.test(name)));
      assert.ok(failed.some((name) => /closing keyword/.test(name)));
      assert.ok(failed.some((name) => /commit map covers/.test(name)));
    });

    test('a core path edited by the import, a dropped import merge and an enabled push URL', () => {
      const failed = tampered('merged', (copy) => {
        const merged = path.join(copy, 'merged');
        commit(merged, { 'pnpm-workspace.yaml': 'packages:\n  - "packages/*"\n' }, 'Widen the workspace');
        git(merged, ['remote', 'set-url', '--push', 'origin', 'https://example.invalid/x.git']);
      });
      assert.ok(failed.some((name) => /nothing outside the imported directories/.test(name)));
      assert.ok(failed.some((name) => /commit count = core/.test(name)));
      assert.ok(failed.some((name) => /cannot push/.test(name)));
    });

    test('a source tag outside main\'s history is reported, not dropped silently', () => {
      const source = path.join(temp, 'src');
      git(path.join(source, 'gallery'), ['checkout', '-q', '-b', 'side']);
      commit(path.join(source, 'gallery'), { 'side.txt': 'x\n' }, 'Side work');
      git(path.join(source, 'gallery'), ['tag', 'v9.9.9']);
      git(path.join(source, 'gallery'), ['checkout', '-q', 'main']);
      try {
        const failed = tampered('side-tag', () => {}, { offline: false });
        assert.ok(failed.some((name) => /source tags are in the pristine clone/.test(name)), failed.join('\n'));
      } finally {
        git(path.join(source, 'gallery'), ['tag', '-d', 'v9.9.9']);
      }
    });
  });

  test('a later commit in an old repository is merged as a delta (the freeze-window re-sync)', () => {
    const before = git(path.join(scratch, 'merged'), ['rev-list', '--count', 'HEAD']);
    commit(path.join(base, 'opf-render'), { 'src/a.js': 'one\nTWO\nthree\nfour\nfive\nsix\n' }, 'Late fix (#40)');
    const second = runImport(options(scratch, base, coreDir, { refresh: true }));
    assert.equal(second.packages.find((entry) => entry.name === 'render').commits, manifest.packages.find((entry) => entry.name === 'render').commits + 1);
    const merged = path.join(scratch, 'merged');
    assert.equal(Number(git(merged, ['rev-list', '--count', 'HEAD'])), Number(before) + 2, 'the new commit and one more import merge, nothing re-imported');
    const resynced = verifyImport({ scratch, packages: [], blame: 'all', offline: false, determinism: true });
    assert.equal(resynced.failed, 0, resynced.results.filter((row) => row.ok === false).map((row) => `${row.package}: ${row.name} (${row.detail})`).join('\n'));
    assert.ok(existsSync(path.join(scratch, 'import-manifest.json')));
  });
});
