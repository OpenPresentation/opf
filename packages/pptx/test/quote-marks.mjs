// WI-4 (P17, N3): the export writes the same quotation marks and the same en dash the preview draws (they come from core's shared
// quote layout), the marks follow the deck language, and import reads them back: the quote returns as authored, and a file
// exported before WI-4 (ASCII marks, " - " joining attribution and source) still imports as the same quote.
import assert from 'node:assert/strict';
import {unzipSync,zipSync} from 'fflate';
import {toPptx,fromPptx} from '../dist/index.js';
import {gallery} from '@openpresentation/gallery';

const catalogs=[gallery],OPTIONS={seed:1,timestamp:'2026-01-01T00:00:00Z',zipDate:'2026-01-01T00:00:00Z'};
const decode=bytes=>new TextDecoder().decode(bytes),encode=text=>new TextEncoder().encode(text);
const texts=xml=>[...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match=>match[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));
const quote={text:'Make the important point easy to understand.',attribution:'Example speaker',source:'Customer interview'};
const exportDeck=async(language,value=quote)=>toPptx({...(language?{language}:{}),slides:[{title:'Voices',quote:value}]},{catalogs,...OPTIONS});
const importQuote=async bytes=>(await fromPptx(bytes,{catalogs})).slides[0].quote;

// 1. Export: the marks of the deck language and an en dash, as the shared layout draws them.
for(const [language,open,close] of [[undefined,'“','”'],['en-US','“','”'],['de','„','“'],['fr','«','»'],['ja','「','」'],['sw','"','"']]){
 const bytes=await exportDeck(language),xml=decode(unzipSync(bytes)['ppt/slides/slide1.xml']),all=texts(xml).join('');
 assert.ok(all.includes(`${open}Make the important point easy to understand.${close}`)||texts(xml).some(text=>text.startsWith(open))&&texts(xml).some(text=>text.endsWith(close)),`${language}: ${all}`);
 assert.ok(all.includes('Example speaker – Customer interview'),`${language}: the footer joins with an en dash: ${all}`);
 assert.ok(!all.includes(' - '),`${language}: no hyphen separator`);
 // 2. Import: the same quote comes back, without the marks.
 assert.deepEqual(await importQuote(bytes),quote,String(language));
}

// 3. A file exported before WI-4 (straight quotes, " - ") still imports as the same quote.
const bytes=await exportDeck('en'),entries=unzipSync(bytes);
const slide=decode(entries['ppt/slides/slide1.xml']).replaceAll('\u201c','&quot;').replaceAll('\u201d','&quot;').replaceAll(' \u2013 ',' - ');
assert.ok(slide.includes('&quot;')&&slide.includes(' - '),'the fixture is the old shape');
const older=zipSync({...entries,'ppt/slides/slide1.xml':encode(slide)});
assert.deepEqual(await importQuote(older),quote);
console.log('quote-marks: ok');
