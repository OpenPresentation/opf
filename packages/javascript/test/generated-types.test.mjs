import assert from 'node:assert/strict';
import {test} from 'node:test';
import ts from 'typescript';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('public generated payload declarations agree with closed schema fields', () => {
  const fixture=fileURLToPath(new URL('./generated-consumer-fixture.ts',import.meta.url));
  const source=`import { type Presentation } from '../dist/index.js'; import { type MetricLayout, type CodeLayout, type QuoteLayout, type CompositionExplanation, composeSlide, layoutQuote, layoutCode, layoutMetric } from '../dist/composition.js';
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
const quote:QuoteLayout=layoutQuote({text:'Body',attribution:'Source'},{x:0,y:0,width:600,height:400},{minFontSizePx:24});
const focusedQuote:FocusedQuote=quote;
const font:string|undefined=focusedQuote.parts[0]?.style.fontFamily;
const code:CodeLayout=layoutCode({source:'  kept',language:'ts',filename:'file.ts'},{x:0,y:0,width:600,height:400},{minFontSizePx:24});
const focusedCode:FocusedCode=code;
const nextStart:number|undefined=focusedCode.parts[0]?.fit?.sourceLines[0]?.nextStart;
const tabSize:4|undefined=focusedCode.parts[0]?.fit?.tabSize;
const segmentKind:'text'|'tab'|undefined=focusedCode.parts[0]?.fit?.sourceLines[0]?.segments[0]?.kind;
const accepted:CodeLayout|undefined=result.items[0]?.codeLayout;
const metric:MetricLayout=layoutMetric({value:42,unit:'ms',delta:0,trend:'flat'},{x:0,y:0,width:600,height:400},{minFontSizePx:32});
const focusedMetric:FocusedMetric=metric;
const originalScalar:string|number|undefined=focusedMetric.parts[0]?.sources[0]?.value;
// @ts-expect-error Unit follows the string field in the schema.
layoutMetric({value:42,unit:1},{x:0,y:0,width:600,height:400});
const scoreVersion:'grid-score-v9'|undefined=explanation?.algorithm;
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

test('FR-02: ids on list items, bullets, timeline events and table rows are in the generated declarations', () => {
  const fixture=fileURLToPath(new URL('./generated-entry-ids-fixture.ts',import.meta.url));
  const source=`import { type Presentation, rowCells, tableRows } from '../dist/index.js';
type Block = NonNullable<Presentation['slides'][number]['blocks']>[number];
const items: Block = {items:['plain',{id:'it-1',text:'with an id'}]};
const bullets: Block = {bullets:[{id:'b-1',text:'with an id'}]};
const timeline: Block = {timeline:[{id:'e-1',what:'Pilot'}]};
const table: Block = {table:{rows:[['a',1],{id:'r-1',cells:['b',2]}]}};
// @ts-expect-error A row object needs its cells.
const noCells: Block = {table:{rows:[{id:'r-2'}]}};
// @ts-expect-error A row object takes no other member.
const extra: Block = {table:{rows:[{id:'r-3',cells:['c'],height:3}]}};
// @ts-expect-error An id is a string.
const numeric: Block = {items:[{id:7,text:'x'}]};
const cells: unknown[] = rowCells({id:'r-1',cells:['b']});
const rows = tableRows({rows:[['a']]}).map((row) => row.id ?? row.cellsPath);
void [items,bullets,timeline,table,noCells,extra,numeric,cells,rows];`;
  const options={strict:true,noEmit:true,skipLibCheck:false,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:[]};
  const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
  host.readFile=file=>path.resolve(file)===fixture?source:read(file);
  host.fileExists=file=>path.resolve(file)===fixture||exists(file);
  const program=ts.createProgram([fixture],options,host);
  const errors=ts.getPreEmitDiagnostics(program);
  assert.equal(errors.length,0,ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:file=>file,getNewLine:()=> '\n'}));
});

test('FR-08: the embed payload is in the generated declarations, on a slide and on a block', () => {
  const fixture=fileURLToPath(new URL('./generated-embed-fixture.ts',import.meta.url));
  const source=`import { type Presentation, embedAspect, embedCardLayout, credentialInSrc, embedTitle, embedValue } from '../dist/index.js';
type Slide = Presentation['slides'][number];
type Block = NonNullable<Slide['blocks']>[number];
const shorthand: Slide = {embed:'https://app.example.com/dashboard'};
const full: Block = {embed:{src:'https://app.example.com/dashboard',title:'Dashboard',aspectRatio:1.6,preview:'asset:shot'},caption:'Live'};
const typed: Slide = {type:'embed',embed:'https://app.example.com/dashboard'};
// @ts-expect-error An embed object needs its address.
const noSrc: Block = {embed:{title:'Dashboard'}};
// @ts-expect-error The deck holds no sandbox policy.
const sandbox: Block = {embed:{src:'https://app.example.com/',sandbox:'allow-scripts'}};
// @ts-expect-error The aspect ratio is a number.
const ratio: Block = {embed:{src:'https://app.example.com/',aspectRatio:'16:9'}};
const value: { src: string; title?: string; aspectRatio?: number; preview?: string } | undefined = embedValue('https://app.example.com/');
const name: string = embedTitle(full.embed);
const aspect: number = embedAspect(shorthand.embed);
const credential: string | undefined = credentialInSrc('https://app.example.com/?token=1');
const card = embedCardLayout({frame:{x:0,y:0,width:800,height:450},title:name,site:'app.example.com',headingFamily:'Roboto',bodyFamily:'Roboto',scale:1});
const lines: string[] | undefined = card.title?.lines;
const badge: number = card.icon.badge.width;
void [shorthand,full,typed,noSrc,sandbox,ratio,value,aspect,credential,lines,badge];`;
  const options={strict:true,noEmit:true,skipLibCheck:false,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:[]};
  const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
  host.readFile=file=>path.resolve(file)===fixture?source:read(file);
  host.fileExists=file=>path.resolve(file)===fixture||exists(file);
  const program=ts.createProgram([fixture],options,host);
  const errors=ts.getPreEmitDiagnostics(program);
  assert.equal(errors.length,0,ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:file=>file,getNewLine:()=> '\n'}));
});
