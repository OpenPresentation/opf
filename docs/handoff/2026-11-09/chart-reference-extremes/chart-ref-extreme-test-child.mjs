import fs from 'node:fs';
import {createRequire,registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
const root='C:/opf-work/chart-ref-impl',require=createRequire(root+'/packages/javascript/package.json'),{buildSync}=createRequire(require.resolve('tsup/package.json'))('esbuild');
const output=root+'/packages/javascript/.tmp/chart-reference-source-probe.mjs',built=buildSync({entryPoints:[root+'/packages/javascript/src/composition.ts'],bundle:true,format:'esm',platform:'node',packages:'external',write:false});fs.writeFileSync(output,built.outputFiles[0].text);
const coreURL=pathToFileURL(root+'/packages/javascript/dist/composition.js').href,svgURL=pathToFileURL(root+'/packages/render/dist/svg.js').href;
registerHooks({resolve(specifier,context,next){if(specifier==='@openpresentation/opf/composition')return{url:pathToFileURL(output).href,shortCircuit:true};const resolved=next(specifier,context);if(resolved.url===coreURL)return{...resolved,url:pathToFileURL(output).href};if(resolved.url===svgURL)return{...resolved,url:pathToFileURL(root+'/packages/render/src/svg.js').href};return resolved;}});
await import(pathToFileURL(root+'/packages/javascript/test/chart-reference-lines.test.mjs'));
await import(pathToFileURL(root+'/packages/render/test/chart-reference-lines.mjs'));
