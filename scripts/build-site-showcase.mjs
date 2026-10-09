import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const registry = process.argv.includes('--registry') ? await (await import('./registry-toolchain.mjs')).registryToolchain() : null;
// RR-55, RR-74: the local workspace and the published packages (`--registry`, the release plan's train) share one API: toSvg (renderSlideSvg before opf-render 0.18), loadFonts, { fonts }, validate.
const render = registry ? await registry.import('@openpresentation/opf-render/svg') : await import('../../opf-render/src/svg.js');
const toSvg = render.toSvg ?? ((deck, slide, options) => render.renderSlideSvg(deck, slide - 1, options));
const {loadFonts} = registry ? await registry.import('@openpresentation/opf-render/fonts-node') : await import('../../opf-render/src/fonts-node.js');
const {toPptx} = registry ? await registry.import('@openpresentation/opf-pptx') : await import('../../opf-pptx/src/index.js');
const {validate} = registry ? await registry.import('@openpresentation/opf') : await import('../packages/javascript/dist/index.js');
const document={name:'Open tools. Editable presentations.',design:{theme:'classic',fontScheme:'roboto',dimensions:'widescreen'},slides:[{id:'open-foundation',title:'One format. Open tools.',composition:{mode:'row',weights:[2,1]},blocks:[{text:['Write plain JSON. ',{text:'Keep every word editable.',bold:true},'\nValidate, preview, and export with the same free libraries.']},{items:['Portable agent skills','Local CLI and editor','Editable PPTX export']}]}]};
const result=validate(document,{only:['format']});if(!result.valid)throw new Error(JSON.stringify(result.findings));
const fonts=await loadFonts({pack:'office'}),embeddedFonts=fonts.embeddedFonts.filter(font=>font.family==='Roboto'&&[400,700].includes(font.weight)&&!font.italic);
const svg=toSvg(document,1,{fonts:{textMeasurement:fonts.textMeasurement,embeddedFonts}}),pptx=await toPptx(document,{fonts:{textMeasurement:fonts.textMeasurement}});
const out=new URL('../artifacts/site-showcase/',import.meta.url);await mkdir(out,{recursive:true});
await writeFile(new URL('example.opf.json',out),JSON.stringify(document,null,2)+'\n');await writeFile(new URL('example.svg',out),svg);await writeFile(new URL('example.pptx',out),pptx);
const sha256=value=>createHash('sha256').update(value).digest('hex');
await writeFile(new URL('manifest.json',out),JSON.stringify({renderer:'@openpresentation/opf-render',source:'example.opf.json',preview:'example.svg',pptx:'example.pptx',sha256:sha256(svg),toolchain:registry?{source:'npm',packages:registry.packages}:{source:'local-workspace'},files:{'example.opf.json':sha256(JSON.stringify(document,null,2)+'\n'),'example.svg':sha256(svg),'example.pptx':sha256(pptx)}},null,2)+'\n');
console.log('Showcase built from validated OPF with measured fonts and native PPTX.');
