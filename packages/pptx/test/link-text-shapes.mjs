// opf#1415: a text box whose whole text is one link carries the link on the shape (a:hlinkClick in its p:cNvPr), not on its run.
// PowerPoint underlines every run that is a link, whatever its u says; the preview draws a footer social line and a video caption
// without an underline. Asserts the footer social lines and the linked video caption link as shapes with plain runs (u="none", their
// color), that a link inside longer text stays on its run (underlined, as the preview draws it), that the import reads a shape link back
// as the link of the box's runs (and a shape block keeps it as its own link), and that the furniture round-trips.
import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';

const decoder = new TextDecoder(), encoder = new TextEncoder();
const HYPERLINK = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';
const deck = {
  organization: [{id: 'harbor', name: 'Harbor Labs', role: 'primary', socials: {linkedin: 'https://www.linkedin.com/company/harbor-labs', x: '@harborlabs'}}],
  slides: [
    {title: 'Social accounts in the footer', text: 'The footer lists the accounts.', design: {footer: {start: {socials: true}, end: {text: '{{slide.number}}'}}}},
    {title: 'Links in a sentence', text: ['Read the ', {text: 'release notes', link: 'https://example.com/notes'}, ' first.']},
    {title: 'A video', video: {src: 'https://example.com/demo.mp4', title: 'Two-minute demo'}},
  ],
};
const shapes = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]);
const named = (xml, pattern) => shapes(xml).filter(shape => pattern.test(/<p:cNvPr\b[^>]*\bname="([^"]*)"/.exec(shape)?.[1] ?? ''));
const shapeLink = shape => /<p:cNvPr\b[^>]*>\s*<a:hlinkClick r:id="([^"]+)"\/>\s*<\/p:cNvPr>/.exec(shape)?.[1];
const relationships = (entries, slide) => new Map([...decoder.decode(entries[`ppt/slides/_rels/slide${slide}.xml.rels`]).matchAll(/<Relationship\b[^>]*>/g)]
  .map(([tag]) => [/\bId="([^"]+)"/.exec(tag)[1], {type: /\bType="([^"]+)"/.exec(tag)[1], target: /\bTarget="([^"]+)"/.exec(tag)[1], mode: /\bTargetMode="([^"]+)"/.exec(tag)?.[1]}]));

const bytes = await toPptx(deck);
const entries = unzipSync(bytes);
const slide = n => decoder.decode(entries[`ppt/slides/slide${n}.xml`]);

// 1. The footer social lines: the link on the shape, a plain run (u="none", the muted color), an external hyperlink relationship.
{
  const lines = named(slide(1), /^OPF furniture \d+ part \d+ line \d+$/).filter(shape => /linkedin|x\.com/.test(shape));
  assert.equal(lines.length, 2, 'two social lines');
  const rels = relationships(entries, 1);
  const targets = lines.map(shape => {
    const id = shapeLink(shape);
    assert.ok(id, 'the line links as a shape');
    assert.ok(!/<a:rPr\b[\s\S]*?<a:hlinkClick/.test(shape.slice(shape.indexOf('<p:txBody>'))), 'no run is a link');
    assert.match(shape, /<a:rPr\b[^>]*\bu="none"/);
    assert.equal(rels.get(id).type, HYPERLINK);
    assert.equal(rels.get(id).mode, 'External');
    return rels.get(id).target;
  });
  assert.deepEqual(targets, ['https://www.linkedin.com/company/harbor-labs', 'https://x.com/harborlabs']);
}

// 2. A link inside a sentence stays on its run (PowerPoint underlines it, and the preview draws the underline in the link's color).
{
  const runs = shapes(slide(2)).flatMap(shape => [...shape.matchAll(/<a:r>[\s\S]*?<\/a:r>/g)].map(match => match[0]));
  const linked = runs.filter(run => /<a:hlinkClick/.test(run));
  assert.ok(linked.length >= 1 && linked.every(run => /\bu="sng"/.test(run)), 'linked runs, underlined');
  assert.ok(!shapes(slide(2)).some(shapeLink), 'no shape link');
}

// 3. The video caption: the whole caption box links as a shape, its run is plain.
{
  const [caption] = named(slide(3), /^OPF media .* caption line 0$/);
  assert.ok(shapeLink(caption), 'the caption links as a shape');
  assert.ok(!/<a:rPr\b[\s\S]*?<a:hlinkClick/.test(caption.slice(caption.indexOf('<p:txBody>'))));
  assert.equal(relationships(entries, 3).get(shapeLink(caption)).target, 'https://example.com/demo.mp4');
}

// 4. Round trip: the furniture, the sentence and the video come back as authored.
{
  const back = await fromPptx(bytes);
  assert.deepEqual(back.slides[0].design?.footer, deck.slides[0].design.footer);
  assert.deepEqual(back.slides[1].text, [{text: 'Read the '}, {text: 'release notes', underline: true, link: 'https://example.com/notes'}, {text: ' first.'}]);
  assert.deepEqual(back.slides[2].video, deck.slides[2].video);
}

// 5. Import: a text box whose link is on the shape reads it as the link of its runs (an edited file, without OPF tags), and a shape
// block with a link keeps it as the shape's own link, not its text's.
{
  const plain = unzipSync(await toPptx({slides: [{title: 'Whole', text: [{text: 'example.com/docs', link: 'https://example.com/docs'}]},
    {title: 'Block', blocks: [{shape: 'roundRect', fill: 'accent1', text: 'Open the docs', link: 'https://example.com/docs'}]}]}, {provenance: false}));
  const part = 'ppt/slides/slide1.xml';
  const xml = decoder.decode(plain[part]);
  const [shape] = shapes(xml).filter(entry => /example\.com\/docs/.test(entry));
  const runLink = /<a:hlinkClick r:id="([^"]+)"[^>]*?(?:\/>|>[\s\S]*?<\/a:hlinkClick>)/.exec(shape);
  assert.ok(runLink, 'the exported run carries the link');
  const moved = shape.replace(runLink[0], '').replace(/<p:cNvPr\b([^>]*?)\/>/, `<p:cNvPr$1><a:hlinkClick r:id="${runLink[1]}"/></p:cNvPr>`);
  assert.ok(shapeLink(moved));
  const edited = zipSync({...plain, [part]: encoder.encode(xml.replace(shape, moved))});
  const back = await fromPptx(edited);
  const runs = back.slides[0].blocks?.find(block => block.type === 'text')?.text ?? back.slides[0].text;
  assert.ok(Array.isArray(runs) && runs.some(run => run.text === 'example.com/docs' && run.link === 'https://example.com/docs'), JSON.stringify(back.slides[0]));
  const block = back.slides[1].blocks.find(entry => entry.shape);
  assert.equal(block.link, 'https://example.com/docs');
  assert.ok(typeof block.text === 'string' || !block.text.some(run => run.link), 'the block text carries no link of its own');
}

console.log('Link text shapes passed: footer social lines and video captions link as shapes, inline links stay on runs, shape links import as run links.');
