import assert from 'node:assert/strict';
import {test} from 'node:test';
import ts from 'typescript';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// FR-04: the generated Presentation type and the hand-written data types agree with the schema: a root `datasources` map, the six
// provenance keys on a dataset and on inline chart data (a data source by id or inline), and no nested `source` object.
test('generated Presentation types carry data sources and the flat dataset', () => {
  const fixture=fileURLToPath(new URL('./data-source-consumer-fixture.ts',import.meta.url));
  const source=`import { type Presentation, type DataSource, type DataProvenance, type DataGenerator, resolveChartData } from '../dist/index.js';
type Dataset = NonNullable<Presentation['datasets']>[string];
type InlineData = Extract<NonNullable<Presentation['slides'][number]['chart']>['data'], { columns: unknown }>;
const sources: Presentation['datasources'] = { warehouse: { title: 'Warehouse', connector: 'postgres', src: 'postgres://warehouse.example.com/finance', license: 'Internal use only', refresh: 'P1D', extensions: { 'com.example': {} } } };
const generator: DataGenerator = { kind: 'model', name: 'metricgen 2.1' };
const dataset: Dataset = { columns: ['Quarter'], rows: [['Q1']], datasource: 'warehouse', query: 'SELECT 1', retrieved: '2026-11-01', version: 'r1', sha256: '0'.repeat(64), generator };
const inlineSource: Dataset = { columns: ['Quarter'], rows: [['Q1']], datasource: { src: './revenue.csv' } };
const inline: InlineData = { columns: ['Quarter'], rows: [['Q1']], datasource: 'warehouse', generator: { kind: 'human', name: 'Avery' } };
const handWritten: DataProvenance = { datasource: { src: './a.csv', connector: 'csv' }, query: 'A1:B2' };
const named: DataSource = { src: './a.csv' };
const resolved = resolveChartData({ type: 'column', data: inline });
const provenance: DataProvenance | undefined = resolved.ok ? resolved.provenance : undefined;
// @ts-expect-error The nested source object is gone.
const old: Dataset = { columns: ['Quarter'], rows: [['Q1']], source: { src: './revenue.csv' } };
// @ts-expect-error A generator is a person or a model.
const robot: DataGenerator = { kind: 'robot', name: 'x' };
// @ts-expect-error A data source holds no password key.
const secret: DataSource = { password: 'x' };
void [sources,dataset,inlineSource,inline,handWritten,named,provenance,old,robot,secret];`;
  const options={strict:true,noEmit:true,skipLibCheck:false,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:[]};
  const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
  host.readFile=file=>path.resolve(file)===fixture?source:read(file);
  host.fileExists=file=>path.resolve(file)===fixture||exists(file);
  const program=ts.createProgram([fixture],options,host);
  const errors=ts.getPreEmitDiagnostics(program);
  assert.equal(errors.length,0,ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:file=>file,getNewLine:()=> '\n'}));
});
