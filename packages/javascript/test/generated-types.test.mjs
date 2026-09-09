import assert from 'node:assert/strict';
import {test} from 'node:test';
import ts from 'typescript';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('public generated payload declarations agree with closed schema fields', () => {
  const fixture=fileURLToPath(new URL('./generated-consumer-fixture.ts',import.meta.url));
  const source=`import {composeSlide, type Presentation, type CompositionExplanation} from '../dist/index.js';
import type {CompositionExplanation as FocusedExplanation} from '../dist/composition.js';
type ContentPayload = NonNullable<Presentation['slides'][number]['blocks']>[number];
const payload: ContentPayload = {text:[{text:'Preserved rich text',bold:true}]};
const nested: ContentPayload = {blocks:[payload],composition:{mode:'row'}};
const deck: Presentation = {slides:[{title:'Consumer',blocks:[nested]}]};
const value: unknown = payload.text;
// @ts-expect-error Unknown content fields are rejected by the canonical schema.
const invalid: ContentPayload = {text:'A real payload',vendorField:1};
// @ts-expect-error Closed payloads do not promise arbitrary string-key access.
const arbitrary = payload['vendorField'];
const result=composeSlide(deck.slides[0],{explain:true});
const explanation: CompositionExplanation | undefined=result.explanation;
const focused: FocusedExplanation | undefined=explanation;
void [deck,value,invalid,arbitrary,focused];`;
  const options={strict:true,noEmit:true,skipLibCheck:false,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:[]};
  const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
  host.readFile=file=>path.resolve(file)===fixture?source:read(file);
  host.fileExists=file=>path.resolve(file)===fixture||exists(file);
  const program=ts.createProgram([fixture],options,host);
  const errors=ts.getPreEmitDiagnostics(program);
  assert.equal(errors.length,0,ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:file=>file,getNewLine:()=> '\n'}));
});
