import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),npmCli=process.env.npm_execpath;
assert.ok(npmCli?.endsWith('npm-cli.js'),'Run with npm run test:packed');
const temporary=await mkdtemp(path.join(tmpdir(),'opf-render-packed-'));
const actualTemporary=await realpath(temporary),temporaryParent=await realpath(tmpdir());
const npm=(args,cwd)=>execFileSync(process.execPath,[npmCli,...args],{cwd,encoding:'utf8',maxBuffer:8*1024*1024});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
  const packed=JSON.parse(npm(['pack','--json','--pack-destination',temporary],root))[0];
  const consumer=path.join(temporary,'consumer');await mkdir(consumer);
  await writeFile(path.join(consumer,'package.json'),JSON.stringify({private:true,type:'module'}));
  npm(['install','--ignore-scripts','--no-fund','--no-audit',path.join(temporary,packed.filename)],consumer);
  const installed=path.join(consumer,'node_modules/@openpresentation/opf-render');
  const manifest=JSON.parse(await readFile(path.join(installed,'package.json'),'utf8'));
  assert.equal(manifest.version,JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version);
  const files={};
  for(const {path:file} of packed.files){
    assert.ok(!path.isAbsolute(file)&&!file.split(/[/\\]/).includes('..'));
    const bytes=await readFile(path.join(installed,file));
    assert.equal(hash(bytes),hash(await readFile(path.join(root,file))),`Installed package file differs: ${file}`);
    files[file]=hash(bytes);
  }
  for(const entry of ['dist/index.js','dist/svg.js','dist/fonts-node.js','dist/fonts-browser.js','dist/svg.d.ts','dist/element.js','dist/element.d.ts','dist/element-define.js','dist/player.js','dist/player.d.ts','dist/deck-runtime.js','dist/preview-fonts.js','dist/preview-fonts-node.js','dist/preview-fonts-cli.js','LICENSE'])assert.ok(files[entry],`Missing public entry: ${entry}`);
  // FF-31: vendored upstream fonts (fonts/carlito) ship in the tarball and load from the installed package.
  const {BUNDLED_FONT_MANIFEST}=await import(pathToFileURL(path.join(root,'dist/font-manifest.js')));
  const vendored=BUNDLED_FONT_MANIFEST.packages.filter(pkg=>pkg.vendored);
  assert.ok(vendored.length>0,'the manifest vendors at least one font directory');
  for(const pkg of vendored)for(const file of [pkg.licenseFile,...(pkg.noticeFile?[pkg.noticeFile]:[]),...pkg.faces.map(face=>face.file)])assert.ok(files[`${pkg.vendored}/${file}`],`Missing vendored font file: ${pkg.vendored}/${file}`);
  // The packed copies byte-match the manifest pins; the open pack also ships its PROVENANCE.json (FF-31).
  for(const pkg of vendored){
    for(const face of pkg.faces)assert.equal(files[`${pkg.vendored}/${face.file}`],face.sha256,`Packed vendored face differs from its manifest pin: ${pkg.vendored}/${face.file}`);
    assert.equal(files[`${pkg.vendored}/${pkg.licenseFile}`],pkg.licenseSha256,`Packed license notice differs from its pin: ${pkg.vendored}`);
    if(pkg.pack==='open')assert.ok(files[`${pkg.vendored}/PROVENANCE.json`],`Missing provenance: ${pkg.vendored}`);
  }
  assert.equal(Object.keys(files).filter(file=>file.startsWith('fonts/')&&file.endsWith('.ttf')).length,vendored.reduce((total,pkg)=>total+pkg.faces.length,0),'Only the listed vendored faces are packed');
  await writeFile(path.join(consumer,'vendored-fonts.mjs'),`import assert from 'node:assert/strict';
import {realpathSync} from 'node:fs';
import path from 'node:path';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
const fonts=await loadFonts({pack:'office'}),{registry,manifest}=fonts;
const installed=realpathSync(path.resolve('node_modules/@openpresentation/opf-render'));
for(const pkg of manifest.packages.filter(item=>item.vendored))for(const face of pkg.faces){
  assert.ok(fonts.fontFiles.some(file=>realpathSync(file)===path.join(installed,pkg.vendored,face.file)),'vendored face loads from the installed package: '+face.file);
  assert.equal(registry.resolveFont({fontFamily:face.family,fontWeight:face.weight,italic:face.italic}).compatibility,'exact');
}
assert.equal(registry.resolveFont({fontFamily:'Calibri',fontWeight:400}).resolvedFamily,'Carlito');
console.log('Vendored fonts load from the installed package.');
`);
  process.stdout.write(execFileSync(process.execPath,['vendored-fonts.mjs'],{cwd:consumer,encoding:'utf8'}));
  // RR-28: the player and <opf-deck> entry points resolve from the installed package, are safe to import on a server, and the font root
  // copies from the installed package (its vendored faces and the installed @expo-google-fonts packages).
  await writeFile(path.join(consumer,'player-entries.mjs'),`import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {defineOpfDeck,renderDeckHtml} from '@openpresentation/opf-render/element';
import {present} from '@openpresentation/opf-render/player';
import '@openpresentation/opf-render/element/define';
import {previewFontLayout} from '@openpresentation/opf-render/preview-fonts';
import {copyPreviewFonts} from '@openpresentation/opf-render/preview-fonts-node';
assert.equal(defineOpfDeck(),undefined,'importing the element on a server defines nothing and throws nothing');
await assert.rejects(present({slides:[{title:'x'}]}),error=>error.code==='no-dom');
const html=renderDeckHtml({name:'Packed',slides:[{title:'One'},{title:'Two',hidden:true}]},{slides:'all'});
assert.match(html,/^<opf-deck><figure /);assert.equal((html.match(/<figure /g)??[]).length,1);
assert.ok(previewFontLayout().length>40);
const out=await mkdtemp(path.join(tmpdir(),'opf-packed-fonts-'));
try{
  const result=copyPreviewFonts({outDir:out});
  assert.ok(result.copied>100&&result.missing.length===0);
  assert.ok(existsSync(path.join(out,'base/roboto/400Regular/Roboto_400Regular.ttf')));
  assert.ok(existsSync(path.join(out,'lazy/fonts/intos/Intos-Regular.ttf')));
  assert.match(await readFile(path.join(out,'LICENSES.txt'),'utf8'),/SIL OPEN FONT LICENSE/);
  const second=await mkdtemp(path.join(tmpdir(),'opf-packed-fonts-cli-'));
  try{
    const bin=path.resolve('node_modules/.bin',process.platform==='win32'?'opf-preview-fonts.cmd':'opf-preview-fonts');
    const output=process.platform==='win32'?execFileSync('cmd.exe',['/c',bin,second],{encoding:'utf8'}):execFileSync(bin,[second],{encoding:'utf8'});
    assert.match(output,/all SHA-256 verified/);
    assert.ok(existsSync(path.join(second,'lazy/fonts/intos/IntosDisplay-Bold.ttf')));
  }finally{await rm(second,{recursive:true,force:true});}
}finally{await rm(out,{recursive:true,force:true});}
console.log('Player and <opf-deck> entry points load from the installed package.');
`);
  process.stdout.write(execFileSync(process.execPath,['player-entries.mjs'],{cwd:consumer,encoding:'utf8'}));
  const lock=JSON.parse(await readFile(path.join(consumer,'package-lock.json'),'utf8'));
  const core=lock.packages['node_modules/@openpresentation/opf'];
  assert.ok(core.resolved.startsWith('https://registry.npmjs.org/')&&core.integrity.startsWith('sha512-')&&!core.link);
  const actualCore=await realpath(path.join(consumer,'node_modules/@openpresentation/opf'));
  assert.ok(actualCore.startsWith((await realpath(path.join(consumer,'node_modules')))+path.sep),'Core must be installed inside the clean consumer');
  for(const file of ['shared-quote.mjs','quote-footer.mjs','shared-code.mjs','chart-axis.mjs','chart-scale.mjs','aptos-preview.mjs']){
    const source=(await readFile(path.join(root,'test',file),'utf8'))
      .replaceAll('new URL("../dist/svg.js", import.meta.url).href','import.meta.resolve("@openpresentation/opf-render/svg")')
      .replaceAll('"../dist/svg.js"','"@openpresentation/opf-render/svg"')
      .replaceAll("'../dist/svg.js'","'@openpresentation/opf-render/svg'")
      .replaceAll("'../dist/fonts-node.js'","'@openpresentation/opf-render/fonts-node'")
      .replaceAll("'../dist/index.js'","'@openpresentation/opf-render'");
    await writeFile(path.join(consumer,file),source);
    process.stdout.write(execFileSync(process.execPath,[file],{cwd:consumer,encoding:'utf8'}));
  }
  const audit=JSON.parse(npm(['audit','--json'],consumer));
  assert.equal(audit.metadata.vulnerabilities.total,0);
  const signatures=npm(['audit','signatures'],consumer);process.stdout.write(signatures);
  await mkdir(path.join(root,'artifacts'),{recursive:true});
  await writeFile(path.join(root,`artifacts/packed-consumer-node${process.versions.node.split('.')[0]}.json`),JSON.stringify({
    node:process.version,package:manifest.name,version:manifest.version,integrity:packed.integrity,
    core:{version:core.version,resolved:core.resolved,integrity:core.integrity},files,knownVulnerabilities:0,
    boundary:'Clean installed candidate with registry core, byte-matched shipped files and Node quote/code and finite chart-axis and chart-scale regressions, including explicit XML character rejection. Browser glyph tests run separately; this is not native raster equivalence or renderer registry publication.',
  },null,2)+'\n');
  console.log(`Packed renderer passed: ${Object.keys(files).length} byte-matched files; registry core ${core.version}; ${packed.integrity}`);
}finally{
  const actual=await realpath(temporary),relative=path.relative(temporaryParent,actual);
  assert.equal(actual,actualTemporary);assert.ok(relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Cleanup must stay inside its temporary parent');
  await rm(temporary,{recursive:true,force:true});
}
