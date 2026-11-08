// RR-106: `opf-preview-fonts <dir> --fontconfig <file>` writes the fontconfig file that gives LibreOffice on Linux OPF's faces (the
// documented font profile of docs/libreoffice.md): the font directory and one alias per font-policy replacement.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FONT_POLICY} from '@openpresentation/opf/font-policy';
import {fontconfigAliases, fontconfigConf} from '../dist/preview-fonts-node.js';

const aliases = fontconfigAliases();
const byFamily = new Map(aliases.map(alias => [alias.family, alias]));
assert.deepEqual(byFamily.get('Aptos'), {family: 'Aptos', prefer: 'Intos', compatibility: 'metric'}, 'the default deck family resolves to its metric replacement');
assert.equal(byFamily.get('Aptos Display').prefer, 'Intos Display');
assert.equal(byFamily.get('Calibri').prefer, 'Carlito');
assert.equal(byFamily.get('Arial').prefer, 'Arimo');
assert.ok(aliases.every(alias => alias.family.toLowerCase() !== alias.prefer.toLowerCase()), 'no alias maps a family to itself');
const withReplacement = FONT_POLICY.families.filter(row => (row.replacement?.family ?? row.replacement?.measured?.replacement) && (row.replacement.family ?? row.replacement.measured.replacement).toLowerCase() !== row.family.toLowerCase());
assert.equal(aliases.length, withReplacement.length, 'one alias per policy row with a replacement');

const conf = fontconfigConf({fontDir: '/home/me/fonts & more', aliases: [byFamily.get('Aptos')]});
assert.match(conf, /^<\?xml version="1\.0"\?>\n<!DOCTYPE fontconfig/);
assert.match(conf, /<dir>\/home\/me\/fonts &amp; more<\/dir>/, 'paths are escaped');
assert.match(conf, /<match target="pattern"><test name="family" qual="any"><string>Aptos<\/string><\/test><edit name="family" mode="assign" binding="same"><string>Intos<\/string><\/edit><\/match>/);
assert.doesNotMatch(conf, /<include/, 'a conf.d file does not include the system configuration (that would loop)');
assert.match(fontconfigConf({includeSystem: true, cacheDir: '/tmp/c', aliases: []}), /<include ignore_missing="yes">\/etc\/fonts\/fonts\.conf<\/include>[\s\S]*<cachedir>\/tmp\/c<\/cachedir>/);

// The command: fonts copied and the file written in one run.
const cli = fileURLToPath(new URL('../dist/preview-fonts-cli.js', import.meta.url));
const directory = mkdtempSync(path.join(tmpdir(), 'opf-fontconfig-'));
try {
  const fonts = path.join(directory, 'fonts'), file = path.join(directory, 'conf.d', '60-opf-fonts.conf');
  const run = spawnSync(process.execPath, [cli, fonts, '--fontconfig', file], {encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /fontconfig: wrote/);
  assert.ok(existsSync(path.join(fonts, 'LICENSES.txt')), 'the fonts were copied');
  const written = readFileSync(file, 'utf8');
  assert.ok(written.includes(`<dir>${path.resolve(fonts).replaceAll('&', '&amp;')}</dir>`), 'the file names the copied font directory');
  assert.equal((written.match(/<match /g) ?? []).length, aliases.length);
  const usage = spawnSync(process.execPath, [cli, '--help'], {encoding: 'utf8'});
  assert.match(usage.stderr, /--fontconfig <file>/);
} finally {
  rmSync(directory, {recursive: true, force: true});
}
console.log(`opf-preview-fonts --fontconfig: ${aliases.length} font-policy aliases and the font directory`);
