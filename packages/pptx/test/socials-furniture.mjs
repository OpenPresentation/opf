import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {attachFurnitureFields} from '../dist/furniture-fields.js';
import {validate, schemas} from '@openpresentation/opf';
import {SOCIAL_PLATFORMS} from '@openpresentation/opf/composition';
import {resolvePresentation} from '@openpresentation/opf-render';
import {readFile} from 'node:fs/promises';
import {editEverywhere, shownXml, slideParts} from './helpers/master-furniture.mjs';

// Generated socials furniture: every line is native text linked to its profile
// URL, and re-import rebuilds organization.socials from the current lines.
const enc = new TextEncoder(), dec = new TextDecoder();
const organization = {id: 'acme', name: 'Acme', socials: {linkedin: 'acme', x: '@acme', bluesky: 'https://bsky.app/profile/acme.bsky.social', threads: 'Visit us', mastodon: 'http://acme.example/profile'}};
const source = {organization, design: {footer: {left: {text: '{{organization.name}}'}, right: {socials: true}}}, slides: [{title: 'One', text: 'Body'}, {title: 'Two', text: 'Body'}]};
const read = async bytes => { const issues = []; const deck = await fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)}); assert.equal(validate(deck, {only: ['format']}).valid, true); return {deck, issues}; };
const modify = (bytes, mutate) => { const entries = unzipSync(bytes); mutate(entries); return zipSync(entries); };
const slideXml = (entries, index = 1) => dec.decode(entries[`ppt/slides/slide${index}.xml`]);
// RR-72: lines drawn the same on both slides are written once, on the slide master; an edit there is every slide's.
const shapeText = (entries, text, replacement) => editEverywhere(entries, xml => xml.replace(`<a:t>${text}</a:t>`, `<a:t>${replacement}</a:t>`));
// The slide's relationships with its layout's and master's (lifted furniture links to its URLs from there).
const shownRels = (entries, number = 1) => Object.values(slideParts(entries, number)).filter(Boolean).map(path => dec.decode(entries[path.replace(/([^/]+)$/, '_rels/$1.rels')] ?? new Uint8Array())).join('');
// A picture bleeding off the right edge covers the right footer zone on both slides: the socials stay shapes on each slide, drawn above
// it (furniture-on-slide), so the slides can disagree.
const photo = `data:image/png;base64,${(await readFile(new URL('fixtures/images/wide.png', import.meta.url))).toString('base64')}`;
const covered = {...source, slides: source.slides.map(slide => ({title: slide.title, blocks: [{text: 'Body'}, {image: photo, placement: {edge: 'right'}}]}))};

const before = structuredClone(source), bytes = await toPptx(source);
assert.deepEqual(source, before, 'Export leaves the source unchanged.');
assert.deepEqual(await toPptx(source), bytes, 'Socials export is deterministic.');
const entries = unzipSync(bytes), xml = shownXml(entries, 1), rels = shownRels(entries);
const shown = ['linkedin.com/company/acme', 'x.com/acme', 'bsky.app/profile/acme.bsky.social', 'Visit us', 'http://acme.example/profile'];
for (const text of shown) assert.ok(xml.includes(`<a:t>${text}</a:t>`), text);
for (const url of ['https://linkedin.com/company/acme', 'https://x.com/acme', 'https://bsky.app/profile/acme.bsky.social', 'http://acme.example/profile'])
  assert.ok(rels.includes(`Target="${url}" TargetMode="External"`), url);
assert.equal((xml.match(/<a:hlinkClick /g) ?? []).length, 4, 'Only formatted or URL values link; raw text does not.');
assert.equal((xml.match(/hlinkClr[^>]*val="tx"/g) ?? []).length, 4, 'Links keep the furniture text colour.');
assert.equal((xml.match(/<a:rPr [^>]*u="none"[^>]*>(?:(?!<\/a:rPr>).)*<a:hlinkClick /g) ?? []).length, 4, 'Links are not underlined, matching the preview.');

