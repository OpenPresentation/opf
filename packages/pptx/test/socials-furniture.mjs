import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {attachFurnitureFields} from '../dist/furniture-fields.js';
import {validatePresentation, catalogs, schemas} from '@openpresentation/opf';
import {resolvePresentation} from '@openpresentation/opf-render';

// Generated socials furniture: every line is native text linked to its profile
// URL, and re-import rebuilds organization.socials from the current lines.
const enc = new TextEncoder(), dec = new TextDecoder();
const organization = {id: 'acme', name: 'Acme', socials: {linkedin: 'acme', x: '@acme', bluesky: 'https://bsky.app/profile/acme.bsky.social', custom: 'Visit us', legacy: 'http://acme.example/profile'}};
const source = {organization, design: {footer: {left: {organization: true}, right: {socials: true}}}, slides: [{title: 'One', text: 'Body'}, {title: 'Two', text: 'Body'}]};
const read = async bytes => { const issues = []; const deck = await fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)}); assert.equal(validatePresentation(deck).valid, true); return {deck, issues}; };
const modify = (bytes, mutate) => { const entries = unzipSync(bytes); mutate(entries); return zipSync(entries); };
const slideXml = (entries, index = 1) => dec.decode(entries[`ppt/slides/slide${index}.xml`]);
const shapeText = (entries, text, replacement) => { for (const index of [1, 2]) entries[`ppt/slides/slide${index}.xml`] = enc.encode(slideXml(entries, index).replace(`<a:t>${text}</a:t>`, `<a:t>${replacement}</a:t>`)); };

const before = structuredClone(source), bytes = await toPptx(source);
assert.deepEqual(source, before, 'Export leaves the source unchanged.');
assert.deepEqual(await toPptx(source), bytes, 'Socials export is deterministic.');
const entries = unzipSync(bytes), xml = slideXml(entries), rels = dec.decode(entries['ppt/slides/_rels/slide1.xml.rels']);
const shown = ['linkedin.com/company/acme', 'x.com/acme', 'bsky.app/profile/acme.bsky.social', 'Visit us', 'http://acme.example/profile'];
for (const text of shown) assert.ok(xml.includes(`<a:t>${text}</a:t>`), text);
for (const url of ['https://linkedin.com/company/acme', 'https://x.com/acme', 'https://bsky.app/profile/acme.bsky.social', 'http://acme.example/profile'])
  assert.ok(rels.includes(`Target="${url}" TargetMode="External"`), url);
assert.equal((xml.match(/<a:hlinkClick /g) ?? []).length, 4, 'Only formatted or URL values link; raw text does not.');
assert.equal((xml.match(/hlinkClr[^>]*val="tx"/g) ?? []).length, 4, 'Links keep the furniture text colour.');
assert.equal((xml.match(/<a:rPr [^>]*u="none"[^>]*>(?:(?!<\/a:rPr>).)*<a:hlinkClick /g) ?? []).length, 4, 'Links are not underlined, matching the preview.');

// Without document provenance (FF-32), furniture alone rebuilds the socials as canonical profile URLs.
const canonicalSocials = {linkedin: 'https://linkedin.com/company/acme', x: 'https://x.com/acme',
  bluesky: 'https://bsky.app/profile/acme.bsky.social', custom: 'Visit us', legacy: 'http://acme.example/profile'};
const plain = await read(await toPptx(source, {provenance: false}));
assert.deepEqual(plain.deck.organization, {id: 'acme', name: 'Acme', socials: canonicalSocials}, 'Handles re-import as their canonical profile URLs.');
assert.deepEqual(plain.deck.design.footer, source.design.footer);
// With provenance, unedited lines keep the authored form (a handle stays a handle).
const {deck, issues} = await read(bytes);
assert.deepEqual(deck.design.footer, source.design.footer);
assert.deepEqual(deck.organization, organization, 'Unedited profile lines keep the authored socials values.');
assert.ok(issues.some(issue => issue.code === 'furniture-import-reflow'));
assert.ok(!issues.some(issue => issue.code === 'invalid-furniture-provenance'));
for (const slide of deck.slides) assert.ok(!JSON.stringify(slide.blocks ?? []).includes('x.com/acme'), 'Social lines are not duplicated as body text.');
// The re-imported deck exports the same visible profiles.
const again = unzipSync(await toPptx(deck));
for (const text of shown) assert.ok(slideXml(again).includes(`<a:t>${text}</a:t>`), text);

