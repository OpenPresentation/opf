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
  // A logo drawn on a cover (a core that composes it) is an exported media part and keeps the $opfMedia reference; an undrawn one is stored inline.
  const storedLogo = value => value === png || (value?.$opfMedia?.startsWith('ppt/media/') && value.prefix === 'data:image/png;base64,');
  assert.deepEqual(Object.keys(document.supplement.design), ['logo']); assert.ok(storedLogo(document.supplement.design.logo), 'the deck logo is stored');
  assert.deepEqual(Object.keys(document.supplement.metadata).sort(), ['extensions', 'filename']);
  assert.equal(document.design.logo, undefined); assert.equal(document.metadata.filename, undefined);
  assert.deepEqual(Object.keys(slide.supplement), ['design']); assert.ok(storedLogo(slide.supplement.design.logo), 'the slide logo is stored'); assert.equal(slide.design.logo, undefined);

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
  // Spec-gap P2: a design-fields export (cover logo, footer logo, picture bullets, accent font). Nothing new goes
  // inside a record the published importer validates strictly: OPF_LOGO_V1 is a new tag, the furniture manifest lists
  // generated logos under `logos` beside its strictly validated `parts`/`definitions`. With a core that composes the
  // fields (core 0.11.4 or the coordinated source) the export carries them; with the published core it carries none,
  // and the checks that need them are skipped.
  {
    const {resolveLogo} = await import('@openpresentation/opf/composition');
    const rich = typeof resolveLogo === 'function';
    const square = png;
    const p2 = {name: 'Interop P2', narrative: 'Why the plan works', audience: 'Executives',
      organization: {id: 'acme', name: 'Acme', role: 'primary'},
      design: {fontScheme: {id: 'aptos', accent: {family: 'Georgia'}}, logo: {default: square, icon: square}, listBullet: 'image', background: {type: 'solid', color: '#FFFFFF'},
        header: {right: {logo: true}}, footer: {left: {logo: true}, center: {text: 'Confidential'}, right: {slideNumber: true}}},
      slides: [{tag: 'Eyebrow', title: 'Cover', subtitle: 'Subtitle', layout: 'title-subtitle'},
        {title: 'Section', layout: 'section-divider', section: 'Part one'},
        {title: 'Items', items: ['Alpha', 'Beta', 'Gamma']},
        {title: 'Quote', quote: {text: 'Design is how it works.', attribution: 'Someone'}}]};
    const exported = await toPptx(p2, {timestamp: '2026-01-01T00:00:00Z', seed: 1});
    const parts = unzipSync(exported);
    const cover = dec.decode(parts['ppt/slides/slide1.xml']);
    assert.equal(/name="OPF logo"/.test(cover), rich, 'the cover logo picture exists exactly when core composes it');
    assert.equal(/<a:buBlip>/.test(dec.decode(parts['ppt/slides/slide3.xml'])), rich, 'picture bullets exist exactly when core composes them');
    const reports = [];
    const older = await published.fromPptx(exported, {onDiagnostic: issue => reports.push(issue)});
    assert.deepEqual(reports.filter(issue => /^invalid-.*provenance$|^document-provenance/.test(issue.code)), [], `published ${PUBLISHED} accepts a design-fields export: ${JSON.stringify(reports.map(issue => `${issue.code} ${issue.message}`))}`);
    assert.equal(older.narrative, 'Why the plan works'); assert.equal(older.audience, 'Executives');
    assert.deepEqual(older.design.fontScheme, {id: 'aptos', accent: {family: 'Georgia'}});
    assert.equal(older.design.listBullet, 'image');
    assert.equal(older.design.footer?.center?.text, 'Confidential'); assert.equal(older.design.footer?.right?.slideNumber, true);
    assert.equal(older.slides[0].tag, 'Eyebrow'); assert.equal(older.slides[0].title, 'Cover');
    // The published importer does not know a:buBlip bullets or the logo pictures: the entries import as text lines, the logos as ordinary pictures.
    for (const entry of ['Alpha', 'Beta', 'Gamma']) assert.ok(JSON.stringify(older.slides[2]).includes(entry), `${entry} is kept`);
    const newer = await fromPptx(exported);
    assert.deepEqual(newer.design.fontScheme, {id: 'aptos', accent: {family: 'Georgia'}});
    assert.equal(newer.design.listBullet, 'image');
    assert.deepEqual(newer.design.logo, {default: square, icon: square});
    if (rich) {
      assert.deepEqual(newer.design.footer?.left, {logo: true}); assert.deepEqual(newer.design.header?.right, {logo: true});
      assert.ok(!newer.slides[0].image && !newer.slides[0].blocks, 'the cover logo is not content');
      assert.equal(Array.isArray(newer.slides[2].items) ? newer.slides[2].items.length : newer.slides[2].blocks?.[0]?.items?.length, 3, 'picture-bullet entries import as a list');
    }
  }
  // RR-11: footer text, date and slide number are native placeholders that keep their furniture tags and the manifest's
  // part list, so the published importer reads the same footer and no placeholder text becomes slide content.
  {
    const nativeFooter = {design: {fontScheme: 'arial', footer: {left: {date: true}, center: {text: 'Native footer'}, right: {slideNumber: true}}}, slides: [{title: 'A', text: 'Body'}, {title: 'B', text: 'Body'}]};
    const exported = await toPptx(nativeFooter, {timestamp: '2026-01-01T00:00:00Z', seed: 1, date: '2026-09-10'});
    assert.ok(/<p:ph type="ftr"/.test(dec.decode(unzipSync(exported)['ppt/slides/slide1.xml'])), 'the footer text is a native placeholder');
    const reports = [];
    const older = await published.fromPptx(exported, {onDiagnostic: issue => reports.push(issue)});
    assert.deepEqual(reports.filter(issue => /^invalid-.*provenance$/.test(issue.code)), [], `published ${PUBLISHED} accepts native footer placeholders`);
    assert.deepEqual(older.design.footer, nativeFooter.design.footer);
    assert.ok(older.slides.every(slide => !JSON.stringify(slide).includes('Native footer')), 'placeholder text is not slide content');
    assert.deepEqual((await fromPptx(exported)).design.footer, nativeFooter.design.footer);
  }
  console.log(`Provenance interop passed: an export of this build imports with published opf-pptx ${PUBLISHED} (design references, metadata, layout intent kept; supplement ignored; design-fields export keeps its provenance) and fully with this build.`);
} finally {
  await rm(consumer, {recursive: true, force: true});
}
