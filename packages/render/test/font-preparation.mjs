import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cp,mkdir,mkdtemp,readFile,rm,symlink,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {BUNDLED_FONT_MANIFEST,loadFonts} from '../dist/fonts-node.js';
import {resolvePresentation, svgToPng, renderSlideSvg} from '../dist/index.js';
import {paginate} from '@openpresentation/opf/pagination';

const require=createRequire(import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
const root=fileURLToPath(new URL('../',import.meta.url)),report={node:process.version,faces:[],guards:[]};
const prepared = await loadFonts(), {registry} = prepared;
// Base, office and open-family (FF-31) packs are runtime dependencies; the FF-19 script pack is an optional peer.
const runtimePacks=BUNDLED_FONT_MANIFEST.packages.filter(p=>p.pack!=='scripts'),scriptPack=BUNDLED_FONT_MANIFEST.packages.filter(p=>p.pack==='scripts');
assert.equal(runtimePacks.length,29);
assert.equal(runtimePacks.reduce((n,p)=>n+p.faces.length,0),127);
assert.equal(scriptPack.length,37);
assert.equal(scriptPack.reduce((n,p)=>n+p.faces.length,0),70);
assert.throws(()=>{BUNDLED_FONT_MANIFEST.packages[0].faces[0].sha256='changed';},TypeError);
assert.equal(registry.embeddedFonts.length,9);
assert.equal(prepared.useBundledFonts,false);
assert.equal(prepared.loadSystemFonts,false);
for(const [i,face]of prepared.embeddedFonts.entries()){
  const bytes=await readFile(prepared.fontFiles[i]);
  assert.deepEqual(Buffer.from(face.dataUrl.split(',')[1],'base64'),bytes,'measurement, embedded SVG, and raster must use identical bytes');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="120"><rect width="900" height="120" fill="white"/><text x="30" y="75" font-family="${face.family}" font-weight="${face.weight}" font-style="${face.italic?'italic':'normal'}" font-size="42">Office AVATAR 0123 — typography</text></svg>`;
  const complete=await svgToPng(svg, {fonts: prepared}),defaults=await svgToPng(svg);
  assert.deepEqual(defaults,complete,`${face.family}/${face.weight}/${face.italic}: default raster must include every measured base face`);
  report.faces.push({family:face.family,weight:face.weight,italic:face.italic,fontSha256:hash(bytes),pngSha256:hash(complete)});
}
const deck={name:'Prepared font workflow',design:{fontScheme:'roboto'},slides:[{id:'prepared',title:'Measured typography',blocks:[{text:[{text:'Source ',bold:true},{text:'keeps its formatting.',italic:true}]},{text:'AVATAR iii WWW office affine. '.repeat(40)}]}]};
const original=JSON.stringify(deck),pages=paginate(deck, {fonts: prepared});
const svg=renderSlideSvg(pages.presentation, 0, {fonts: prepared});
assert.equal(JSON.stringify(deck),original);
assert.match(svg,/@font-face/);
const again=await loadFonts();
assert.equal(renderSlideSvg(pages.presentation, 0, {fonts: again}),svg,'same bytes and input must replay identically');
assert.deepEqual(resolvePresentation(pages.presentation, {fonts: prepared}).slides.map(s=>s.geometry),resolvePresentation(pages.presentation, {fonts: again}).slides.map(s=>s.geometry));
assert.ok((await svgToPng(svg, {fonts: prepared})).length>1000);
const office=await loadFonts({pack:'office',substitutionPolicy:'visual'});
const aptosDeck={slides:[{title:'Explicit Office substitute',text:'The source font choice stays in the document.'}]};
const aptosSource=JSON.stringify(aptosDeck);
renderSlideSvg(aptosDeck, 0, {fonts: office});
assert.equal(JSON.stringify(aptosDeck),aptosSource);
// FF-31 (owner policy 2026-09-29): the font policy previews Aptos with the metric-compatible Intos.
assert.ok(office.registry.substitutions.some(item=>item.requestedFamily==='Aptos'&&item.resolvedFamily==='Intos'&&item.compatibility==='metric'&&item.substitute));
const metric=await loadFonts({pack:'office'});
assert.doesNotThrow(()=>renderSlideSvg(aptosDeck, 0, {fonts: metric}));
assert.ok(metric.registry.substitutions.some(item=>item.requestedFamily==='Aptos'&&item.resolvedFamily==='Intos'&&item.compatibility==='metric'));
const baseMetric=await loadFonts({pack:'base',substitutionPolicy:'metric'});
assert.throws(()=>renderSlideSvg(aptosDeck, 0, {fonts: baseMetric}),{code:'font-unavailable'});
await assert.rejects(loadFonts({pack:'unknown'}),{code:'invalid-font-pack'});
assert.throws(()=>renderSlideSvg({design:{fontScheme:'roboto'},slides:[{text:'你好'}]}, 0, {fonts: prepared}),{code:'missing-glyph'});

// Corrupt only a disposable copy. Real parser-valid fonts must still fail an integrity mismatch.
const temporary=await mkdtemp(path.join(tmpdir(),'opf-font-integrity-'));
try{
  await writeFile(path.join(temporary,'package.json'),JSON.stringify({type:'module'}));
  await cp(path.join(root,'dist'),path.join(temporary,'dist'),{recursive:true});
  await mkdir(path.join(temporary,'node_modules/@expo-google-fonts'),{recursive:true});
  await symlink(path.join(root,'node_modules/fontkit'),path.join(temporary,'node_modules/fontkit'),process.platform==='win32'?'junction':'dir');
  for(const namespace of ['@openpresentation','@resvg'])await symlink(path.join(root,'node_modules',namespace),path.join(temporary,'node_modules',namespace),process.platform==='win32'?'junction':'dir');
  for(const pkg of BUNDLED_FONT_MANIFEST.packages.filter(p=>p.pack==='base')){
    await cp(path.dirname(require.resolve(`${pkg.name}/package.json`)),path.join(temporary,'node_modules',pkg.name),{recursive:true});
  }
  const isolated=await import(pathToFileURL(path.join(temporary,'dist/fonts-node.js')));
  await isolated.loadFonts();
  const pkg=BUNDLED_FONT_MANIFEST.packages[0],directory=path.join(temporary,'node_modules',pkg.name);
  const file=path.join(directory,pkg.faces[0].file),originalFont=await readFile(file);
  await writeFile(file,Buffer.concat([originalFont,Buffer.from('corrupt')]));
  await assert.rejects(isolated.loadFonts(),{code:'font-integrity-mismatch'});report.guards.push('modified font bytes');
  await writeFile(file,originalFont);
  const licenseFile=path.join(directory,pkg.licenseFile),license=await readFile(licenseFile);
  await writeFile(licenseFile,'Missing original notice');
  await assert.rejects(isolated.loadFonts(),{code:'font-integrity-mismatch'});report.guards.push('modified license');
  await writeFile(licenseFile,license);
  const metadataFile=path.join(directory,'package.json'),metadata=await readFile(metadataFile,'utf8');
  await writeFile(metadataFile,JSON.stringify({...JSON.parse(metadata),version:'99.0.0'}));
  await assert.rejects(isolated.loadFonts(),{code:'font-version-mismatch'});report.guards.push('unexpected version');
  await writeFile(metadataFile,metadata);
  await rm(file);
  await assert.rejects(isolated.loadFonts(),{code:'font-resource-unavailable'});report.guards.push('missing font');
  const raster=await import(pathToFileURL(path.join(temporary,'dist/index.js')));
  const emptySvg='<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>';
  await assert.rejects(raster.svgToPng(emptySvg),{code:'font-resource-unavailable'});report.guards.push('default raster refuses missing bundled resources');
  await writeFile(file,originalFont);
  await isolated.loadFonts();
  assert.ok((await raster.svgToPng(emptySvg)).length>0,'a repaired installation must recover from a rejected default-font load');
  // FF-31: a vendored entry (fonts/carlito) resolves from the package root and has the same integrity guards.
  for(const pkg of BUNDLED_FONT_MANIFEST.packages.filter(p=>(p.pack==='office'&&!p.vendored)||p.name==='@expo-google-fonts/noto-sans')){
    await cp(path.dirname(require.resolve(`${pkg.name}/package.json`)),path.join(temporary,'node_modules',pkg.name),{recursive:true});
  }
  const vendored=BUNDLED_FONT_MANIFEST.packages.find(p=>p.vendored);
  await assert.rejects(isolated.loadFonts({pack:'office'}),{code:'font-resource-unavailable'});report.guards.push('missing vendored directory');
  for(const pkg of BUNDLED_FONT_MANIFEST.packages.filter(p=>p.vendored))await cp(path.join(root,pkg.vendored),path.join(temporary,pkg.vendored),{recursive:true});
  const office=await isolated.loadFonts({pack:'office'});
  const vendoredFile=path.join(temporary,vendored.vendored,vendored.faces[0].file),vendoredFont=await readFile(vendoredFile);
  assert.ok(office.fontFiles.includes(vendoredFile),'vendored faces load from the package root');
  await writeFile(vendoredFile,Buffer.concat([vendoredFont,Buffer.from('corrupt')]));
  await assert.rejects(isolated.loadFonts({pack:'office'}),{code:'font-integrity-mismatch'});report.guards.push('modified vendored font bytes');
  await writeFile(vendoredFile,vendoredFont);
  const vendoredLicense=path.join(temporary,vendored.vendored,vendored.licenseFile);
  await writeFile(vendoredLicense,'Missing original notice');
  await assert.rejects(isolated.loadFonts({pack:'office'}),{code:'font-integrity-mismatch'});report.guards.push('modified vendored license');
}finally{await rm(temporary,{recursive:true,force:true});}
if(process.argv[2]){await mkdir(path.dirname(path.resolve(process.argv[2])),{recursive:true});await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');}
console.log('Prepared fonts: 127 pinned faces/notices, nine exact raster styles, deterministic document workflow, explicit substitutions and integrity failure/recovery passed.');
