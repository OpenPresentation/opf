import assert from 'node:assert/strict';
import {renderSvg,resolvePresentation} from '../dist/svg.js';
import {catalogs} from '@openpresentation/opf';

// Generated socials furniture: core formats organization.socials through the
// socialPlatforms catalog; the renderer supplies the bundled records.
const deck={organization:{id:'acme',name:'Acme',socials:{linkedin:'acme',x:'@acme',custom:'Visit us'}},
 design:{footer:{left:{organization:true},right:{socials:true}}},slides:[{title:'Socials',text:'Body'}]};
const before=structuredClone(deck),config={trace:true};
const geometry=resolvePresentation(deck,config).slides[0].geometry,svg=renderSvg(deck,config);
assert.deepEqual(deck,before);assert.deepEqual(geometry.diagnostics,[]);
const part=geometry.furniture.parts.find(item=>item.field==='socials');
assert.equal(part.text,'linkedin.com/company/acme\nx.com/acme\nVisit us');
assert.deepEqual(part.links.map(link=>link.href),['https://linkedin.com/company/acme','https://x.com/acme',undefined]);
for(const text of ['linkedin.com/company/acme','x.com/acme','Visit us'])assert.ok(svg.includes(`>${text}<`),text);
assert.ok(svg.includes('data-opf-furniture-field="socials"'));assert.ok(svg.includes('data-opf-furniture-generated="true"'));
// Removing the socials removes the rendered profiles; a zone that asks for them diagnoses instead.
const bare=structuredClone(deck);delete bare.organization.socials;
assert.deepEqual(resolvePresentation(bare).slides[0].geometry.diagnostics.map(d=>[d.code,d.path]),[['unresolved-content','design.footer.right.socials']]);
assert.throws(()=>renderSvg({...bare,slides:[{text:'Body',composition:{overflow:'error'}}]}),{code:'layout-overflow'});
// Inline document records win over injected host records, which win over the bundled catalog.
const injected={catalogs:{socialPlatforms:[{id:'x',profileUrlPattern:'https://injected.test/{handle}',handlePrefix:'@'}]}};
assert.ok(renderSvg(deck,injected).includes('>injected.test/acme<'));
const inline={...deck,catalogs:{socialPlatforms:{records:[{$schema:'https://openpresentation.org/schema/opf-social-platform/v1',id:'x',name:'X',profileUrlPattern:'https://inline.test/{handle}',handlePrefix:'@'}]}}};
assert.ok(renderSvg(inline,injected).includes('>inline.test/acme<'));
// Every bundled platform renders its own example handle as a profile URL.
for(const platform of catalogs.socialPlatforms){
 const one={...deck,organization:{id:'acme',name:'Acme',socials:{[platform.id]:platform.handleExample}}};
 const link=resolvePresentation(one).slides[0].geometry.furniture.parts.find(item=>item.field==='socials').links[0];
 assert.equal(link.resolved,true,platform.id);assert.ok(renderSvg(one).includes(`>${link.text.replace(/&/g,'&amp;')}<`),platform.id);
}
// FF-27 + FF-34: one footer with a live slide-number field and linked socials in the same zone.
const mixed={...deck,design:{footer:{left:{slideNumber:true,slideNumberFormat:'Slide {current} of {total}'},right:{slideNumber:true,socials:true}}},slides:[{text:'One'},{text:'Two'}]};
const mixedParts=resolvePresentation(mixed).slides[1].geometry.furniture.parts;
assert.deepEqual(mixedParts.map(part=>[part.zone,part.field,part.text,part.fields?.length??0,part.links?.length??0]),[['left','slideNumber','Slide 2 of 2',1,0],['right','socials','linkedin.com/company/acme\nx.com/acme\nVisit us',0,3],['right','slideNumber','2',1,0]]);
const mixedSvg=renderSvg(mixed,{trace:true,slideIndex:1});
// Rendered in document order: left zone first, then the right zone top to bottom.
const order=['Slide 2 of 2','linkedin.com/company/acme','x.com/acme','Visit us','>2<'].map(text=>mixedSvg.indexOf(text.startsWith('>')?text:`>${text}<`,mixedSvg.indexOf('data-opf-furniture-field')));
assert.ok(order.every(index=>index>=0),JSON.stringify(order));assert.deepEqual([...order].sort((a,b)=>a-b),order,'furniture text renders in part and line order');
console.log(`Socials furniture passed: ${catalogs.socialPlatforms.length} bundled platforms, inline/injected precedence, and unresolved-content rejection.`);