// Current native words win: an edited profile line becomes the new value.
const edited = await read(modify(bytes, entries => shapeText(entries, 'x.com/acme', 'x.com/acme_news')));
assert.deepEqual(edited.deck.organization.socials, {...organization.socials, x: 'https://x.com/acme_news'}, 'Only the edited line changes.');
assert.equal((await read(modify(await toPptx(source, {provenance: false}), entries => shapeText(entries, 'x.com/acme', 'x.com/acme_news')))).deck.organization.socials.x, 'https://x.com/acme_news');
// Disagreeing slides, cleared lines and unowned lines (no repeated organization
// name) fall back to ordinary current text with a specific diagnostic. Without
// provenance no socials are rebuilt; with it the stored authored socials return.
const disagreeing = entries => { entries['ppt/slides/slide2.xml'] = enc.encode(slideXml(entries, 2).replace('<a:t>x.com/acme</a:t>', '<a:t>x.com/other</a:t>')); };
const clearing = entries => shapeText(entries, 'Visit us', '');
const unnamed = {...source, design: {footer: {right: {socials: true}}}};
for (const [deckSource, mutate, pattern] of [[source, disagreeing, /social profile metadata disagrees/], [source, clearing, /social profile lines/], [unnamed, () => {}, /repeated organization name/]]) {
  const bare = await read(modify(await toPptx(deckSource, {provenance: false}), mutate));
  assert.equal(bare.deck.organization?.socials, undefined, String(pattern));
  assert.ok(bare.issues.some(issue => issue.code === 'invalid-furniture-provenance' && pattern.test(issue.message)), String(pattern));
  const stored = await read(modify(await toPptx(deckSource), mutate));
  assert.deepEqual(stored.deck.organization, organization, `stored ${pattern}`);
  assert.ok(stored.issues.some(issue => issue.code === 'invalid-furniture-provenance' && pattern.test(issue.message)), String(pattern));
  if (deckSource === unnamed) assert.ok(JSON.stringify(bare.deck.slides).includes('x.com/acme'), 'Unowned profile lines stay as current text.');
}

// Missing socials diagnose the controlling path; strict composition rejects them.
const missing = {...source, organization: {id: 'acme', name: 'Acme'}}, diagnostics = [];
await toPptx(missing, {onDiagnostic: issue => diagnostics.push(issue)});
assert.ok(diagnostics.some(issue => issue.code === 'unresolved-content' && issue.path === 'design.footer.right.socials'));

