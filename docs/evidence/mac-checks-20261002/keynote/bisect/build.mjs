// Keynote chart bisect set (opf-pptx#162). Builds decks/b-*.pptx (1 slide, 1 chart each) and bisect/manifest.json.
// Every variant starts from a base deck written by the published @openpresentation/opf-pptx (as ../build.mjs does)
// and changes exactly ONE thing by post-processing the PPTX zip; each mutation asserts that it changed something.
//   node bisect/build.mjs            (from the keynote-set directory; npm install there first)
//   PYTHON=/path/to/venv/bin/python node bisect/build.mjs   also builds the python-pptx control (needs python-pptx + XlsxWriter)
import {writeFile, readFile, mkdir, rm} from 'node:fs/promises';
import {readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import JSZip from 'jszip';
import {validatePresentation} from '@openpresentation/opf';
import {toPptx} from '@openpresentation/opf-pptx';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const decksDir = path.join(root, 'decks');
const version = (name) => JSON.parse(execFileSync('node', ['-p', `JSON.stringify(require('${name}/package.json'))`], {cwd: root, encoding: 'utf8'})).version;

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const series = {columns: ['Month', 'North', 'South'], rows: months.map((m, i) => [m, 10 + i * 3, 14 + ((i * 5) % 9)])};
const single = {columns: ['Region', 'Revenue'], rows: [['Americas', 42], ['EMEA', 31], ['APAC', 24], ['LatAm', 11]]};
const xy = {columns: ['X', 'Y'], rows: [[1, 2], [2, 4], [3, 5], [4, 9], [5, 11]]};
const doc = (title, chart) => ({name: title, design: {theme: 'minimal', fontScheme: 'aptos'}, slides: [{title, chart}]});
// Same chart definitions as decks 09-charts-core slides 1, 4 and 7.
const bases = {
  column: doc('Column with options', {type: 'column', data: series, axisTitles: {category: 'Month', value: 'Units'}, legend: 'bottom', dataLabels: true}),
  columnPlain: doc('Column', {type: 'column', data: series}),
  pie: doc('Pie', {type: 'pie', data: single}),
  scatter: doc('Scatter', {type: 'scatter', data: xy}),
};

async function opfDeck(source) {
  const result = validatePresentation(source);
  if (!result.valid) throw new Error(JSON.stringify(result.errors).slice(0, 400));
  return JSZip.loadAsync(await toPptx(source, {zipDate: '2026-10-02'}));
}

// ---- zip helpers ---------------------------------------------------------------------------------------------
const rels = (xml) => [...xml.matchAll(/<Relationship\b[^>]*>/g)].map((m) => ({xml: m[0], id: /\bId="([^"]*)"/.exec(m[0])[1], type: /\bType="([^"]*)"/.exec(m[0])[1], target: /\bTarget="([^"]*)"/.exec(m[0])[1]}));
const resolve = (from, target) => target.startsWith('/') ? target.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(from), target));
const relsPath = (part) => path.posix.join(path.posix.dirname(part), '_rels', path.posix.basename(part) + '.rels');
async function parts(zip) {
  const slide = 'ppt/slides/slide1.xml';
  const slideRel = rels(await zip.file(relsPath(slide)).async('string')).find((r) => r.type.endsWith('/chart'));
  const chart = resolve(slide, slideRel.target);
  const chartRelsFile = zip.file(relsPath(chart));
  const wbRel = chartRelsFile ? rels(await chartRelsFile.async('string')).find((r) => r.type.endsWith('/package')) : undefined;
  return {slide, slideRel, chart, workbook: wbRel ? resolve(chart, wbRel.target) : undefined};
}
async function edit(zip, name, fn, what) {
  const before = await zip.file(name).async('string');
  const after = fn(before);
  if (after === before) throw new Error(`no change: ${what} in ${name}`);
  zip.file(name, after);
}
const chartEdit = async (zip, fn, what) => edit(zip, (await parts(zip)).chart, fn, what);
async function workbookEdit(zip, fn) {
  const {workbook} = await parts(zip);
  const wb = await JSZip.loadAsync(await zip.file(workbook).async('uint8array'));
  await fn(wb);
  zip.file(workbook, await wb.generateAsync({type: 'uint8array', compression: 'DEFLATE'}));
}
const removeAll = (re, what) => (s) => { const out = s.replace(re, ''); if (out === s) throw new Error(`nothing to remove: ${what}`); return out; };

