import assert from 'node:assert/strict';
import {test} from 'node:test';
import ts from 'typescript';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('public generated payload declarations agree with closed schema fields', () => {
  const fixture=fileURLToPath(new URL('./generated-consumer-fixture.ts',import.meta.url));
  const source=`import {composeSlide, layoutQuote, layoutCode, layoutMetric, type MetricLayout, type CodeLayout, type QuoteLayout, type Presentation, type CompositionExplanation} from '../dist/index.js';
import type {MetricLayout as FocusedMetric, CodeLayout as FocusedCode, QuoteLayout as FocusedQuote, CompositionExplanation as FocusedExplanation} from '../dist/composition.js';
type ContentPayload = NonNullable<Presentation['slides'][number]['blocks']>[number];
const payload: ContentPayload = {text:[{text:'Preserved rich text',bold:true}]};
const nested: ContentPayload = {blocks:[payload],composition:{mode:'row'}};
const deck: Presentation = {slides:[{title:'Consumer',blocks:[nested]}]};
const value: unknown = payload.text;
// @ts-expect-error Unknown content fields are rejected by the canonical schema.
const invalid: ContentPayload = {text:'A real payload',vendorField:1};
// @ts-expect-error Closed payloads do not promise arbitrary string-key access.
const arbitrary = payload['vendorField'];
const result=composeSlide(deck.slides[0],{explain:true,contentBox:true});
const cardWidth:number|undefined=result.items[0]?.frameBox?.width;
const explanation: CompositionExplanation | undefined=result.explanation;
const focused: FocusedExplanation | undefined=explanation;
const quote:QuoteLayout=layoutQuote({text:'Body',attribution:'Source'},{x:0,y:0,width:600,height:400},{minFontSize:24});
const focusedQuote:FocusedQuote=quote;
const font:string|undefined=focusedQuote.parts[0]?.style.fontFamily;
const code:CodeLayout=layoutCode({source:'  kept',language:'ts',filename:'file.ts'},{x:0,y:0,width:600,height:400},{minFontSize:24});
const focusedCode:FocusedCode=code;
const nextStart:number|undefined=focusedCode.parts[0]?.fit?.sourceLines[0]?.nextStart;
const tabSize:4|undefined=focusedCode.parts[0]?.fit?.tabSize;
const segmentKind:'text'|'tab'|undefined=focusedCode.parts[0]?.fit?.sourceLines[0]?.segments[0]?.kind;
const accepted:CodeLayout|undefined=result.items[0]?.codeLayout;
const metric:MetricLayout=layoutMetric({value:42,unit:'ms',delta:0,trend:'flat'},{x:0,y:0,width:600,height:400},{minFontSize:32});
const focusedMetric:FocusedMetric=metric;
const originalScalar:string|number|undefined=focusedMetric.parts[0]?.sources[0]?.value;
// @ts-expect-error Unit follows the string field in the schema.
layoutMetric({value:42,unit:1},{x:0,y:0,width:600,height:400});
const scoreVersion:'grid-score-v6'|undefined=explanation?.algorithm;
// @ts-expect-error Code metadata follows the string fields in the schema.
layoutCode({source:'kept',language:42},{x:0,y:0,width:600,height:400});
void [deck,value,invalid,arbitrary,focused,font,nextStart,tabSize,segmentKind,accepted,scoreVersion,originalScalar,cardWidth];`;
  const options={strict:true,noEmit:true,skipLibCheck:false,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:[]};
  const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
  host.readFile=file=>path.resolve(file)===fixture?source:read(file);
  host.fileExists=file=>path.resolve(file)===fixture||exists(file);
  const program=ts.createProgram([fixture],options,host);
  const errors=ts.getPreEmitDiagnostics(program);
  assert.equal(errors.length,0,ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:file=>file,getNewLine:()=> '\n'}));
});
