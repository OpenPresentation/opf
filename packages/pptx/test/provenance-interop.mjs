import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {unzipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';

// Spec-gap P1 interop: a PPTX exported by this build must still import with the
// PUBLISHED importer. Importers up to 0.11.6 reject an OPF_DOCUMENT_V1 whose
// `design`/`metadata` carries a key they do not know (and an OPF_SLIDE_V1 whose
// `design` does), dropping the whole tag. The new keys therefore live under
// `supplement`, which those importers ignore. Run through `npm run test:packed`
// (needs the npm CLI and registry access).
const PUBLISHED = '0.11.6';
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run through npm run test:packed for portable npm execution.');
const consumer = await mkdtemp(path.join(tmpdir(), 'opf-pptx-interop-'));
try {
  await writeFile(path.join(consumer, 'package.json'), JSON.stringify({name: 'interop-consumer', private: true, type: 'module'}));
  execFileSync(process.execPath, [npmCli, 'install', `@openpresentation/opf-pptx@${PUBLISHED}`, '--no-audit', '--no-fund', '--ignore-scripts'], {cwd: consumer, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  const published = await import(pathToFileURL(path.join(consumer, 'node_modules/@openpresentation/opf-pptx/dist/index.js')).href);
  const dec = new TextDecoder();
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const deck = {name: 'Interop', filename: 'interop-deck', extensions: {'x-vendor': {a: 1}}, tone: 'formal', purpose: 'inform',
    organization: {id: 'acme', name: 'Acme', logo: png}, assets: {spare: png},
    design: {fontScheme: 'arial', logo: png, contentAlignment: 'center'},
    slides: [{id: 'one', layout: 'title-subtitle', title: 'One', subtitle: 'Two', section: 'Intro', extensions: {'x-s': true}, design: {logo: png, titleAlignment: 'center'}},
      {title: 'Two', section: 'Intro', blocks: [{type: 'group', id: 'g', blocks: [{type: 'text', text: 'a'}, {type: 'text', text: 'b'}]}]}]};
  const bytes = await toPptx(deck, {timestamp: '2026-01-01T00:00:00Z', seed: 1});
  const entries = unzipSync(bytes);
  const tagValue = part => JSON.parse(Buffer.from(dec.decode(entries[part]).match(/\bval="([^"]+)"/)[1], 'hex').toString('utf8'));
  const document = tagValue('ppt/tags/opfDocument.xml'), slide = tagValue('ppt/tags/opfSlide1.xml');
  assert.deepEqual(Object.keys(document.supplement), ['design', 'metadata'], 'new document keys live under supplement');
  assert.deepEqual(document.supplement.design, {logo: png});
  assert.deepEqual(Object.keys(document.supplement.metadata).sort(), ['extensions', 'filename']);
  assert.equal(document.design.logo, undefined); assert.equal(document.metadata.filename, undefined);
  assert.deepEqual(slide.supplement, {design: {logo: png}}); assert.equal(slide.design.logo, undefined);

  // The published importer keeps every value it knows; it ignores the rest without a diagnostic.
  const issues = [];
  const old = await published.fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)});
  assert.deepEqual(issues.filter(issue => /provenance|reference/.test(issue.code)), [], `published ${PUBLISHED} accepts the tags: ${JSON.stringify(issues.map(issue => issue.code))}`);
  assert.equal(old.tone, 'formal'); assert.equal(old.purpose, 'inform');
  assert.deepEqual(old.organization, {id: 'acme', name: 'Acme', logo: png});
  assert.equal(old.design.contentAlignment, 'center'); assert.equal(old.design.fontScheme, 'arial');
  assert.deepEqual(old.slides.map(item => [item.id, item.layout, item.design?.titleAlignment]), [['one', 'title-subtitle', 'center'], [undefined, undefined, undefined]]);
  assert.equal(old.filename, undefined); assert.equal(old.design.logo, undefined); assert.equal(old.slides[1].blocks[0].type, 'text', 'older importers keep flat blocks');

  // This build restores everything.
  const current = await fromPptx(bytes);
  assert.equal(current.filename, 'interop-deck'); assert.deepEqual(current.extensions, {'x-vendor': {a: 1}});
  assert.equal(current.design.logo, png); assert.equal(current.slides[0].design.logo, png);
  assert.deepEqual(current.slides.map(item => item.section), ['Intro', 'Intro']);
  assert.equal(current.slides[1].blocks[0].type, 'group');
  console.log(`Provenance interop passed: an export of this build imports with published opf-pptx ${PUBLISHED} (design references, metadata, layout intent kept; supplement ignored) and fully with this build.`);
} finally {
  await rm(consumer, {recursive: true, force: true});
}
