// RR-97: an imageResolver that throws for an image it cannot read (the CLI's does, with its AssetError) is an unresolved image,
// not a failed export: one `unresolved-asset` warning (reason `resolver-failed`) carrying the resolver's message and "left out",
// the picture's own fallback (a background keeps the slide's resolved background fill) and a package with no dangling
// relationship and no picture without bytes. `strictAssets` still fails with `missing-asset`.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {strFromU8, unzipSync} from 'fflate';
import {gallery as defaultCatalog} from '@openpresentation/gallery';
import {toPptx, OPFPptxError} from '../dist/index.js';

const png = new Uint8Array(await readFile(new URL('fixtures/images/wide.png', import.meta.url)));
const MISSING = './assets/bluewater-logistics-field-photo.jpg';
const text = 'Image "./assets/bluewater-logistics-field-photo.jpg" was not read: no such file under /deck. Fix the path, embed the image as a data URI, or pass --asset-dir.';
class AssetError extends Error { code = 'asset-unresolved'; }
const resolver = async src => {
  if (src === MISSING) throw new AssetError(text);
  if (src === 'ok.png') return {data: png, mediaType: 'image/png'};
  return null;
};

// A structural package check: every relationship target exists, every r:id / r:embed / r:link in a part is declared in its
// .rels, no blip is empty, and no media part is left without a relationship.
function checkPackage(entries, label) {
  const targets = new Set();
  const names = Object.keys(entries);
  for (const rels of names.filter(name => name.endsWith('.rels'))) {
    const base = rels === '_rels/.rels' ? '' : path.posix.dirname(path.posix.dirname(rels));
    const xml = strFromU8(entries[rels]);
    const ids = new Set();
    for (const [, tag] of xml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
      const id = /\bId="([^"]*)"/.exec(tag)?.[1], target = /\bTarget="([^"]*)"/.exec(tag)?.[1];
      assert.ok(id && target, `${label}: ${rels} has a relationship without Id or Target`);
      assert.ok(!ids.has(id), `${label}: ${rels} repeats ${id}`);
      ids.add(id);
      if (/TargetMode="External"/.test(tag)) continue;
      const resolved = path.posix.normalize(target.startsWith('/') ? target.slice(1) : path.posix.join(base, target));
      assert.ok(entries[resolved], `${label}: ${rels} ${id} points at missing ${resolved}`);
      targets.add(resolved);
    }
    const part = rels === '_rels/.rels' ? undefined : path.posix.join(base, path.posix.basename(rels, '.rels'));
    if (part && entries[part]) {
      const body = strFromU8(entries[part]);
      for (const [, id] of body.matchAll(/\br:(?:id|embed|link|pict)="([^"]*)"/g)) assert.ok(ids.has(id), `${label}: ${part} uses undeclared ${id}`);
    }
  }
  for (const name of names.filter(name => name.endsWith('.xml') && /^ppt\/(slides|slideLayouts|slideMasters)\//.test(name))) {
    const body = strFromU8(entries[name]);
    for (const [blip] of body.matchAll(/<a:blip\b[^>]*>/g)) assert.match(blip, /\br:embed="[^"]+"/, `${label}: ${name} has an empty blip`);
    for (const [pic] of body.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)) assert.match(pic, /<a:blip\b[^>]*\br:embed="[^"]+"/, `${label}: ${name} has a picture without bytes`);
    for (const [fill] of body.matchAll(/<a:blipFill\b[\s\S]*?<\/a:blipFill>/g)) assert.match(fill, /\br:embed="[^"]+"/, `${label}: ${name} has an empty blipFill`);
  }
  for (const name of names.filter(name => name.startsWith('ppt/media/'))) assert.ok(targets.has(name), `${label}: ${name} is not referenced`);
}

async function run(deck, options = {}) {
  const diagnostics = [];
  const bytes = await toPptx(structuredClone(deck), {imageResolver: resolver, catalogs: [defaultCatalog], onDiagnostic: issue => diagnostics.push(issue), ...options});
  return {bytes, entries: unzipSync(bytes), diagnostics};
}
const unresolved = diagnostics => diagnostics.filter(issue => issue.code === 'unresolved-asset');
const light = {type: 'solid', color: '#FFFFFF'};
let checks = 0;

