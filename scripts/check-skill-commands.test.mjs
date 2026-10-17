import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkCommand, checkSources, commandOf, extractCommands, probeArguments, valueOptions, words } from './check-skill-commands.mjs';

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'cli', 'dist', 'index.js');

test('words keeps quoted text together', () => {
  assert.deepEqual(words(`opf create deck.opf.json --title "Decision brief"`), ['opf', 'create', 'deck.opf.json', '--title', 'Decision brief']);
});

test('commandOf strips launchers and cuts at shell operators', () => {
  assert.equal(commandOf('npx @openpresentation/cli@latest skills install'), 'opf skills install');
  assert.equal(commandOf('$ opf validate deck.opf.json | jq .'), 'opf validate deck.opf.json');
  assert.equal(commandOf('opf convert a.json b.pdf > log.txt'), 'opf convert a.json b.pdf');
  assert.equal(commandOf('opf schema presentation \'/$defs/Slide\''), "opf schema presentation '/$defs/Slide'");
  assert.equal(commandOf('opf-export'), undefined);
  assert.equal(commandOf('@openpresentation/opf'), undefined);
  assert.equal(commandOf('opf.convert(a, b)'), undefined);
});

test('extractCommands reads shell fences, continued lines and inline spans, and skips other code', () => {
  const markdown = [
    'Run `opf validate deck.opf.json` first, or `opf --version`. Not `opf-export` nor `opf.open()`.',
    '',
    '```sh',
    'opf convert deck.opf.md deck.pdf',
    'opf ingest data.csv \\',
    '  --as table',
    '```',
    '',
    '```js',
    "await opf.convert('a', 'b'); // opf create x",
    '```',
  ].join('\n');
  assert.deepEqual(
    extractCommands(markdown).map((entry) => entry.command),
    ['opf validate deck.opf.json', 'opf --version', 'opf convert deck.opf.md deck.pdf', 'opf ingest data.csv --as table'],
  );
});

test('valueOptions finds the options that take a value', () => {
  const usage = 'opf create [output|-] [--title <text> | --example <slug>] [--force] [--fail-on <level>]';
  assert.deepEqual([...valueOptions(usage)].sort(), ['example', 'fail-on', 'title']);
});

test('probeArguments gives value options a placeholder, drops positionals and ends with --help', () => {
  const valueOptionsOf = () => new Set(['title']);
  assert.deepEqual(probeArguments('opf create deck.opf.json --title "Decision brief" --force', valueOptionsOf), ['create', '--title', 'x', '--force', '--help']);
  assert.deepEqual(probeArguments('opf --version', valueOptionsOf), ['--version']);
  assert.deepEqual(probeArguments('opf help convert', valueOptionsOf), ['help', 'convert']);
});

test('checkSources fails a command the CLI rejects, honours the allowlist and reports a stale entry', () => {
  const run = (args) => (args.includes('--from') && args[0] === 'create' ? { status: 2, output: '', message: 'removed in 0.18' } : { status: 0, output: 'Usage:\n  opf create [--title <text>]', message: '' });
  const file = { file: 'skills/x/SKILL.md', text: 'Use `opf create deck.opf.json --from authored.json` or `opf create deck.opf.json --title Hi`.' };
  const failing = checkSources([file], [], run);
  assert.equal(failing.checked, 2);
  assert.deepEqual(failing.failures.map((entry) => entry.command), ['opf create deck.opf.json --from authored.json']);
  const allowed = checkSources([file], [{ command: 'opf create deck.opf.json --from authored.json', reason: 'test' }], run);
  assert.equal(allowed.failures.length, 0);
  const stale = checkSources([file], [{ command: 'opf create deck.opf.json --from authored.json', reason: 'test' }, { command: 'opf nothing', reason: 'test' }], run);
  assert.deepEqual(stale.staleAllowlist.map((entry) => entry.command), ['opf nothing']);
});

test('the workspace CLI rejects the removed create --from and an unknown command, and accepts current commands', { skip: !existsSync(cli) && 'packages/cli/dist is not built' }, () => {
  assert.match(checkCommand('opf create deck.opf.json --from authored.json'), /removed in 0\.18/);
  assert.match(checkCommand('opf validate deck.opf.json --strict'), /--strict was removed/);
  assert.match(checkCommand('opf convert a.json b.pdf --fonts-dir x'), /Unknown option --fonts-dir/);
  assert.match(checkCommand('opf render deck.opf.json'), /removed in 0\.18/);
  assert.equal(checkCommand('opf create deck.opf.json --title "Decision brief"'), undefined);
  assert.equal(checkCommand('opf convert deck.opf.md slides/deck.png --slides 1-3 --scale 2'), undefined);
  assert.equal(checkCommand('opf ingest data.csv deck.opf.json --as chart --into deck.opf.json -i'), undefined);
  assert.equal(checkCommand('opf --version'), undefined);
});
