// RR-72: header and footer furniture written once, on the slide master or a layout (docs/native-header-footer.md, "Master furniture").
// A part with no PowerPoint placeholder that is drawn the same on two or more slides moves off the slides: onto the master when every
// slide that shows such furniture draws it, else onto one layout per distinct set (a light and a dark tone of a logo get a layout each).
// A slide that hides it uses a layout without it. RR-11's native date, footer and slide-number placeholders do not move.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unzipSync, zipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {validate} from '@openpresentation/opf';
import {toPptx, fromPptx, defaultCatalog} from './helpers/default-catalog.mjs';
import PptxGenJS from '../vendor/pptxgenjs/pptxgen.es.js';
import {lifted, relationshipPath, shownFurniture, shownFurnitureParts, slideParts} from './helpers/master-furniture.mjs';

const enc = new TextEncoder(), dec = new TextDecoder();
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const image = async name => new Uint8Array(await readFile(new URL(`./fixtures/images/${name}`, import.meta.url)));
const uri = bytes => `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
const bytes = {square: await image('square.png'), tall: await image('tall.png'), wide: await image('wide.png')};
const light = {type: 'solid', color: '#FFFFFF'}, dark = {type: 'solid', color: '#0B1220'};
const organization = {id: 'acme', name: 'Acme', role: 'primary', logo: {full: uri(bytes.wide), icon: {onLight: uri(bytes.square), onDark: uri(bytes.tall)}}};
const FIXED = {seed: 1, timestamp: '2026-01-01T00:00:00Z', date: '2026-09-10'};

const text = (entries, path) => dec.decode(entries[path]);
const same = (a, b) => Boolean(a && b) && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
const exportDeck = async (deck, options = {}) => {
  const diagnostics = [], before = structuredClone(deck);
  const output = await toPptx(deck, {...FIXED, onDiagnostic: item => diagnostics.push(item), ...options});
  assert.deepEqual(deck, before, 'Export leaves the source unchanged.');
  const entries = unzipSync(output);
  for (const [path, data] of Object.entries(entries)) if (/\.(?:xml|rels)$/.test(path)) parser.parse(dec.decode(data));
  return {bytes: output, entries, diagnostics};
};
const read = async (input, options = {}) => {
  const reports = [], imported = await fromPptx(input, {onDiagnostic: item => reports.push(item), ...options});
  assert.equal(validate(imported, {only: ['format']}).valid, true, JSON.stringify(validate(imported, {only: ['format']}).findings));
  return {imported, reports, invalid: reports.filter(item => /^invalid-.*provenance$/.test(item.code))};
};
const slideCount = entries => Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).length;
const pictures = xml => [...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)].map(match => match[0]);
const embedOf = picture => picture.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1];
const pictureBytes = (entries, path, picture) => entries[relationshipPath(entries, path, embedOf(picture))];
const placeholders = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]).filter(shape => /<p:ph type="(?:dt|ftr|sldNum)"/.test(shape));
const phTypes = xml => placeholders(xml).map(shape => shape.match(/<p:ph type="(\w+)"/)[1]).filter(type => type !== 'title');
const tagData = (entries, path) => JSON.parse(Buffer.from(text(entries, path).match(/\bval="([^"]+)"/)[1], 'hex').toString('utf8'));
const manifestOf = (entries, index) => tagData(entries, `ppt/tags/opfFurnitureSlide${index}.xml`);
const layouts = entries => Object.keys(entries).filter(path => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(path)).sort();
const automaticLayout = entries => layouts(entries).find(path => /<p:cSld[^>]*name="OPF auto"/.test(text(entries, path)));
const catalogLayoutCount = Object.keys(defaultCatalog.layouts).length;
const showMasterSp = xml => xml.match(/<p:sldLayout\b[^>]*\bshowMasterSp="([^"]*)"/)?.[1];
const mutate = (entries, edits) => {
  const copy = {...entries};
  for (const [path, change] of Object.entries(edits)) copy[path] = enc.encode(change(text(entries, path)));
  return zipSync(copy);
};
let checked = 0;

// ---- 1. One tone: the logo and the header text are drawn once, on the slide master; the slides do not repeat them. RR-11's
// placeholders stay on the slides, and Insert > Header & Footer keeps every placeholder on the master and every layout.
const oneTone = {organization, design: {background: light, header: {right: {text: 'Board review'}},
  footer: {left: {image: 'var:organization.logo.icon'}, center: {text: 'Confidential'}, right: {text: '{{slide.number}}'}}},
  slides: [{title: 'One', text: 'Body.'}, {title: 'Two', text: 'Body.'}, {title: 'Three', text: 'Body.'}]};
{
  const {entries, bytes: output, diagnostics} = await exportDeck(oneTone);
  assert.deepEqual(diagnostics.map(item => item.code), []);
  const master = text(entries, 'ppt/slideMasters/slideMaster1.xml');
  const masterPictures = pictures(master);
  assert.equal(masterPictures.length, 1, 'the master holds the logo once');
  assert.match(masterPictures[0], /name="OPF furniture footer left image"/);
  assert.ok(same(pictureBytes(entries, 'ppt/slideMasters/slideMaster1.xml', masterPictures[0]), bytes.square), 'the onLight icon');
  assert.deepEqual(lifted(master).map(shape => shape.match(/name="([^"]+)"/)[1]), ['OPF furniture header right text line 0', 'OPF furniture footer left image']);
  assert.equal(layouts(entries).length, catalogLayoutCount + 2, 'default, all reachable gallery templates and automatic layout share the master');
  assert.equal(lifted(text(entries, 'ppt/slideLayouts/slideLayout1.xml')).length, 0);
  for (let number = 1; number <= 3; number++) {
    const xml = text(entries, `ppt/slides/slide${number}.xml`);
    assert.equal(pictures(xml).length, 0, `slide ${number} does not repeat the logo`);
    assert.doesNotMatch(xml, /Board review/, `slide ${number} does not repeat the header`);
    assert.deepEqual(phTypes(xml), ['ftr', 'sldNum'], `slide ${number} keeps its native footer and slide number`);
    assert.match(xml, new RegExp(`type="slidenum"><a:rPr[^>]*>(?:(?!</a:rPr>)[\\s\\S])*</a:rPr><a:t>${number}</a:t>`), `slide ${number}: a live slide-number field`);
    assert.deepEqual(shownFurniture(entries, number).filter(shape => shape.on !== 'slide').map(shape => shape.on), ['master', 'master']);
    // Relationships the lifted shapes used are gone from the slide: no picture and no furniture tag for them.
    const rels = text(entries, `ppt/slides/_rels/slide${number}.xml.rels`);
    assert.doesNotMatch(rels, /relationships\/image"/);
    assert.equal([...rels.matchAll(/opfFurniture\d+\.xml/g)].length, 2, `slide ${number} tags only its two placeholders`);
  }
  // The master placeholders and flags (RR-11) are unchanged; the layout keeps its three placeholders.
  assert.deepEqual(phTypes(master), ['dt', 'ftr', 'sldNum']);
  assert.match(master, /<p:hf sldNum="1" hdr="0" ftr="1" dt="0"\/>/);
  assert.deepEqual(phTypes(text(entries, 'ppt/slideLayouts/slideLayout1.xml')), ['dt', 'ftr', 'sldNum']);
  // The lifted shapes carry their slot tag; the slide manifests move the parts into `shared`.
  const masterRels = text(entries, 'ppt/slideMasters/_rels/slideMaster1.xml.rels');
  const tags = [...masterRels.matchAll(/Target="\.\.\/tags\/(opfFurnitureShared\d+\.xml)"/g)].map(match => tagData(entries, `ppt/tags/${match[1]}`));
  assert.deepEqual(tags.map(tag => tag.slot).sort(), ['footer.left.image', 'header.right.text']);
  assert.ok(tags.every(tag => tag.group === undefined && tag.part === undefined), 'a shared shape names no slide');
  for (let index = 0; index < 3; index++) {
    const manifest = manifestOf(entries, index);
    assert.deepEqual(Object.keys(manifest.shared).sort(), ['footer.left.image', 'header.right.text']);
    assert.deepEqual(Object.values(manifest.shared).map(entry => entry.on), ['master', 'master']);
    assert.deepEqual(manifest.shared['footer.left.image'].image.reference, 'var:organization.logo.icon');
    assert.deepEqual(manifest.parts.map(part => part.ph), ['ftr', 'sldNum'], 'the slide parts are its placeholders');
    assert.equal(manifest.images, undefined);
  }
  // The round trip: the logo reference, the header text and the native footer return on every slide (one deck-level design).
  const {imported, invalid} = await read(output);
  assert.deepEqual(invalid, []);
  assert.deepEqual(imported.design.header, oneTone.design.header);
  assert.deepEqual(imported.design.footer, oneTone.design.footer);
  assert.ok(imported.slides.every(slide => slide.design?.footer === undefined && slide.design?.header === undefined));
  assert.deepEqual(imported.organization, organization);
  assert.ok(imported.slides.every(slide => !slide.image && !slide.blocks?.some(block => block.image)), 'no logo becomes slide content');
  assert.ok(same(await toPptx(imported, FIXED), output), 'a re-export of the import is byte-identical');
  assert.ok(same((await exportDeck(oneTone)).bytes, output), 'deterministic');
  checked++;

  // An importer that does not know `shared` (before 0.18) reads the rest of each slide's furniture without a complaint: with the
  // entries removed this build reads the same placeholders and nothing else.
  const older = {...entries};
  for (let index = 0; index < 3; index++) {
    const path = `ppt/tags/opfFurnitureSlide${index}.xml`, manifest = manifestOf(entries, index);
    delete manifest.shared;
    older[path] = enc.encode(text(entries, path).replace(/\bval="[^"]+"/, `val="${Buffer.from(JSON.stringify(manifest)).toString('hex').toUpperCase()}"`));
  }
  const view = await read(zipSync(older));
  assert.deepEqual(view.invalid, []);
  assert.deepEqual(view.imported.design.footer, {left: {}, center: {text: 'Confidential'}, right: {text: '{{slide.number}}'}});
  checked++;

  // PowerPoint edits on the master. Deleting the logo there removes it from every slide: the deck's footer loses its image (intent,
  // not damage). Replacing its picture (Change Picture) imports the new picture. Hiding background graphics on one slide removes the
  // master furniture from that slide only.
  const masterPath = 'ppt/slideMasters/slideMaster1.xml';
  const deleted = await read(mutate(entries, {[masterPath]: xml => xml.replace(/<p:pic>[\s\S]*?<\/p:pic>/, '')}));
  assert.deepEqual(deleted.invalid, []);
  assert.deepEqual(deleted.imported.design.footer, {center: {text: 'Confidential'}, right: {text: '{{slide.number}}'}});
  assert.ok(deleted.imported.slides.every(slide => slide.design?.footer === undefined));
  const replaced = await read(zipSync({...entries, [relationshipPath(entries, masterPath, embedOf(masterPictures[0]))]: bytes.wide}));
  assert.deepEqual(replaced.invalid, []);
  assert.match(replaced.imported.design.footer.left.image?.src ?? '', /^data:image\/png;base64,/, 'a replaced master picture is an ordinary image');
  const hidden = await read(mutate(entries, {'ppt/slides/slide2.xml': xml => xml.replace('<p:sld ', '<p:sld showMasterSp="0" ')}));
  assert.deepEqual(hidden.invalid, []);
  assert.deepEqual(hidden.imported.design.footer, oneTone.design.footer);
  assert.deepEqual(hidden.imported.slides[1].design.footer, {center: {text: 'Confidential'}, right: {text: '{{slide.number}}'}});
  assert.equal(hidden.imported.slides[1].design.header, false, 'the master header is hidden on that slide too');
  // A damaged tag on the master is damage: reported, and the master's current words stay the part's value.
  const damaged = await read(mutate(entries, Object.fromEntries(Object.keys(entries).filter(path => /^ppt\/tags\/opfFurnitureShared\d+\.xml$/.test(path) && tagData(entries, path).slot === 'header.right.text')
    .map(path => [path, xml => xml.replace(/\bval="[^"]+"/, `val="${Buffer.from(JSON.stringify({...tagData(entries, path), boundary: 'bogus'})).toString('hex').toUpperCase()}"`)]))));
  assert.ok(damaged.invalid.length > 0);
  assert.deepEqual(damaged.imported.design.header, {right: {text: 'Board review'}});
  checked++;
}

// ---- 1b. All three native placeholders beside a master logo: the live date, the footer text and the slide number stay RR-11
// placeholders on each slide (live fields, the dialog's objects); only the logo moves to the master.
{
  const deck = {organization, design: {background: light, footer: {left: {date: true, image: 'var:organization.logo.icon'}, center: {text: 'Internal'}, right: {text: 'Page {{slide.number}}'}}},
    slides: [{title: 'One', text: 'Body.'}, {title: 'Two', text: 'Body.'}]};
  const {entries, bytes: output} = await exportDeck(deck);
  const master = text(entries, 'ppt/slideMasters/slideMaster1.xml');
  assert.equal(pictures(master).length, 1);
  assert.match(master, /<p:hf sldNum="1" hdr="0" ftr="1" dt="1"\/>/);
  for (const number of [1, 2]) {
    const xml = text(entries, `ppt/slides/slide${number}.xml`);
    assert.deepEqual(phTypes(xml), ['dt', 'ftr', 'sldNum']);
    assert.match(xml, /<a:fld [^>]*type="datetime1">/, 'a live date field');
    assert.match(xml, new RegExp(`<a:t>Page </a:t></a:r><a:fld [^>]*type="slidenum">(?:(?!</a:fld>)[\\s\\S])*<a:t>${number}</a:t>`), 'Page and a live number');
    assert.equal(pictures(xml).length, 0);
  }
  const {imported, invalid} = await read(output);
  assert.deepEqual(invalid, []);
  assert.deepEqual(imported.design.footer, deck.design.footer);
  checked++;
}

// ---- 2. Light and dark slides: one layout per tone, each drawing its own icon; the master draws no logo.
{
  const deck = {organization, design: {background: light, footer: {left: {image: 'var:organization.logo.icon'}, right: {text: '{{slide.number}}'}}}, slides: [
    {title: 'Light 1', text: 'Body.'}, {title: 'Dark 1', text: 'Body.', design: {background: dark}},
    {title: 'Light 2', text: 'Body.'}, {title: 'Dark 2', text: 'Body.', design: {background: dark}}]};
  const {entries, bytes: output, diagnostics} = await exportDeck(deck);
  assert.deepEqual(diagnostics.map(item => item.code), []);
  assert.equal(pictures(text(entries, 'ppt/slideMasters/slideMaster1.xml')).length, 0, 'the logo differs by tone, so the master draws none');
  const byTone = new Map();
  for (let number = 1; number <= 4; number++) {
    const {layout} = slideParts(entries, number);
    assert.notEqual(layout, 'ppt/slideLayouts/slideLayout1.xml');
    assert.equal(pictures(text(entries, `ppt/slides/slide${number}.xml`)).length, 0, `slide ${number} does not repeat the logo`);
    const [picture] = pictures(text(entries, layout));
    assert.ok(same(pictureBytes(entries, layout, picture), number % 2 ? bytes.square : bytes.tall), `slide ${number}'s layout draws its tone`);
    byTone.set(number % 2, [...(byTone.get(number % 2) ?? []), layout]);
    assert.deepEqual(phTypes(text(entries, layout)), ['dt', 'ftr', 'sldNum'], 'a furniture layout keeps the native placeholders');
    assert.match(text(entries, layout), /<p:hf sldNum="1" hdr="0" ftr="0" dt="0"\/>/);
    assert.equal(showMasterSp(text(entries, layout)), undefined);
  }
  assert.equal(new Set(byTone.get(1)).size, 1, 'the light slides share one layout');
  assert.equal(new Set(byTone.get(0)).size, 1, 'the dark slides share one layout');
  assert.equal(layouts(entries).length, catalogLayoutCount + 4);
  // Every layout is listed on the master with a unique id, and has its content type.
  const master = text(entries, 'ppt/slideMasters/slideMaster1.xml'), types = text(entries, '[Content_Types].xml');
  const ids = [...master.matchAll(/<p:sldLayoutId id="(\d+)"/g)].map(match => match[1]);
  assert.equal(ids.length, catalogLayoutCount + 4); assert.equal(new Set(ids).size, ids.length);
  for (const layout of layouts(entries)) assert.ok(types.includes(`PartName="/${layout}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"`));
  for (let index = 0; index < 4; index++) assert.equal(manifestOf(entries, index).shared['footer.left.image'].on, 'layout');
  // The reference returns on every slide.
  const {imported, invalid} = await read(output);
  assert.deepEqual(invalid, []);
  assert.deepEqual(imported.design.footer, deck.design.footer);
  assert.ok(imported.slides.every(slide => slide.design?.footer === undefined));
  assert.ok(same(await toPptx(imported, FIXED), output), 'a re-export of the import is byte-identical');
  checked++;

  // One dark slide among light ones: its icon is drawn on that slide only, so it stays a shape there (a layout for one slide gains
  // nothing); the light slides share the master.
  const single = {...deck, slides: deck.slides.slice(0, 3)};
  const one = await exportDeck(single);
  assert.equal(pictures(text(one.entries, 'ppt/slides/slide2.xml')).length, 1, 'the one dark slide keeps its own icon');
  assert.ok(same(pictureBytes(one.entries, 'ppt/slides/slide2.xml', pictures(text(one.entries, 'ppt/slides/slide2.xml'))[0]), bytes.tall));
  for (const number of [1, 3]) {
    const [shape] = shownFurnitureParts(one.entries, number).filter(item => item.xml.startsWith('<p:pic>'));
    assert.equal(shape.on, 'layout');
    assert.ok(same(pictureBytes(one.entries, shape.path, shape.xml), bytes.square));
  }
  const back = await read(one.bytes);
  assert.deepEqual(back.invalid, []);
  assert.deepEqual(back.imported.design.footer, deck.design.footer);
  assert.ok(back.imported.slides.every(slide => slide.design?.footer === undefined), 'every slide restores var:organization.logo.icon');
  checked++;
}

