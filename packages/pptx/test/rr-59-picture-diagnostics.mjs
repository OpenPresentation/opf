// opf-pptx#210: every picture path reports an unresolved source with exactly one `unresolved-asset` diagnostic at its path,
// so strict export (the CLI's --fail-on warning, or strictAssets here) gates it. Before the fix a quote photo exported the
// "Image unavailable" placeholder silently, a local raster file that could not be read failed the whole export
// (pptxgen-failed) on every path, and a background picture with alt text reported unreadable bytes twice.
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {strFromU8, unzipSync} from 'fflate';
import {gallery as defaultCatalog} from '@openpresentation/gallery';
import {toPptx} from '../dist/index.js';

const light = {type: 'solid', color: '#FFFFFF'};
const catalogs = [defaultCatalog];
// [path the diagnostic names, deck with the source at that path, what the slide shows instead]
const paths = src => [
  ['slides.0.image', {slides: [{title: 'Image', image: src}]}, 'placeholder'],
  ['slides.0.quote.photo', {slides: [{quote: {text: 'Ship it.', attribution: 'Priya Raman', photo: {src, alt: 'Priya Raman'}}}]}, 'placeholder'],
  ['slides.0.design.background', {slides: [{title: 'Background', design: {background: {type: 'image', src, alt: 'A harbour at dawn'}}}]}, 'no picture'],
  ['design.background', {design: {background: {type: 'image', src}}, slides: [{title: 'Background'}]}, 'no picture'],
  ['design.watermark', {design: {watermark: {src, opacity: 0.2}}, slides: [{title: 'Watermark'}]}, 'no picture'],
  ['organization.logo', {organization: {id: 'acme', name: 'Acme', role: 'primary', logo: src}, design: {background: light}, slides: [{title: 'Cover', layout: 'cover'}]}, 'placeholder'],
  ['design.footer.left.image', {design: {footer: {left: {image: src}}}, slides: [{title: 'Footer', text: 'Body'}]}, 'placeholder'],
  ['organization.logo.icon', {organization: {id: 'acme', name: 'Acme', logo: {full: 'logo.png', icon: src}}, design: {footer: {left: {image: 'var:organization.logo.icon'}}}, slides: [{title: 'Footer', text: 'Body'}]}, 'placeholder'],
  ['organization.logo', {organization: {id: 'acme', name: 'Acme', logo: src}, design: {listBullet: 'image', background: light}, slides: [{title: 'List', items: ['Alpha', 'Beta']}]}, 'character bullets'],
];

const network = globalThis.fetch;
globalThis.fetch = () => { throw Error('Network access is forbidden in the exporter.'); };
const directory = await mkdtemp(path.join(tmpdir(), 'opf-picture-paths-'));
let checks = 0;
try {
  const sources = ['https://example.invalid/missing.png', 'asset:missing', 'missing-file.png', 'data:image/png;base64,bm90LWFuLWltYWdl', 'data:image/svg+xml;base64,@@@'];
  for (const src of sources) {
    for (const [at, deck, fallback] of paths(src)) {
      const label = `${at} <- ${src}`;
      const diagnostics = [];
      const bytes = await toPptx(structuredClone(deck), {baseDir: directory, catalogs, onDiagnostic: issue => diagnostics.push(issue)});
      assert.deepEqual(diagnostics.filter(issue => issue.code === 'unresolved-asset').map(issue => issue.path), [at], `${label}: exactly one unresolved-asset`);
      // The CLI's --fail-on warning fails on any warning finding; unresolved-asset is one, so strict export fails for each path.
      assert.ok(diagnostics.some(issue => issue.code === 'unresolved-asset'), `${label}: strict export has a finding to fail on`);
      const slide = strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']);
      if (fallback === 'placeholder') assert.match(slide, /Image unavailable/, `${label}: the placeholder is drawn`);
      if (fallback === 'character bullets') assert.match(slide, /<a:buChar/, `${label}: the character bullets stay`);
      assert.doesNotMatch(slide, /<p:pic>[\s\S]*?<a:blip r:embed/, `${label}: no picture is embedded`);
      await assert.rejects(toPptx(structuredClone(deck), {baseDir: directory, catalogs, strictAssets: true}), error => ['unsupported-asset', 'missing-asset', 'unsupported-image-dimensions', 'invalid-svg-image'].includes(error.code), `${label}: strictAssets fails`);
      checks++;
    }
  }
  // A local raster that cannot be read names the cause; strictAssets keeps the specific error.
  const diagnostics = [];
  await toPptx({slides: [{quote: {text: 'Ship it.', attribution: 'Priya Raman', photo: 'missing-file.png'}}]}, {baseDir: directory, onDiagnostic: issue => diagnostics.push(issue)});
  assert.deepEqual(diagnostics.filter(issue => issue.code === 'unresolved-asset').map(({path: at, reason}) => ({path: at, reason})), [{path: 'slides.0.quote.photo', reason: 'file-unreadable'}]);
  await assert.rejects(toPptx({slides: [{image: 'missing-file.png'}]}, {baseDir: directory, strictAssets: true}), error => error.code === 'missing-asset' && error.details?.reason === 'file-unreadable');
  checks++;
} finally {
  globalThis.fetch = network;
  await rm(directory, {recursive: true, force: true});
}

console.log(`RR-59 picture diagnostics passed: ${checks} checks (10 picture paths x 5 unresolved source kinds, one unresolved-asset each, the fallback drawn, strictAssets fails).`);
