// RR-17 (opf-pptx#162): every embedded chart workbook carries valid range metadata. PptxGenJS 4.0.1 wrote
// ref="A1:C7'" (stray apostrophe) for category-chart tables and a bubble table ref whose last row is its column count
// (upstream gitbrent/PptxGenJS#1531); its category sheet dimension counts one label column. Keynote 15.1.1 drops every
// chart whose table ref does not parse; Excel repairs the workbook. The export rewrites each table/autoFilter ref and
// sheet dimension to the cell range the sheet holds.
import assert from 'node:assert/strict';
import {unzipSync,strFromU8,strToU8,zipSync} from 'fflate';
import PptxGenJS from '../vendor/pptxgenjs/pptxgen.es.js';
import {repairChartWorkbookRanges,usedRange} from '../dist/chart-workbook.js';
import {CHART_TYPES} from '../dist/chart-types.js';
import {toPptx} from '../dist/index.js';

const A1_RANGE=/^[A-Z]{1,3}[1-9]\d{0,6}:[A-Z]{1,3}[1-9]\d{0,6}$/;
let assertions=0;

/** Asserts the workbook's range metadata: each table ref (and autoFilter ref) is a plain A1 range equal to the
 *  sheet's used cell range and its dimension, with one tableColumn per column and a header cell per column. */
function checkWorkbook(bytes,label){
 const book=unzipSync(bytes),tables=Object.keys(book).filter(name=>/^xl\/tables\/[^/]+\.xml$/.test(name));
 assert.ok(tables.length,`${label}: the chart workbook has a table part`);
 for(const tablePart of tables){
  const table=strFromU8(book[tablePart]);
  const owner=Object.keys(book).find(name=>/^xl\/worksheets\/_rels\/[^/]+\.rels$/.test(name)&&strFromU8(book[name]).includes(`../tables/${tablePart.split('/').pop()}`));
  assert.ok(owner,`${label}: ${tablePart} belongs to a worksheet`);
  const sheet=strFromU8(book[owner.replace('_rels/','').replace(/\.rels$/,'')]),range=usedRange(sheet);
  const ref=/<table\b[^>]*\bref="([^"]*)"/.exec(table)[1];
  assert.match(ref,A1_RANGE,`${label}: table ref ${JSON.stringify(ref)} is a valid A1 range`);
  assert.equal(ref,range.ref,`${label}: table ref matches the sheet data`);
  for(const [,filter]of table.matchAll(/<autoFilter\b[^>]*\bref="([^"]*)"/g))assert.equal(filter,range.ref,`${label}: autoFilter ref`);
  assert.equal(/<dimension ref="([^"]*)"/.exec(sheet)?.[1],range.ref,`${label}: sheet dimension matches the sheet data`);
  assert.equal(Number(/<tableColumns count="(\d+)"/.exec(table)[1]),range.columns,`${label}: one table column per data column`);
  assert.equal((table.match(/<tableColumn\b/g)??[]).length,range.columns,`${label}: tableColumn elements`);
  const headerRow=/<row r="1"[^>]*>([\s\S]*?)<\/row>/.exec(sheet)?.[1]??'';
  assert.equal((headerRow.match(/<c\b/g)??[]).length,range.columns,`${label}: a header cell per table column`);
  assertions++;
 }
}

// 1. Plain pptxgenjs-plus 4.3.4 (the vendored copy): every chart family it writes, valid after the repair (bubble is
// broken before it).
const labels=['Jan','Feb','Mar','Apr','May'],north=[10,13,16,19,22],south=[14,19,15,20,16];
const families=[
 ['bar',[{name:'North',labels,values:north},{name:'South',labels,values:south}],{barDir:'col'}],
 ['bar',[{name:'North',labels,values:north}],{barDir:'bar'}],
 ['line',[{name:'North',labels,values:north},{name:'South',labels,values:south}]],
 ['area',[{name:'North',labels,values:north},{name:'South',labels,values:south}]],
 ['pie',[{name:'Share',labels,values:north}]],
 ['doughnut',[{name:'Share',labels,values:north}]],
 ['radar',[{name:'North',labels,values:north},{name:'South',labels,values:south}]],
 ['scatter',[{name:'X',values:[1,2,3,4,5]},{name:'Y',values:north},{name:'Z',values:south}]],
 ['bubble',[{name:'X',values:[1,2,3,4,5]},{name:'Y1',values:north,sizes:[4,5,6,7,8]},{name:'Y2',values:south,sizes:[3,3,4,4,5]}]],
 ['bubble',[{name:'X',values:[1,2,3,4,5,6,7,8,9]},{name:'Y1',values:[1,2,3,4,5,6,7,8,9],sizes:[1,1,1,1,1,1,1,1,1]}]],
];
for(const [type,data,options={}]of families){
 const pptx=new PptxGenJS();
 pptx.addSlide().addChart(type,data,{x:0.5,y:0.5,w:6,h:4,...options});
 const entries=unzipSync(await pptx.write({outputType:'uint8array'}));
 const workbookPart=Object.keys(entries).find(name=>/^ppt\/embeddings\/.*\.xlsx$/.test(name));
 const label=`PptxGenJS ${type}${options.barDir?` (${options.barDir})`:''}, ${data.length} series`;
 const raw=unzipSync(entries[workbookPart]),rawTable=strFromU8(raw['xl/tables/table1.xml']),rawRef=/<table\b[^>]*\bref="([^"]*)"/.exec(rawTable)[1];
 const actual=usedRange(strFromU8(raw['xl/worksheets/sheet1.xml'])).ref;
 // pptxgenjs-plus 4.3.4 (vendored) fixed upstream #1531 for category and scatter tables; its bubble table still takes
 // its last row from the column count (lofcz/pptxgenjs-plus#15). The repair below keeps covering both.
 if(type==='bubble')assert.notEqual(rawRef,actual,`${label}: the vendored bubble ref is wrong (${rawRef}); if upstream fixed it (lofcz/pptxgenjs-plus#15), update this test`);
 else assert.equal(rawRef,actual,`${label}: the vendored table ref matches the sheet data`);
 const repaired=repairChartWorkbookRanges(raw);
 checkWorkbook(zipSync(repaired),label);
 // Nothing but the range attributes changes.
 for(const part of Object.keys(raw)){
  const before=strFromU8(unzipSync(entries[workbookPart])[part]),after=strFromU8(repaired[part]);
  assert.equal(after.replace(/\b(ref)="[^"]*"/g,'$1=""'),before.replace(/\b(ref)="[^"]*"/g,'$1=""'),`${label}: ${part} changes only ref attributes`);
 }
}