// ---- mutations (each changes ONE thing) ----------------------------------------------------------------------
const fixTableRef = (zip) => workbookEdit(zip, (wb) => edit(wb, 'xl/tables/table1.xml', (s) => s.replace(/\bref="([A-Z]+\d+:[A-Z]+\d+)'"/, 'ref="$1"'), 'stray apostrophe in table ref'));
const breakTableRef = (zip) => workbookEdit(zip, (wb) => edit(wb, 'xl/tables/table1.xml', (s) => s.replace(/\bref="([A-Z]+\d+:[A-Z]+\d+)"/, `ref="$1'"`), 'add stray apostrophe'));
const mutations = {
  tableRefFixed: fixTableRef,
  noTablePart: (zip) => workbookEdit(zip, async (wb) => {
    if (!wb.file('xl/tables/table1.xml')) throw new Error('no table part');
    wb.remove('xl/tables/table1.xml'); wb.remove('xl/tables'); wb.remove('xl/worksheets/_rels/sheet1.xml.rels'); wb.remove('xl/worksheets/_rels');
    await edit(wb, '[Content_Types].xml', removeAll(/<Override PartName="\/xl\/tables\/table1\.xml"[^>]*\/>/, 'table override'), 'table override');
    const sheet = await wb.file('xl/worksheets/sheet1.xml').async('string');
    if (/<tableParts/.test(sheet)) wb.file('xl/worksheets/sheet1.xml', sheet.replace(/<tableParts\b[\s\S]*?<\/tableParts>/, ''));
  }),
  noExternalData: async (zip) => {
    const {chart, workbook} = await parts(zip);
    await chartEdit(zip, removeAll(/<c:externalData\b[\s\S]*?<\/c:externalData>/, 'c:externalData'), 'c:externalData');
    zip.remove(relsPath(chart)); zip.remove(workbook);
    await edit(zip, '[Content_Types].xml', removeAll(/<Default Extension="xlsx"[^>]*\/>/, 'xlsx default'), 'xlsx content type');
  },
  twoAxIds: (zip) => chartEdit(zip, (s) => s.replace(/(<c:(?:bar|line|area|radar)Chart>[\s\S]*?<c:axId val="\d+"\/><c:axId val="\d+"\/>)<c:axId val="\d+"\/>/, '$1'), 'third c:axId'),
  noDLbls: (zip) => chartEdit(zip, removeAll(/<c:dLbls>[\s\S]*?<\/c:dLbls>/g, 'c:dLbls'), 'c:dLbls'),
  noDPt: (zip) => chartEdit(zip, removeAll(/<c:dPt>[\s\S]*?<\/c:dPt>/g, 'c:dPt'), 'c:dPt'),
  noTxPr: (zip) => chartEdit(zip, (s) => s
    .replace(/<c:txPr>[\s\S]*?<\/c:txPr>/g, '')
    .replace(/(<c:rich>[\s\S]*?)<a:pPr>[\s\S]*?<\/a:pPr>/g, '$1')
    .replace(/<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>/g, '<a:rPr lang="en-US"/>'), 'c:txPr and rich-text run properties'),
  noChartFlags: (zip) => chartEdit(zip, removeAll(/<c:roundedCorners val="\d"\/>|<c:autoTitleDeleted val="\d"\/>|\s*<c:dispBlanksAs val="\w+"\/>/g, 'flags'), 'roundedCorners/autoTitleDeleted/dispBlanksAs'),
  noNumCacheFormatCode: (zip) => chartEdit(zip, removeAll(/\s*<c:formatCode>[^<]*<\/c:formatCode>/g, 'c:formatCode'), 'c:numCache formatCode'),
  noNumFmt: (zip) => chartEdit(zip, removeAll(/\s*<c:numFmt\b[^>]*\/>/g, 'c:numFmt'), 'c:numFmt'),
  addStyle: (zip) => chartEdit(zip, (s) => s.replace('<c:roundedCorners val="0"/>', '<c:roundedCorners val="0"/><mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="c14" xmlns:c14="http://schemas.microsoft.com/office/drawing/2007/8/2/chart"><c14:style val="102"/></mc:Choice><mc:Fallback><c:style val="2"/></mc:Fallback></mc:AlternateContent>'), 'c14/c:style'),
  catStrRef: (zip) => chartEdit(zip, (s) => s.replace(/<c:multiLvlStrRef>\s*<c:f>([^<]*)<\/c:f>\s*<c:multiLvlStrCache>\s*(<c:ptCount val="\d+"\/>)<c:lvl>([\s\S]*?)<\/c:lvl>\s*<\/c:multiLvlStrCache>\s*<\/c:multiLvlStrRef>/g, '<c:strRef><c:f>$1</c:f><c:strCache>$2$3</c:strCache></c:strRef>'), 'multiLvlStrRef'),
  relTargetRelative: async (zip) => { const {slide} = await parts(zip); await edit(zip, relsPath(slide), (s) => s.replace('Target="/ppt/charts/', 'Target="../charts/'), 'absolute chart target'); },
  workbookA1Shared: (zip) => workbookEdit(zip, (wb) => edit(wb, 'xl/worksheets/sheet1.xml', (s) => s.replace(/<c r="A1" t="inlineStr"><is><t xml:space="preserve">[^<]*<\/t><\/is><\/c>/, '<c r="A1" t="s"><v>0</v></c>'), 'A1 inlineStr')),
  breakTableRef,
};

