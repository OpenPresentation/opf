// LH-76: both parts of a split "Topic: qualifier" title carry the title's path, so with `trace` each part's lines carry their
// source ranges in the authored title (the value at that path): the editor maps a press on either part to the whole title.
import assert from 'node:assert/strict';
import {gallery} from '@openpresentation/gallery';
import {loadFonts} from '../dist/fonts-node.js';
import {toSvg} from '../dist/index.js';

const fonts = await loadFonts({pack: 'office'});
const title = 'Market sizing: a bottom-up estimate across every region we serve today and the three we enter next year';
const svg = toSvg({design: {fontScheme: 'roboto'}, slides: [{layout: 'text', title, text: 'Body.'}]}, 1, {catalogs: [gallery], fonts, trace: true});
const lines = [...svg.matchAll(/<text[^>]*data-opf-path="slides\.0\.title"[^>]*>([\s\S]*?)<\/text>/g)].map(([tag, content]) => ({
  start: Number(/data-opf-source-start="(\d+)"/.exec(tag)?.[1]), end: Number(/data-opf-source-end="(\d+)"/.exec(tag)?.[1]), text: content.replace(/<[^>]+>/g, ''),
}));
assert.ok(lines.length >= 2, 'the title is drawn as the topic and at least one qualifier line');
for (const line of lines) assert.equal(title.slice(line.start, line.end).trimEnd(), line.text.trimEnd(), JSON.stringify(line));
assert.equal(lines[0].start, 0);
assert.equal(lines[1].start, title.indexOf('a bottom-up'), 'the qualifier traces its range in the authored title');
console.log(`Title split trace: ${lines.length} traced lines map into the authored title.`);