// 2. A table that does not start at the sheet's first cell is left alone; an autoFilter is resized with its table.
{
 const book={
  'xl/worksheets/sheet1.xml':strToU8('<worksheet><dimension ref="A1:Z9"/><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>a</t></is></c><c r="B1" t="inlineStr"><is><t>b</t></is></c></row><row r="2"><c r="A2"><v>1</v></c><c r="B2"/></row></sheetData></worksheet>'),
  'xl/worksheets/_rels/sheet1.xml.rels':strToU8('<Relationships><Relationship Id="t1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/><Relationship Id="t2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table2.xml"/></Relationships>'),
  'xl/tables/table1.xml':strToU8(`<table ref="A1:B9'"><autoFilter ref="A1:B9'"/><tableColumns count="2"><tableColumn id="1" name="a"/><tableColumn id="2" name="b"/></tableColumns></table>`),
  'xl/tables/table2.xml':strToU8('<table ref="D4:E5"><tableColumns count="2"/></table>'),
 };
 repairChartWorkbookRanges(book);
 assert.equal(strFromU8(book['xl/tables/table1.xml']),'<table ref="A1:B2"><autoFilter ref="A1:B2"/><tableColumns count="2"><tableColumn id="1" name="a"/><tableColumn id="2" name="b"/></tableColumns></table>');
 assert.equal(strFromU8(book['xl/tables/table2.xml']),'<table ref="D4:E5"><tableColumns count="2"/></table>');
 assert.match(strFromU8(book['xl/worksheets/sheet1.xml']),/<dimension ref="A1:B2"\/>/);
 assert.equal(usedRange('<worksheet><sheetData/></worksheet>'),undefined);
 assert.equal(usedRange('<c r="AA10"/><c r="B3"/>').ref,'B3:AA10');
 assertions++;
}

// 3. The actual export: every OPF chart type (category, circular, xy and the chartex families with their classic
// fallback), single and multi-series, with gaps, writes only valid workbook ranges.
const months=['Jan','Feb','Mar','Apr','May','Jun'];
const multi={columns:['Month','North','South','West'],rows:months.map((m,i)=>[m,10+i*3,i===2?null:14+((i*5)%9),5+i])};
const single={columns:['Region','Revenue'],rows:[['Americas',42],['EMEA',31],['APAC',24],['LatAm',11]]};
const xy={columns:['X','Y'],rows:[[1,2],[2,4],[3,5],[4,9],[5,11]]};
for(const type of Object.keys(CHART_TYPES)){
 const spec=CHART_TYPES[type];
 const datasets=spec.family==='xy'?[xy]:spec.family==='circular'||spec.series===1?[single]:[single,multi];
 for(const data of datasets){
  const bytes=await toPptx({slides:[{title:type,chart:{type,data}}]});
  const entries=unzipSync(bytes),books=Object.keys(entries).filter(name=>/^ppt\/embeddings\/.*\.xlsx$/.test(name));
  assert.ok(books.length,`${type}: the export embeds the chart workbook`);
  for(const name of books)checkWorkbook(entries[name],`toPptx ${type} (${data.columns.length-1} series) ${name}`);
 }
}
console.log(`Chart workbook ranges: ${assertions} workbooks checked (PptxGenJS ${families.length} families incl. bubble, every OPF chart type, anchored-table rule).`);