// ---- 3. A hidden footer: the cover hides header and footer, so it uses a layout that hides the master's furniture; a slide that hides
// only the footer keeps the master header and draws no footer.
{
  const deck = {organization, design: {background: light, header: {left: {text: 'Board review'}}, footer: {left: {image: 'var:organization.logo.icon'}, right: {text: '{{slide.number}}'}}}, slides: [
    {title: 'Cover', layout: 'cover', design: {header: false, footer: false}},
    {title: 'Two', text: 'Body.'}, {title: 'Three', text: 'Body.'}]};
  const {entries, bytes: output} = await exportDeck(deck);
  const cover = slideParts(entries, 1);
  assert.equal(showMasterSp(text(entries, cover.layout)), '0', 'the cover layout hides the master furniture');
  assert.equal(lifted(text(entries, cover.layout)).length, 0, 'and draws none of its own');
  assert.match(text(entries, cover.layout), /<p:cSld name="Cover \(no furniture\)">/);
  assert.deepEqual(shownFurniture(entries, 1), [], 'the cover shows no furniture');
  assert.deepEqual(phTypes(text(entries, cover.layout)), ['dt', 'ftr', 'sldNum'], 'Insert > Header & Footer still works on it');
  for (const number of [2, 3]) assert.equal(slideParts(entries, number).layout, automaticLayout(entries));
  assert.equal(lifted(text(entries, 'ppt/slideMasters/slideMaster1.xml')).length, 2);
  const {imported, invalid} = await read(output);
  assert.deepEqual(invalid, []);
  assert.deepEqual(imported.design.header, deck.design.header); assert.deepEqual(imported.design.footer, deck.design.footer);
  assert.equal(imported.slides[0].design.header, false); assert.equal(imported.slides[0].design.footer, false);
  checked++;

  const footerOnly = {...deck, slides: [{title: 'Footer hidden', text: 'Body.', design: {footer: false}}, ...deck.slides.slice(1)]};
  const result = await exportDeck(footerOnly);
  // The header is on all three slides (master); the logo on two (a layout), so the first slide uses the master's own layout.
  assert.equal(slideParts(result.entries, 1).layout, automaticLayout(result.entries));
  assert.deepEqual(shownFurniture(result.entries, 1).map(shape => shape.on), ['master']);
  assert.deepEqual(shownFurniture(result.entries, 2).map(shape => shape.on).sort(), ['layout', 'master', 'slide'], 'its slide number stays a placeholder on the slide');
  const back = await read(result.bytes);
  assert.deepEqual(back.invalid, []);
  assert.equal(back.imported.slides[0].design.footer, false);
  assert.deepEqual(back.imported.design.footer, deck.design.footer);
  checked++;
}

