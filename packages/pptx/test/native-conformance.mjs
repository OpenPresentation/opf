// LH-12: the PowerPoint export follows the native-quality rules of Claude's pptx skill. Every example deck
// (@openpresentation/opf/examples) is exported with the default catalog, and its XML is checked:
//
//   1. Theme. ppt/theme/theme1.xml carries the deck's font scheme (major and minor latin are the resolved heading and body
//      fonts) and all twelve colour slots. A slide or chart colour equal to a deck theme slot is written as a:schemeClr unless the
//      author wrote that colour literally (an authored literal stays literal, so a theme edit does not recolour it). The literal
//      share is printed: the rest are engine-derived colours (syntax, emphasis, contrast and chrome mixes, gradients).
//   2. Chart text. Every chart text property (c:txPr, c:rich, cx:txPr, cx:rich) names a latin typeface the deck itself uses, so
//      PowerPoint never falls back to its own default (Arial).
//   3. Text boxes and names. A text shape that is not a placeholder and has no fill is a text box (txBox="1"); a placeholder never
//      carries the flag. Every drawing object has a non-empty name that is not PowerPoint's generic "Text 3" or "Shape 4". A
//      picture carries `descr` (its OPF alt); only a deck with an image without alt may have a picture without one.
//   4. Insets. Every text box has explicit zero insets (the composed box already is the text's box, so PowerPoint adds no
//      0.1 in / 0.05 in of its own) and every table cell explicit margins.
//   5. Native chart guards. Stacked bars and columns place labels only at ctr, inEnd or inBase, and lines, areas, radar,
//      scatter and doughnut charts never at outEnd (PowerPoint declares the file corrupt);
//      every chart group's axis ids name axes of the right kind that cross each other, so a combo with a secondary axis
//      declares both its value-axis and its category-axis ids.
//   6. Bullets. No run starts with a literal bullet glyph; list bullets are paragraph bullets (a:buChar, a:buBlip, a:buAutoNum).
//
// Focused cases after the corpus cover the guards the corpus may not reach: every stacked type and label position, a combo
// with a secondary axis, and picture alt text from an inline image and from an asset.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unzipSync} from 'fflate';
import {examples} from '@openpresentation/opf/examples';
import {resolveDesignRecords} from '@openpresentation/opf';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {catalogs, toPptx} from './helpers/default-catalog.mjs';

const decoder = new TextDecoder();
const fonts = await loadFonts({pack: 'office', fallbackFamily: 'Roboto', strictGlyphs: false});
const image = new Uint8Array(await readFile(new URL('./fixtures/images/wide.png', import.meta.url)));
const SLOTS = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
const GENERIC_NAME = /^(?:Text|Shape|Image|Picture|Chart|Table|Media|Line|Group|Connector) \d+$/;
const BULLET_GLYPH = /^\s*[\u2022\u25E6\u25AA\u25AB\u2023\u25CF\u25CB\u25A0\u25A1\u2043]/;
const STACKED_POSITIONS = new Set(['ctr', 'inEnd', 'inBase']);