// The graphicFrame-as-scatter variant is not built: in 1-slide decks the column and scatter graphicFrames are
// byte-identical (checked by the assertion below), so the variant would equal the base.
{
  const frame = async (b) => /<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/.exec(await (await opfDeck(bases[b])).file('ppt/slides/slide1.xml').async('string'))[0];
  if (await frame('column') !== await frame('scatter')) throw new Error('column and scatter graphicFrames differ: add the b-14 graphicFrame variant');
}

// ---- deck list -------------------------------------------------------------------------------------------------
const variants = [
  {id: 'b-00-column-base', base: 'column', role: 'base', change: 'none: opf-pptx column chart exactly as deck 09 slide 1 (axis titles, legend bottom, data labels)'},
  {id: 'b-01-column-plain', base: 'columnPlain', role: 'base', change: 'none: opf-pptx column chart without options (as deck 16)'},
  {id: 'b-02-table-ref-fixed', base: 'column', role: 'variant', apply: mutations.tableRefFixed, change: "embedded workbook xl/tables/table1.xml: ref=\"A1:C7'\" -> ref=\"A1:C7\" (PptxGenJS 4.0.1 writes a stray apostrophe for category charts; the surviving scatter charts have a clean ref)"},
  {id: 'b-03-no-table-part', base: 'column', role: 'variant', apply: mutations.noTablePart, change: 'embedded workbook: table part, its sheet relationship and content-type override removed'},
  {id: 'b-04-no-external-data', base: 'column', role: 'variant', apply: mutations.noExternalData, change: 'c:externalData removed, with the chart relationship file, the embedded workbook part and the xlsx Default content type'},
  {id: 'b-05-two-axids', base: 'column', role: 'variant', apply: mutations.twoAxIds, change: 'c:barChart keeps 2 c:axId (PptxGenJS writes a third, series-axis id, which the 2-D schema does not allow)'},
  {id: 'b-06-no-dlbls', base: 'column', role: 'variant', apply: mutations.noDLbls, change: 'every c:dLbls removed (series and chart-group data labels)'},
  {id: 'b-07-no-txpr', base: 'column', role: 'variant', apply: mutations.noTxPr, change: 'every c:txPr removed; axis-title rich text keeps the text with empty run properties'},
  {id: 'b-08-no-chart-flags', base: 'column', role: 'variant', apply: mutations.noChartFlags, change: 'c:roundedCorners, c:autoTitleDeleted and c:dispBlanksAs removed'},
  {id: 'b-09-no-numcache-formatcode', base: 'column', role: 'variant', apply: mutations.noNumCacheFormatCode, change: 'c:formatCode removed from every c:numCache'},
  {id: 'b-10-no-numfmt', base: 'column', role: 'variant', apply: mutations.noNumFmt, change: 'every c:numFmt removed (axes and data labels)'},
  {id: 'b-11-add-c14-style', base: 'column', role: 'variant', apply: mutations.addStyle, change: 'adds the mc:AlternateContent c14:style 102 / c:style 2 block PowerPoint writes (opf-pptx writes none)'},
  {id: 'b-12-cat-strref', base: 'column', role: 'variant', apply: mutations.catStrRef, change: 'c:cat c:multiLvlStrRef (one level) -> c:strRef with c:strCache'},
  {id: 'b-13-rel-target-relative', base: 'column', role: 'variant', apply: mutations.relTargetRelative, change: 'slide relationship Target /ppt/charts/chart1.xml (absolute) -> ../charts/chart1.xml'},
  {id: 'b-15-workbook-a1-shared', base: 'column', role: 'variant', apply: mutations.workbookA1Shared, change: "embedded sheet A1 (opf-pptx's inlineStr category heading) -> PptxGenJS's shared string 0"},
  {id: 'b-16-column-plain-table-ref-fixed', base: 'columnPlain', role: 'variant', apply: mutations.tableRefFixed, change: 'b-01 plus the table ref fix of b-02'},
  {id: 'b-20-pie-base', base: 'pie', role: 'base', change: 'none: opf-pptx pie chart as deck 09 slide 4'},
  {id: 'b-21-pie-table-ref-fixed', base: 'pie', role: 'variant', apply: mutations.tableRefFixed, change: 'pie: table ref stray apostrophe removed'},
  {id: 'b-22-pie-no-dpt', base: 'pie', role: 'variant', apply: mutations.noDPt, change: 'pie: every c:dPt removed'},
  {id: 'b-30-scatter-base', base: 'scatter', role: 'control', change: 'none: opf-pptx scatter chart (survived in deck 09; positive control)'},
  {id: 'b-31-scatter-table-ref-broken', base: 'scatter', role: 'variant', apply: mutations.breakTableRef, change: "scatter: stray apostrophe ADDED to the table ref (ref=\"A1:B6'\"): the reverse test"},
];