// ---- 4. A slide with its own furniture: its header differs, so it keeps that text on the slide; the shared header is on a layout and
// the logo, the same everywhere, on the master.
{
  const deck = {organization, design: {background: light, header: {right: {text: 'Board review'}}, footer: {left: {image: 'var:organization.logo.icon'}}}, slides: [
    {title: 'One', text: 'Body.'}, {title: 'Two', text: 'Body.'}, {title: 'Appendix', text: 'Body.', design: {header: {right: {text: 'Appendix'}}}}, {title: 'Four', text: 'Body.'}]};
  const {entries, bytes: output} = await exportDeck(deck);
  assert.equal(pictures(text(entries, 'ppt/slideMasters/slideMaster1.xml')).length, 1);
  assert.match(text(entries, 'ppt/slides/slide3.xml'), /<a:t>Appendix<\/a:t>/, 'the override stays on its slide');
  assert.equal(slideParts(entries, 3).layout, automaticLayout(entries));
  const shared = slideParts(entries, 1).layout;
  assert.notEqual(shared, automaticLayout(entries));
  for (const number of [1, 2, 4]) assert.equal(slideParts(entries, number).layout, shared);
  assert.match(text(entries, shared), /<a:t>Board review<\/a:t>/);
  assert.equal(manifestOf(entries, 2).shared['footer.left.image'].on, 'master');
  assert.equal(manifestOf(entries, 2).shared['header.right.text'], undefined);
  assert.equal(manifestOf(entries, 0).shared['header.right.text'].on, 'layout');
  const {imported, invalid} = await read(output);
  assert.deepEqual(invalid, []);
  assert.deepEqual(imported.design, {...imported.design, header: deck.design.header, footer: deck.design.footer});
  assert.deepEqual(imported.slides[2].design.header, {right: {text: 'Appendix'}});
  assert.ok([0, 1, 3].every(index => imported.slides[index].design?.header === undefined));
  checked++;
}

