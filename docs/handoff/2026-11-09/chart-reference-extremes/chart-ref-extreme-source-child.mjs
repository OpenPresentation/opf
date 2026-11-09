import fs from 'node:fs';
import {createRequire,registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
const root='C:/opf-work/chart-ref-impl',require=createRequire(root+'/packages/javascript/package.json'),{buildSync}=createRequire(require.resolve('tsup/package.json'))('esbuild');
const output=root+'/packages/javascript/.tmp/chart-reference-source-probe.mjs';fs.mkdirSync(root+'/packages/javascript/.tmp',{recursive:true});
const built=buildSync({entryPoints:[root+'/packages/javascript/src/composition.ts'],bundle:true,format:'esm',platform:'node',packages:'external',write:false});fs.writeFileSync(output,built.outputFiles[0].text);
registerHooks({resolve(specifier,context,next){if(specifier==='@openpresentation/opf/composition')return{url:pathToFileURL(output).href,shortCircuit:true};return next(specifier,context);}});
const core=await import(pathToFileURL(output));
const {toSvg,resolvePresentation}=await import(pathToFileURL(root+'/packages/render/src/svg.js'));
const {gallery}=await import(pathToFileURL(root+'/packages/gallery/dist/index.js'));
const opts={catalogs:[gallery],trace:true};
for(const type of ['column','bar','line','line-with-markers','area','combo'])for(const values of [[Number.MAX_VALUE],[-Number.MAX_VALUE],[-Number.MAX_VALUE,Number.MAX_VALUE]]){
 const chart={type,data:{columns:['Q','Actual',...(type==='combo'?['Rate']:[])],rows:[['Q1',1,...(type==='combo'?[.2]:[])],['Q2',2,...(type==='combo'?[.3]:[])]]},...(type==='combo'?{line:['Rate'],secondaryAxis:['Rate']}:{}),referenceLines:values.map(value=>({value,label:'Target'}))};const doc={slides:[{chart}]};
 const svg=toSvg(doc,1,opts),item=resolvePresentation(doc,opts).slides[0].geometry.items.find(i=>i.field==='chart'),count=(svg.match(/data-opf-path="slides\.0\.chart\.referenceLines\.\d+"/g)??[]).length;
 if(count!==values.length||/NaN|Infinity/.test(svg)||item.chart.layer.references.lines.length!==values.length)throw Error('Extreme mismatch '+type+' '+values);
 console.log(JSON.stringify({type,values,referenceCount:count,ticks:core.chartAxisScale(item.chart.valueAxis).ticks.length,nonfinite:false}));
}
console.log('bounded source control PASS (18 actual SVG/composition cases; source-only diagnostic bundle, not a normal package qualification)');
