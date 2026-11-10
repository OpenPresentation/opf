import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
const moduleURL =
  process.env.OPF_RR114_FONT_MODULE ??
  new URL('../dist/fonts-node.js', import.meta.url).href;
const galleryURL = new URL('../../gallery/dist/index.js', import.meta.url).href;
const code = String.raw`
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {createRequire,registerHooks,syncBuiltinESMExports} from 'node:module';
const mode=process.argv[1],fontURL=process.argv[2],require=createRequire(fontURL);let armed=false,protectedFile,protectedBefore;
registerHooks({resolve(specifier,context,next){if(armed&&mode==='activation'&&specifier==='@expo-google-fonts/roboto-mono/package.json')throw Object.assign(Error('Owned simulated missing later resource'),{code:'MODULE_NOT_FOUND'});return next(specifier,context);}});
const original=fs.readFile;fs.readFile=async function(file,...args){const bytes=await original.call(this,file,...args);if(armed&&mode!=='activation'&&String(file).includes('NotoSansSC_')){protectedFile=file;protectedBefore=createHash('sha256').update(bytes).digest('hex');const copy=Buffer.from(bytes);copy[copy.length-1]^=1;if(mode==='refresh-error')fonts.registry.describeFaces=()=>{throw Object.assign(Error('Owned synthetic refresh error'),{code:'owned-refresh-error'});};return copy;}return bytes;};syncBuiltinESMExports();
const {loadFonts}=await import(fontURL),{gallery}=await import(process.argv[3]);
const catalog={...gallery,source:'https://catalog.example/activation',fontSchemes:{...gallery.fontSchemes,activation:{name:'Activation',app:'powerpoint',languageFamily:'latin',languages:[],major:'Noto Sans',minor:'Noto Sans',textSample:'Text',type:'sans-serif'}}},renderOptions={catalogs:[catalog]};
const caller=mode==='activation'?[{path:path.join(path.dirname(require.resolve('@expo-google-fonts/noto-sans/package.json')),'400Regular/NotoSans_400Regular.ttf'),family:'Noto Sans',weight:400,scripts:['Latn'],fallbackOnly:true,embed:'used'}]:[];
const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:{slides:[{title:'Initial',text:'Body'}]},renderOptions,faces:caller});
const originalDescribe=fonts.registry.describeFaces;const {lazyFontList}=await import(new URL('./lazy-font-list.js',fontURL));const id=face=>[face.family,face.weight,!!face.italic].join('/');
const cached=fonts.embeddedFonts,beforeFiles=fonts.fontFiles.length,beforeHeld=fonts.registry.describeFaces();
const edit=mode!=='activation'?{language:'ja',design:{fontScheme:'open-sans'},slides:[{title:'New family',text:'ASCII これは啰です'}]}:{design:{fontScheme:'activation'},slides:[{code:'const value = 1;'}]};
armed=true;let refusal;try{await fonts.ensure(edit,{renderOptions});}catch(error){refusal=error.code;}armed=false;fonts.registry.describeFaces=originalDescribe;fs.readFile=original;syncBuiltinESMExports();
const complete=mode!=='activation'?{design:{fontScheme:'open-sans'},slides:[{title:'Complete',text:'ASCII only'}]}:{design:{fontScheme:'activation'},slides:[{text:'Complete ASCII'}]};
const current=fonts.registry.describeFaces(),pending=fonts.pending(complete,renderOptions),width=fonts.textMeasurement.measure('Complete ASCII',20,{fontFamily:mode!=='activation'?'Open Sans':'Noto Sans',fontWeight:400});
const expectedEmbedded=fonts.registry.selectEmbeddedFonts(face=>!face.scripts||face.fallbackOnly).map(id);
console.log(JSON.stringify({mode,refusal,beforeFiles,beforeHeld,current,pending,width,actualFiles:fonts.fontFiles,expectedFiles:fonts.registry.fontFiles,actualEmbedded:fonts.embeddedFonts.map(id),expectedEmbedded,cacheRefreshed:cached!==fonts.embeddedFonts,actualLazy:fonts.registry.lazyFonts.map(id),expectedLazy:lazyFontList().filter(face=>current.some(held=>id(held)===id(face))).map(id),...(protectedFile?{protectedBefore,protectedAfter:createHash('sha256').update(await original(protectedFile)).digest('hex')}:{})}));
`;
for (const mode of ['fallback', 'activation', 'refresh-error'])
  test(`failed ${mode} preparation keeps file/embedded views synchronized for a different already-complete deck`, () => {
    const result = JSON.parse(
      execFileSync(
        process.execPath,
        ['--input-type=module', '-e', code, mode, moduleURL, galleryURL],
        { encoding: 'utf8', timeout: 20000, maxBuffer: 2000000 },
      ).trim(),
    );
    assert.equal(
      result.refusal,
      mode !== 'activation'
        ? 'font-integrity-mismatch'
        : 'font-resource-unavailable',
    );
    assert.deepEqual(result.pending, []);
    assert.ok(result.width > 0);
    if (mode !== 'activation') {
      assert.ok(
        result.current.length > result.beforeHeld.length,
        'verified primary faces really registered before the later refusal',
      );
      assert.equal(
        result.protectedBefore,
        result.protectedAfter,
        'tamper is a copied read buffer, never a shared-package mutation',
      );
    } else {
      assert.equal(
        result.current.length,
        result.beforeHeld.length,
        'activation mutates metadata without adding files',
      );
      assert.equal(
        result.beforeHeld.find((face) => face.family === 'Noto Sans')
          .fallbackOnly,
        true,
      );
      assert.notEqual(
        result.current.find((face) => face.family === 'Noto Sans').fallbackOnly,
        true,
      );
    }
    assert.deepEqual(
      result.actualFiles,
      result.expectedFiles,
      'the different complete document needs every verified physical file',
    );
    assert.deepEqual(
      result.actualEmbedded,
      result.expectedEmbedded,
      'embedded selection reflects actual registry state after rejection',
    );
    assert.equal(result.cacheRefreshed, true);
    if (mode !== 'refresh-error')
      assert.deepEqual(
        result.actualLazy,
        result.expectedLazy,
        'lazy metadata view follows committed partial additions',
      );
  });