await mkdir(decksDir, {recursive: true});
for (const f of readdirSync(decksDir)) if (/^b-.*\.pptx$/.test(f)) await rm(path.join(decksDir, f));
const manifest = {generated: 'by bisect/build.mjs', issue: 'https://github.com/OpenPresentation/opf-pptx/issues/162', packages: {'@openpresentation/opf': version('@openpresentation/opf'), '@openpresentation/opf-pptx': version('@openpresentation/opf-pptx')},
  notApplicable: {
    'c15/c16 extLst': 'the opf-pptx column chart has no c:extLst (none in any deck-09 chart part), so there is nothing to remove',
    'mc:AlternateContent wrapper': 'neither the chart part nor the slide graphicFrame uses mc:AlternateContent for classic charts (only chartex uses it); b-11 tests adding the PowerPoint style block instead',
    'chart content type / relationship type': 'the column and scatter parts use identical, standard values (application/vnd.openxmlformats-officedocument.drawingml.chart+xml, .../relationships/chart, .../relationships/package); b-13 tests the only difference from PowerPoint (absolute Target)',
    'c:dPt in column': 'the opf-pptx column chart writes no c:dPt; tested on the pie chart (b-22)',
    'c:style / c14 style': 'opf-pptx writes none; b-11 adds the PowerPoint block',
    'graphicFrame as scatter (b-14)': 'in a 1-slide deck the column and scatter slide graphicFrames are byte-identical (build.mjs asserts it), so the variant would equal b-00; slide-level differences are ruled out',
  },
  structuralDiffColumnVsScatter: [
    "embedded workbook table ref: column/bar/line/area/radar/pie/doughnut ref ends with a stray apostrophe (A1:C7'), scatter is clean (A1:B6) - PptxGenJS 4.0.1 gen-xml chart workbook, category branch",
    'c:barChart/lineChart/areaChart/radarChart carry 3 c:axId, scatterChart 2, pie/doughnut 0',
    'c:cat uses c:multiLvlStrRef (one level) in column/line/area/radar, c:strRef in pie/doughnut; scatter has c:xVal c:numRef',
    'catAx vs valAx; dLbls position; legend absent in scatter',
    'workbook A1: inlineStr category heading (opf-pptx) for category charts, shared string for scatter',
    'slide graphicFrame: byte-identical in 1-slide decks (in deck 09 only the cNvPr name differs)',
  ],
  decks: {}};

