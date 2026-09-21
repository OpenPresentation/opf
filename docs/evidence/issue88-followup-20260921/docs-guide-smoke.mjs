import assert from 'node:assert/strict';
import {readFileSync, realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

assert.match(process.version, /^v24\./);
assert.ok(!process.env.NODE_OPTIONS, 'Do not alias installed packages with a loader.');
const consumer = realpathSync(process.argv[2]);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const installed = async spec => {
  // Core exposes ESM-only import conditions; CommonJS require.resolve cannot
  // resolve these public subpaths. Follow their declared ESM export instead.
  const [scope,name,...subpath] = spec.split('/');
  const directory = path.join(consumer,'node_modules',scope,name);
  const manifest = JSON.parse(readFileSync(path.join(directory,'package.json')));
  const exported = manifest.exports['./'+subpath.join('/')];
  const target = typeof exported === 'string' ? exported : exported?.import ?? exported?.default;
  assert.equal(typeof target, 'string', 'Public ESM export must exist: '+spec);
  const file = realpathSync(path.join(directory,target));
  assert.ok(file.startsWith(path.join(consumer, 'node_modules') + path.sep));
  return import(pathToFileURL(file).href);
};
const packages = {};
for (const [name, version] of Object.entries({opf:'0.11.0', cli:'0.9.0', 'opf-render':'0.9.0', 'opf-pptx':'0.9.1', 'opf-editor':'0.8.0'})) {
  const record = JSON.parse(readFileSync(path.join(consumer, 'node_modules', '@openpresentation', name, 'package.json')));
  assert.equal(record.version, version);
  packages[record.name] = record.version;
}
const {createDataContent, parseTabularData} = await installed('@openpresentation/opf/data');
const {createDataContent: editorData} = await installed('@openpresentation/opf-editor/data');
const {composeSlide, layoutMetric, fitText} = await installed('@openpresentation/opf/composition');
const {formatRichTextRange, replaceRichTextRange, richTextContent} = await installed('@openpresentation/opf-editor/rich-text');
const csv = 'ID,Value\n001,12';
const table = createDataContent(csv, {as:'table', format:'csv'});
assert.equal(table.table.rows[0][0], '001');
assert.equal(parseTabularData(csv).rows[0][0], '001');
assert.deepEqual(editorData(csv, {as:'table', format:'csv'}), table);
const deck = {design:{header:{left:{text:'Header'}}, contentBox:true}, slides:[{metric:{value:12, unit:'%', label:'Growth'}, composition:{minFontSize:32}}]};
const composed = composeSlide(deck.slides[0], {presentation:deck, contentBox:true, width:1280, height:720, explain:true});
assert.equal(composed.explanation.algorithm, 'grid-score-v9');
assert.equal(composed.furniture.algorithm, 'furniture-flow-v2');
assert.equal(composed.items[0].metricLayout.algorithm, 'metric-flow-v1');
assert.ok(Math.abs(composed.items[0].box.x - composed.items[0].frameBox.x - 12) < 1e-10);
assert.deepEqual(composed.explanation.unmeasuredPayloads, []);
assert.equal(layoutMetric({value:0, unit:'%'}, {x:0,y:0,width:600,height:300}, {minFontSize:32}).algorithm, 'metric-flow-v1');
const runs = [{text:'Keep ',color:'accent2'}, {text:'bold',bold:true}];
assert.equal(richTextContent(formatRichTextRange(runs,0,4,{italic:true})), 'Keep bold');
assert.equal(richTextContent(replaceRichTextRange(runs,5,9,'edit')), 'Keep edit');
assert.equal(fitText('Small', {x:0,y:0,width:600,height:300}, 15, 32).fontSize, 32);
const cli = path.join(consumer,'node_modules/@openpresentation/cli/dist/index.js');
const cliHelp = execFileSync(process.execPath,[cli,'--help'],{cwd:consumer,encoding:'utf8'});
assert.match(cliHelp, /opf import-data/);
assert.match(cliHelp, /opf paginate/);
assert.doesNotMatch(cliHelp, /opf (?:explain|repair|auto-arrange)/);
console.log(JSON.stringify({
  status:'passed', checkedAt:new Date().toISOString(), node:process.version, platform:process.platform,
  consumer, packages, verifierSha256:hash(readFileSync(fileURLToPath(import.meta.url))),
  lockSha256:hash(readFileSync(path.join(consumer,'package-lock.json'))),
  checks:{csvIdentifierPreserved:true, editorDataReexport:true, richRangeHelpers:true, explanation:'grid-score-v9', furniture:'furniture-flow-v2', metric:'metric-flow-v1', contentCardInset:12, minFontSize:32, unmeasuredMetricPayloads:[], cliImportData:true, cliPaginate:true, cliExplainRepairAbsent:true},
  cliHelp,
  scope:'Focused installed-package API/documentation smoke. No browser, native Office, font parity, general repair or release gate claim. The inset tolerance handles JavaScript decimal arithmetic, not a renderer/native visual tolerance.',
},null,2));
