import assert from 'node:assert/strict';
import {toPng, toSvg} from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)
const table={columns:[['Normal ',{text:'bold',bold:true}]],rows:[[['A ',{text:'red',color:'#AA0000',bold:true}]],[[{text:'link',link:'https://example.com',italic:true}]], [[]]]};
const svg=toSvg({design:{theme:'classic',fontScheme:'roboto'},slides:[{table}]}, 1,{trace:true});
assert.ok(/<tspan(?=[^>]*fill="#AA0000")(?=[^>]*font-weight="700")[^>]*>red<\/tspan>/.test(svg));
assert.match(svg,/data-opf-path="slides\.0\.table\.rows\.0\.0"/);
assert.match(svg,/data-opf-rich-text="true"/);
assert.match(svg,/href="https:\/\/example.com"/);
assert.ok((await toPng(svg)).length>1000);
const huge={slides:[{composition:{overflow:'error'},table:{rows:[[[{text:'Too large '.repeat(20),fontSize:120}]]]}}]};
assert.throws(()=>toSvg(huge, 1),/overflow|fit|exceed/i);
console.log('Rich table renderer passed: formatted cell/header runs, trace paths, links, empty rich cells, PNG output and strict overflow.');
