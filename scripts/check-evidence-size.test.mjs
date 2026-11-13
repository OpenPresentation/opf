import assert from 'node:assert/strict';
import test from 'node:test';
import { LIMIT_BYTES, docsTree, evaluate } from './check-evidence-size.mjs';

const added = (file, size = 100) => ({ file, before: null, after: size });

test('docs trees are docs/ and each package docs/', () => {
  assert.equal(docsTree('docs/a.md'), 'docs/');
  assert.equal(docsTree('packages/render/docs/evidence/x.png'), 'packages/render/docs/');
  assert.equal(docsTree('packages/render/test/x.png'), null);
  assert.equal(docsTree('scripts/docs/x.md'), null);
});

test('a short Markdown result, a guide and a guide picture pass', () => {
  const result = evaluate([added('docs/handoff/2026-12-01/README.md'), added('docs/new-guide.md'), added('docs/images/diagrams/flow.svg'), added('docs/images/flow.png')]);
  assert.deepEqual(result.problems, []);
  assert.equal(result.added, 400);
});

test('evidence folders, archives, decks, images and logs are refused', () => {
  const { problems } = evaluate([
    added('docs/evidence/rr-1/README.md'),
    added('packages/pptx/docs/evidence/run/a.json'),
    added('docs/programs/shapes/run-2026-12-01/sheet.png'),
    added('docs/programs/shapes/run-2026-12-01/raw.zip'),
    added('packages/render/docs/run.log.gz'),
    added('docs/handoff/2026-12-01/saved.pptx'),
    added('docs/handoff/2026-12-01/receipt.json'),
  ]);
  assert.equal(problems.length, 7, problems.join('\n'));
});

test('files that exist in the base tree are allowed as they are, and deletions never fail', () => {
  const { problems, added: bytes } = evaluate([
    { file: 'docs/evidence/old/a.zip', before: 10, after: 10 },
    { file: 'docs/demos/a.png', before: 10, after: 20 },
    { file: 'docs/evidence/old/b.zip', before: 10_000_000, after: null },
  ]);
  assert.deepEqual(problems, []);
  assert.equal(bytes, 10);
});

test('growth over the limit fails, counting new files and growth but not shrinkage', () => {
  const half = LIMIT_BYTES / 2;
  assert.deepEqual(evaluate([added('docs/a.md', half), { file: 'docs/b.md', before: 0, after: half }]).problems, []);
  assert.equal(evaluate([added('docs/a.md', half), { file: 'docs/b.md', before: 1, after: half + 2 }]).problems.length, 1);
  assert.deepEqual(evaluate([added('docs/a.md', half), { file: 'docs/b.md', before: LIMIT_BYTES, after: 0 }]).problems, []);
});

test('a base-tree file that moves keeps its allowance and is not growth', () => {
  const result = evaluate([
    { file: 'docs/programs/x/tracker-inputs/run/compare.json', before: null, after: LIMIT_BYTES * 2, moved: true },
    { file: 'docs/handoff/2026-12-01/sheet.png', before: null, after: 10, moved: true },
  ]);
  assert.deepEqual(result.problems, []);
  assert.equal(result.added, 0);
});
