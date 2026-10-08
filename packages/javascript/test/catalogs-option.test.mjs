// FA wave C: a bad `catalogs` option throws OPFCatalogsOptionError (code `invalid-catalogs`) at every entry point,
// an undeclared `name:` prefix is a format error engines reject at their format check, and /composition exports the
// picture-size reading engines need for host-resolved pictures.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { intrinsicImageAspect, intrinsicImageSize, resolveScriptFonts } from '../dist/composition.js';
import {
  OPFCatalogsOptionError, catalogRecords, copySlides, embed, fromMarkdown, paginate, resolveDesignRecords, resolveFontScheme,
  resolveReference, resolveSlideContext, stats, updateFromCatalog, validate,
} from '../dist/index.js';
import { fromYaml } from '../dist/yaml.js';

const deck = { $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Option', slides: [{ title: 'One' }] };
const bad = [{ themes: {} }, 'catalogs', null, { source: 'x' }, [{ themes: {} }], [{ source: 'x', widgets: {} }], [{ source: 'x', themes: [] }]];
const entryPoints = {
  validate: (catalogs) => validate(deck, { catalogs }),
  resolveSlideContext: (catalogs) => resolveSlideContext(deck, 0, { catalogs }),
  paginate: (catalogs) => paginate(deck, { catalogs }),
  stats: (catalogs) => stats(deck, { catalogs }),
  resolveScriptFonts: (catalogs) => resolveScriptFonts(deck, { catalogs }),
  resolveDesignRecords: (catalogs) => resolveDesignRecords(deck, 0, { catalogs }),
  resolveFontScheme: (catalogs) => resolveFontScheme(deck, 'roboto', 'design.fontScheme', { catalogs }),
  resolveReference: (catalogs) => resolveReference(deck, 'themes', 'classic', { catalogs }),
  catalogRecords: (catalogs) => catalogRecords(deck, 'themes', { catalogs }),
  embed: (catalogs) => embed(deck, { catalogs }),
  copySlides: (catalogs) => copySlides(deck, deck, [0], { catalogs }),
  updateFromCatalog: (catalogs) => updateFromCatalog(deck, catalogs),
  fromMarkdown: (catalogs) => fromMarkdown('# One\n', { catalogs }),
  fromYaml: (catalogs) => fromYaml('name: One\nslides:\n  - title: One\n', { catalogs }),
};

test('a catalogs option that is not an array of registered catalogs throws invalid-catalogs at every entry point', () => {
  for (const [name, call] of Object.entries(entryPoints)) {
    for (const value of bad) {
      // updateFromCatalog takes the catalogs positionally and has no "none registered" default.
      assert.throws(() => call(value), (error) => error instanceof OPFCatalogsOptionError && error instanceof TypeError && error.code === 'invalid-catalogs' && error.message.startsWith(`${name}:`), `${name} with ${JSON.stringify(value)}`);
    }
    assert.doesNotThrow(() => call([]), name);
  }
});

test('an undeclared catalog prefix is a format error, so a format-only check (the engines\' boundary) rejects it', () => {
  const document = { ...deck, design: { fontScheme: 'foo:x' } };
  const format = validate(document, { only: ['format'] });
  assert.equal(format.valid, false);
  assert.deepEqual(format.findings.filter((finding) => finding.severity === 'error').map(({ ruleId, category, path }) => ({ ruleId, category, path })), [{ ruleId: 'opf/undeclared-catalog', category: 'format', path: '/design/fontScheme' }]);
  // Never also an unresolved reference, and it is reported once in a full run.
  const full = validate(document);
  assert.deepEqual(full.findings.filter((finding) => /undeclared-catalog|unresolved-reference/.test(finding.ruleId)).map((finding) => finding.ruleId), ['opf/undeclared-catalog']);
  // A declared group passes the format check even when nothing is registered for it.
  assert.equal(validate({ ...document, catalogs: { foo: { source: 'https://foo.example' } } }, { only: ['format'] }).valid, true);
});

test('/composition exports the embedded-picture size reading', () => {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, 400);
  new DataView(bytes.buffer).setUint32(20, 100);
  const png = `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
  assert.equal(intrinsicImageAspect(png), 4);
  assert.equal(intrinsicImageAspect('asset:hero', { hero: { src: png } }), 4);
  assert.deepEqual(intrinsicImageSize(png), { width: 400, height: 100, svg: false });
  assert.equal(intrinsicImageAspect('https://example.com/a.png'), undefined);
});

test('an undeclared catalog group is reported once per reference path, in every mode', () => {
  const document = {
    ...deck,
    design: { theme: 'foo:t', colorScheme: { id: 'foo:c' } },
    catalogs: { custom: { themes: { mine: { name: 'Mine', fontScheme: 'foo:f' } } } },
    slides: [{ title: 'One', layout: 'foo:a', design: { theme: 'foo:t' } }, { title: 'Two', design: { theme: 'mine' } }],
  };
  const expected = ['/catalogs/custom/themes/mine/fontScheme', '/design/colorScheme/id', '/design/theme', '/slides/0/design/theme', '/slides/0/layout'];
  for (const options of [{}, { only: ['format'] }, { only: ['format', 'references'] }, { catalogs: [] }]) {
    const paths = validate(document, options).findings.filter((finding) => finding.ruleId === 'opf/undeclared-catalog').map((finding) => finding.path);
    assert.deepEqual([...paths].sort(), expected, JSON.stringify(options));
  }
  assert.deepEqual(fromYaml('name: x\ndesign:\n  theme: foo:t\nslides:\n  - title: t\n').findings.filter((finding) => finding.ruleId === 'opf/undeclared-catalog').map((finding) => finding.path), ['/design/theme']);
});
