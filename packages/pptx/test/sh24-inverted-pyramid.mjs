import assert from 'node:assert/strict';
import {strFromU8,unzipSync} from 'fflate';
import {toPptx,fromPptx,toSvg} from './helpers/default-catalog.mjs';
import {smartArtReason,opfLayoutReason,addArrangements} from '../src/smart-art.js';
import {pyramidNodes} from '@openpresentation/opf/composition';
const items=['Possibilities','Qualified options','Shortlist','Decision'];
const deck={slides:[{layout:'inverted-pyramid',title:'From options to a decision',items}]};
const diagnostics=[];
const bytes=new Uint8Array(await toPptx(deck,{seed:1128,timestamp:'2026-11-08T00:00:00Z',onDiagnostic:x=>diagnostics.push(x)}));
const parts=unzipSync(bytes),slide=strFromU8(parts['ppt/slides/slide1.xml']);
assert.equal(Object.keys(parts).some(name=>name.startsWith('ppt/diagrams/')),false,'an unmeasured inverse must never become live SmartArt');
assert.equal((slide.match(/name="OPF arrangement slides\.0\.items node /g)??[]).length,4,'native editable shape per level');
assert.doesNotMatch(slide,/normAutofit|spAutoFit/);
assert.ok(diagnostics.some(x=>x.code==='smartart-unavailable'&&/inverted pyramid/.test(x.reason)));
const imported=await fromPptx(bytes);
assert.equal(imported.slides[0].layout,deck.slides[0].layout,'OPF provenance restores the authored layout id');
assert.deepEqual(imported.slides[0].items,items);
const [svg]=toSvg(deck);for(const label of items)assert.ok(svg.includes(label),label);
// Exercise continuous trapezoids independently of the fitter's preferred stepped design: only the shape is flipped, not its text.
const frame={x:0,y:0,width:800,height:420},arrangement={kind:'pyramid',pyramidDirection:'down',design:'smartart',path:'slides.0.items',frame,nodes:pyramidNodes(frame,4,'down'),lineWidth:2,smartArt:{lines:[1,1,1,1],stable:[true,true,true,true]}};
assert.match(smartArtReason(arrangement,items,false),/no qualified live/);assert.match(opfLayoutReason({...arrangement,design:'opf'},items,false),/no qualified live/);
const shapes=[];await addArrangements({addShape:(preset,options)=>shapes.push({preset,options})},[arrangement],{context:{colors:{accent:'336699',background:'FFFFFF',text:'000000'}},mode:'shapes',items:[{path:arrangement.path,value:items}],slideIndex:0,records:[],tags:new Map(),smartArtTags:new Map(),report:()=>{}});
assert.equal(shapes.length,4);assert.ok(shapes.every(s=>s.preset==='trapezoid'&&s.options.flipV===true));
console.log('SH24: wide-first pyramid schema/composition, editable shapes, no unmeasured SmartArt, SVG labels and roundtrip pass.');


