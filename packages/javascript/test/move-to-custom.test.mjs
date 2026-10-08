// FA wave C: moveToCustom, the fix opf/catalog-record-not-in-source suggests, and copySlides listing only real renames.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OPFMoveToCustomError, applyPatch, copySlides, moveToCustom, resolveReference, resolveSlideContext, validate } from '../dist/index.js';

const GALLERY = 'https://gallery.example';
const ACME = 'https://acme.example';
const scheme = (accent1) => ({ name: `Scheme ${accent1}`, accent1, accent2: '#222222', accent3: '#333333', accent4: '#444444', accent5: '#555555', accent6: '#666666', dark1: '#000000', dark2: '#111111', light1: '#FFFFFF', light2: '#EEEEEE', hyperlink: '#0000EE', followedHyperlink: '#551A8B' });
const layout = (name) => ({ name, placeholders: [{ type: 'title' }] });
const gallery = { source: GALLERY, layouts: { 'two-column': layout('Two column') } };
const base = (catalogs, slides) => ({ $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Move', catalogs, slides });
const notInSource = (document, catalogs) => validate(document, { only: ['references'], catalogs }).findings.filter((finding) => finding.ruleId === 'opf/catalog-record-not-in-source');

test('moveToCustom moves a default record into custom, rewrites nothing that already resolves, and clears the finding', () => {
  const document = base({ default: { source: GALLERY, layouts: { 'my-special': layout('Mine') } } }, [{ layout: 'my-special', title: 'A' }, { layout: 'my-special', title: 'B' }]);
  assert.equal(notInSource(document, [gallery]).length, 1);
  const result = moveToCustom(document, { kind: 'layouts', reference: 'my-special' }, { catalogs: [gallery] });
  assert.deepEqual(result.from, { kind: 'layouts', group: 'default', id: 'my-special', reference: 'my-special' });
  assert.deepEqual(result.to, { kind: 'layouts', group: 'custom', id: 'my-special', reference: 'my-special' });
  assert.deepEqual(result.document.catalogs, { default: { source: GALLERY }, custom: { layouts: { 'my-special': layout('Mine') } } });
  // The bare references already resolve in custom first: none is rewritten.
  assert.deepEqual(result.references, []);
  assert.deepEqual(notInSource(result.document, [gallery]), []);
  assert.equal(resolveSlideContext(result.document, 0, { catalogs: [gallery] }).resolved.provenance.layout.group, 'custom');
  assert.deepEqual(applyPatch(document, result.patch), result.document);
  assert.equal(document.catalogs.default.layouts['my-special'].name, 'Mine', 'the input is not mutated');
});

test('moveToCustom from a named group rewrites name:id references, keeps the record\'s own references and renames on conflict', () => {
  const document = base(
    {
      acme: { source: ACME, themes: { hero: { name: 'Hero', colorScheme: 'brand' } }, colorSchemes: { brand: scheme('#123456') } },
      custom: { themes: { hero: { name: 'Our hero' } } },
    },
    [{ title: 'A', design: { theme: 'acme:hero' } }, { title: 'B', design: { theme: 'hero' } }],
  );
  const result = moveToCustom(document, { kind: 'themes', reference: 'acme:hero' });
  assert.deepEqual(result.to, { kind: 'themes', group: 'custom', id: 'hero-2', reference: 'hero-2' });
  // The moved theme's colour scheme still names acme's record, now from custom.
  assert.deepEqual(result.document.catalogs.custom.themes['hero-2'], { name: 'Hero', colorScheme: 'acme:brand' });
  assert.deepEqual(result.document.catalogs.acme, { source: ACME, colorSchemes: { brand: scheme('#123456') } });
  assert.equal(result.document.slides[0].design.theme, 'hero-2');
  assert.equal(result.document.slides[1].design.theme, 'hero', 'a reference to the other record is untouched');
  assert.deepEqual(result.references, ['/slides/0/design/theme']);
  assert.equal(resolveReference(result.document, 'colorSchemes', 'acme:brand').record.accent1, '#123456');
  assert.deepEqual(applyPatch(document, result.patch), result.document);
  assert.equal(validate(result.document, { only: ['format', 'references'] }).valid, true);
});

test('moveToCustom reuses an identical custom record and refuses what it cannot move', () => {
  const document = base({ acme: { source: ACME, layouts: { same: layout('Same') } }, custom: { layouts: { same: layout('Same') } } }, [{ layout: 'acme:same', title: 'A' }]);
  const result = moveToCustom(document, { kind: 'layouts', reference: 'acme:same' });
  assert.equal(result.to.id, 'same');
  assert.deepEqual(result.document.catalogs, { acme: { source: ACME }, custom: { layouts: { same: layout('Same') } } });
  assert.equal(result.document.slides[0].layout, 'same');
  assert.deepEqual(applyPatch(document, result.patch), result.document);
  const code = (call) => { try { call(); } catch (error) { return error instanceof OPFMoveToCustomError ? error.code : String(error); } return 'no error'; };
  assert.equal(code(() => moveToCustom(document, { kind: 'layouts', reference: 'same' })), 'not-embedded');
  assert.equal(code(() => moveToCustom(document, { kind: 'layouts', reference: 'custom:same' })), 'already-custom');
  assert.equal(code(() => moveToCustom(document, { kind: 'layouts', reference: 'Not An Id' })), 'invalid-reference');
  assert.equal(code(() => moveToCustom(document, { kind: 'widgets', reference: 'same' })), 'invalid-reference');
});

test('copySlides lists a rename only when it creates a record under a new id, not when a later copy reuses it', () => {
  const from = base({ custom: { layouts: { mine: layout('From source') } } }, [{ layout: 'mine', title: 'Copied' }]);
  const to = base({ custom: { layouts: { mine: layout('Target own') } } }, [{ title: 'Target' }]);
  const first = copySlides(from, to, [0]);
  assert.deepEqual(first.renamed, [{ kind: 'layouts', from: 'mine', to: 'mine-2', reason: 'custom-conflict' }]);
  const second = copySlides(from, first.document, [0]);
  assert.deepEqual(second.renamed, [], 'the second copy reuses mine-2: not a rename');
  assert.equal(second.document.slides[2].layout, 'mine-2');
  assert.deepEqual(Object.keys(second.document.catalogs.custom.layouts), ['mine', 'mine-2']);
  // In one call, the same slide twice: one rename.
  assert.equal(copySlides(from, to, [0, 0]).renamed.length, 1);
});

test('fork: moveToCustom with an id copies the record into custom under that id and removes the original once unreferenced', () => {
  const document = base(
    { default: { source: GALLERY, layouts: { 'two-column': layout('Two column'), kept: layout('Kept') } } },
    [{ layout: 'two-column', title: 'A' }, { layout: 'kept', title: 'B' }],
  );
  const result = moveToCustom(document, { kind: 'layouts', reference: 'two-column' }, { id: 'our-two-column', catalogs: [gallery] });
  assert.deepEqual(result.to, { kind: 'layouts', group: 'custom', id: 'our-two-column', reference: 'our-two-column' });
  assert.deepEqual(result.document.catalogs, { default: { source: GALLERY, layouts: { kept: layout('Kept') } }, custom: { layouts: { 'our-two-column': layout('Two column') } } });
  assert.equal(result.document.slides[0].layout, 'our-two-column');
  assert.equal(result.document.slides[1].layout, 'kept');
  assert.deepEqual(result.references, ['/slides/0/layout']);
  assert.deepEqual(applyPatch(document, result.patch), result.document);
  const code = (call) => { try { call(); } catch (error) { return error instanceof OPFMoveToCustomError ? error.code : String(error); } return 'no error'; };
  const taken = { ...document, catalogs: { ...document.catalogs, custom: { layouts: { mine: layout('Other') } } } };
  assert.equal(code(() => moveToCustom(taken, { kind: 'layouts', reference: 'two-column' }, { id: 'mine' })), 'id-taken');
  assert.equal(code(() => moveToCustom(document, { kind: 'layouts', reference: 'two-column' }, { id: 'Not An Id' })), 'invalid-id');
});