const attr = (xml, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(xml)?.[1];
const hex6 = value => {
  const raw = value.replace(/^#/, '');
  return (raw.length === 3 ? [...raw].map(char => char + char).join('') : raw.slice(0, 6)).toUpperCase();
};
// The RRGGBB colours the author wrote anywhere in the document (variables, design records, slides).
const authoredColors = deck => new Set([...JSON.stringify(deck).matchAll(/#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/gi)].map(match => hex6(match[1])));
// Whether the document draws an image it gives no alt for: a bare source string, or a source object without alt.
function hasImageWithoutAlt(deck) {
  let found = false;
  const visit = (value, key) => {
    if (found || value === null || typeof value !== 'object') {
      if (typeof value === 'string' && ['image', 'logo', 'onLight', 'onDark', 'full', 'compact', 'icon'].includes(key)) found = true;
      return;
    }
    if (typeof value.src === 'string' && typeof value.alt !== 'string') found = true;
    for (const [child, entry] of Object.entries(value)) visit(entry, child);
  };
  visit(deck);
  for (const asset of Object.values(deck.assets ?? {})) if (typeof asset === 'string' || (asset && typeof asset.alt !== 'string')) found = true;
  return found;
}

/** Every check over one exported package; returns the problems found and the colour counts. */
function audit(entries, deck, {label = 'deck'} = {}) {
  const problems = [];
  const fail = (rule, where, detail) => problems.push(`${rule} ${label} ${where}: ${detail}`);
  const text = path => decoder.decode(entries[path]);
  const slides = Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path));
  const charts = Object.keys(entries).filter(path => /^ppt\/charts\/chart(?:Ex)?\d+\.xml$/.test(path));
  const counts = {literal: 0, scheme: 0, literalSlot: 0};

  // 1. Theme fonts and slots.
  const theme = text('ppt/theme/theme1.xml');
  const major = /<a:majorFont><a:latin typeface="([^"]*)"/.exec(theme)?.[1], minor = /<a:minorFont><a:latin typeface="([^"]*)"/.exec(theme)?.[1];
  const {fontScheme} = resolveDesignRecords(deck, undefined, {catalogs});
  if (major !== (fontScheme.heading ?? fontScheme.major)) fail('theme-font', 'major', `${major} is not the deck heading font ${fontScheme.heading ?? fontScheme.major}`);
  if (minor !== (fontScheme.body ?? fontScheme.minor)) fail('theme-font', 'minor', `${minor} is not the deck body font ${fontScheme.body ?? fontScheme.minor}`);
  const slotColors = new Map();
  for (const slot of SLOTS) {
    const value = new RegExp(`<a:${slot}><a:(?:srgbClr val|sysClr val="\\w+" lastClr)="([0-9A-Fa-f]{6})"`).exec(theme)?.[1];
    if (!value) fail('theme-slot', slot, 'missing');
    else slotColors.set(value.toUpperCase(), slot);
  }
  const authored = authoredColors(deck);
  for (const path of [...slides, ...charts]) {
    // A data label inside a mark takes core's contrast colour for the mark's literal fill (textColorForFill: the chart text
    // colour, else pure black or white). That black or white is chosen against a literal and stays literal even where it
    // equals a slot, so a theme edit cannot drop the label's contrast.
    const xml = text(path).replace(/<c:dLbls?>[\s\S]*?<\/c:dLbls?>/g, labels => labels.replace(/<a:srgbClr val="(?:000000|FFFFFF)"/g, '<a:srgbClr val="contrast"'));
    counts.scheme += (xml.match(/<a:schemeClr\b/g) ?? []).length;
    for (const [, value] of xml.matchAll(/<a:srgbClr val="([0-9A-Fa-f]{6})"/g)) {
      counts.literal++;
      const key = value.toUpperCase();
      if (!slotColors.has(key)) continue;
      counts.literalSlot++;
      if (!authored.has(key)) fail('scheme-color', path, `#${key} is the theme's ${slotColors.get(key)} but is written as a literal`);
    }
  }

  // 2. Chart text fonts: the deck's own typefaces (theme fonts, the slides' runs) or the theme font references.
  const deckFonts = new Set([major, minor, '+mn-lt', '+mj-lt']);
  for (const path of slides) for (const [, face] of text(path).matchAll(/<a:latin typeface="([^"]*)"/g)) deckFonts.add(face);
  for (const path of charts) {
    for (const [block] of text(path).matchAll(/<(c|cx):(txPr|rich)>[\s\S]*?<\/\1:\2>/g)) {
      for (const [properties] of block.matchAll(/<a:(?:defRPr|rPr)\b[^>]*?(?:\/>|>[\s\S]*?<\/a:(?:defRPr|rPr)>)/g)) {
        const face = /<a:latin typeface="([^"]*)"/.exec(properties)?.[1];
        if (!face) fail('chart-font', path, `text properties without a typeface (PowerPoint would use its default): ${properties.slice(0, 80)}`);
        else if (!deckFonts.has(face)) fail('chart-font', path, `${face} is not a typeface of the deck`);
      }
    }
  }

  for (const path of slides) {
    const xml = text(path);
    // 3. Names, text boxes, alt text; 4. insets.
    for (const [nv] of xml.matchAll(/<p:cNvPr\b[^>]*>/g)) {
      const name = attr(nv, 'name'), id = attr(nv, 'id');
      if (id === '1') continue; // the shape tree's own group, which PowerPoint also leaves unnamed
      if (!name) fail('shape-name', path, `object ${id} has no name`);
      else if (GENERIC_NAME.test(name)) fail('shape-name', path, `object ${id} has the generic name "${name}"`);
    }
    for (const [shape] of xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)) {
      const name = attr(shape, 'name'), placeholder = /<p:ph\b/.test(shape), textBox = /<p:cNvSpPr\b[^>]*\btxBox="1"/.test(shape);
      const hasText = /<a:t>[^<]*\S[^<]*<\/a:t>/.test(shape);
      const properties = /<p:spPr\b[\s\S]*?<\/p:spPr>|<p:spPr\/>/.exec(shape)?.[0] ?? '';
      const filled = /<a:(?:solidFill|gradFill|blipFill|pattFill)\b/.test(properties.replace(/<a:ln\b[\s\S]*?<\/a:ln>/g, ''));
      if (placeholder && textBox) fail('text-box', path, `placeholder "${name}" carries txBox="1"`);
      if (!placeholder && hasText && !filled && !textBox) fail('text-box', path, `text shape "${name}" is not a text box`);
      const body = /<a:bodyPr\b[^>]*>/.exec(shape)?.[0];
      if (hasText && body) {
        const insets = ['lIns', 'tIns', 'rIns', 'bIns'].map(name => attr(body, name));
        if (insets.some(value => value !== '0')) fail('inset', path, `"${name}" has insets ${insets.join(',')} (want explicit 0)`);
      }
      // 6. Bullets.
      for (const [, run] of shape.matchAll(/<a:t>([^<]*)<\/a:t>/g)) if (BULLET_GLYPH.test(run)) fail('bullet', path, `"${name}" writes a literal bullet: ${run.slice(0, 40)}`);
    }
    for (const [cell] of xml.matchAll(/<a:tcPr\b[^>]*>/g)) {
      if (['marL', 'marR', 'marT', 'marB'].some(name => attr(cell, name) === undefined)) fail('inset', path, `table cell without explicit margins: ${cell}`);
    }
    for (const [picture] of xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)) {
      const nv = /<p:cNvPr\b[^>]*>/.exec(picture)[0], descr = attr(nv, 'descr');
      if (descr === '') fail('alt', path, `picture "${attr(nv, 'name')}" has an empty descr`);
      if (descr === undefined && !hasImageWithoutAlt(deck)) fail('alt', path, `picture "${attr(nv, 'name')}" has no descr though every image of the deck has alt text`);
    }
  }

  // 5. Native chart guards (classic charts; chartex positions are their own vocabulary).
  for (const path of charts.filter(path => /chart\d+\.xml$/.test(path))) {
    const xml = text(path);
    const axes = new Map([...xml.matchAll(/<c:(catAx|dateAx|serAx|valAx)>([\s\S]*?)<\/c:\1>/g)].map(([, kind, body]) => [attr(body, 'val'), {kind, cross: /<c:crossAx val="(\d+)"/.exec(body)?.[1]}]));
    for (const [id, axis] of axes) if (axes.get(axis.cross)?.cross !== id) fail('chart-axes', path, `axis ${id} does not cross an axis that crosses it back`);
    for (const [, type, body] of xml.matchAll(/<c:(\w+Chart)>([\s\S]*?)<\/c:\1>/g)) {
      const grouping = /<c:grouping val="(\w+)"/.exec(body)?.[1];
      const positions = [...body.matchAll(/<c:dLblPos val="(\w+)"/g)].map(match => match[1]);
      if (type === 'barChart' && /stacked/i.test(grouping ?? '') && positions.some(position => !STACKED_POSITIONS.has(position))) fail('stacked-labels', path, `${type} ${grouping} places labels at ${positions.join(',')}`);
      if (['lineChart', 'areaChart', 'radarChart', 'scatterChart', 'doughnutChart'].includes(type) && positions.includes('outEnd')) fail('label-position', path, `${type} places labels at outEnd`);
      if (['pieChart', 'doughnutChart'].includes(type)) continue;
      const ids = [...body.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, '').matchAll(/<c:axId val="(\d+)"/g)].map(match => match[1]);
      const kinds = ids.map(id => axes.get(id)?.kind);
      const scatter = ['scatterChart', 'bubbleChart'].includes(type);
      if (ids.length < 2 || kinds.includes(undefined)) fail('chart-axes', path, `${type} lists axis ids ${ids.join(',')} that are not all declared`);
      else if (scatter ? kinds[0] !== 'valAx' : !['catAx', 'dateAx'].includes(kinds[0])) fail('chart-axes', path, `${type} has a ${kinds[0]} as its category axis`);
      else if (kinds[1] !== 'valAx') fail('chart-axes', path, `${type} has a ${kinds[1]} as its value axis`);
    }
  }
  return {problems, counts};
}

