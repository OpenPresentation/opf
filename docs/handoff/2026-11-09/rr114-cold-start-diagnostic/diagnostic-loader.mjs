import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, realpathSync} from 'node:fs';
import {registerHooks} from 'node:module';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';

export const runtimeSource='ed29f47f092aeefbde5fabac26d395f92c6b7823';
export const builtSource='3857ff1bbc467ddb0d0031bc400e159d120b67b9';
export const moduleHashes={
  'font-demand.js':'d0a22840d1c61dea0272306862fbf2039f5f0466e469d43637c8b9871e40d0e9',
  'lazy-fonts.js':'df49a2f1f836b195e2601c1b0789f76ead0284aa7078753a1445c70ac3f4c2cf',
  'script-font-pack.js':'c3d8016bd2632e40707fbc1c7aa3098d946c463fe74b16a4404d1eb2e21c5d15',
  'fonts-node.js':'e57fc27f3f3727ab601118b0a0279913b5b7e11d98ec35853d12b7e56cbeeed4',
  'font-registry.js':'63041d9ce5e4aed51726e53bdf2d4624e29d256a903c2ada7eb5a0c63399544a',
  'svg.js':'2e583d1a7698468fa41229a1dca73116927cd4957a6539126ad50c3df0d596cc'
};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const symbol=Symbol.for('opf.rr114.coldDiagnostic');

function createCollector(){
  const spans=[],events=[],counters=new Map(),stack=[];
  let phase='moduleImport',nextId=0;
  const count=(name,n=1)=>{
    const context=stack.findLast(item=>item.name==='demand.context')?.id??null;
    const key=JSON.stringify([phase,context,name]);
    counters.set(key,(counters.get(key)??0)+n);
  };
  const begin=(name,meta={})=>{
    const item={id:++nextId,name,phase,parent:stack.at(-1)?.id??null,startMs:performance.now(),cpu:process.cpuUsage(),meta};
    spans.push(item);stack.push(item);return item;
  };
  const end=(item,meta={})=>{
    assert.equal(item.endMs,undefined,'span ended once');
    const cpu=process.cpuUsage(item.cpu);
    item.endMs=performance.now();item.elapsedMs=item.endMs-item.startMs;
    item.cpuMs={user:cpu.user/1000,system:cpu.system/1000};
    item.meta={...item.meta,...meta};delete item.cpu;
    const index=stack.indexOf(item);assert.ok(index>=0);stack.splice(index,1);
  };
  return{
    setPhase(value){assert.equal(stack.length,0,'phase changes outside active spans');phase=value;},
    begin,end,count,
    event(name,meta={}){events.push({name,phase,atMs:performance.now(),parent:stack.at(-1)?.id??null,meta});},
    sync(name,fn,meta){const item=begin(name,meta);try{return fn();}finally{end(item);}},
    async async(name,fn,meta){const item=begin(name,meta);try{return await fn();}finally{end(item);}},
    snapshot(){return{spans:spans.map(item=>({...item,cpu:undefined})),events:[...events],counters:[...counters].map(([key,value])=>{const[phase,context,name]=JSON.parse(key);return{phase,context,name,value};}),incompleteSpanIds:stack.map(item=>item.id),timingContract:'Nested and concurrent spans are inclusive, not additive. Instrumented times are attribution diagnostics, not replacement performance statistics.'};}
  };
}