// Every bundled platform exports its own example handle as a linked profile URL.
for (const platform of catalogs.socialPlatforms) {
  const platformDeck = {...source, organization: {id: 'acme', name: 'Acme', socials: {[platform.id]: platform.handleExample}}, slides: [{text: 'Body'}]};
  assert.equal((await read(await toPptx(platformDeck))).deck.organization.socials[platform.id], platform.handleExample, platform.id);
  const one = await toPptx(platformDeck, {provenance: false});
  const {deck: back} = await read(one);
  assert.match(back.organization.socials[platform.id], /^https:\/\//, platform.id);
  assert.ok(dec.decode(unzipSync(one)['ppt/slides/_rels/slide1.xml.rels']).includes(`Target="${back.organization.socials[platform.id].replace(/&/g, '&amp;')}"`), platform.id);
}
// Export resolves socialPlatforms records exactly like the opf-render preview:
// inline records, then the document source (catalogSources), injected catalogs, bundled.
const record = (id, url) => ({$schema: 'https://openpresentation.org/schema/opf-social-platform/v1', id, name: id, profileUrlPattern: url, handlePrefix: '@'});
const sourced = {...source, catalogs: {socialPlatforms: {source: 'https://example.test/socials.json'}}, slides: [{text: 'Body'}]};
const hosts = [
  [{}, 'x.com/acme'],
  [{catalogs: {socialPlatforms: [record('x', 'https://injected.test/{handle}')]}}, 'injected.test/acme'],
  [{catalogs: {socialPlatforms: [record('x', 'https://injected.test/{handle}')]}, catalogSources: {'https://example.test/socials.json': {records: [record('x', 'https://sourced.test/{handle}')]}}}, 'sourced.test/acme'],
];
// CI links opf-render#34 or later, which passes socials records to core.
const previewText = (deck, host) => resolvePresentation(deck, host).slides[0].geometry.furniture.parts.find(part => part.field === 'socials').text.split('\n')[1];
for (const [host, expected] of hosts) for (const deck of [sourced, {...sourced, catalogs: {socialPlatforms: {source: sourced.catalogs.socialPlatforms.source, records: [record('x', 'https://inline.test/{handle}')]}}}]) {
  const want = deck.catalogs.socialPlatforms.records ? 'inline.test/acme' : expected;
  assert.equal(previewText(deck, host), want, 'preview');
  const hostBytes = await toPptx(deck, host);
  assert.ok(slideXml(unzipSync(hostBytes)).includes(`<a:t>${want}</a:t>`), `export ${want}`);
  // Given the export's host catalogs, re-import recognizes the unedited line and
  // restores the authored handle; without them the line keeps its visible URL.
  const back = await fromPptx(hostBytes, host);
  assert.equal(validatePresentation(back).valid, true);
  assert.deepEqual(back.organization.socials, organization.socials, `authored socials with host catalogs (${want})`);
  const withoutHost = (await read(hostBytes)).deck.organization.socials;
  assert.equal(withoutHost.x, want === 'x.com/acme' || want === 'inline.test/acme' ? '@acme' : `https://${want}`, `without host catalogs (${want})`);
}

// Every platform key the Socials schema accepts re-imports; the provenance check uses the schema pattern itself.
const keyPattern = new RegExp(schemas.presentation.$defs.Socials.propertyNames.pattern, 'u');
assert.equal(keyPattern.test('my_site'), false, 'Underscored keys are not valid Socials keys.');
const keyed = {...source, organization: {id: 'acme', name: 'Acme', socials: {'my-site2': 'Visit us', x9: '@acme'}}, slides: [{text: 'Body'}]};
assert.deepEqual((await read(await toPptx(keyed, {provenance: false}))).deck.organization.socials, {'my-site2': 'Visit us', x9: '@acme'});

// FF-27 + FF-34: one footer with a live slide-number field and linked socials in
// the same zone exports <a:fld type="slidenum"> and <a:hlinkClick> side by side and
// re-imports both, with and without FF-32 document provenance.
const mixed = {organization: {id: 'acme', name: 'Acme', socials: {x: '@acme', custom: 'Visit us'}},
  design: {footer: {left: {organization: true, slideNumber: true, slideNumberFormat: 'Slide {current} of {total}'}, right: {socials: true, slideNumber: true}}},
  slides: [{text: 'One'}, {text: 'Two'}]};
const mixedBytes = await toPptx(mixed), mixedXml = slideXml(unzipSync(mixedBytes), 2);
assert.ok(/<a:fld [^>]*type="slidenum"[^>]*>(?:(?!<\/a:fld>).)*<a:t>2<\/a:t><\/a:fld>/.test(mixedXml), 'Live slide-number field.');
assert.ok(mixedXml.includes('<a:t>Slide </a:t>') && mixedXml.includes('<a:t> of 2</a:t>'), 'Fixed text around the field.');
assert.ok(/<a:hlinkClick [^>]*>(?:(?!<\/a:r>).)*<\/a:rPr><a:t>x\.com\/acme<\/a:t>/.test(mixedXml), 'Linked profile line.');
assert.ok(mixedXml.includes('<a:t>Visit us</a:t>'));
for (const provenance of [true, false]) {
  const {deck: back, issues: mixedIssues} = await read(await toPptx(mixed, provenance ? {} : {provenance: false}));
  assert.deepEqual(back.design.footer, mixed.design.footer, `footer, provenance ${provenance}`);
  assert.deepEqual(back.organization.socials, provenance ? mixed.organization.socials : {x: 'https://x.com/acme', custom: 'Visit us'});
  assert.ok(!mixedIssues.some(issue => issue.code === 'invalid-furniture-provenance'), JSON.stringify(mixedIssues));
}
// A single line that is both linked and holds a field keeps the link on every run
// and on the field: attachFurnitureFields reuses the line's run properties.
const linkedRun = '<a:rPr lang="en-US" dirty="0"><a:hlinkClick r:id="rId9"/></a:rPr>';
const fieldEntries = {'ppt/slides/slide1.xml': new TextEncoder().encode(`<p:sld><p:sp><p:nvSpPr><p:cNvPr id="2" name="OPF furniture 0 part 0 line 0"/></p:nvSpPr><p:txBody><a:p><a:r>${linkedRun}<a:t>Page 3</a:t></a:r></a:p></p:txBody></p:sp></p:sld>`)};
attachFurnitureFields(fieldEntries, new Map([['OPF furniture 0 part 0 line 0', {text: 'Page 3', fields: [{type: 'slideNumber', start: 5, end: 6, nativeType: 'slidenum'}]}]]));
const combined = dec.decode(fieldEntries['ppt/slides/slide1.xml']);
assert.ok(combined.includes(`<a:r>${linkedRun}<a:t>Page </a:t></a:r>`) && combined.includes(`type="slidenum">${linkedRun}<a:t>3</a:t></a:fld>`), combined);

console.log(`Socials furniture passed: linked profile lines, canonical re-import, edits, disagreement, orphan and ${catalogs.socialPlatforms.length} bundled platforms.`);
