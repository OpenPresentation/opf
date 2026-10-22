import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';

// FF-45 (RR-17): symbol-encoded families (Symbol, Wingdings, Wingdings 2, Wingdings 3, Webdings). A preview maps their
// codes to Unicode equivalents drawn with open faces; the PPTX keeps the chosen family name and the author's original
// characters byte for byte, in both forms Office uses (the private-use character U+F0xx that Insert > Symbol writes,
// and the Windows-1252 character of the code, "l" for the Wingdings bullet), and a re-import gives them back.
//
// What the exporter writes today for such a run: the family in the run's a:latin (with a:ea/a:cs as for any run) and
// the text unchanged. It does not write an a:sym element. PowerPoint itself stores Insert > Symbol runs as a:sym plus
// U+F0xx; whether it draws an a:latin symbol font with private-use text, and with the plain character, is the native
// check the supervisor runs (FF-46): native verification pending. This test pins the current contract so a change is
// deliberate.
const slides = [
  {id: 'pua', title: 'Private use', text: [{text: 'Check '}, {text: '', fontFamily: 'Wingdings'}, {text: ' alpha '}, {text: '', fontFamily: 'Symbol'}, {text: ' web '}, {text: '', fontFamily: 'Webdings'}]},
  {id: 'plain', title: 'Plain', text: [{text: 'Check '}, {text: 'ülà', fontFamily: 'Wingdings'}, {text: ' alpha '}, {text: 'abg', fontFamily: 'Symbol'}, {text: ' web '}, {text: 'A', fontFamily: 'Webdings'}, {text: ' two '}, {text: '§', fontFamily: 'Wingdings 2'}, {text: ' three '}, {text: 'x', fontFamily: 'Wingdings 3'}]},
];
const presentation = {name: 'FF-45 symbol fonts', slides};
const families = ['Wingdings', 'Symbol', 'Webdings', 'Wingdings 2', 'Wingdings 3'];

const entries = unzipSync(new Uint8Array(await toPptx(structuredClone(presentation), {strictAssets: true})));
const slideXml = index => strFromU8(entries[`ppt/slides/slide${index}.xml`]);
const runsOf = xml => [...xml.matchAll(/<a:r>(?:(?!<\/a:r>).)*<\/a:r>/gs)].map(match => match[0]);
const latinOf = run => run.match(/<a:latin typeface="([^"]*)"/)?.[1];
const textOf = run => run.match(/<a:t>([^<]*)<\/a:t>/)?.[1].replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal))).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

for (const [index, slide] of slides.entries()) {
  const xml = slideXml(index + 1);
  const runs = runsOf(xml).filter(run => families.includes(latinOf(run)));
  const expected = slide.text.filter(run => run.fontFamily);
  assert.equal(runs.length, expected.length, `${slide.id}: one native run per symbol run`);
  for (const [position, run] of runs.entries()) {
    const source = expected[position];
    assert.equal(latinOf(run), source.fontFamily, `${slide.id}: a:latin names the chosen family`);
    assert.equal(textOf(run), source.text, `${slide.id}: the characters are the author's, byte for byte (${JSON.stringify(source.text)})`);
    // The script slots repeat the Latin face for a Latin deck (FF-07); no a:sym is written (see the note above).
    assert.ok(!/<a:sym\b/.test(run), `${slide.id}: no a:sym element today (native verification pending)`);
    assert.ok(!/typeface="Noto/.test(run), `${slide.id}: no preview face leaks into the run`);
  }
  // Private-use characters survive as characters, not as entities that a reader would decode differently.
  if (slide.id === 'pua') assert.ok(/|&#xF0FC;|&#61692;/.test(xml), 'the Wingdings codes are in the slide part');
}

// Round trip: the re-imported runs keep the family and the original characters.
const imported = await fromPptx(new Uint8Array(await toPptx(structuredClone(presentation), {strictAssets: true})));
const deck = imported.presentation ?? imported;
for (const [index, slide] of slides.entries()) {
  const text = deck.slides[index].text;
  const runs = (Array.isArray(text) ? text : []).filter(run => typeof run === 'object' && families.includes(run.fontFamily));
  const expected = slide.text.filter(run => run.fontFamily);
  assert.deepEqual(runs.map(run => [run.fontFamily, run.text]), expected.map(run => [run.fontFamily, run.text]), `${slide.id}: re-import keeps family and codes`);
}

// With a measuring renderer that previews symbol fonts (opf-render with FF-45: resolveFont reports symbolEncoding), the
// measured export names exactly the same typefaces as the unmeasured one.
{
  const {loadFonts} = await import('@openpresentation/opf-render/fonts-node');
  const fonts = await import('@openpresentation/opf-render/fonts');
  {
    const handle = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation}), {registry} = handle;
    // Hosts (the editor) pass the renderer's script-aware measurement, which plans symbol runs code by code; the raw registry would
    // measure the private-use characters with the substitute face and report missing-glyph.
    const textMeasurement = fonts.createScriptTextMeasurement(handle.textMeasurement, {});
    const measured = unzipSync(new Uint8Array(await toPptx(structuredClone(presentation), {fonts: {...handle, textMeasurement}, strictAssets: true})));
    const typefaces = archive => new Set(Object.keys(archive).filter(name => name.endsWith('.xml')).flatMap(name => [...strFromU8(archive[name]).matchAll(/typeface="([^"]*)"/g)].map(match => match[1])));
    assert.deepEqual([...typefaces(measured)].sort(), [...typefaces(entries)].sort(), 'a symbol-previewing renderer changes no typeface');
    assert.ok(registry.substitutions.some(entry => entry.symbolEncoding === 'Wingdings'), 'the preview resolved Wingdings through its encoding');
    for (const [index] of slides.entries()) assert.equal(slideXml(index + 1).replace(/<a:t>[^<]*<\/a:t>/g, ''), strFromU8(measured[`ppt/slides/slide${index + 1}.xml`]).replace(/<a:t>[^<]*<\/a:t>/g, ''), 'the measured export writes the same run properties');
    console.log('Symbol fonts: measured export (opf-render FF-45) names the chosen families and keeps the codes.');
  }
}
console.log(`Symbol fonts: ${families.length} families; a:latin names the chosen family, characters byte for byte in private-use and Windows-1252 form, re-import round-trips; no a:sym written (native verification pending).`);