// --- The example corpus ---------------------------------------------------------------------------------------------------
const total = {decks: 0, slides: 0, literal: 0, scheme: 0, literalSlot: 0};
const problems = [];
for (const {file, deck} of examples) {
  const bytes = await toPptx(structuredClone(deck), {fonts, imageResolver: async () => image});
  const result = audit(unzipSync(bytes), deck, {label: file});
  problems.push(...result.problems);
  total.decks++;
  total.slides += deck.slides.length;
  for (const key of ['literal', 'scheme', 'literalSlot']) total[key] += result.counts[key];
}
assert.deepEqual(problems.slice(0, 40), [], `${problems.length} native-conformance problems`);
assert.ok(total.decks >= 100, 'the example corpus is present');

// --- Focused cases --------------------------------------------------------------------------------------------------------
const data = {columns: ['Quarter', 'North', 'South'], rows: [['Q1', 10, 5], ['Q2', 20, 8], ['Q3', 15, 12], ['Q4', 22, 9]]};
const chartDeck = chart => ({design: {fontScheme: 'roboto'}, slides: [{title: 'Chart', chart}]});
const exportEntries = async deck => unzipSync(await toPptx(deck, {imageResolver: async () => image}));

// 5a. Stacked bars and columns: every label position the author may ask for lands on ctr, inEnd or inBase, never outEnd.
let stackedCases = 0;
for (const type of ['stacked-column', '100pct-stacked-column', 'stacked-bar', '100pct-stacked-bar', 'stacked-line', 'stacked-area', '100pct-stacked-area']) {
  for (const position of ['outside-end', 'inside-end', 'inside-base', 'center', 'above', 'auto', undefined]) {
    const deck = chartDeck({type, data, dataLabels: position ? {position} : true});
    const entries = await exportEntries(deck);
    const xml = decoder.decode(entries['ppt/charts/chart1.xml']);
    assert.doesNotMatch(xml, /<c:dLblPos val="outEnd"\/>/, `${type} with labels at ${position ?? 'the default'} writes no outEnd`);
    assert.deepEqual(audit(entries, deck, {label: `${type}/${position}`}).problems, []);
    stackedCases++;
  }
}

