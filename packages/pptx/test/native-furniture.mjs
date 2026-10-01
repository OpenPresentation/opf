// RR-11: native PowerPoint Header & Footer objects (docs/native-header-footer.md).
// OOXML-level checks of every part, geometry parity with core, determinism and the
// round trip (with and without OPF provenance, and after native edits in PowerPoint).
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {unzipSync, zipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {validatePresentation} from '@openpresentation/opf';
import {resolvePresentation} from '@openpresentation/opf-render/svg';
import {prepareNodeFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx, fromPptx} from '../dist/index.js';
import {nativeFurnitureParts, NATIVE_PLACEHOLDERS} from '../dist/native-furniture.js';

const enc = new TextEncoder(), dec = new TextDecoder();
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const hash = value => createHash('sha256').update(value).digest('hex');
const {options: fontOptions} = await prepareNodeFonts();
const DATE = '2026-09-10';

const exportDeck = async (source, extra = {}) => {
  const before = structuredClone(source), issues = [];
  const bytes = await toPptx(source, {seed: 1, date: DATE, onDiagnostic: issue => issues.push(issue), ...extra});
  assert.deepEqual(source, before, 'Export leaves the source unchanged.');
  const entries = unzipSync(bytes);
  return {bytes, issues, entries};
};
const text = (entries, path) => dec.decode(entries[path]);
const slidePath = index => `ppt/slides/slide${index}.xml`;
const shapesOf = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]);
const nameOf = shape => shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1];
const phOf = shape => shape.match(/<p:ph\b([^>]*)\/>/)?.[1]?.trim();
const phType = shape => phOf(shape)?.match(/type="(\w+)"/)?.[1];
const furnitureShapes = xml => shapesOf(xml).filter(shape => /^OPF furniture \d+ part \d+ line \d+$/.test(nameOf(shape)));
const placeholderShapes = xml => shapesOf(xml).filter(shape => ['dt', 'ftr', 'sldNum'].includes(phType(shape)));
const xfrmOf = shape => ({x: Number(shape.match(/<a:off x="(-?\d+)"/)[1]), y: Number(shape.match(/<a:off x="-?\d+" y="(-?\d+)"/)[1]),
  cx: Number(shape.match(/<a:ext cx="(\d+)"/)[1]), cy: Number(shape.match(/<a:ext cx="\d+" cy="(\d+)"/)[1])});
const runsOf = shape => [...shape.matchAll(/<a:(r|fld)\b([^>]*)>[\s\S]*?<a:t>([^<]*)<\/a:t><\/a:\1>/g)]
  .map(([, kind, attributes, value]) => kind === 'fld' ? `[${attributes.match(/type="([^"]+)"/)[1]}:${value}]` : value).join('');
const read = async (bytes, extra = {}) => {
  const issues = [], imported = await fromPptx(bytes, {onDiagnostic: issue => issues.push(issue), ...extra});
  assert.equal(validatePresentation(imported).valid, true, JSON.stringify(validatePresentation(imported).errors));
  return {imported, issues, invalid: issues.filter(issue => issue.code === 'invalid-furniture-provenance')};
};
const mutate = (entries, edits) => {
  const copy = {...entries};
  for (const [path, change] of Object.entries(edits)) copy[path] = enc.encode(change(text(entries, path)));
  return zipSync(copy);
};
// The same package with every OPF tag removed: an ordinary PowerPoint file.
const stripTags = entries => {
  const copy = {...entries};
  for (const path of Object.keys(copy)) {
    if (/^ppt\/tags\//.test(path)) delete copy[path];
    else if (/^ppt\/(slides\/slide\d+|presentation)\.xml$/.test(path)) copy[path] = enc.encode(text(copy, path).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, ''));
    else if (/^ppt\/slides\/_rels\//.test(path)) copy[path] = enc.encode(text(copy, path).replace(/<Relationship\b[^>]*relationships\/tags"[^>]*\/>/g, ''));
  }
  return zipSync(copy);
};
const removeShapes = (entries, index, predicate) => mutate(entries, {[slidePath(index)]: xml => xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => predicate(shape) ? '' : shape)});

const results = [];

