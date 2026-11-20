import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const artifacts = path.join(root, 'artifacts');
mkdirSync(artifacts, {recursive: true});
const cwd = mkdtempSync(path.join(artifacts, 'sh20 parser cwd '));
const parser = new URL('../../../tools/shapes/sh-20/layout-xml.mjs', import.meta.url);
const permission = process.allowedNodeEnvironmentFlags.has('--permission') ? '--permission' : '--experimental-permission';
const xml = `<dgm:layoutDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" uniqueId="urn:opf:test:portable">
  <dgm:title val="Portable &amp; local"/><dgm:desc val="Read the actual layout parser"/>
  <dgm:catLst><dgm:cat type="cycle"/></dgm:catLst>
  <dgm:layoutNode name="root" styleLbl="node0">
    <dgm:alg type="cycle"><dgm:param type="stAng" val="270"/></dgm:alg>
    <dgm:constrLst><dgm:constr type="w" for="ch" refType="w" fact="0.5" val="10"/></dgm:constrLst>
    <dgm:forEach name="entries" axis="ch" ptType="node" st="1" cnt="3" hideLastTrans="0">
      <dgm:layoutNode name="entry"><dgm:shape type="roundRect" rot="90" hideGeom="1"><dgm:adjLst><dgm:adj val="0.25"/></dgm:adjLst></dgm:shape><dgm:presOf axis="self" ptType="node"/></dgm:layoutNode>
    </dgm:forEach>
  </dgm:layoutNode>
</dgm:layoutDef>`;
// Restrict reads to this checkout: an installed, unrelated developer checkout must
// not make a hard-coded dependency location appear portable. The empty cwd also
// prevents dependency lookup from accidentally depending on the caller's cwd.
const run = spawnSync(process.execPath, [
  permission, `--allow-fs-read=${root}`, '--input-type=module', '--eval',
  'const {parseLayoutDefinition} = await import(process.argv[1]); console.log(JSON.stringify(parseLayoutDefinition(process.argv[2])));',
  parser.href, xml,
], {cwd, encoding: 'utf8', timeout: 15000, windowsHide: true});
assert.equal(run.status, 0, `The production parser must load this checkout's dependency from an unrelated cwd:\n${run.stderr}`);
assert.deepEqual(JSON.parse(run.stdout), {
  uniqueId: 'urn:opf:test:portable', title: 'Portable & local', description: 'Read the actual layout parser', category: 'cycle',
  root: {
    kind: 'layoutNode', name: 'root', styleLbl: 'node0', alg: {type: 'cycle', params: {stAng: '270'}},
    constraints: [{type: 'w', for: 'ch', refType: 'w', fact: 0.5, val: 10}],
    children: [{kind: 'forEach', name: 'entries', axis: 'ch', ptType: 'node', st: 1, cnt: 3, hideLastTrans: false,
      children: [{kind: 'layoutNode', name: 'entry', shape: {type: 'roundRect', rot: 90, hideGeom: true, adj: [25000]}, presOf: {axis: 'self', ptType: 'node'}, children: []}]}],
  },
});
console.log('SH20 layout XML: production parser resolves checkout-local dependencies from an unrelated cwd and retains layout semantics.');