for (const v of variants) {
  const zip = await opfDeck(bases[v.base]);
  if (v.apply) await v.apply(zip);
  const bytes = await zip.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
  await writeFile(path.join(decksDir, `${v.id}.pptx`), bytes);
  const {chart} = await parts(await JSZip.loadAsync(bytes));
  manifest.decks[v.id] = {role: v.role, base: v.base, generator: `@openpresentation/opf-pptx ${manifest.packages['@openpresentation/opf-pptx']}` + (v.apply ? ' + post-processing' : ''), change: v.change, chartPart: chart, title: bases[v.base].slides[0].title, categoryLabels: bases[v.base].slides[0].chart.data.rows.map((r) => String(r[0]))};
  console.log(v.id, bytes.length, 'bytes');
}

// ---- controls from other generators -----------------------------------------------------------------------------
// Plain PptxGenJS 4.0.1: the exact vendored copy that opf-pptx ships (no opf-pptx post-processing at all).
const {default: PptxGenJS} = await import(path.join(root, 'node_modules/@openpresentation/opf-pptx/vendor/pptxgenjs/pptxgen.es.js'));
async function plainPptxgen() {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  const slide = pptx.addSlide();
  slide.addText('Column (PptxGenJS)', {x: 0.6, y: 0.3, w: 12, h: 0.8, fontSize: 28});
  slide.addChart(pptx.ChartType.bar, [{name: 'North', labels: months, values: series.rows.map((r) => r[1])}, {name: 'South', labels: months, values: series.rows.map((r) => r[2])}], {x: 0.6, y: 1.4, w: 12, h: 5.4, barDir: 'col'});
  return JSZip.loadAsync(await pptx.write({outputType: 'uint8array'}));
}
const pgVersion = JSON.parse(await readFile(path.join(root, 'node_modules/@openpresentation/opf-pptx/vendor/pptxgenjs/UPSTREAM.json'), 'utf8')).version;
for (const [id, apply, change] of [
  ['b-40-pptxgenjs-plain-column', null, `none: minimal column chart written by plain PptxGenJS ${pgVersion} (the vendored copy), no opf-pptx code`],
  ['b-41-pptxgenjs-plain-table-ref-fixed', mutations.tableRefFixed, 'b-40 plus the table ref fix of b-02'],
]) {
  const zip = await plainPptxgen();
  if (apply) await apply(zip);
  const bytes = await zip.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
  await writeFile(path.join(decksDir, `${id}.pptx`), bytes);
  manifest.decks[id] = {role: 'control', base: 'pptxgenjs', generator: `pptxgenjs ${pgVersion}` + (apply ? ' + post-processing' : ''), change, chartPart: (await parts(await JSZip.loadAsync(bytes))).chart, title: 'Column (PptxGenJS)', categoryLabels: months};
  console.log(id, bytes.length, 'bytes');
}

// python-pptx (writes the workbook with XlsxWriter): an independent known-good generator.
if (process.env.PYTHON) {
  const id = 'b-90-python-pptx-column';
  const out = execFileSync(process.env.PYTHON, [path.join(here, 'python-control.py'), path.join(decksDir, `${id}.pptx`)], {encoding: 'utf8'}).trim();
  const zip = await JSZip.loadAsync(await readFile(path.join(decksDir, `${id}.pptx`)));
  manifest.decks[id] = {role: 'control', base: 'python-pptx', generator: out, change: 'none: the same clustered column chart written by python-pptx (independent generator)', chartPart: (await parts(zip)).chart, title: 'Column (python-pptx)', categoryLabels: months};
  console.log(id, out);
} else console.log('PYTHON not set: python-pptx control skipped');

await writeFile(path.join(here, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`${Object.keys(manifest.decks).length} bisect decks in decks/b-*.pptx; manifest: bisect/manifest.json`);