// ---- 5. Slide content over the footer: PowerPoint draws master shapes beneath slide content, so on a slide where a picture bleeds
// over the logo it stays a shape on that slide, above the picture as in the preview, with a diagnostic; the other slides share the master.
{
  const covered = {blocks: [{text: 'Body.'}, {image: uri(bytes.wide), placement: {edge: 'left'}}]};
  const deck = {organization, design: {background: light, footer: {left: {image: 'var:organization.logo.icon'}}}, slides: [{title: 'One', text: 'Body.'}, {title: 'Two', ...covered}, {title: 'Three', text: 'Body.'}]};
  const {entries, bytes: output, diagnostics} = await exportDeck(deck);
  assert.deepEqual(diagnostics.filter(item => item.code === 'furniture-on-slide').map(item => item.path), ['design.footer.left.image']);
  const slideTwo = text(entries, 'ppt/slides/slide2.xml');
  assert.equal(pictures(slideTwo).length, 2, 'the placed picture and the logo');
  assert.ok(slideTwo.lastIndexOf('<p:pic>') > slideTwo.indexOf('name="OPF image'), 'the logo is drawn after the picture');
  assert.equal(showMasterSp(text(entries, slideParts(entries, 2).layout)), '0', 'and its layout hides the master logo, so it is not drawn twice');
  for (const number of [1, 3]) assert.deepEqual(shownFurniture(entries, number).map(shape => shape.on), ['master']);
  const {imported, invalid} = await read(output);
  assert.deepEqual(invalid, []);
  assert.deepEqual(imported.design.footer, deck.design.footer);
  assert.ok(imported.slides.every(slide => slide.design?.footer === undefined));
  checked++;
}

