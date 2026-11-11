// Harness-only esbuild overlay. Nothing here edits product source/dist or adds a package API.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const FONT_CACHE_DIAGNOSTIC_VERSION=2;
export const FONT_CACHE_TARGETS=['font-registry.js','lazy-fonts.js','script-font-pack.js','fonts-browser.js','current-browser-entry.mjs'];
const virtualName='@rr117/font-cache-diagnostics';
const hash=value=>createHash('sha256').update(value).digest('hex');
const normalized=value=>value.split(path.sep).join('/');

// Readers use existing measurement/stat identity keys. No strong owner registration history is kept.
const runtimeSource=String.raw`
const readers=new WeakMap(),mounts=[];
let registrations=0,registrationMs=0,mountRegistrationMs=0;
const weakRefsSupported=typeof WeakRef==='function';
export function keyFootprint(keys){
 const start=performance.now();let keyCount=0,utf16Units=0;
 for(const key of keys){if(typeof key!=='string')throw Error('Diagnostic cache key must be a string');keyCount++;utf16Units+=key.length;}
 return{keyCount,utf16Units,iterationMs:performance.now()-start};
}
export function registerReader(owner,kind,read){
 const start=performance.now();
 if(!owner||(typeof owner!=='object'&&typeof owner!=='function'))throw Error('Diagnostic owner must be an object');
 let kinds=readers.get(owner);if(!kinds)readers.set(owner,kinds=new Map());
 if(kinds.has(kind))throw Error('Duplicate diagnostic reader: '+kind);
 kinds.set(kind,read);registrations++;registrationMs+=performance.now()-start;
}
export function readCache(owner,kind){const read=readers.get(owner)?.get(kind);if(!read)throw Error('Missing diagnostic reader: '+kind);return read();}
export function trackMount(editor){
 const start=performance.now(),refs=[],omitted=[];
 // workspace.root and workspace.session return the actual captured objects, not clone/snapshot getters.
 for(const[type,owner]of[['editor-handle',editor],['workspace-owned-root-element',editor?.root],['editor-owned-session-object',editor?.session]]){
  if(!owner||(typeof owner!=='object'&&typeof owner!=='function')){omitted.push({type,reason:'not-an-object'});continue;}
  if(weakRefsSupported)refs.push({type,ref:new WeakRef(owner)});else omitted.push({type,reason:'WeakRef-unavailable'});
 }
 mounts.push({mount:mounts.length+1,refs,omitted});mountRegistrationMs+=performance.now()-start;
}
export function readDiagnostics(fonts,checkpoint){
 const start=performance.now(),measurement=fonts.textMeasurement;
 const metrics=readCache(measurement,'metrics'),analysis=readCache(measurement,'analysis');
 const footprints=[...metrics.perFace.map(face=>face.keyFootprint),analysis.fonts.contextKeys,...analysis.fonts.slideKeysPerContext,analysis.fonts.checkedDeckKeys,analysis.scripts.profileKeys,...analysis.scripts.textKeysPerProfile];
 const logicalKeyFootprint=footprints.reduce((sum,item)=>({keyCount:sum.keyCount+item.keyCount,utf16Units:sum.utf16Units+item.utf16Units,iterationMs:sum.iterationMs+item.iterationMs}),{keyCount:0,utf16Units:0,iterationMs:0});
 // Called only after the existing GC/heap observation. Dereferenced owners never escape this synchronous job.
 const census=mounts.map(entry=>({mount:entry.mount,omitted:entry.omitted,owners:entry.refs.map(({type,ref})=>{
  const owner=ref.deref();return{type,alive:owner!==undefined,...(owner&&type==='editor-handle'?{destroyed:owner.destroyed}:{}),...(owner&&type==='workspace-owned-root-element'?{connected:owner.isConnected}:{})};
 })}));
 return{scope:'CACHE_AND_WEAKREF_DIAGNOSTIC_NOT_LEAK_OR_LATENCY_ACCEPTANCE',checkpoint,metrics,analysis,logicalKeyFootprint:{...logicalKeyFootprint,scope:'LOGICAL_RETAINED_KEY_REFERENCES_UTF16_UNITS_NOT_HEAP_BYTES_OR_UNIQUE_STRING_STORAGE'},
  ownership:{sharedFontsStillOwned:true,fontsDisposed:analysis.fontsDisposed,termination:'runner finally closes browser; no added fonts.dispose call'},
  weakCensus:{supported:weakRefsSupported,mounts:census,interpretation:'Collected means absent at this read; alive after forced GC is a candidate, not a leak verdict.'},
  overhead:{cumulativeReaderRegistrations:registrations,readerRegistrationMs:registrationMs,mountRegistrationMs,mountRecords:mounts.length,weakRefWrappers:mounts.reduce((n,mount)=>n+mount.refs.length,0),readMs:performance.now()-start}};
}
`;

