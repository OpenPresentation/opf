import assert from 'node:assert/strict';
import {unzipSync,zipSync,strToU8,strFromU8} from 'fflate';
import {readChartCategoryHeading,writeChartCategoryHeading} from '../dist/chart-workbook.js';
import {toPptx,fromPptx} from '../dist/index.js';

const chartPart='ppt/charts/chart1.xml',bookPart='ppt/embeddings/data.xlsx';
const rels=inner=>`<Relationships>${inner}</Relationships>`;
const rel=(id,type,target,mode='')=>`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"${mode?` TargetMode="${mode}"`:''}/>`;
const encode=entries=>Object.fromEntries(Object.entries(entries).map(([name,value])=>[name,strToU8(value)]));
const cell='<c r="A1" t="inlineStr"><is><t>Quarter</t></is></c>';
function fixture({formula="'Revenue ''26'!$A$2:$A$3",header=cell,strings='',chartTarget='../embeddings/data.xlsx',chartMode='',sheetTarget='worksheets/sheet1.xml',sheetMode='',refKind='strRef'}={}){
 const workbook=encode({
  'xl/workbook.xml':'<workbook><sheets><sheet name="Revenue &apos;26" r:id="s1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':rels(rel('s1','worksheet',sheetTarget,sheetMode)),
  'xl/worksheets/sheet1.xml':`<worksheet><sheetData><row r="1">${header}<c r="B1" t="inlineStr"><is><t>Series</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Q1</t></is></c><c r="B2"><v>2</v></c></row></sheetData></worksheet>`,
  'xl/worksheets/_rels/sheet1.xml.rels':rels(rel('t1','table','../tables/table1.xml')),
  'xl/tables/table1.xml':'<table ref="A1:B3"><tableColumns><tableColumn id="1" name="Quarter"/><tableColumn id="2" name="Series"/></tableColumns></table>',
  'xl/tables/unrelated.xml':'<table ref="A1:B3"><tableColumns><tableColumn id="1" name="Unrelated"/></tableColumns></table>',
  'xl/sharedStrings.xml':`<sst>${strings}</sst>`,
 });
 return {...encode({[chartPart]:`<c:chartSpace><c:chart><c:plotArea><c:barChart><c:ser><c:cat><c:${refKind}><c:f>${formula}</c:f></c:${refKind}></c:cat></c:ser></c:barChart></c:plotArea></c:chart><c:externalData r:id="book"/></c:chartSpace>`,
 'ppt/charts/_rels/chart1.xml.rels':rels(rel('book','package',chartTarget,chartMode))}),[bookPart]:zipSync(workbook)};
}
let assertions=0;
function heading(options,expected){const entries=fixture(options),before=structuredClone(entries);assert.equal(readChartCategoryHeading(entries,chartPart),expected);assert.deepEqual(entries,before);assertions++;}
for(const refKind of ['strRef','numRef','multiLvlStrRef'])heading({refKind},'Quarter');
heading({formula:"'Revenue ''26'!$a$2:$A$3"},'Quarter');
heading({header:'<c r="A1" t="inlineStr"><is><r><t xml:space="preserve"> Q &amp; </t></r><r><t>Ω😀&#9;&#10;&#13;</t></r></is></c>'},' Q & Ω😀\t\n\r');
heading({header:'<c r="A1" t="s"><v>1</v></c>',strings:'<si><t>Wrong</t></si><si><r><t>Native </t></r><r><t>heading Ω</t></r></si>'},'Native heading Ω');
heading({header:'<c r="A1" t="inlineStr"><is><t/></is></c>'},'');
heading({header:'<c r="A1"><v>2026</v></c>'},'2026');
for(const options of [
 {chartMode:'External'},{chartMode:'external'},{chartTarget:'https://example.invalid/data.xlsx'},
 {chartTarget:'../../../escape.xlsx'},{chartTarget:'../embeddings/data.xlsx#fragment'},
 {sheetMode:'External'},{sheetTarget:'https://example.invalid/sheet.xml'},
 {formula:"'Revenue ''26'!$A$1:$A$3"},{formula:"'Revenue ''26'!$A$2:$B$3"},
 {formula:"'Revenue ''26'!$A$3:$A$2"},{formula:"'Revenue ''26'!$A$2"},
 {formula:"'Revenue ''26'!$A$2:$A$1048577"},{formula:"'Revenue ''26'!$XFE$2:$XFE$3"},
 {formula:"'[external.xlsx]Revenue ''26'!$A$2:$A$3"},{formula:'Missing!$A$2:$A$3'},
 {header:'<c r="A1"><f>1+1</f><v>2</v></c>'},{header:'<c r="A1" t="e"><v>#REF!</v></c>'},
 {header:'<c r="A1" t="b"><v>1</v></c>'},{header:'<c r="A1" t="s"><v>999</v></c>'},
 {header:'<c r="A1" t="s"><v>-1</v></c>'},{header:''},
])heading(options,undefined);
const corrupt=fixture();corrupt[bookPart]=strToU8('Not a ZIP');assert.equal(readChartCategoryHeading(corrupt,chartPart),undefined);assertions++;
const oversized=fixture(),largeBook=unzipSync(oversized[bookPart]);largeBook['xl/sharedStrings.xml']=strToU8('x'.repeat(16*1024*1024));oversized[bookPart]=zipSync(largeBook);assert.equal(readChartCategoryHeading(oversized,chartPart),undefined);assertions++;
for(const value of ['Quarter & <phase> "Ω" 😀', '', ' \t\r\n Quarter \t ']){
 const entries=fixture(),before=unzipSync(entries[bookPart]);
 writeChartCategoryHeading(entries,chartPart,value);assert.equal(readChartCategoryHeading(entries,chartPart),value);
 const after=unzipSync(entries[bookPart]);
 for(const part of Object.keys(before))if(!['xl/worksheets/sheet1.xml','xl/tables/table1.xml'].includes(part))assert.deepEqual(after[part],before[part]);
 const source=strFromU8(before['xl/worksheets/sheet1.xml']),result=strFromU8(after['xl/worksheets/sheet1.xml']);
 assert.equal(result.replace(/<c r="A1"[\s\S]*?<\/c>/,cell),source,'Only the actual heading cell may change');assertions++;
 const data={columns:[value,'Current'],rows:[['Q1',2],['Q2',3]]},document={slides:[{chart:{type:'column',data}}]};
 const first=await toPptx(document),second=await toPptx(document);assert.deepEqual(first,second,'Export must remain deterministic');
 const imported=await fromPptx(first),slide=imported.slides[0],chart=slide.chart??slide.blocks?.find(block=>block.chart)?.chart;assert.ok(chart);assert.deepEqual(chart.data,data);assertions++;
}
for(const value of ['\u0000','\u0001','\uD800','\uFFFE'])assert.throws(()=>writeChartCategoryHeading(fixture(),chartPart,value),/XML-invalid/);
assert.throws(()=>writeChartCategoryHeading(fixture({formula:'Missing!A2:A3'}),chartPart,'Heading'),/no editable/);
console.log(`Chart workbook checks passed: ${assertions} bounded heading/preservation cases, Unicode/whitespace, rich shared strings, unsupported/external/corrupt metadata and deterministic actual export/reimport.`);