// Every picture use: one warning at its path, the resolver's message, "left out", a valid package.
const uses = [
  ['slides.0.image', {slides: [{title: 'Image', image: MISSING}]}, /Image unavailable/],
  ['slides.0.quote.photo', {slides: [{quote: {text: 'Ship it.', attribution: 'Priya Raman', photo: {src: MISSING, alt: 'Priya Raman'}}}]}, /Image unavailable/],
  ['slides.0.design.background', {slides: [{title: 'Background', design: {background: {type: 'image', src: MISSING}}}]}],
  ['slides.0.design.background', {slides: [{title: 'Background', design: {background: {type: 'image', src: MISSING, alt: 'A harbour at dawn'}}}]}],
  ['design.background', {design: {background: {type: 'image', src: MISSING}}, slides: [{title: 'Background'}]}],
  ['design.watermark', {design: {watermark: {src: MISSING, opacity: 0.2}}, slides: [{title: 'Watermark'}]}],
  ['organization.logo', {organization: {id: 'acme', name: 'Acme', role: 'primary', logo: MISSING}, design: {background: light}, slides: [{title: 'Cover', layout: 'cover'}]}, /Image unavailable/],
  ['design.footer.left.image', {design: {footer: {left: {image: MISSING}}}, slides: [{title: 'Footer', text: 'Body'}]}, /Image unavailable/],
  ['organization.logo', {organization: {id: 'acme', name: 'Acme', logo: MISSING}, design: {listBullet: 'image', background: light}, slides: [{title: 'List', items: ['Alpha', 'Beta']}]}, /<a:buChar/],
];
for (const [at, deck, shows] of uses) {
  const label = `${at} (${JSON.stringify(deck).length})`;
  const {entries, diagnostics} = await run(deck);
  const found = unresolved(diagnostics);
  assert.equal(found.length, 1, `${label}: exactly one unresolved-asset, got ${JSON.stringify(found)}`);
  assert.equal(found[0].path, at, `${label}: the path`);
  assert.equal(found[0].reason, 'resolver-failed', `${label}: the reason`);
  assert.ok(found[0].message.startsWith(text), `${label}: the resolver's message is kept`);
  assert.match(found[0].message, /left out of the export/, `${label}: says the image was left out`);
  const slide = strFromU8(entries['ppt/slides/slide1.xml']);
  if (shows) assert.match(slide, shows, `${label}: the fallback is drawn`);
  checkPackage(entries, label);
  assert.equal(Object.keys(entries).filter(name => name.startsWith('ppt/media/')).length, 0, `${label}: no media part`);
  await assert.rejects(run(deck, {strictAssets: true}), error => error instanceof OPFPptxError && error.code === 'missing-asset' && error.details.reason === 'resolver-failed' && error.message === text, `${label}: strictAssets fails with missing-asset`);
  checks++;
}

// A missing background image keeps the background the slide would otherwise have: a theme variant color or the solid fill.
for (const base of [{type: 'solid', color: '#123456'}, undefined]) {
  const withImage = {slides: [{title: 'Harbour', design: {background: {type: 'image', src: MISSING}}}]};
  const without = {slides: [{title: 'Harbour'}]};
  if (base) { withImage.design = {background: base}; without.design = {background: base}; }
  const a = await run(withImage), b = await run(without);
  const bg = entries => /<p:bg>[\s\S]*?<\/p:bg>/.exec(strFromU8(entries['ppt/slides/slide1.xml']))?.[0];
  assert.ok(bg(a.entries), 'the slide has a background');
  assert.match(bg(a.entries), /<a:solidFill>/, 'the fallback background is a solid fill');
  assert.doesNotMatch(bg(a.entries), /blip/i, 'no blip in the fallback background');
  if (base) assert.equal(bg(a.entries), bg(b.entries), 'a missing background image leaves the fill the slide would have had');
  assert.equal(unresolved(a.diagnostics).length, 1);
  checkPackage(a.entries, 'background fallback');
  checks++;
}