// 5b. A combo with a secondary axis: the column group and the line group each declare a category and a value axis id.
{
  const deck = chartDeck({type: 'combo', data, secondaryAxis: ['South'], dataLabels: true});
  const entries = await exportEntries(deck);
  const xml = decoder.decode(entries['ppt/charts/chart1.xml']);
  assert.equal((xml.match(/<c:valAx>/g) ?? []).length, 2, 'a primary and a secondary value axis');
  assert.equal((xml.match(/<c:catAx>/g) ?? []).length, 2, 'a category axis for each value axis');
  const groupIds = [...xml.matchAll(/<c:(barChart|lineChart)>([\s\S]*?)<\/c:\1>/g)].map(([, , body]) => [...body.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, '').matchAll(/<c:axId val="(\d+)"/g)].map(match => match[1]));
  assert.equal(groupIds.length, 2);
  assert.ok(groupIds.every(ids => ids.length === 2), 'each group lists its category and value axis ids');
  assert.notDeepEqual(groupIds[0], groupIds[1], 'the line group plots against its own pair of axes');
  assert.deepEqual(audit(entries, deck, {label: 'combo'}).problems, []);
}

// 3. Alt text from an inline image and an asset, names and text boxes of rich body text and a list.
{
  const deck = {
    design: {fontScheme: 'roboto'},
    assets: {harbor: {src: './harbor.png', alt: 'Harbor at dusk'}},
    slides: [
      {title: 'Pictures', blocks: [{type: 'image', image: {src: './pier.png', alt: 'Pier in fog'}}, {type: 'image', image: 'asset:harbor'}]},
      {title: 'Rich text', text: [{text: 'A long paragraph whose emphasis '}, {text: 'wraps across several lines', bold: true}, {text: ' of the body, so it is exported line by line as native text boxes with their own names.'}]},
      {title: 'List', bullets: ['First point', 'Second point', 'Third point']},
    ],
  };
  const entries = await exportEntries(deck);
  assert.deepEqual(audit(entries, deck, {label: 'focused'}).problems, []);
  const slide = index => decoder.decode(entries[`ppt/slides/slide${index}.xml`]);
  const descriptions = [...slide(1).matchAll(/<p:pic>[\s\S]*?<p:cNvPr\b[^>]*\bdescr="([^"]*)"/g)].map(match => match[1]).sort();
  assert.deepEqual(descriptions, ['Harbor at dusk', 'Pier in fog'], 'each picture carries its OPF alt as descr');
  assert.match(slide(2), /<p:cNvPr id="\d+" name="OPF text slides\.1\.text line 0"\/><p:cNvSpPr txBox="1"\/>/, 'a rich body line is a named text box');
  assert.match(slide(3), /<a:buChar char="&#x2022;"\/>/, 'list bullets are paragraph bullets');
  assert.doesNotMatch(slide(3), /<a:t>\u2022/, 'no literal bullet in the runs');
}

const share = total.literal / (total.literal + total.scheme);
console.log(`Native conformance passed: ${total.decks} example decks (${total.slides} slides) with theme fonts and slots, scheme colours, chart text fonts, text boxes, names, alt text, zero insets, chart guards and paragraph bullets; ${stackedCases} stacked label cases and a secondary-axis combo. ` +
  `Colours: ${total.scheme} a:schemeClr and ${total.literal} a:srgbClr (${(share * 100).toFixed(1)}% literal); ${total.literalSlot} literals equal a theme slot and every one is a colour the author wrote literally, the rest are engine-derived colours with no theme slot.`);