// FA-31: no furniture part shows the organization's name any more ({{organization.name}} is resolved before export), so the profiles
// belong to the organization the stored document record (FF-32) names by id. Without that record the lines stay ordinary current text.
// RR-72: here the lines are drawn once, on the slide master, which an import without OPF provenance does not read (a plain PowerPoint
// master); on slides they stay ordinary current text.
const plain = await read(await toPptx(source, {provenance: false}));
assert.equal(plain.deck.organization, undefined, 'No organization is rebuilt from the profile lines alone.');
assert.ok(!JSON.stringify(plain.deck).includes('x.com/acme'), 'Master lines of a file without provenance are not slide content.');
const plainCovered = await read(await toPptx(covered, {provenance: false}));
assert.equal(plainCovered.deck.organization, undefined);
assert.ok(plainCovered.issues.some(issue => issue.code === 'invalid-furniture-provenance' && /stored organization metadata/.test(issue.message)));
assert.ok(JSON.stringify(plainCovered.deck.slides).includes('x.com/acme'), 'The profile lines stay as current text.');
// With provenance, unedited lines keep the authored form (a handle stays a handle).
const {deck, issues} = await read(bytes);
assert.deepEqual(deck.design.footer, source.design.footer, 'The organization token returns (drawn from the stored organization); the generated socials return as the flag.');
assert.deepEqual(deck.organization, organization, 'Unedited profile lines keep the authored socials values.');
assert.ok(issues.some(issue => issue.code === 'furniture-import-reflow'));
assert.ok(!issues.some(issue => issue.code === 'invalid-furniture-provenance'));
for (const slide of deck.slides) assert.ok(!JSON.stringify(slide.blocks ?? []).includes('x.com/acme'), 'Social lines are not duplicated as body text.');
// The re-imported deck exports the same visible profiles.
const again = unzipSync(await toPptx(deck));
for (const text of shown) assert.ok(shownXml(again, 1).includes(`<a:t>${text}</a:t>`), text);

// Current native words win: an edited profile line becomes the new value.
const edited = await read(modify(bytes, entries => shapeText(entries, 'x.com/acme', 'x.com/acme_news')));
assert.deepEqual(edited.deck.organization.socials, {...organization.socials, x: 'https://x.com/acme_news'}, 'Only the edited line changes.');
// Disagreeing slides and cleared lines fall back to ordinary current text with a specific diagnostic; so do the lines of a file with
// no stored organization (provenance: false). With the stored record the authored organization still returns.
const disagreeing = entries => { entries['ppt/slides/slide2.xml'] = enc.encode(slideXml(entries, 2).replace('<a:t>x.com/acme</a:t>', '<a:t>x.com/other</a:t>')); };
const clearing = entries => shapeText(entries, 'Visit us', '');
for (const [mutate, barePattern, storedPattern] of [[disagreeing, /stored organization metadata/, /social profile metadata disagrees/], [clearing, /social profile lines/, /social profile lines/]]) {
  const bare = await read(modify(await toPptx(covered, {provenance: false}), mutate));
  assert.equal(bare.deck.organization?.socials, undefined, String(barePattern));
  assert.ok(bare.issues.some(issue => issue.code === 'invalid-furniture-provenance' && barePattern.test(issue.message)), String(barePattern));
  const stored = await read(modify(await toPptx(covered), mutate));
  assert.deepEqual(stored.deck.organization, organization, `stored ${storedPattern}`);
  assert.ok(stored.issues.some(issue => issue.code === 'invalid-furniture-provenance' && storedPattern.test(issue.message)), String(storedPattern));
}

// Missing socials diagnose the controlling path; strict composition rejects them.
const missing = {...source, organization: {id: 'acme', name: 'Acme'}}, diagnostics = [];
await toPptx(missing, {onDiagnostic: issue => diagnostics.push(issue)});
assert.ok(diagnostics.some(issue => issue.code === 'unresolved-content' && issue.path === 'design.footer.right.socials'));

