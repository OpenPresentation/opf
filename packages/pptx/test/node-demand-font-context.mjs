import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {catalogs,fromPptx,resolvePresentation,toPptx} from './helpers/default-catalog.mjs';

const quote={text:'The rollout took six weeks, not six months, and every store manager was using it by the second Monday.',attribution:'Sofia Brandt',role:'Head of procurement'};
const deck={language:'en',design:{fontScheme:'roboto'},slides:[{title:'Signal trend',blocks:[{chart:{type:'column',data:{columns:['Quarter','Pilot','Baseline'],rows:[['Q1',19,16],['Q2',23,18],['Q3',26,20],['Q4',30,22]]}}},{quote}]}]};
const styles=fonts=>fonts.registry.describeFaces().map(face=>[face.family,face.weight,face.italic]);
const expected=[['Roboto',400,false],['Roboto Medium',500,false],['Roboto SemiBold',600,false],['Roboto',700,false]];

test('demand preparation uses the drawing catalog; async PPTX prepares a caller handle before any actual measurement',async()=>{
  // This handle saw no catalog: it could not resolve the document's Roboto record.
  const fonts=await loadFonts({scripts:'auto',presentation:deck});
  assert.deepEqual(styles(fonts),[]);
  assert.throws(()=>resolvePresentation(deck,{fonts}),error=>error.code==='font-unavailable'&&error.details.path==='slides.0.title'&&error.details.fontFamily==='Roboto'&&error.details.fontWeight===700,'synchronous composition cannot measure an unprepared catalog face');
  // The public asynchronous boundary supplies its actual catalogs itself. No caller ensure or eager pack is needed.
  const bytes=await toPptx(deck,{fonts});
  assert.deepEqual(styles(fonts),expected,'only the title/chart/quote styles actually required by this catalog are prepared');
  assert.deepEqual(fonts.pending(deck,{catalogs}),[]);
  assert.ok(resolvePresentation(deck,{fonts}).slides[0].geometry.items.some(item=>item.quoteLayout?.mark));
  const imported=await fromPptx(bytes);
  assert.deepEqual(imported.slides[0].blocks.filter(block=>block.quote).map(block=>block.quote),[quote],'the quote remains exact and its decorative mark does not become text');
  const files=[...fonts.fontFiles];
  assert.equal(new Set(files).size,files.length);
  assert.deepEqual(await toPptx(deck,{fonts}),bytes,'repeated public export is deterministic');
  assert.deepEqual(fonts.fontFiles,files,'repeated export adds no duplicate files or styles');
  assert.deepEqual(styles(fonts),expected);
  // A synchronous caller instead prepares against the same catalog before composing.
  const prepared=await loadFonts({scripts:'auto',presentation:deck,renderOptions:{catalogs}});
  assert.deepEqual(styles(prepared),expected);
  assert.doesNotThrow(()=>resolvePresentation(deck,{fonts:prepared}));
});