export function transformForPreflight(file,original){
  let source=original;const anchors=[];
  const once=(name,needle,replacement)=>{
    assert.equal(source.split(needle).length-1,1,file+': unique anchor '+name);
    source=source.replace(needle,replacement);anchors.push(name);
  };
  if(file==='font-demand.js'){
    once('context-start',
      '  function context(presentation, renderOptions, initial = false, mapFamily) {\n',
      '  function context(presentation, renderOptions, initial = false, mapFamily) {\n    const __context = __cold.begin("demand.context", { generation, initial, slides: presentation.slides?.length, held: registry.describeFaces().length });\n    try {\n');
    once('context-end',
      '  }\n  function notify(code, details, message, diagnostic) {',
      '    } finally { __cold.end(__context, { analysisStats: {...analysis.stats}, scriptStats: {...scriptMemory.stats} }); }\n  }\n  function notify(code, details, message, diagnostic) {');
    once('plan-summary',
      '    const wanted = new Set(drawn.map(key));\n',
      '    const wanted = new Set(drawn.map(key));\n    __cold.event("demand.plan", { generation, held: held.length, wanted: [...wanted], needed: universe.filter(face => wanted.has(key(face)) && !heldKeys.has(key(face)) && !skipped.has(face.package)).map(face => ({family:face.family,weight:face.weight,italic:face.italic})), scripts:selection.scripts });\n');
    once('coverage-count',
      '            coverage(text, size, style) {\n',
      '            coverage(text, size, style) {\n              __cold.count("coverage.calls"); __cold.count("coverage.characters", text.length);\n');
  } else if(file==='lazy-fonts.js'){
    once('face-analysis-start',
      '  function faces(presentation, options = {}, registry) {\n',
      '  function faces(presentation, options = {}, registry) {\n    const __faces = __cold.begin("analysis.faces", { coverageKey:registry?.coverageKey, before:{...stats} });\n    try {\n');
    once('face-analysis-end',
      '  }\n\n  function families(presentation, options = {}) {',
      '    } finally { __cold.end(__faces, { after:{...stats} }); }\n  }\n\n  function families(presentation, options = {}) {');
    once('cache-missing-slides',
      '    if (missing.length) {\n      // Composition of the slides, then their drawing, as '+
      String.fromCharCode(96)+'toSvg'+String.fromCharCode(96)+' runs them.',
      '    __cold.event("analysis.faces.cache", { coverageKey:registry?.coverageKey, slides:keys.slides.length, missing:missing.length });\n    if (missing.length) {\n      // Composition of the slides, then their drawing, as '+
      String.fromCharCode(96)+'toSvg'+String.fromCharCode(96)+' runs them.');
    once('analysis-compose',
      '      for (const index of missing) opened.bind(index, recorders.get(index).textMeasurement);',
      '      __cold.sync("analysis.compose", () => { for (const index of missing) opened.bind(index, recorders.get(index).textMeasurement); }, {slides:missing.length});');
    once('analysis-draw-start',
      '      for (const index of missing) {\n        if (resolveOptions.skipHidden',
      '      const __draw = __cold.begin("analysis.draw", {slides:missing.length});\n      for (const index of missing) {\n        if (resolveOptions.skipHidden');
    once('analysis-draw-end',
      '        opened.render(index);\n      }\n      for (const [index, entry] of made)',
      '        opened.render(index);\n      }\n      __cold.end(__draw);\n      for (const [index, entry] of made)');
  } else if(file==='script-font-pack.js'){
    once('scripts-start',
      'export function analyzePresentationScripts(presentation, profile, renderOptions, memory = createScriptAnalysis()) {\n',
      'export function analyzePresentationScripts(presentation, profile, renderOptions, memory = createScriptAnalysis()) {\n  const __scripts = __cold.begin("analysis.scripts", {before:{strings:memory.stats.strings,fonts:{...memory.fonts.stats}}});\n  try {\n');
    once('scripts-end',
      '  return { profile, detected: [...scripts].sort(), design: design.scripts, cjk };\n}',
      '  return { profile, detected: [...scripts].sort(), design: design.scripts, cjk };\n  } finally { __cold.end(__scripts, {after:{strings:memory.stats.strings,fonts:{...memory.fonts.stats}}}); }\n}');
  } else if(file==='fonts-node.js'){
    once('file-read',
      '  try { bytes = await readFile(file); }\n',
      '  const __read = __cold.begin("font.read", {package:details.package,resource:details.file});\n  try { bytes = await readFile(file); __cold.end(__read, {bytes:bytes.length}); }\n');
    once('file-read-error',
      '  catch (error) { throw new OPFFontError("font-resource-unavailable",',
      '  catch (error) { if(__read.endMs===undefined)__cold.end(__read,{error:error.code}); throw new OPFFontError("font-resource-unavailable",');
    once('file-hash',
      '  const actual = createHash("sha256").update(bytes).digest("hex");',
      '  const actual = __cold.sync("font.verifyHash", () => createHash("sha256").update(bytes).digest("hex"), {bytes:bytes.length});');
    once('harfbuzz-initialize',
      '  const [subsetter, shaper] = await Promise.all([nodeHarfbuzz("subsets"), nodeHarfbuzz("shaper")]);',
      '  const [subsetter, shaper] = await __cold.async("harfbuzz.initialize", () => Promise.all([nodeHarfbuzz("subsets"), nodeHarfbuzz("shaper")]));');
  } else if(file==='font-registry.js'){
    once('font-parse',
      '    try { font = create(data, entry.postscriptName); }',
      '    try { font = __cold.sync("font.parse", () => create(data, entry.postscriptName), {bytes:data.length,family:entry.family,weight:entry.weight}); }');
    once('metrics-cache',
      '    let value=face.cache.get(key);',
      '    let value=face.cache.get(key);\n    __cold.count("metrics.calls"); __cold.count(value===undefined?"metrics.cacheMiss":"metrics.cacheHit");\n    if(value!==undefined&&includeOutline&&!Object.hasOwn(value,"outline"))__cold.count("metrics.outlineUpgrade");');
    once('fontkit-shape',
      '      const shape=extra=>{const features=policyFeatures||extra?',
      '      const shape=extra=>{__cold.count("shaping.fontkit"); const features=policyFeatures||extra?');
    once('harfbuzz-shape',
      '          const glyphs = shaper.shape(face, text, {direction, lang: style.lang, features: policyFeatures});',
      '          __cold.count("shaping.harfbuzz");\n          const glyphs = shaper.shape(face, text, {direction, lang: style.lang, features: policyFeatures});');
    once('cache-clear',
      '    setShaper(engine) {\n      shaper = engine;',
      '    setShaper(engine) {\n      __cold.event("font.shaperHandoff", {engine:engine?"harfbuzz":"fontkit",faces:faces.length,cachedEntries:faces.reduce((n,face)=>n+face.cache.size,0)});\n      shaper = engine;');
  } else if(file==='svg.js'){
    once('actual-compose',
      '  const slides = presentation.slides.map((_, index) => (only && !only.has(index) ? undefined : bindSlide(presentation, index, context)));',
      '  const slides = __cold.sync("svg.compose", () => presentation.slides.map((_, index) => (only && !only.has(index) ? undefined : bindSlide(presentation, index, context))), {slides:presentation.slides.length});');
    once('actual-draw',
      '  return numbers.map(number => renderResolvedSlide(resolved, number - 1, drawn));',
      '  return __cold.sync("svg.draw", () => numbers.map(number => renderResolvedSlide(resolved, number - 1, drawn)), {slides:numbers.length});');
  } else throw new Error('Unknown diagnostic module '+file);
  return{source:'const __cold = globalThis[Symbol.for("opf.rr114.coldDiagnostic")];\n'+source,anchors};
}