// ---------------------------------------------------------------------------
// 1. Every part: slide, layout, master, notes master, presentation.
// ---------------------------------------------------------------------------
const full = {
  organization: {id: 'primary', name: 'Northstar Health'},
  design: {fontScheme: 'roboto',
    header: {left: {text: 'Quarterly review'}, center: {organization: true}, right: {text: 'Internal'}},
    footer: {left: {date: true}, center: {text: 'Confidential'}, right: {slideNumber: true}}},
  slides: [{title: 'Cover', design: {footer: false}}, {title: 'Two', text: 'Body'}, {title: 'Three', text: 'Body'}],
};
for (const measured of [false, true]) {
  const extra = measured ? fontOptions : {};
  const {bytes, issues, entries} = await exportDeck(full, extra);
  assert.deepEqual(issues, []);
  const geometry = resolvePresentation(full, {...extra, date: DATE}).slides;

  // Slides: the title slide hides the footer; the others carry the three placeholders at core's geometry.
  assert.deepEqual(placeholderShapes(text(entries, slidePath(1))), [], 'design.footer false on a slide removes its placeholders.');
  const header = furnitureShapes(text(entries, slidePath(1)));
  assert.deepEqual(header.map(runsOf), ['Quarterly review', 'Northstar Health', 'Internal'], 'The header is unaffected by the footer override.');
  for (const index of [2, 3]) {
    const xml = text(entries, slidePath(index));
    const placeholders = placeholderShapes(xml);
    assert.deepEqual(placeholders.map(phType), ['dt', 'ftr', 'sldNum'], 'Date, footer text and slide number are placeholders, in core order.');
    assert.deepEqual(placeholders.map(phOf), ['type="dt" sz="half" idx="10"', 'type="ftr" sz="quarter" idx="11"', 'type="sldNum" sz="quarter" idx="12"']);
    for (const shape of placeholders) assert.match(shape, /<p:cNvSpPr><a:spLocks noGrp="1"\/><\/p:cNvSpPr>/);
    assert.deepEqual(placeholders.map(runsOf), [`[datetime1:9/10/2026]`, 'Confidential', `[slidenum:${index}]`]);
    // The header stays tagged ordinary shapes: PowerPoint slides have no header placeholder.
    const headerShapes = furnitureShapes(xml).filter(shape => !phOf(shape));
    assert.deepEqual(headerShapes.map(runsOf), ['Quarterly review', 'Northstar Health', 'Internal']);
    // Geometry parity: each placeholder has exactly the box core composed (and the tagged shape had).
    const parts = geometry[index - 1].geometry.furniture.parts.filter(part => part.kind === 'footer');
    assert.equal(parts.length, 3);
    for (const [at, part] of parts.entries()) {
      const placed = part.fit.placement?.lines[0], factor = part.alignment === 'right' ? 1 : part.alignment === 'center' ? .5 : 0;
      const area = placed ? {x: placed.x + placed.width * factor - part.box.width * factor, y: placed.baseline - part.fit.fontSize, width: part.box.width, height: placed.height}
        : {x: part.box.x, y: part.box.y, width: part.box.width, height: part.fit.lineHeight};
      const box = xfrmOf(placeholders[at]);
      for (const [actual, expected] of [[box.x, area.x], [box.y, area.y], [box.cx, area.width], [box.cy, area.height]]) assert.equal(actual, Math.round(expected * 9525));
      assert.match(placeholders[at], new RegExp(`algn="${{left: 'l', center: 'ctr', right: 'r'}[part.alignment]}"`));
      assert.match(placeholders[at], new RegExp(`sz="${Math.round(part.fit.fontSize * .75 * 100)}"`));
    }
    // The shape ids are unique and the placeholder ids keep the tagged shapes' naming.
    const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(placeholders.map(nameOf), parts.map((part, at) => `OPF furniture ${index - 1} part ${geometry[index - 1].geometry.furniture.parts.indexOf(part)} line 0`));
  }

  // Layout: the three placeholders the slide placeholders point at by idx, plus the flags.
  const layout = text(entries, 'ppt/slideLayouts/slideLayout1.xml');
  assert.deepEqual(shapesOf(layout).map(phOf), ['type="dt" sz="half" idx="10"', 'type="ftr" sz="quarter" idx="11"', 'type="sldNum" sz="quarter" idx="12"']);
  assert.match(layout, /<\/p:clrMapOvr><p:hf sldNum="1" hdr="0" ftr="1" dt="1"\/><\/p:sldLayout>/);
  assert.match(layout, /<a:fld [^>]*type="datetimeFigureOut">/);
  assert.match(layout, /<a:fld [^>]*type="slidenum"><a:rPr lang="en-US"\/><a:t>‹#›<\/a:t>/);
  // Master: the same three (idx 2, 3, 4), at the first slide's boxes with its text style as the default, and the flags before txStyles.
  const master = text(entries, 'ppt/slideMasters/slideMaster1.xml');
  assert.deepEqual(shapesOf(master).map(phOf), ['type="dt" sz="half" idx="2"', 'type="ftr" sz="quarter" idx="3"', 'type="sldNum" sz="quarter" idx="4"']);
  assert.match(master, /<\/p:sldLayoutIdLst><p:hf sldNum="1" hdr="0" ftr="1" dt="1"\/><p:txStyles>/);
  const slidePlaceholders = placeholderShapes(text(entries, slidePath(2)));
  for (const [at, shape] of shapesOf(master).entries()) {
    assert.deepEqual(xfrmOf(shape), xfrmOf(slidePlaceholders[at]), 'The master placeholder sits where the first native footer sits.');
    assert.match(shape, new RegExp(`<a:defRPr sz="${slidePlaceholders[at].match(/\bsz="(\d+)"/)[1]}">`));
  }
  // Notes master: PowerPoint's placeholders stay; the flags say the notes pages carry a page number only.
  const notes = text(entries, 'ppt/notesMasters/notesMaster1.xml');
  assert.match(notes, /<p:clrMap [^>]*\/><p:hf hdr="0" ftr="0" dt="0"\/><p:notesStyle>/);
  assert.equal(shapesOf(notes).map(phType).join(), 'hdr,dt,sldImg,body,ftr,sldNum');
  // The presentation has no header/footer setting of its own (docs/native-header-footer.md): nothing is invented.
  assert.doesNotMatch(text(entries, 'ppt/presentation.xml'), /showSpecialPlsOnTitleSld/);
  // Every part parses, and each slide placeholder has its layout counterpart.
  for (const [path, bytesOf] of Object.entries(entries)) if (/\.xml$/.test(path) && !path.startsWith('ppt/media/')) parser.parse(dec.decode(bytesOf));
  const layoutIdx = new Set(shapesOf(layout).map(shape => phOf(shape).match(/idx="(\d+)"/)[1]));
  for (const index of [2, 3]) for (const shape of placeholderShapes(text(entries, slidePath(index)))) assert.ok(layoutIdx.has(phOf(shape).match(/idx="(\d+)"/)[1]));
  // Determinism: the same input gives the same bytes.
  assert.equal(hash((await exportDeck(full, extra)).bytes), hash(bytes));
  results.push({measured, sha256: hash(bytes)});
}

// ---------------------------------------------------------------------------
// 2. What stays a tagged shape, and the flags for partial decks.
// ---------------------------------------------------------------------------
{
  // A second text part, a second slide number, organization, section and multi-line text are not native.
  const source = {organization: {id: 'primary', name: 'Org'}, design: {fontScheme: 'roboto',
    footer: {left: {text: 'First', organization: true, section: true}, center: {text: 'Second', slideNumber: true}, right: {slideNumber: true, date: DATE}}},
    slides: [{title: 'A', section: 'S', text: 'Body'}]};
  const {entries} = await exportDeck(source);
  const xml = text(entries, slidePath(1));
  const placeholders = placeholderShapes(xml);
  assert.deepEqual(placeholders.map(phType).sort(), ['dt', 'ftr', 'sldNum']);
  assert.deepEqual(placeholders.map(runsOf).sort(), ['9/10/2026'.replace(/.*/, '2026-09-10'), 'First', '[slidenum:1]'].sort(), 'The first text, the first number and the (fixed) date.');
  const rest = furnitureShapes(xml).filter(shape => !phOf(shape));
  assert.deepEqual(rest.map(runsOf).sort(), ['Org', 'S', 'Second', '[slidenum:1]'].sort(), 'Everything else is an ordinary tagged shape; the second number stays a live field.');
  assert.match(text(entries, 'ppt/slideMasters/slideMaster1.xml'), /<p:hf sldNum="1" hdr="0" ftr="1" dt="1"\/>/);
}
{
  const source = {design: {fontScheme: 'roboto', footer: {left: {text: 'Line one\nLine two'}, right: {slideNumber: true}}}, slides: [{title: 'A', text: 'Body'}]};
  const {entries} = await exportDeck(source);
  const xml = text(entries, slidePath(1));
  assert.deepEqual(placeholderShapes(xml).map(phType), ['sldNum'], 'Multi-line footer text is not one native placeholder.');
  assert.equal(furnitureShapes(xml).filter(shape => !phOf(shape)).length, 2);
  // Only the slide number is in use: the master still carries all three (so the dialog works) with flags for the one.
  assert.match(text(entries, 'ppt/slideMasters/slideMaster1.xml'), /<p:hf sldNum="1" hdr="0" ftr="0" dt="0"\/>/);
  assert.equal(shapesOf(text(entries, 'ppt/slideMasters/slideMaster1.xml')).length, 3);
}
{
  // Linked socials come first in the slide: their hyperlink never leaks into the master's default text style.
  const source = {organization: {id: 'acme', name: 'Acme', socials: {linkedin: 'acme'}}, design: {fontScheme: 'roboto', header: {right: {socials: true}}, footer: {left: {organization: true}, center: {slideNumber: true}}}, slides: [{title: 'A', text: 'Body'}]};
  const {entries} = await exportDeck(source);
  assert.match(text(entries, slidePath(1)), /<a:hlinkClick\b/, 'The header socials are linked.');
  assert.doesNotMatch(text(entries, 'ppt/slideMasters/slideMaster1.xml'), /hlinkClick|r:id="rId[3-9]/);
  assert.deepEqual(placeholderShapes(text(entries, slidePath(1))).map(phType), ['sldNum']);
}
{
  // A header-only deck, and a deck without furniture, keep their masters exactly as they were: no placeholders, flags off.
  for (const design of [{fontScheme: 'roboto', header: {left: {text: 'Header only'}}}, {fontScheme: 'roboto'}]) {
    const {entries} = await exportDeck({design, slides: [{title: 'A', text: 'Body', notes: 'Spoken'}]});
    assert.deepEqual(placeholderShapes(text(entries, slidePath(1))), []);
    assert.equal(shapesOf(text(entries, 'ppt/slideMasters/slideMaster1.xml')).length, 0);
    assert.equal(shapesOf(text(entries, 'ppt/slideLayouts/slideLayout1.xml')).length, 0);
    assert.match(text(entries, 'ppt/slideMasters/slideMaster1.xml'), /<p:hf sldNum="0" hdr="0" ftr="0" dt="0"\/>/);
    assert.doesNotMatch(text(entries, 'ppt/notesMasters/notesMaster1.xml'), /<p:hf\b/);
  }
}
{
  // Footer parts that wrap in a narrow portrait deck are several lines each: shapes, never a native placeholder.
  const source = {design: {fontScheme: 'roboto', dimensions: {widthInches: 4, heightInches: 7}, footer: {left: {text: 'A footer sentence that is long enough to wrap in a zone'}, right: {slideNumber: true}}}, slides: [{title: 'A'}]};
  const {entries} = await exportDeck(source);
  const xml = text(entries, slidePath(1));
  assert.ok(!placeholderShapes(xml).some(shape => phType(shape) === 'ftr'));
}
{
  // Empty text is not a placeholder; the helper rejects parts that are not one accepted line.
  assert.deepEqual([...nativeFurnitureParts({parts: [
    {kind: 'header', type: 'text', field: 'text', text: 'h', fit: {sourceLines: [1], lines: ['h']}},
    {kind: 'footer', type: 'text', field: 'text', text: '', fit: {sourceLines: [1], lines: ['']}},
    {kind: 'footer', type: 'text', field: 'text', text: 'a', fit: {sourceLines: [1], lines: ['a']}},
    {kind: 'footer', type: 'text', field: 'text', text: 'b', fit: {sourceLines: [1], lines: ['b']}},
    {kind: 'footer', type: 'text', field: 'date', text: 'd', fit: {sourceLines: [1, 2], lines: ['d']}},
    {kind: 'footer', type: 'text', field: 'slideNumber', text: '1', fit: {sourceLines: [1], lines: ['1']}},
    {kind: 'footer', type: 'text', field: 'socials', text: 'x', fit: {sourceLines: [1], lines: ['x']}},
    {kind: 'footer', type: 'image', field: 'image'}]}).entries()], [[2, 'ftr'], [5, 'sldNum']]);
  assert.deepEqual(Object.keys(NATIVE_PLACEHOLDERS), ['dt', 'ftr', 'sldNum']);
}
{
  // Unused placeholder types default to core's footer band (date left, text center, number right).
  const source = {design: {fontScheme: 'roboto', footer: {right: {slideNumber: true}}}, slides: [{title: 'A'}]};
  const {entries} = await exportDeck(source);
  const master = shapesOf(text(entries, 'ppt/slideMasters/slideMaster1.xml'));
  const reference = resolvePresentation({design: {fontScheme: 'roboto', footer: {left: {date: DATE}, center: {text: 'Footer'}, right: {slideNumber: true}}}, slides: [{title: 'A'}]}).slides[0].geometry.furniture.parts;
  for (const [at, part] of reference.entries()) {
    const box = xfrmOf(master[at]);
    assert.equal(box.x, Math.round(part.box.x * 9525));
    assert.equal(box.cx, Math.round(part.box.width * 9525));
    assert.equal(box.y, Math.round(part.box.y * 9525));
  }
}

// ---------------------------------------------------------------------------
// 3. Slide-level overrides and per-slide differences.
// ---------------------------------------------------------------------------
{
  const source = {design: {fontScheme: 'roboto', footer: {left: {text: 'Deck footer'}, right: {slideNumber: true}}}, slides: [
    {title: 'A', text: 'Body'}, {title: 'B', text: 'Body', design: {footer: {center: {text: 'Only here'}}}}, {title: 'C', text: 'Body', design: {footer: false}}]};
  const {bytes, entries} = await exportDeck(source);
  assert.deepEqual(['1', '2', '3'].map(index => placeholderShapes(text(entries, slidePath(index))).map(phType)), [['ftr', 'sldNum'], ['ftr'], []]);
  assert.deepEqual(placeholderShapes(text(entries, slidePath(2))).map(runsOf), ['Only here']);
  const {imported, invalid} = await read(bytes);
  assert.deepEqual(invalid, []);
  assert.deepEqual(imported.design.footer, source.design.footer);
  assert.deepEqual(imported.slides.map(slide => slide.design?.footer), [undefined, {center: {text: 'Only here'}}, false]);
}

// ---------------------------------------------------------------------------
// 4. Round trip, with provenance and without it.
// ---------------------------------------------------------------------------
const footerOnly = {design: {fontScheme: 'roboto', footer: {left: {date: true, dateFormat: 'MMMM d, yyyy'}, center: {text: 'Confidential'}, right: {slideNumber: true, slideNumberFormat: 'Page {current}'}}},
  slides: [{title: 'A', text: 'Body'}, {title: 'B', text: 'Body'}, {title: 'C', text: 'Body'}]};
{
  const {bytes, entries} = await exportDeck(footerOnly);
  assert.deepEqual(placeholderShapes(text(entries, slidePath(1))).map(runsOf), ['[datetime4:September 10, 2026]', 'Confidential', 'Page [slidenum:1]']);
  const withTags = await read(bytes);
  assert.deepEqual(withTags.invalid, []);
  assert.deepEqual(withTags.imported.design.footer, footerOnly.design.footer, 'With provenance the footer returns exactly.');
  assert.ok(withTags.imported.slides.every(slide => slide.design?.footer === undefined));
  assert.ok(withTags.imported.slides.every(slide => !slide.blocks && slide.text === 'Body'), 'No footer text leaks into content.');
  // Without any tag (an ordinary PowerPoint file) the placeholders alone return the same footer.
  const stripped = await read(stripTags(entries));
  assert.deepEqual(stripped.imported.design.footer, footerOnly.design.footer);
  assert.ok(stripped.imported.slides.every(slide => slide.design?.footer === undefined));
  for (const slide of stripped.imported.slides) assert.ok(!JSON.stringify(slide).includes('Confidential'), 'Placeholder text is not slide content.');
  // The re-exported import carries the same placeholders again.
  const again = unzipSync(await toPptx(stripped.imported, {seed: 1, date: DATE}));
  assert.deepEqual(placeholderShapes(text(again, slidePath(2))).map(runsOf), ['[datetime4:September 10, 2026]', 'Confidential', 'Page [slidenum:2]']);
}
{
  // The Header & Footer dialog: unchecking Slide number on one slide removes its placeholder, and the import follows.
  const {entries} = await exportDeck(footerOnly);
  const removed = removeShapes(entries, 2, shape => phType(shape) === 'sldNum');
  for (const base of [removed, stripTags(unzipSync(removed))]) {
    const {imported, invalid} = await read(base);
    assert.deepEqual(invalid, []);
    const second = {left: footerOnly.design.footer.left, center: footerOnly.design.footer.center};
    assert.deepEqual(imported.slides[1].design?.footer ?? imported.design.footer, imported.slides[1].design?.footer ?? imported.design.footer);
    const footers = imported.slides.map(slide => slide.design?.footer ?? imported.design.footer);
    assert.deepEqual(footers[0], footerOnly.design.footer);
    assert.deepEqual(footers[1], second, 'The slide that lost its number keeps the rest of its footer.');
    assert.deepEqual(footers[2], footerOnly.design.footer);
  }
  // Unchecking everything removes the footer from the slide: footer false.
  const none = removeShapes(entries, 3, shape => ['dt', 'ftr', 'sldNum'].includes(phType(shape)));
  for (const base of [none, stripTags(unzipSync(none))]) {
    const {imported, invalid} = await read(base);
    assert.deepEqual(invalid, []);
    assert.equal(imported.slides[2].design.footer, false);
    assert.deepEqual(imported.design.footer, footerOnly.design.footer);
  }
  // Slide number unchecked with Apply to All removes it from every slide: the deck's footer loses it (no per-slide copies).
  const noNumbers = mutate(entries, Object.fromEntries([1, 2, 3].map(index => [slidePath(index), xml => xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => phType(shape) === 'sldNum' ? '' : shape)])));
  for (const base of [noNumbers, stripTags(unzipSync(noNumbers))]) {
    const {imported, invalid} = await read(base);
    assert.deepEqual(invalid, []);
    assert.deepEqual(imported.design.footer, {left: footerOnly.design.footer.left, center: footerOnly.design.footer.center});
    assert.ok(imported.slides.every(slide => slide.design?.footer === undefined));
  }
  // Apply to All with a new footer text changes every slide's placeholder: the deck's footer changes.
  const retyped = mutate(entries, Object.fromEntries([1, 2, 3].map(index => [slidePath(index), xml => xml.replace('<a:t>Confidential</a:t>', '<a:t>Draft v2</a:t>')])));
  assert.equal((await read(retyped)).imported.design.footer.center.text, 'Draft v2');
}

// ---------------------------------------------------------------------------
// 5. Placeholders as PowerPoint writes them: no xfrm (inherited), several field types, any zone.
// ---------------------------------------------------------------------------
{
  // A deck without footers, then a Header & Footer dialog "Apply to All": placeholders appear on every slide,
  // without their own geometry, pointing at the layout (idx 10-12), which names the footer band.
  const base = await exportDeck({design: {fontScheme: 'roboto', footer: {left: {date: true}, center: {text: 'Seed'}, right: {slideNumber: true}}}, slides: [{title: 'A', text: 'Body'}, {title: 'B', text: 'Body'}]});
  const bare = (type, idx, sz, body, align) => `<p:sp><p:nvSpPr><p:cNvPr id="90" name="${type} Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="${type}" sz="${sz}" idx="${idx}"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p>${body}<a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`;
  const field = (type, value) => `<a:fld id="{00000000-0000-4000-8000-000000000001}" type="${type}"><a:rPr lang="en-US"/><a:t>${value}</a:t></a:fld>`;
  const run = value => `<a:r><a:rPr lang="en-US"/><a:t>${value}</a:t></a:r>`;
  const inject = (entries, shapes) => {
    const copy = stripTags(entries), out = unzipSync(copy);
    for (const index of [1, 2]) out[slidePath(index)] = enc.encode(text(out, slidePath(index)).replace(/<p:sp>[\s\S]*?OPF furniture[\s\S]*?<\/p:sp>/g, '').replace('</p:spTree>', `${shapes(index)}</p:spTree>`));
    return zipSync(out);
  };
  const entries = unzipSync(base.bytes);
  const noPlaceholders = zipSync(Object.fromEntries(Object.entries(entries).map(([path, data]) => [path, /^ppt\/slides\/slide\d+\.xml$/.test(path) ? enc.encode(text(entries, path).replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="OPF furniture[\s\S]*?<\/p:sp>/g, '')) : data])));
  assert.equal(placeholderShapes(text(unzipSync(noPlaceholders), slidePath(1))).length, 0);
  const applied = inject(unzipSync(noPlaceholders), index => bare('dt', 10, 'half', field('datetime1', '9/10/2026'), 'l') + bare('ftr', 11, 'quarter', run('Applied to all'), 'ctr') + bare('sldNum', 12, 'quarter', field('slidenum', String(index)), 'r'));
  const {imported} = await read(applied);
  assert.deepEqual(imported.design.footer, {left: {date: true}, center: {text: 'Applied to all'}, right: {slideNumber: true}},
    'Inherited positions resolve through the layout and master: date left, footer center, number right.');
  assert.ok(imported.slides.every(slide => slide.design?.footer === undefined && !JSON.stringify(slide.blocks ?? '').includes('Applied')));
  // Every datetime field type maps to its OPF pattern; a time field and fixed text keep their words.
  const patterns = {datetime1: 'M/d/yyyy', datetime2: 'EEEE, MMMM d, yyyy', datetime3: 'd MMMM yyyy', datetime4: 'MMMM d, yyyy', datetime5: 'd-MMM-yy', datetime6: 'MMMM yy', datetime7: 'MMM-yy'};
  for (const [type, pattern] of Object.entries(patterns)) {
    const one = await read(inject(unzipSync(noPlaceholders), () => bare('dt', 10, 'half', field(type, 'x'), 'l')));
    assert.deepEqual(one.imported.design.footer, {left: {date: true, ...(pattern === 'M/d/yyyy' ? {} : {dateFormat: pattern})}}, type);
  }
  const time = await read(inject(unzipSync(noPlaceholders), () => bare('dt', 10, 'half', field('datetime10', '14:05'), 'l')));
  assert.deepEqual(time.imported.design.footer, {left: {date: '14:05'}});
  const fixed = await read(inject(unzipSync(noPlaceholders), () => bare('dt', 10, 'half', run('Q3 2026'), 'l')));
  assert.deepEqual(fixed.imported.design.footer, {left: {date: 'Q3 2026'}});
  // The slide number's surrounding words become its format.
  const numbered = await read(inject(unzipSync(noPlaceholders), index => bare('sldNum', 12, 'quarter', run('Slide ') + field('slidenum', String(index)), 'r')));
  assert.deepEqual(numbered.imported.design.footer, {right: {slideNumber: true, slideNumberFormat: 'Slide {current}'}});
  // Placeholders that PowerPoint left empty are not furniture (and are not slide content either).
  const empty = await read(inject(unzipSync(noPlaceholders), () => bare('ftr', 11, 'quarter', '', 'ctr')));
  assert.equal(empty.imported.design?.footer, undefined);
  // A footer on one slide only is that slide's; one on most slides is the deck's and the others hide it.
  const mostly = await read(inject(unzipSync(noPlaceholders), index => index === 1 ? '' : bare('ftr', 11, 'quarter', run('Only second'), 'ctr')));
  assert.deepEqual(mostly.imported.slides.map(slide => slide.design?.footer), [undefined, {center: {text: 'Only second'}}]);
  assert.equal(mostly.imported.design?.footer, undefined);
  // Explicit geometry decides the zone too: a footer dragged to the left edge is left, whatever its type.
  const moved = await read(inject(unzipSync(noPlaceholders), () => bare('ftr', 11, 'quarter', run('Left'), 'l').replace('<p:spPr/>', '<p:spPr><a:xfrm><a:off x="300000" y="6300000"/><a:ext cx="2000000" cy="300000"/></a:xfrm></p:spPr>')));
  assert.deepEqual(moved.imported.design.footer, {left: {text: 'Left'}});
}

// ---------------------------------------------------------------------------
// 5b. Provenance modes, and a placeholder added in PowerPoint to a tagged deck.
// ---------------------------------------------------------------------------
{
  // The furniture tags are written whatever the provenance option, so the placeholders are too.
  for (const provenance of ['references-only', false]) {
    const {bytes, entries} = await exportDeck(footerOnly, {provenance});
    assert.deepEqual(placeholderShapes(text(entries, slidePath(2))).map(phType), ['dt', 'ftr', 'sldNum'], String(provenance));
    assert.deepEqual((await read(bytes)).imported.design.footer, footerOnly.design.footer, String(provenance));
  }
  // A tagged deck with a date and a slide number only; PowerPoint's dialog adds a footer text to every slide (no xfrm: it inherits
  // the layout's, which is the default footer band's centre).
  const source = {design: {fontScheme: 'roboto', footer: {left: {date: true}, right: {slideNumber: true}}}, slides: [{title: 'A', text: 'Body'}, {title: 'B', text: 'Body'}]};
  const {entries} = await exportDeck(source);
  const added = mutate(entries, Object.fromEntries([1, 2].map(index => [slidePath(index), xml => xml.replace('</p:spTree>',
    '<p:sp><p:nvSpPr><p:cNvPr id="90" name="Footer Placeholder 89"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="ftr" sz="quarter" idx="11"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Added in PowerPoint</a:t></a:r></a:p></p:txBody></p:sp></p:spTree>')])));
  const {imported, invalid} = await read(added);
  assert.deepEqual(invalid, []);
  assert.deepEqual(imported.design.footer, {left: {date: true}, center: {text: 'Added in PowerPoint'}, right: {slideNumber: true}});
  assert.ok(imported.slides.every(slide => !JSON.stringify(slide).includes('Added in PowerPoint')));
  // A duplicate of a part the tags already describe is not merged into it: it stays ordinary text.
  const twice = mutate(entries, {[slidePath(1)]: xml => xml.replace('</p:spTree>',
    '<p:sp><p:nvSpPr><p:cNvPr id="91" name="Date Placeholder 90"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="dt" sz="half" idx="10"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="800000" y="6000000"/><a:ext cx="3000000" cy="300000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Second date</a:t></a:r></a:p></p:txBody></p:sp></p:spTree>')});
  const duplicate = await read(twice);
  assert.equal(duplicate.invalid.length, 1);
  assert.ok(JSON.stringify(duplicate.imported.slides[0]).includes('Second date'));
}

// ---------------------------------------------------------------------------
// 6. Older exports (tagged footer shapes that are not placeholders) still import unchanged.
// ---------------------------------------------------------------------------
{
  const {entries} = await exportDeck(footerOnly);
  // Rewrite the package as 0.11.7 wrote it: plain shapes, manifest without `ph`.
  const legacy = {...entries};
  for (const index of [1, 2, 3]) legacy[slidePath(index)] = enc.encode(text(entries, slidePath(index)).replace(/<p:ph [^>]*\/>/g, '').replace(/<p:cNvSpPr><a:spLocks noGrp="1"\/><\/p:cNvSpPr>/g, '<p:cNvSpPr/>'));
  const hexOf = value => [...enc.encode(JSON.stringify(value))].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  for (const path of Object.keys(legacy).filter(path => /^ppt\/tags\/opfFurnitureSlide\d+\.xml$/.test(path))) {
    legacy[path] = enc.encode(text(legacy, path).replace(/val="([0-9A-F]+)"/, (match, value) => {
      const manifest = JSON.parse(dec.decode(Uint8Array.from(value.match(/../g), byte => parseInt(byte, 16))));
      assert.ok(manifest.parts.some(part => part.ph), 'The new manifest marks its native parts.');
      for (const part of manifest.parts) delete part.ph;
      return `val="${hexOf(manifest)}"`;
    }));
  }
  const {imported, invalid} = await read(zipSync(legacy));
  assert.deepEqual(invalid, []);
  assert.deepEqual(imported.design.footer, footerOnly.design.footer);
}

console.log(`Native header/footer: ${results.length} measured/estimated exports match core at every placeholder; master, layout, notes master and flags, round trips with and without provenance, dialog edits, inherited placeholders and determinism pass.`);
