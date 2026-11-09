import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require = createRequire(new URL('../../../../packages/pptx/package.json', import.meta.url));
const {unzipSync} = require('fflate'), {XMLParser} = require('fast-xml-parser');
const own = path.dirname(fileURLToPath(import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(own, 'manifest.json')));
const archive = fs.readFileSync(path.join(own, manifest.archive.path));
assert.equal(archive.length, manifest.archive.bytes); assert.equal(digest(archive), manifest.archive.sha256);
const raw = unzipSync(archive), keys = Object.keys(raw).sort();
assert.deepEqual(keys, manifest.files.map(f => f.path).sort());
for (const file of manifest.files) {assert.equal(raw[file.path].length, file.bytes, file.path); assert.equal(digest(raw[file.path]), file.sha256, file.path);}
const text = key => new TextDecoder().decode(raw[key]).replace(/^\uFEFF/u, '');
const json = key => JSON.parse(text(key));
const failure = json('original-profile02/table-colors/failure.json');
assert.equal(failure.error, 'Native table character color differs'); assert.equal(failure.cleanupConfirmed, false); assert.equal(failure.officeOperationsStopped, true);
assert.equal(failure.partial.original.length, 0); assert.equal(failure.partial.reopened.length, 0); assert.equal(failure.partial.edited.length, 0);
assert.equal(failure.partial.currentCellProbe, undefined);
const terminal = json('original-profile02/table-colors/supervisor.json');
assert.equal(terminal.exitCode, 1); assert.equal(terminal.timedOut, false); assert.equal(terminal.cleanupConfirmed, false);
const inventory = json('original-driver/postfailure-process-inventory.json');
assert.equal(inventory.count, 0); assert.deepEqual(inventory.processes, []); assert.equal(inventory.OfficeCOMCalls, 0);
assert.equal(json('original-driver/driver-exit.json').profileSha256, digest(raw['original-profile02/table-profile.json']));
const stages = text('original-profile02/table-colors/stages.jsonl').trim().split(/\r?\n/u).map(line => JSON.parse(line.replace(/^\uFEFF/u, '')));
assert.equal(stages.at(-2).stage, 'original.slide.4.cell.1.1.character.1.color'); assert.equal(stages.at(-2).status, 'success'); assert.equal(stages.at(-1).stage, 'worker.failure');
assert.equal(keys.filter(k => /original-profile02\/table-colors\/original-[1-6]\.png$/u.test(k)).length, 3);
assert.equal(keys.filter(k => /original-profile02\/table-colors\/(?:reopened|edited)-/u.test(k)).length, 0);
const input = raw['original-profile02/table-colors/table-colors.pptx'], parts = unzipSync(input);
assert.equal(digest(input), '485236f38e925ac3435582799edbf968d6ea8a2a2148a88f6e23194a9cfcb6fb');
const generation = json('original-profile02/table-colors/generation.json'); assert.equal(generation.pptxSha256, digest(input));
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false});
const array = v => v === undefined ? [] : Array.isArray(v) ? v : [v];
const find = (v, key) => !v || typeof v !== 'object' ? [] : Array.isArray(v) ? v.flatMap(x => find(x, key)) : Object.entries(v).flatMap(([k, child]) => k === key ? array(child) : find(child, key));
const xml = p => parser.parse(new TextDecoder().decode(parts[p]));
function relation(owner, type) {
  const rel = path.posix.join(path.posix.dirname(owner), '_rels', path.posix.basename(owner) + '.rels');
  const matches = find(xml(rel), 'Relationship').filter(r => r.Type.endsWith('/' + type)); assert.equal(matches.length, 1); assert.equal(matches[0].TargetMode, undefined);
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(owner), matches[0].Target)); assert.ok(parts[target]); return target;
}
let cells = 0, runs = 0; const mismatches = [], chains = [];
for (let i = 0; i < 6; i++) {
  const slide = 'ppt/slides/slide' + (i + 1) + '.xml', layout = relation(slide, 'slideLayout'), master = relation(layout, 'slideMaster'), theme = relation(master, 'theme');
  const slideXml = xml(slide), layoutXml = xml(layout), masterXml = xml(master), colors = find(xml(theme), 'a:clrScheme'); assert.equal(colors.length, 1);
  for (const doc of [slideXml, layoutXml]) {const override = find(doc, 'p:clrMapOvr'); assert.equal(override.length, 1); assert.ok(Object.hasOwn(override[0], 'a:masterClrMapping'));}
  const maps = find(masterXml, 'p:clrMap'); assert.equal(maps.length, 1); assert.equal(maps[0].tx1, 'dk1');
  const resolve = fill => {
    if (fill['a:srgbClr']) return '#' + fill['a:srgbClr'].val;
    const slot = fill['a:schemeClr'].val, role = maps[0][slot] ?? slot, color = colors[0]['a:' + role];
    return '#' + (color['a:srgbClr']?.val ?? color['a:sysClr']?.lastClr);
  };
  chains.push({slide, layout, master, theme, tx1: maps[0].tx1, resolvedTx1: resolve({'a:schemeClr': {val: 'tx1'}})});
  const tables = find(slideXml, 'a:tbl'); assert.equal(tables.length, 1); const rows = array(tables[0]['a:tr']); assert.equal(rows.length, 2);
  for (const expected of generation.expected[i].cells) {
    const actualRuns = find(array(rows[expected.row - 1]['a:tc'])[expected.column - 1], 'a:r'); assert.equal(actualRuns.length, expected.runs.length); cells++;
    for (let j = 0; j < expected.runs.length; j++) {const run = expected.runs[j], actual = actualRuns[j]; assert.equal(actual['a:t'], run.text); const color = resolve(actual['a:rPr']['a:solidFill']); runs++; if (color !== run.color) mismatches.push({slide: i + 1, row: expected.row, column: expected.column, text: run.text, expected: run.color, source: color});}
  }
}
assert.equal(cells, 24); assert.equal(runs, 36);
assert.deepEqual(mismatches, [{slide: 4, row: 1, column: 1, text: 'Header', expected: '#FFFFFF', source: '#000000'}, {slide: 4, row: 1, column: 2, text: 'Inherited', expected: '#FFFFFF', source: '#000000'}]);
assert.match(text('reviewed-source/packages/pptx/test/styled-table.mjs'), /\['#767676','000000','000000'\]/u);
assert.match(text('reviewed-source/packages/pptx/src/index.js'), /readableSchemeColor\(`#\$\{baseFill\}`,context.roles\)\.hex/u);
assert.equal(manifest.actualNativeRGB, null);
console.log(JSON.stringify({passed: true, files: keys.length, cells, runs, mismatches, chains, originalWorkerSucceeded: false, cleanupConfirmed: false, actualNativeRGB: null, laterZeroIsNotQuitProof: true, OfficeCOMCalls: 0}, null, 2));
