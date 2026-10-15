// Versioned route fixtures. No coefficient selection, native font reads or acceptance claims.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {digest} from './identity.mjs';

export const FONT_ROUTE_CASE_NAMES = Object.freeze([
  'font-route-traditional-arabic','font-route-nirmala-telu','font-route-nirmala-knda',
  'font-route-nirmala-gujr','font-route-nirmala-mlym',
]);
export function selectFontRoutes(value) {
  assert.equal(typeof value,'string','font routes require all or explicit case IDs');
  const names=value==='all'?[...FONT_ROUTE_CASE_NAMES]:value.split(',');
  assert.ok(names.length&&new Set(names).size===names.length,'duplicate font route IDs');
  for(const name of names)assert.ok(FONT_ROUTE_CASE_NAMES.includes(name),`Unknown font route: ${name}`);
  return FONT_ROUTE_CASE_NAMES.filter(name=>names.includes(name));
}
const sourcePaths=['scripts/native-acceptance/fixtures/font-routes.json','docs/evidence/script-corpora-20261001/script-corpora.json'];
export const fontRouteSourcePaths=()=>[...sourcePaths];
export async function loadFontRouteSource(names) {
  assert.deepEqual(names,selectFontRoutes(names.join(',')),'canonical explicit selection required');
  const root=new URL('../../',import.meta.url);
  const [manifestBytes,corpusBytes]=await Promise.all(sourcePaths.map(file=>readFile(new URL(file,root))));
  const manifest=JSON.parse(manifestBytes),corpus=JSON.parse(corpusBytes);
  assert.equal(manifest.schemaVersion,1);assert.equal(manifest.corpus.path,sourcePaths[1]);
  assert.equal(digest(corpusBytes),manifest.corpus.sha256,'font corpus differs from reviewed fixture pin');
  assert.deepEqual(manifest.cases.map(item=>item.id),FONT_ROUTE_CASE_NAMES,'retain five explicit route fixtures');
  assert.deepEqual(manifest.styles,[{weight:400,italic:false},{weight:700,italic:false}]);
  assert.deepEqual(manifest.nominalSizesPoints,[18,24,32]);
  const decks={},fontRoutes={};
  for(const record of manifest.cases.filter(item=>names.includes(item.id))) {
    const samples=record.samples.map(id=>{
      const sample=corpus.groups.find(group=>group.script===record.script)?.samples.find(item=>item.id===id);
      assert.ok(sample,`Missing committed corpus sample: ${id}`);return sample;
    });
    const controls=[
      {id:'numbers',text:record.script==='Arab'?'0123456789 ٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹':'0123456789'},
      {id:'latin',text:'PowerPoint Q3 2026'},
      {id:'neutrals',text:record.script==='Arab'?'() [] — ، ؛ . , %':'() [] — . , %'},
      {id:'mixed',text:`${samples[0].text} 0123456789 PowerPoint`},
    ];
    const run=(text,weight,fontSize=18.75,lang=record.language)=>({text,fontFamily:record.requestedNativeFamily,fontSize,bold:weight===700,italic:false,lang});
    const slides=manifest.styles.map(({weight})=>({
      title:[run(`${record.requestedNativeFamily} ${weight} upright`,weight)],
      items:[...samples.map(sample=>[run(sample.text,weight,18.75,sample.lang)]),...controls.map(control=>[run(control.text,weight)])],
    }));
    slides.push({title:[run('Nominal size controls',400)],items:manifest.nominalSizesPoints.flatMap(size=>manifest.styles.map(({weight})=>[run(samples[0].text,weight,size)]))});
    decks[record.id]={name:`Font route ${record.requestedNativeFamily} ${record.script}`,language:record.language,
      design:{fontScheme:{major:record.requestedNativeFamily,minor:record.requestedNativeFamily,complexScript:{major:record.requestedNativeFamily,minor:record.requestedNativeFamily}}},slides};
    fontRoutes[record.id]={...record,styles:manifest.styles,nominalSizesPoints:manifest.nominalSizesPoints,
      corpus:manifest.corpus,controls,referenceMeasurement:{status:'unresolved-for-this-suite',sha256:null,postscriptName:null,widths:null},
      physicalNativeFace:null,nativeAcceptance:false,productionCoefficientsSelected:false};
  }
  const scripts=[...new Set(Object.values(fontRoutes).flatMap(route=>route.script==='Arab'?['Arab']:['Deva',route.script]))];
  return {base:{},decks,fontRoutes,caseNames:names,previewScripts:scripts,featureManifest:{},
    sourceFiles:sourcePaths.map((path,index)=>({path,sha256:digest(index===0?manifestBytes:corpusBytes)}))};
}

/** Bind expected preview bytes from this installed handle, never a requested native font. */
export function previewRoutePins(route,fonts,manifest) {
  const descriptions=fonts.registry.describeFaces(),exported=fonts.registry.exportFaces();
  const pkg=manifest.packages.find(item=>item.faces.some(face=>face.family===route.expectedPreviewFamily));
  assert.ok(pkg,`Missing installed preview manifest: ${route.expectedPreviewFamily}`);
  assert.ok(['OFL-1.1','Apache-2.0','MIT','UFL-1.0'].includes(pkg.license),'preview face must be permissively licensed');
  const faces=route.styles.map(style=>{
    const pin=pkg.faces.find(face=>face.family===route.expectedPreviewFamily&&face.weight===style.weight&&face.italic===style.italic);
    const index=descriptions.findIndex(face=>face.family===route.expectedPreviewFamily&&face.weight===style.weight&&face.italic===style.italic);
    assert.ok(pin&&index>=0,'expected exact preview face/style unavailable');
    assert.equal(digest(exported[index].data),pin.sha256,'loaded preview bytes differ from installed renderer pin');
    return {family:pin.family,weight:pin.weight,italic:pin.italic,sha256:pin.sha256};
  });
  return {expectedFamily:route.expectedPreviewFamily,package:pkg.name,version:pkg.version,faces,actualPinnedBytesVerified:true,
    physicalNativeFaceClaimed:false,referenceMeasurementStatus:route.referenceMeasurement.status};
}
