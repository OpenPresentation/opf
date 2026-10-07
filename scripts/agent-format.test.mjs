import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { contextFor, parseErrors, repoRoot, targetFile } from './agent-format.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agent-format.mjs');

function hook(payload) {
  const input = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const result = spawnSync(process.execPath, [script], { input, encoding: 'utf8', cwd: tmpdir() });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('targetFile accepts a source file in the repository and skips everything else', () => {
  const inside = path.join(repoRoot, 'scripts', 'agent-format.mjs');
  assert.deepEqual(targetFile({ tool_input: { file_path: inside } }), { file: inside, relative: path.join('scripts', 'agent-format.mjs') });
  assert.match(targetFile({}).skip, /no tool_input.file_path/);
  assert.match(targetFile({ tool_input: { file_path: path.join(repoRoot, 'scripts', 'no-such-file.mjs') } }).skip, /does not exist/);
  assert.match(targetFile({ tool_input: { file_path: path.join(repoRoot, 'README.md') } }).skip, /not a file type/);
  assert.match(targetFile({ tool_input: { file_path: path.join(repoRoot, 'scripts') } }).skip, /not a file type/);
  assert.match(targetFile({ tool_input: { file_path: path.join(repoRoot, 'node_modules', '.modules.yaml') } }).skip, /not a file type/);
  assert.equal(targetFile({ tool_input: { file_path: 'package.json' }, cwd: repoRoot }).relative, 'package.json');
  const outside = mkdtempSync(path.join(tmpdir(), 'opf-agent-format-'));
  try {
    writeFileSync(path.join(outside, 'x.mjs'), 'let a = 1\n');
    assert.match(targetFile({ tool_input: { file_path: path.join(outside, 'x.mjs') } }).skip, /outside the repository/);
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});

test('parseErrors turns Biome github annotations into one line each, and contextFor words the hook output', () => {
  const output = [
    `::error title=lint/suspicious/noDoubleEquals,file=${path.join(repoRoot, 'scripts', 'x.mjs')},line=6,endLine=6,col=7,endColumn=9::Using == may be unsafe.`,
    'check ━━━━━',
    '  × Some errors were emitted while applying fixes.',
  ].join('\n');
  assert.deepEqual(parseErrors(output), ['scripts/x.mjs:6 lint/suspicious/noDoubleEquals: Using == may be unsafe.']);
  assert.equal(contextFor('a.mjs', false, []), null);
  assert.match(contextFor('a.mjs', true, []), /reformatted or auto-fixed a\.mjs.*read it again/);
  const many = Array.from({ length: 9 }, (_, index) => `a.mjs:${index} rule: m`);
  assert.match(contextFor('a.mjs', false, many), /\(3 more\)/);
});

test('the hook fixes a file in place, reports what is left, and never fails', () => {
  const file = path.join(repoRoot, 'scripts', `agent-format-fixture-${process.pid}.mjs`);
  try {
    writeFileSync(file, 'let x = 1;\nconsole.log(x);\nif (x == 1) console.log(x);\n');
    const result = hook({ tool_name: 'Edit', tool_input: { file_path: file } });
    assert.equal(result.status, 0);
    assert.equal(readFileSync(file, 'utf8').startsWith('const x = 1;'), true, 'the safe fix (let to const) is applied');
    const output = JSON.parse(result.stdout);
    assert.equal(output.hookSpecificOutput.hookEventName, 'PostToolUse');
    assert.match(output.hookSpecificOutput.additionalContext, /read it again/);
    assert.match(output.hookSpecificOutput.additionalContext, /noDoubleEquals/);

    const again = hook({ tool_name: 'Write', tool_input: { file_path: file } });
    assert.equal(again.status, 0);
    assert.doesNotMatch(JSON.parse(again.stdout).hookSpecificOutput.additionalContext, /read it again/, 'the second run changes nothing');

    writeFileSync(file, 'const x = 1;\nconsole.log(x);\n');
    const clean = hook({ tool_name: 'Edit', tool_input: { file_path: file } });
    assert.equal(clean.status, 0);
    assert.equal(clean.stdout, '', 'a clean file prints nothing');
  } finally {
    rmSync(file, { force: true });
  }
});

test('the hook exits 0 with a reason on stderr for bad input, a missing file or a file outside the repository', () => {
  for (const payload of ['not json', '{}', { tool_input: { file_path: path.join(repoRoot, 'nope.mjs') } }, { tool_input: { file_path: path.join(tmpdir(), 'x.mjs') } }]) {
    const result = hook(payload);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^agent-format: /);
  }
});