// The variant's color is what the slide shows: a dark variant stays dark (the literal canvas color core falls back to for a picture is
// white, which sat behind the light text), whichever of the slide, the deck or an alt-text picture carries the missing image.
{
  const bg = entries => /<p:bg>[\s\S]*?<\/p:bg>/.exec(strFromU8(entries['ppt/slides/slide1.xml']))?.[0];
  const image = {type: 'image', src: MISSING}, design = {theme: 'classic', variant: 'dark1'};
  const plain = await run({design, slides: [{title: 'Dark'}]});
  assert.match(bg(plain.entries), /schemeClr val="bg1"/);
  for (const [label, deck] of [
    ['slide image', {design, slides: [{title: 'Dark', design: {background: image}}]}],
    ['slide image with alt', {design, slides: [{title: 'Dark', design: {background: {...image, alt: 'A harbour'}}}]}],
    ['deck image', {design: {...design, background: image}, slides: [{title: 'Dark'}]}],
  ]) {
    const result = await run(deck);
    assert.equal(bg(result.entries), bg(plain.entries), `${label}: the dark variant background survives`);
    assert.equal(unresolved(result.diagnostics).length, 1);
    checkPackage(result.entries, label);
  }
  // A slide picture over a deck gradient falls back to the deck's gradient.
  const gradient = {type: 'gradient', gradient: {angle: 0, stops: [{position: 0, color: '#000000'}, {position: 1, color: '#FFFFFF'}]}};
  const over = await run({design: {...design, background: gradient}, slides: [{title: 'Dark', design: {background: image}}]});
  const direct = await run({design: {...design, background: gradient}, slides: [{title: 'Dark'}]});
  assert.equal(bg(over.entries), bg(direct.entries), 'the deck gradient is the fallback');
  checks++;
}

// Several uses of one missing image: one warning each, one package.
{
  const {entries, diagnostics} = await run({design: {background: {type: 'image', src: MISSING}, watermark: {src: MISSING}}, slides: [{title: 'One', image: MISSING}, {title: 'Two', image: MISSING}]});
  assert.deepEqual(unresolved(diagnostics).map(issue => issue.path).sort(), ['design.background', 'design.background', 'design.watermark', 'design.watermark', 'slides.0.image', 'slides.1.image']);
  assert.ok(unresolved(diagnostics).every(issue => issue.reason === 'resolver-failed'));
  checkPackage(entries, 'several uses');
  checks++;
}

// A resolvable image is unchanged: the resolver's bytes export exactly as the same bytes as a data URI do, with no diagnostic.
{
  const uri = `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
  const make = src => ({slides: [{title: 'Picture', image: src, design: {background: {type: 'image', src}}}]});
  const viaResolver = await run(make('ok.png'));
  const diagnostics = [];
  const direct = unzipSync(await toPptx(make(uri), {catalogs: [defaultCatalog], onDiagnostic: issue => diagnostics.push(issue)}));
  assert.deepEqual(unresolved(viaResolver.diagnostics), []);
  assert.deepEqual(unresolved(diagnostics), []);
  assert.deepEqual(Object.keys(viaResolver.entries).sort(), Object.keys(direct).sort());
  // The provenance parts record the authored source ('ok.png' against the data URI), so they differ by design; everything drawn is the same.
  for (const name of Object.keys(direct).filter(name => !/^ppt\/tags\/|^docProps\/|^customXml\//.test(name))) assert.deepEqual(viaResolver.entries[name], direct[name], `${name} is unchanged`);
  assert.ok(Object.keys(direct).some(name => name.startsWith('ppt/media/')), 'the picture is embedded');
  checkPackage(viaResolver.entries, 'resolvable');
  checks++;
}

// Other failures keep their behavior: an OPFPptxError or an AbortError from the resolver propagates; a plain Error is a warning.
await assert.rejects(toPptx({slides: [{image: MISSING}]}, {imageResolver: () => { throw new OPFPptxError('custom', 'stop'); }}), error => error.code === 'custom');
await assert.rejects(toPptx({slides: [{image: MISSING}]}, {imageResolver: () => { throw Object.assign(new Error('cancelled'), {name: 'AbortError'}); }}), error => error.name === 'AbortError');
{
  const diagnostics = [];
  await toPptx({slides: [{image: MISSING}]}, {imageResolver: () => { throw new Error('boom'); }, onDiagnostic: issue => diagnostics.push(issue)});
  assert.match(unresolved(diagnostics)[0].message, /^boom\. The image was left out/);
  checks++;
}

console.log(`RR-97 resolver failure passed: ${checks} checks (${uses.length} picture uses, background fallback, unchanged resolvable image, strictAssets).`);
