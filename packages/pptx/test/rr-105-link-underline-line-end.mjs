// RR-105 (coverage finding 02): an underline, link or strikethrough ends with a line's last visible character. When a decorated run's
// space ends a native line, that space is a run of its own without the hyperlink (PowerPoint underlines hyperlink text) or the
// underline; the line's text is unchanged, and the import joins the space back into its run, so the document comes back the same.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {strFromU8, unzipSync} from 'fflate';
import {toPptx, fromPptx} from './helpers/default-catalog.mjs';

const base = ['Read the ', {text: 'release notes', link: 'https://openpresentation.org/'}, ', call ', {text: 'the desk', link: 'https://example.com/desk'}, ' or write to ', {text: 'support', link: 'mailto:support@example.com'}, '. The French team calls it the plan.'];
const runsOf = xml => [...xml.matchAll(/<a:r><a:rPr([^>]*?)(?:\/>|>([\s\S]*?)<\/a:rPr>)<a:t>([^<]*)<\/a:t><\/a:r>/g)].map(match => ({link: /hlinkClick/.test(match[2] ?? ''), underline: / u="sng"/.test(match[1]), text: match[3]}));
const slideOf = (kind, text) => kind === 'text' ? {title: 'Links', text} : kind === 'bullets' ? {title: 'Links', bullets: [text, 'Two']} : kind === 'quote' ? {title: 'Links', subtitle: 'Desk', quote: {text}} : {title: 'Links', text: text.map((run, index) => index === 3 ? {text: run.text, underline: true} : run)};
// The first padding that breaks the line inside "the desk", after "the ".
async function wrapped(kind) {
  for (let index = 0; index < 80; index++) {
    const pad = 'word '.repeat(Math.floor(index / 4)) + 'x'.repeat(index % 4);
    const slide = slideOf(kind, [pad + base[0], ...base.slice(1)]);
    const deck = {language: 'en-US', design: {background: 'light1'}, slides: [slide]};
    const bytes = await toPptx(deck);
    const runs = runsOf(strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']));
    const at = runs.findIndex((run, position) => run.text === 'the' && runs[position + 1]?.text === ' ');
    if (at >= 0) return {deck, slide, bytes, runs, at};
  }
  throw Error(`no padding breaks the ${kind} line inside "the desk"`);
}

for (const kind of ['text', 'bullets', 'quote']) test(`${kind}: the link's line-end space is undecorated natively and comes back in the link`, async () => {
  const {slide, bytes, runs, at} = await wrapped(kind);
  assert.ok(runs[at].link, 'the visible part keeps its hyperlink');
  assert.ok(!runs[at + 1].link && !runs[at + 1].underline, 'the space at the line end has none');
  assert.ok(runs[at + 2].link && runs[at + 2].text === 'desk', 'the next line goes on with the link');
  const imported = (await fromPptx(bytes)).slides[0];
  const desk = JSON.stringify(imported).match(/\{"text":"the desk"[^}]*\}/)?.[0];
  assert.ok(desk && desk.includes('"link":"https://example.com/desk"'), `the link comes back whole: ${JSON.stringify(imported)}`);
  // Lists and quotes come back exactly (body text adds underline: true to its links on import, as before this change).
  if (kind !== 'text') assert.deepEqual(imported, slide);
});

test('an underlined run is split the same way', async () => {
  const {runs, at} = await wrapped('underline');
  assert.ok(runs[at].underline && !runs[at].link, 'the visible part is underlined');
  assert.ok(!runs[at + 1].underline, 'the space at the line end is not');
  assert.ok(runs[at + 2].underline && runs[at + 2].text === 'desk');
});
