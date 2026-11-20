import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {OPFRenderError} from '@openpresentation/opf-render';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('tsup'))('esbuild');
const here=path.dirname(fileURLToPath(import.meta.url));
const report={valid:false,schemaValid:false,findings:[{category:'format',severity:'error',ruleId:'opf/schema',path:'/slides/0/title'}]};

test('validation font recovery recognizes the actual renderer class/report and its one preparation wrapper only',async()=>{
  const dir=await mkdtemp(path.join(here,'../.validation-fonts-'));
  try {
    const entry=path.join(dir,'entry.mjs'),output=path.join(dir,'built.mjs');
    await writeFile(entry,`export {isRendererValidationFailure} from ${JSON.stringify(fileURLToPath(new URL('../src/node/validation-fonts.ts',import.meta.url)))};\nexport {prepareFonts} from ${JSON.stringify(fileURLToPath(new URL('../src/node/fonts.ts',import.meta.url)))};\nexport {OPFApiError} from ${JSON.stringify(fileURLToPath(new URL('../src/api-errors.ts',import.meta.url)))};`);
    await build({entryPoints:[entry],outfile:output,bundle:true,platform:'node',format:'esm',target:'node24'});
    const {isRendererValidationFailure:accepts,prepareFonts,OPFApiError}=await import(pathToFileURL(output));
    const actual=new OPFRenderError('invalid-opf','boundary',{report});
    assert.equal(accepts(actual,OPFRenderError),true);
    const fakeRenderer={fonts:{loadFonts:async()=>{throw actual;}}};
    let wrapped;try{await prepareFonts(fakeRenderer,{slides:[]},[],{add(){}});}catch(error){wrapped=error;}
    assert.ok(wrapped instanceof OPFApiError);assert.equal(wrapped.cause,actual);
    assert.equal(accepts(wrapped,OPFRenderError),true);
    const lookalike=Object.assign(new Error('boundary'),{name:'OPFRenderError',code:'invalid-opf',details:{report}});
    const negatives=[lookalike,new OPFRenderError('font-resource-unavailable','wrong code',{report}),new OPFRenderError('invalid-opf','no report'),new OPFRenderError('invalid-opf','valid report',{report:{...report,valid:true}}),new OPFRenderError('invalid-opf','no format error',{report:{...report,findings:[{category:'layout',severity:'warning'}]}}),new OPFApiError('wrong wrapper code','font-failed',{cause:actual}),new Error('foreign wrapper',{cause:actual}),new OPFApiError('wrong cause','invalid-opf',{cause:lookalike})];
    for(const error of negatives)assert.equal(accepts(error,OPFRenderError),false,error.message);
    assert.equal(accepts(actual,undefined),false,'an older/missing constructor cannot be guessed');
    const malformed=new OPFRenderError('invalid-opf','malformed');malformed.details=null;
    assert.equal(accepts(malformed,OPFRenderError),false);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('only validation opts into format-refusal reporting; generic font preparation and real failures remain strict',async()=>{
  const {measuringFonts,Reporter}=await import('@openpresentation/opf/internal/engine');
  const invalid={slides:[{title:3}]};
  await assert.rejects(measuringFonts(invalid,{reporter:new Reporter()}),error=>error instanceof OPFRenderError&&error.code==='invalid-opf');
  const deferred=await measuringFonts(invalid,{reporter:new Reporter(),reportInvalidDocument:true});
  assert.equal(deferred.invalidDocument,true);assert.equal(deferred.fonts,undefined);assert.equal(deferred.estimated,undefined);deferred.release();
  const valid=await measuringFonts({slides:[{title:'Valid',text:'Measured text.'}]},{reporter:new Reporter(),reportInvalidDocument:true});
  assert.ok(valid.fonts);assert.equal(valid.invalidDocument,undefined);valid.release();
});
