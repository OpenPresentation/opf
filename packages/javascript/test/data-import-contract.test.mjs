import assert from 'node:assert/strict';
import {test} from 'node:test';
import ts from 'typescript';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {importData, parseTabularData} from '../dist/data.js';
import {validate} from '../dist/index.js';

test('chart imports compose into public Presentation declarations without casts', () => {
  const fixture=fileURLToPath(new URL('./data-consumer.ts',import.meta.url));
  const source=`import {importData,type Presentation} from '../dist/index.js';
import {importData as focused,type ImportedChart,type ImportedChartType,type ImportedTable} from '../dist/data.js';
const csv='Quarter,Revenue\\nQ1,12';
const chart:ImportedChart=importData(csv,{as:'chart'});
const table:ImportedTable=focused(csv,{as:'table'});
const deck:Presentation={slides:[{blocks:[chart,table]},chart,table]};
const firstColumn:string=chart.chart.data.columns[0];
const kind:ImportedChartType=focused(csv,{as:'chart',chartType:'line'}).chart.type;
// @ts-expect-error A chart type outside the OPF vocabulary is rejected at compile time.
focused(csv,{as:'chart',chartType:'donut'});
const firstRow:unknown[]=chart.chart.data.rows[0];
const tableRows:unknown[][]=table.table.rows;
declare const mode:'table'|'chart';
const dynamicDeck:Presentation={slides:[focused(csv,{as:mode})]};
// @ts-expect-error Literal table mode has no chart property.
table.chart;
// @ts-expect-error Literal chart mode has no table property.
chart.table;
void [deck,dynamicDeck,firstColumn,kind,firstRow,tableRows];`;
  const options={strict:true,noUncheckedIndexedAccess:true,noEmit:true,skipLibCheck:false,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:[]};
  const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
  host.readFile=file=>path.resolve(file)===fixture?source:read(file);
  host.fileExists=file=>path.resolve(file)===fixture||exists(file);
  const errors=ts.getPreEmitDiagnostics(ts.createProgram([fixture],options,host));
  assert.equal(errors.length,0,ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:file=>file,getNewLine:()=> '\n'}));
});

test('nonempty chart guarantees retain runtime rejection and header-only tables', () => {
  assert.throws(()=>importData('Quarter,Revenue',{as:'chart'}),/data row/);
  assert.throws(()=>importData('Quarter\nQ1',{as:'chart'}),/numeric series/);
  assert.deepEqual(parseTabularData('Quarter,Revenue'),{columns:['Quarter','Revenue'],rows:[]});
  assert.deepEqual(importData('Quarter,Revenue',{as:'table'}).table.rows,[]);
  const chart=importData('Quarter,Revenue\nQ1,12',{as:'chart'});
  const table=importData('Quarter,Revenue\nQ1,12',{as:'table'});
  assert.equal(validate({slides:[chart,table]},{only:['format']}).valid,true);
});