function replaceOne(source,needle,replacement,label,sites){
 const at=source.indexOf(needle);
 if(at<0||source.indexOf(needle,at+needle.length)!==-1)throw Error('Expected exactly one diagnostic source site: '+label);
 sites.push(label);return source.slice(0,at)+replacement+source.slice(at+needle.length);
}

export function createFontCacheOverlay({root,entry}){
 const targets=new Map(FONT_CACHE_TARGETS.map(name=>[name==='current-browser-entry.mjs'?path.resolve(entry):path.resolve(root,'packages/render/dist',name),name]));
 const ownerFile=path.resolve(root,'packages/editor/src/workspace.js'),ownerSource=fs.readFileSync(ownerFile,'utf8'),ownerSites=[];
 for(const[getter,value]of[['root','root'],['session','session']]){
  const needle=`    get ${getter}() {\n      return ${value};\n    },`;
  replaceOne(ownerSource,needle,needle,'workspace actual-owner getter '+getter,ownerSites);
 }
 const ownershipSource={path:normalized(path.relative(root,ownerFile)),bytes:Buffer.byteLength(ownerSource),sha256:hash(ownerSource),sites:ownerSites};
 const records=[],seen=new Set();let runtimeLoads=0;
 const plugin={name:'rr117-font-cache-diagnostics',setup(builder){
  builder.onResolve({filter:/^@rr117\/font-cache-diagnostics$/},()=>({path:'runtime',namespace:'rr117-font-cache'}));
  builder.onLoad({filter:/.*/,namespace:'rr117-font-cache'},()=>{
   if(++runtimeLoads!==1)throw Error('Diagnostic runtime must be loaded exactly once');
   return{contents:runtimeSource,loader:'js'};
  });
  builder.onLoad({filter:/(font-registry|lazy-fonts|script-font-pack|fonts-browser)\.js$|current-browser-entry\.mjs$/},args=>{
   const name=targets.get(path.resolve(args.path));if(!name)return;
   if(seen.has(name))throw Error('Duplicate diagnostic overlay input: '+name);seen.add(name);
   const original=fs.readFileSync(args.path,'utf8'),sites=[];
   if(name!=='current-browser-entry.mjs'){
    const source=fs.readFileSync(path.resolve(root,'packages/render/src',name),'utf8');
    if(original!==source)throw Error('Diagnostic dist input differs from maintained source: '+name);
   }
   const replace=(source,needle,replacement,label)=>replaceOne(source,needle,replacement,name+':'+label,sites);
   let transformed=original;
   if(name==='font-registry.js'){
    // Verify the declared limits as well as the reader's insertion site.
    for(const needle of['if (text.length<=2048) {','if (face.cache.size>=512&&!face.cache.has(key)) face.cache.delete(face.cache.keys().next().value);'])
     replace(original,needle,needle,'bound '+needle);
    const needle='  const textMeasurement={measure,resolveStyle,outlineBounds,resolveFont:style=>resolve(style).resolution};';
    transformed=replace(original,needle,needle+"\n  registerReader(textMeasurement,'metrics',()=>({perFace:faces.map((face,index)=>({ordinal:index+1,weight:face.weight,italic:face.italic,entries:face.cache.size,keyFootprint:keyFootprint(face.cache.keys())})),maxEntriesPerFace:512,maxTextLength:2048}));",'metric readers');
   }else if(name==='lazy-fonts.js'){
    const start='function slideMemory(contexts = 8) {',end='\n/**\n * `presentationFaces` and `presentationFamilies` with memory';
    const at=original.indexOf(start),last=original.indexOf(end,at);if(at<0||last<0)throw Error('Missing slide-memory boundary');
    let memory=original.slice(at,last);
    memory=replace(memory,'  return (context, slides) => {','  const memory = (context, slides) => {','slide memory factory');
    memory=replace(memory,'  };\n}\n','  };\n  registerReader(memory,\'slides\',()=>{const entriesPerContext=[],slideKeysPerContext=[];let ordinal=0;for(const entries of byContext.values()){entriesPerContext.push(entries.size);slideKeysPerContext.push({ordinal:++ordinal,...keyFootprint(entries.keys())});}return{contexts:byContext.size,contextLimit:contexts,entriesPerContext,contextKeys:keyFootprint(byContext.keys()),slideKeysPerContext,entryLimitFormula:\'2 * slideCount + 16\'};});\n  return memory;\n}\n','slide memory reader');
    transformed=replace(original,original.slice(at,last),memory,'slide memory block');
    const needle='  const memory = slideMemory(), stats = { decks: 0, slides: 0, designs: 0 }, checked = new Set();';
    transformed=replace(transformed,needle,needle+"\n  registerReader(stats,'font-analysis',()=>({...readCache(memory,'slides'),checkedDecks:checked.size,checkedDeckLimit:8,checkedDeckKeys:keyFootprint(checked.keys())}));",'font analysis reader');
    for(const needle of['const limit = 2 * slides + 16;','while (checked.size > 8) checked.delete(checked.keys().next().value);'])replace(original,needle,needle,'bound '+needle);
   }else if(name==='script-font-pack.js'){
    const needle='  const byProfile = new Map(), stats = { strings: 0 };';
    transformed=replace(original,needle,needle+"\n  registerReader(stats,'script-analysis',()=>{const stringsPerProfile=[],textKeysPerProfile=[];let ordinal=0;for(const seen of byProfile.values()){stringsPerProfile.push(seen.size);textKeysPerProfile.push({ordinal:++ordinal,...keyFootprint(seen.keys())});}return{profiles:byProfile.size,profileLimit:4,stringsPerProfile,profileKeys:keyFootprint(byProfile.keys()),textKeysPerProfile,maxStringsPerProfile:STRING_MEMORY_LIMIT};});",'script analysis reader');
    for(const needle of['const STRING_MEMORY_LIMIT = 65536;','if (byProfile.size >= 4) byProfile.delete(byProfile.keys().next().value);','if (seen.size >= STRING_MEMORY_LIMIT) seen.clear();'])replace(original,needle,needle,'bound '+needle);
   }else if(name==='fonts-browser.js'){
    const needle='  const fontAnalysis = createFontAnalysis(), scriptMemory = createScriptAnalysis({ fonts: fontAnalysis });';
    transformed=replace(original,needle,needle+"\n  registerReader(registry.textMeasurement,'analysis',()=>({fonts:readCache(fontAnalysis.stats,'font-analysis'),scripts:readCache(scriptMemory.stats,'script-analysis'),fontsDisposed:disposed}));",'shared font owner');
   }else{
    transformed=replace(original,'});await editor.ready;','});trackMount(editor);await editor.ready;','mount census');
    transformed=replace(transformed,'window.__browserPerfReady=true;',"window.reviewTrial.fontCacheDiagnostics=checkpoint=>readDiagnostics(fonts,checkpoint);\nwindow.__browserPerfReady=true;",'checkpoint reader');
   }
   const imports=name==='current-browser-entry.mjs'?'trackMount,readDiagnostics':name==='font-registry.js'||name==='script-font-pack.js'?'registerReader,keyFootprint':name==='lazy-fonts.js'?'registerReader,readCache,keyFootprint':'registerReader,readCache';
   transformed=`import {${imports}} from '${virtualName}';\n`+transformed;
   records.push({name,original:{path:normalized(path.relative(root,args.path)),bytes:Buffer.byteLength(original),sha256:hash(original)},transformed:{bytes:Buffer.byteLength(transformed),sha256:hash(transformed)},sites});
   return{contents:transformed,loader:'js',resolveDir:path.dirname(args.path)};
  });
 }};
 return{plugin,receipt(){
  if(runtimeLoads!==1||FONT_CACHE_TARGETS.some(name=>!seen.has(name))||seen.size!==FONT_CACHE_TARGETS.length)throw Error('Incomplete diagnostic overlay');
  return{enabled:true,recipeVersion:FONT_CACHE_DIAGNOSTIC_VERSION,ownershipSource,transforms:records.sort((a,b)=>a.name.localeCompare(b.name)),runtime:{bytes:Buffer.byteLength(runtimeSource),sha256:hash(runtimeSource),source:runtimeSource},overhead:{runtimeSourceBytes:Buffer.byteLength(runtimeSource),overlaySourceBytesAdded:records.reduce((sum,row)=>sum+row.transformed.bytes-row.original.bytes,0),bundleDelta:'Compare separately bound flag-off bundle; source deltas are not bundled byte deltas.'},scope:'Opt-in cache/WeakRef observation; no product source/dist rewrite, clearing, ownership change or leak threshold.'};
 }};
}
