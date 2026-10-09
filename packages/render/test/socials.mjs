import assert from 'node:assert/strict';
import {resolvePresentation, renderSlideSvg} from '../dist/index.js';
import {SOCIAL_PLATFORMS} from '@openpresentation/opf/composition';

// Generated socials furniture. OPF 0.15: organization.socials keys are an engine vocabulary (the schema enum and core's
// SOCIAL_PLATFORMS, no catalog lookup); core formats each handle through its platform's URL pattern and handle prefix, and
// the renderer draws what core formats. There are no document or host social-platform records any more.
const deck={organization:{id:'acme',name:'Acme',socials:{linkedin:'acme',x:'@acme',mastodon:'https://hachyderm.io/@acme'}},
 design:{footer:{left:{text:'{{organization.name}}'},right:{socials:true}}},slides:[{title:'Socials',text:'Body'}]};
const lines='linkedin.com/company/acme\nx.com/acme\nhachyderm.io/@acme';
const before=structuredClone(deck),config={trace:true};
const geometry=resolvePresentation(deck,config).slides[0].geometry,svg=renderSlideSvg(deck, 0,config);
assert.deepEqual(deck,before);assert.deepEqual(geometry.diagnostics,[]);
const part=geometry.furniture.parts.find(item=>item.field==='socials');
assert.equal(part.text,lines);
// An organization handle takes the platform's company pattern (linkedin), the handle prefix is stripped (x), and a value that
// is already a URL passes through unchanged and unformatted (mastodon on another server).
assert.deepEqual(part.links.map(link=>[link.href,link.resolved]),[['https://linkedin.com/company/acme',true],['https://x.com/acme',true],['https://hachyderm.io/@acme',false]]);
for(const text of lines.split('\n'))assert.ok(svg.includes(`>${text}<`),text);
assert.ok(svg.includes('data-opf-furniture-field="socials"'));assert.ok(svg.includes('data-opf-furniture-generated="true"'));
// Removing the socials removes the rendered profiles; a zone that asks for them diagnoses instead.
const bare=structuredClone(deck);delete bare.organization.socials;
assert.deepEqual(resolvePresentation(bare).slides[0].geometry.diagnostics.map(d=>[d.code,d.path]),[['unresolved-content','design.footer.right.socials']]);
assert.throws(()=>renderSlideSvg({...bare,slides:[{text:'Body',composition:{overflow:'error'}}]}, 0),{code:'layout-overflow'});
// A platform key outside the vocabulary is rejected at the boundary, and social platforms are not a catalog kind a document
// can embed records for.
const unknownKey=structuredClone(deck);unknownKey.organization.socials.custom='Visit us';
assert.throws(()=>renderSlideSvg(unknownKey, 0),error=>error.code==='invalid-opf'&&JSON.stringify(error.details).includes('/organization/socials'),'an unknown platform key is invalid');
assert.throws(()=>renderSlideSvg({...deck,catalogs:{custom:{socialPlatforms:{x:{profileUrlPattern:'https://inline.test/{handle}',handlePrefix:'@'}}}}}, 0),{code:'invalid-opf'},'a catalog group has no socialPlatforms kind');
// Every engine platform renders a handle (written with its prefix) as its profile URL: the company pattern for an organization
// where the platform has one, else the profile pattern.
const platforms=Object.entries(SOCIAL_PLATFORMS);
assert.ok(platforms.length>0,'core exports SOCIAL_PLATFORMS');
for(const [id,platform] of platforms){
 const one={...deck,organization:{id:'acme',name:'Acme',socials:{[id]:`${platform.handlePrefix??''}acme`}}};
 const link=resolvePresentation(one).slides[0].geometry.furniture.parts.find(item=>item.field==='socials').links[0];
 const expected=(platform.companyUrlPattern??platform.profileUrlPattern).replace('{handle}','acme');
 assert.equal(link.resolved,true,id);assert.equal(link.href,expected,id);
 assert.ok(renderSlideSvg(one, 0).includes(`>${expected.replace(/^https:\/\//,'').replace(/&/g,'&amp;')}<`),id);
}
// FF-27 + FF-34 + FA-31: one footer with a live slide-number field and linked socials in the same zone (text stacks before socials).
const mixed={...deck,design:{footer:{left:{text:'Slide {{slide.number}} of {{deck.slideCount}}'},right:{text:'{{slide.number}}',socials:true}}},slides:[{text:'One'},{text:'Two'}]};
const mixedParts=resolvePresentation(mixed).slides[1].geometry.furniture.parts;
assert.deepEqual(mixedParts.map(part=>[part.zone,part.field,part.text,part.fields?.length??0,part.links?.length??0]),[['left','text','Slide 2 of 2',1,0],['right','text','2',1,0],['right','socials',lines,0,3]]);
const mixedSvg=renderSlideSvg(mixed, 1,{trace:true});
// Rendered in document order: left zone first, then the right zone top to bottom.
const order=['Slide 2 of 2','>2<',...lines.split('\n')].map(text=>mixedSvg.indexOf(text.startsWith('>')?text:`>${text}<`,mixedSvg.indexOf('data-opf-furniture-field')));
assert.ok(order.every(index=>index>=0),JSON.stringify(order));assert.deepEqual([...order].sort((a,b)=>a-b),order,'furniture text renders in part and line order');
console.log(`Socials furniture passed: ${platforms.length} engine platforms (SOCIAL_PLATFORMS), URL pass-through, unknown-key rejection and unresolved-content.`);