// ---- 6. Live fields stay on each slide: a header slide number is cached per slide; a footer text with a number is RR-11's placeholder.
{
  const deck = {design: {header: {left: {text: 'Page {{slide.number}}'}, right: {text: 'Same'}}}, slides: [{title: 'One', text: 'Body.'}, {title: 'Two', text: 'Body.'}]};
  const {entries, bytes: output} = await exportDeck(deck);
  for (const number of [1, 2]) assert.match(text(entries, `ppt/slides/slide${number}.xml`), /type="slidenum"/);
  assert.deepEqual(lifted(text(entries, 'ppt/slideMasters/slideMaster1.xml')).map(shape => shape.match(/name="([^"]+)"/)[1]), ['OPF furniture header right text line 0']);
  const {imported, invalid} = await read(output);
  assert.deepEqual(invalid, []);
  assert.deepEqual(imported.design.header, deck.design.header);
  checked++;
}

// ---- 7. Third-party masters. A picture or text on a master PowerPoint (or another tool) wrote is template decoration: the importer
// does not read master or layout shapes without OPF provenance, so it is neither slide content nor header/footer furniture (as before
// RR-72). The same holds for an export without provenance: its master furniture is not read back.
{
  const native = new PptxGenJS();
  native.defineSlideMaster({title: 'BRANDED', objects: [{image: {x: .3, y: 6.8, w: .5, h: .5, data: uri(bytes.square)}}, {text: {text: 'Template footer', options: {x: 1, y: 6.9, w: 4, h: .3, fontSize: 10}}}]});
  for (const title of ['First', 'Second']) native.addSlide({masterName: 'BRANDED'}).addText(title, {x: .5, y: .4, w: 8, h: .6, fontSize: 28});
  const foreign = await native.write({outputType: 'uint8array'});
  const foreignEntries = unzipSync(foreign);
  assert.ok(Object.keys(foreignEntries).some(path => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(path) && /<p:pic>/.test(text(foreignEntries, path))), 'the fixture has a master picture');
  const {imported, reports} = await read(foreign);
  assert.equal(imported.design?.header, undefined); assert.equal(imported.design?.footer, undefined);
  assert.ok(!JSON.stringify(imported).includes('data:image/png'), 'the master picture is not imported');
  assert.ok(!JSON.stringify(imported).includes('Template footer'), 'nor the master text');
  assert.deepEqual(imported.slides.map(slide => slide.title), ['First', 'Second']);
  assert.deepEqual(reports.filter(item => /furniture/.test(item.code)), []);
  // An OPF export with every tag removed is a plain PowerPoint file: the same rule. (Furniture tags are written whatever the
  // provenance option, so `provenance: false` still reads the master furniture back; without the stored organization the logo is
  // an ordinary picture, RR-71.)
  const {entries} = await exportDeck(oneTone, {provenance: false});
  assert.equal(pictures(text(entries, 'ppt/slideMasters/slideMaster1.xml')).length, 1, 'export without provenance still writes the master logo');
  const unstored = (await read(zipSync(entries))).imported.design;
  assert.match(unstored.footer.left.image.src, /^data:image\/png;base64,/);
  assert.deepEqual(unstored.header, oneTone.design.header);
  const untagged = zipSync(Object.fromEntries(Object.entries(entries).filter(([path]) => !/^ppt\/tags\//.test(path)).map(([path, data]) => [path,
    /^ppt\/(?:slides\/slide|slideLayouts\/slideLayout|slideMasters\/slideMaster)\d+\.xml$/.test(path) ? enc.encode(dec.decode(data).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, '')) :
    /^ppt\/(?:slides|slideLayouts|slideMasters)\/_rels\//.test(path) ? enc.encode(dec.decode(data).replace(/<Relationship [^>]*relationships\/tags"[^>]*\/>/g, '')) :
    path === '[Content_Types].xml' ? enc.encode(dec.decode(data).replace(/<Override PartName="\/ppt\/tags\/[^>]*\/>/g, '')) : data])));
  const plain = await read(untagged);
  assert.ok(!JSON.stringify(plain.imported).includes('data:image/png'), 'the master logo of a plain file is not imported');
  assert.ok(!JSON.stringify(plain.imported).includes('Board review'), 'nor its master header text');
  assert.deepEqual(plain.imported.design.footer, {center: {text: 'Confidential'}, right: {text: '{{slide.number}}'}}, 'the native placeholders still import');
  checked++;
}

// ---- 8. Per-slide script fonts give a slide its own slide master (opf-pptx#168): furniture is lifted per master.
{
  const deck = {organization, language: 'ja', design: {background: light, footer: {left: {image: 'var:organization.logo.icon'}}}, slides: [
    {title: '日本語の見出し', text: 'ひらがな'}, {title: '日本語の見出し', text: 'カタカナ', design: {fontScheme: 'ms-mincho'}},
    {title: '日本語の見出し', text: 'ひらがな'}, {title: '日本語の見出し', text: 'カタカナ', design: {fontScheme: 'ms-mincho'}}]};
  const {entries, bytes: output} = await exportDeck(deck);
  const masters = Object.keys(entries).filter(path => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(path));
  assert.equal(masters.length, 2, 'the MS Mincho slides have their own slide master');
  assert.equal(slideParts(entries, 1).master, slideParts(entries, 3).master);
  assert.notEqual(slideParts(entries, 1).master, slideParts(entries, 2).master);
  for (let number = 1; number <= slideCount(entries); number++) {
    const shown = shownFurniture(entries, number);
    assert.equal(shown.length, 1, `slide ${number} shows one logo`);
    assert.notEqual(shown[0].on, 'slide');
  }
  for (const master of masters) assert.equal(pictures(text(entries, master)).length, 1, `${master} draws the logo once for its slides`);
  const {imported, invalid} = await read(output);
  assert.deepEqual(invalid, []);
  assert.deepEqual(imported.design.footer, deck.design.footer);
  checked++;
}

console.log(`Master furniture passed: ${checked} groups (master logo once, an older importer's view, master edits, native date, footer and number beside it, per-tone layouts, a single dark slide, hidden footers, a slide's own header, content over the logo, live fields, third-party masters, per-script masters).`);