// OPF 0.15: social platforms are an engine vocabulary (core SOCIAL_PLATFORMS), not a catalog. Every platform with a profile
// URL exports a handle as a linked profile URL, and re-import restores the authored handle with no host option.
const platforms = Object.entries(SOCIAL_PLATFORMS).filter(([, platform]) => platform.profileUrlPattern || platform.companyUrlPattern);
assert.ok(platforms.length > 5, 'core names the platforms it links');
for (const [id, platform] of platforms) {
  const handle = `${platform.handlePrefix ?? ''}acme`;
  const platformDeck = {...source, organization: {id: 'acme', name: 'Acme', socials: {[id]: handle}}, slides: [{text: 'Body'}]};
  assert.equal((await read(await toPptx(platformDeck))).deck.organization.socials[id], handle, id);
  // The linked profile URL is core's: the relationship target of the exported line is the part's own href.
  const href = resolvePresentation(platformDeck).slides[0].geometry.furniture.parts.find(part => part.field === 'socials').links[0].href;
  assert.match(href, /^https:\/\//, id);
  assert.ok(dec.decode(unzipSync(await toPptx(platformDeck, {provenance: false}))['ppt/slides/_rels/slide1.xml.rels']).includes(`Target="${href.replace(/&/g, '&amp;')}"`), id);
}
// Export formats socials exactly like the opf-render preview: both use core's vocabulary, so no host option is involved.
{
  const deck = {...source, slides: [{text: 'Body'}]};
  const previewText = resolvePresentation(deck).slides[0].geometry.furniture.parts.find(part => part.field === 'socials').text.split('\n')[1];
  assert.equal(previewText, 'x.com/acme', 'preview');
  const exported = await toPptx(deck);
  assert.ok(slideXml(unzipSync(exported)).includes(`<a:t>${previewText}</a:t>`), 'export matches the preview');
  const back = await fromPptx(exported);
  assert.deepEqual(back.organization.socials, organization.socials, 'the unedited line restores the authored handle');
  // The removed 0.14 host options change nothing (no alias): the export is the same bytes.
  assert.deepEqual(await toPptx(deck, {catalogSources: {'https://example.test/socials.json': {records: []}}}), exported);
}

// Every platform key the Socials schema accepts re-imports; the provenance check uses the schema pattern itself.
// OPF 0.15: the keys are core's vocabulary (a schema enum), not a pattern; a key outside it is invalid, not a custom platform.
const keys = schemas.presentation.$defs.Socials.propertyNames.enum;
assert.deepEqual([...keys].sort(), Object.keys(SOCIAL_PLATFORMS).sort(), 'the schema keys are core\'s platforms');
assert.equal(validate({...source, organization: {id: 'acme', name: 'Acme', socials: {'my-site2': 'Visit us'}}}, {only: ['format']}).valid, false, 'a key outside the vocabulary is invalid');
const keyed = {...source, organization: {id: 'acme', name: 'Acme', socials: {threads: 'Visit us', x: '@acme'}}, slides: [{text: 'Body'}]};
assert.deepEqual((await read(await toPptx(keyed))).deck.organization.socials, {threads: 'Visit us', x: '@acme'});

// FF-27 + FF-34: one footer with a live slide-number field and linked socials in
// the same zone exports <a:fld type="slidenum"> and <a:hlinkClick> side by side and
// re-imports both, with and without FF-32 document provenance.
const mixed = {organization: {id: 'acme', name: 'Acme', socials: {x: '@acme', threads: 'Visit us'}},
  design: {footer: {left: {text: '{{organization.name}}\nSlide {{slide.number}} of {{deck.slideCount}}'}, right: {socials: true, text: '{{slide.number}}'}}},
  slides: [{text: 'One'}, {text: 'Two'}]};
const mixedBytes = await toPptx(mixed), mixedXml = shownXml(unzipSync(mixedBytes), 2);
assert.ok(/<a:fld [^>]*type="slidenum"[^>]*>(?:(?!<\/a:fld>).)*<a:t>2<\/a:t><\/a:fld>/.test(mixedXml), 'Live slide-number field.');
assert.ok(mixedXml.includes('<a:t>Slide </a:t>') && mixedXml.includes('<a:t> of 2</a:t>'), 'Fixed text around the field.');
assert.ok(/<a:hlinkClick [^>]*>(?:(?!<\/a:r>).)*<\/a:rPr><a:t>x\.com\/acme<\/a:t>/.test(mixedXml), 'Linked profile line.');
assert.ok(mixedXml.includes('<a:t>Visit us</a:t>'));
{
  const {deck: back, issues: mixedIssues} = await read(mixedBytes);
  assert.deepEqual(back.design.footer, mixed.design.footer);
  assert.deepEqual(back.organization.socials, mixed.organization.socials);
  assert.ok(!mixedIssues.some(issue => issue.code === 'invalid-furniture-provenance'), JSON.stringify(mixedIssues));
  // Without the stored record the socials are ordinary text (see above); the slide-number fields still import as tokens in a native footer.
  // (Here the socials are the same on both slides, so they are drawn once, on the slide master, which a plain import does not read.)
  const bare = await read(await toPptx(mixed, {provenance: false}));
  assert.equal(bare.deck.organization, undefined);
  assert.ok(!JSON.stringify(bare.deck).includes('x.com/acme'));
}
// A single line that is both linked and holds a field keeps the link on every run
// and on the field: attachFurnitureFields reuses the line's run properties.
const linkedRun = '<a:rPr lang="en-US" dirty="0"><a:hlinkClick r:id="rId9"/></a:rPr>';
const fieldEntries = {'ppt/slides/slide1.xml': new TextEncoder().encode(`<p:sld><p:sp><p:nvSpPr><p:cNvPr id="2" name="OPF furniture 0 part 0 line 0"/></p:nvSpPr><p:txBody><a:p><a:r>${linkedRun}<a:t>Page 3</a:t></a:r></a:p></p:txBody></p:sp></p:sld>`)};
attachFurnitureFields(fieldEntries, new Map([['OPF furniture 0 part 0 line 0', {text: 'Page 3', fields: [{type: 'slideNumber', start: 5, end: 6, nativeType: 'slidenum'}]}]]));
const combined = dec.decode(fieldEntries['ppt/slides/slide1.xml']);
assert.ok(combined.includes(`<a:r>${linkedRun}<a:t>Page </a:t></a:r>`) && combined.includes(`type="slidenum">${linkedRun}<a:t>3</a:t></a:fld>`), combined);

console.log(`Socials furniture passed: linked profile lines, stored-organization re-import, edits, disagreement, orphan and ${platforms.length} engine platforms.`);
