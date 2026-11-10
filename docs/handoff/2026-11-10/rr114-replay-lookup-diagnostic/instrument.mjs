// Non-timed diagnostic instrumentation. No cache, validation, data or control-flow shortcut is added.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const sha=value=>createHash('sha256').update(value).digest('hex');
export const COUNTER=Symbol.for('opf.rr114.full-style-key-lookup-diagnostic.v1');
export function transform(source){
 const replacements=[
  ['const internStyle = (style) => {','const internStyle = (style, diagnosticKind) => {\n    globalThis[Symbol.for("opf.rr114.full-style-key-lookup-diagnostic.v1")].enter(diagnosticKind);'],
  ['const id = internStyle(style);','const id = internStyle(style, "selection");'],
  ['const styleId = internStyle(style);','const styleId = internStyle(style, kind);'],
  ['const held = candidate.styleIds.get(key);','globalThis[Symbol.for("opf.rr114.full-style-key-lookup-diagnostic.v1")].key(diagnosticKind, key);\n    const held = candidate.styleIds.get(key);'],
 ];
 let out=source;for(const[before,after]of replacements){assert.equal(out.split(before).length,2,'One exact diagnostic anchor: '+before);out=out.replace(before,after);}return{source:out,anchors:replacements.map(([before])=>before),sha256:sha(out),bytes:Buffer.byteLength(out)};
}
export function counters(limits){
 const kinds=['selection','measure','probe'],rows=Object.fromEntries(kinds.map(kind=>[kind,{calls:0,fullKeyLookups:0,samePreviousOfKind:0,differentPreviousOfKind:0,firstOfKind:0,samePreviousOverall:0,sameSecondPreviousOverall:0,sameEitherLastTwoOverall:0,maxKeyUtf16:0}])),lastByKind={};
 let lastOverall,secondOverall,failure=null,totalCalls=0,phase='preparation';
 const reject=message=>{failure??=message;},row=kind=>{if(!Object.hasOwn(rows,kind)){reject('Unknown existing caller kind');return;}return rows[kind];};
 return{
  enter(kind){const r=row(kind);if(!r)return;r.calls++;if(++totalCalls>limits.maxCalls)reject('Diagnostic call bound exceeded');},
  key(kind,key){const r=row(kind);if(!r)return;r.fullKeyLookups++;if(typeof key!=='string'){reject('Missing full serialized key');return;}r.maxKeyUtf16=Math.max(r.maxKeyUtf16,key.length);if(key.length>limits.maxKeyUtf16){reject('Diagnostic retained-key bound exceeded');return;}
   if(Object.hasOwn(lastByKind,kind)){if(lastByKind[kind]===key)r.samePreviousOfKind++;else r.differentPreviousOfKind++;}else r.firstOfKind++;
   if(lastOverall===key)r.samePreviousOverall++;if(secondOverall===key)r.sameSecondPreviousOverall++;if(lastOverall===key||secondOverall===key)r.sameEitherLastTwoOverall++;
   lastByKind[kind]=key;secondOverall=lastOverall;lastOverall=key;
  },
  phase(value){phase=value;},
  snapshot(){return{phase,totalCalls,failure,rows:structuredClone(rows),retention:{fixedMaximumKeys:limits.maxRetainedKeys,maxUtf16PerKey:limits.maxKeyUtf16,fullKeyContentEmitted:false},scope:'Instrumented counters; durations/RSS are not performance results'};},
  release(){for(const kind of kinds)delete lastByKind[kind];lastOverall=undefined;secondOverall=undefined;},
 };
}