export function installDiagnostic(runtimeRoot){
  assert.equal(globalThis[symbol],undefined,'one diagnostic collector per fresh child');
  const collector=createCollector(),loadedModules=[];
  globalThis[symbol]=collector;
  const targets=new Map();
  for(const[file,expected]of Object.entries(moduleHashes)){
    const sourcePath=path.join(runtimeRoot,'packages/render/src',file);
    const distPath=path.join(runtimeRoot,'packages/render/dist',file);
    const src=readFileSync(sourcePath),dist=readFileSync(distPath);
    assert.equal(hash(src),expected,'frozen source module '+file);
    assert.equal(hash(dist),expected,'normal build module '+file);
    const url=pathToFileURL(realpathSync(distPath)).href;
    assert.ok(!targets.has(url));targets.set(url,{file,expected});
  }
  const hook=registerHooks({
    load(url,context,nextLoad){
      const result=nextLoad(url,context),target=targets.get(url);
      if(!target)return result;
      const before=Buffer.from(result.source);
      assert.equal(hash(before),target.expected,'loaded pre-transform module '+target.file);
      assert.ok(!loadedModules.some(item=>item.file===target.file),'one module instantiation');
      const changed=transformForPreflight(target.file,before.toString('utf8'));
      loadedModules.push({file:target.file,url,beforeSha256:target.expected,afterSha256:hash(changed.source),anchors:changed.anchors});
      return{...result,source:changed.source};
    }
  });
  return{
    collector,
    loadedModules,
    verifyLoaded(){assert.deepEqual(loadedModules.map(item=>item.file).sort(),Object.keys(moduleHashes).sort());},
    close(){hook.deregister();}
  };
}
