import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cp,mkdir,mkdtemp,readFile,rm,symlink,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {BUNDLED_FONT_MANIFEST,prepareNodeFonts} from '../dist/fonts-node.js';
import {renderSvg,resolvePresentation,svgToPng} from '../dist/index.js';
import {paginatePresentation} from '@openpresentation/opf/pagination';

const require=createRequire(import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
const root=fileURLToPath(new URL('../',import.meta.url)),report={node:process.version,faces:[],guards:[]};
const {registry,options}=await prepareNodeFonts();
assert.equal(BUNDLED_FONT_MANIFEST.packages.length,8);
assert.equal(BUNDLED_FONT_MANIFEST.packages.reduce((n,p)=>n+p.faces.length,0),33);
assert.throws(()=>{BUNDLED_FONT_MANIFEST.packages[0].faces[0].sha256='changed';},TypeError);
assert.equal(registry.embeddedFonts.length,9);
assert.equal(options.useBundledFonts,false);
assert.equal(options.loadSystemFonts,false);
for(const [i,face]of options.embeddedFonts.entries()){
  const bytes=await readFile(options.fontFiles[i]);
  assert.deepEqual(Buffer.from(face.dataUrl.split(',')[1],'base64'),bytes,'measurement, embedded SVG, and raster must use identical bytes');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="120"><rect width="900" height="120" fill="white"/><text x="30" y="75" font-family="${face.family}" font-weight="${face.weight}" font-style="${face.italic?'italic':'normal'}" font-size="42">Office AVATAR 0123 — typography</text></svg>`;
  const complete=await svgToPng(svg,options),defaults=await svgToPng(svg,{loadSystemFonts:false});
  assert.deepEqual(defaults,complete,`${face.family}/${face.weight}/${face.italic}: default raster must include every measured base face`);
  report.faces.push({family:face.family,weight:face.weight,italic:face.italic,fontSha256:hash(bytes),pngSha256:hash(complete)});
}
const deck={name:'Prepared font workflow',design:{fontScheme:'roboto'},slides:[{id:'prepared',title:'Measured typography',blocks:[{text:[{text:'Source ',bold:true},{text:'keeps its formatting.',italic:true}]},{text:'AVATAR iii WWW office affine. '.repeat(40)}]}]};
const original=JSON.stringify(deck),pages=paginatePresentation(deck,options);
const svg=renderSvg(pages.presentation,options);
assert.equal(JSON.stringify(deck),original);
assert.match(svg,/@font-face/);
const again=await prepareNodeFonts();
assert.equal(renderSvg(pages.presentation,again.options),svg,'same bytes and input must replay identically');
assert.deepEqual(resolvePresentation(pages.presentation,options).slides.map(s=>s.geometry),resolvePresentation(pages.presentation,again.options).slides.map(s=>s.geometry));
assert.ok((await svgToPng(svg,options)).length>1000);
const office=await prepareNodeFonts({pack:'office',substitutionPolicy:'visual'});
const aptosDeck={slides:[{title:'Explicit Office substitute',text:'The source font choice stays in the document.'}]};
const aptosSource=JSON.stringify(aptosDeck);
renderSvg(aptosDeck,office.options);
assert.equal(JSON.stringify(aptosDeck),aptosSource);
assert.ok(office.registry.substitutions.some(item=>item.requestedFamily==='Aptos'&&item.resolvedFamily==='Carlito'&&item.compatibility==='visual'));
const metric=await prepareNodeFonts({pack:'office'});
assert.throws(()=>renderSvg(aptosDeck,metric.options),{code:'font-unavailable'});
await assert.rejects(prepareNodeFonts({pack:'unknown'}),{code:'invalid-font-pack'});
assert.throws(()=>renderSvg({design:{fontScheme:'roboto'},slides:[{text:'你好'}]},options),{code:'missing-glyph'});

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
  await isolated.loadBundledFontRegistry();
  const pkg=BUNDLED_FONT_MANIFEST.packages[0],directory=path.join(temporary,'node_modules',pkg.name);
  const file=path.join(directory,pkg.faces[0].file),originalFont=await readFile(file);
  await writeFile(file,Buffer.concat([originalFont,Buffer.from('corrupt')]));
  await assert.rejects(isolated.loadBundledFontRegistry(),{code:'font-integrity-mismatch'});report.guards.push('modified font bytes');
  await writeFile(file,originalFont);
  const licenseFile=path.join(directory,pkg.licenseFile),license=await readFile(licenseFile);
  await writeFile(licenseFile,'Missing original notice');
  await assert.rejects(isolated.loadBundledFontRegistry(),{code:'font-integrity-mismatch'});report.guards.push('modified license');
  await writeFile(licenseFile,license);
  const metadataFile=path.join(directory,'package.json'),metadata=await readFile(metadataFile,'utf8');
  await writeFile(metadataFile,JSON.stringify({...JSON.parse(metadata),version:'99.0.0'}));
  await assert.rejects(isolated.loadBundledFontRegistry(),{code:'font-version-mismatch'});report.guards.push('unexpected version');
  await writeFile(metadataFile,metadata);
  await rm(file);
  await assert.rejects(isolated.loadBundledFontRegistry(),{code:'font-resource-unavailable'});report.guards.push('missing font');
  const raster=await import(pathToFileURL(path.join(temporary,'dist/index.js')));
  const emptySvg='<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>';
  await assert.rejects(raster.svgToPng(emptySvg),{code:'font-resource-unavailable'});report.guards.push('default raster refuses missing bundled resources');
  await writeFile(file,originalFont);
  await isolated.loadBundledFontRegistry();
  assert.ok((await raster.svgToPng(emptySvg)).length>0,'a repaired installation must recover from a rejected default-font load');
}finally{await rm(temporary,{recursive:true,force:true});}
if(process.argv[2]){await mkdir(path.dirname(path.resolve(process.argv[2])),{recursive:true});await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');}
console.log('Prepared fonts: 33 pinned faces/notices, nine exact raster styles, deterministic document workflow, explicit substitutions and integrity failure/recovery passed.');
