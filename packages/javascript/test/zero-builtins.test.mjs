// FA-21 (OPF 0.15): zero built-in records. Core resolves only what a document embeds and what a host registers; the
// pinned gallery snapshot is the opt-in @openpresentation/opf/catalog; theme, colour-scheme and font fallbacks are engine
// defaults in code; the cover rule is a record rule, not a list of ids.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { ENGINE_DEFAULT_COLOR_SCHEME, ENGINE_DEFAULT_FONT_SCHEME, ENGINE_DEFAULT_THEME, embed, resolveSlideContext, validate } from '../dist/index.js';
import { composeSlide } from '../dist/composition.js';
import { DEFAULT_CATALOG_SOURCE, defaultCatalog } from '../dist/catalog.js';

const drawn = (record, keys) => Object.fromEntries(keys.filter((key) => record[key] !== undefined).map((key) => [key, record[key]]));

describe('no built-in records', () => {
  test('a gallery id resolves only when the host registers the default catalog', () => {
    const deck = { design: { theme: 'classic' }, slides: [{ layout: 'two-column', title: 'x' }] };
    const alone = resolveSlideContext(deck, 0);
    assert.deepEqual(alone.diagnostics.map((entry) => entry.reference), ['classic', 'two-column']);
    assert.equal(alone.options.layout, undefined);
    const hosted = resolveSlideContext(deck, 0, { catalogs: [defaultCatalog] });
    assert.deepEqual(hosted.diagnostics, []);
    assert.equal(hosted.options.layout.name, defaultCatalog.layouts['two-column'].name);
    assert.equal(defaultCatalog.source, DEFAULT_CATALOG_SOURCE);
  });

  test('validate reports what no catalog defines, and nothing once the records are embedded', () => {
    const deck = { narrative: 'classic-story', design: { theme: 'classic' }, slides: [{ layout: 'two-column', title: 'x' }] };
    // RR-75: the Node build registers the default catalog unless the call names catalogs; `catalogs: []` registers none.
    const unresolved = validate(deck, { only: ['references'], catalogs: [] }).findings.filter((finding) => finding.ruleId === 'opf/unresolved-reference');
    assert.deepEqual(unresolved.map((finding) => finding.path), ['/narrative', '/design/theme', '/slides/0/layout']);
    const saved = embed(deck, { catalogs: [defaultCatalog] }).document;
    assert.deepEqual(validate(saved, { only: ['format', 'references'], catalogs: [] }).findings, []);
    // Reopened in a fresh process with no catalog registered: every referenced record is embedded exactly once.
    const reopened = JSON.parse(JSON.stringify(saved));
    assert.deepEqual(Object.keys(reopened.catalogs), ['default']);
    assert.deepEqual(Object.keys(reopened.catalogs.default.layouts), ['two-column']);
    assert.deepEqual(Object.keys(reopened.catalogs.default.themes), ['classic']);
    assert.deepEqual(resolveSlideContext(reopened, 0).diagnostics, []);
  });
});

describe('engine defaults', () => {
  const defaults = JSON.parse(readFileSync(new URL('../../../spec/reference/engine-defaults.json', import.meta.url), 'utf8'));

  test('the engine defaults are spec/reference/engine-defaults.json, compiled into code', () => {
    assert.deepEqual(ENGINE_DEFAULT_THEME, defaults.theme);
    assert.deepEqual(ENGINE_DEFAULT_COLOR_SCHEME, defaults.colorScheme);
    assert.deepEqual(ENGINE_DEFAULT_FONT_SCHEME, defaults.fontScheme);
  });

  test('they are the drawing fields of the gallery records minimal, cool-horizon and aptos', () => {
    assert.deepEqual(ENGINE_DEFAULT_THEME, drawn(defaultCatalog.themes.minimal, ['background', 'dimensions']));
    const slots = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'dark1', 'dark2', 'light1', 'light2', 'hyperlink', 'followedHyperlink'];
    assert.deepEqual(ENGINE_DEFAULT_COLOR_SCHEME, drawn(defaultCatalog.colorSchemes['cool-horizon'], slots));
    assert.deepEqual(ENGINE_DEFAULT_FONT_SCHEME, drawn(defaultCatalog.fontSchemes.aptos, ['major', 'minor', 'languageFamily']));
  });

  test('a deck that names nothing draws the same with and without the default catalog', () => {
    const deck = { slides: [{ title: 'Title', text: 'Body' }] };
    const alone = resolveSlideContext(deck, 0), hosted = resolveSlideContext({ ...deck, design: { theme: 'minimal' } }, 0, { catalogs: [defaultCatalog] });
    assert.deepEqual(alone.options.fontFamilies, hosted.options.fontFamilies);
    assert.equal(alone.options.darkBackground, hosted.options.darkBackground);
    assert.deepEqual([alone.options.width, alone.options.height], [hosted.options.width, hosted.options.height]);
    for (const slot of ['accent1', 'dark2', 'light1']) assert.equal(alone.resolved.colorScheme[slot], hosted.resolved.colorScheme[slot], slot);
  });
});

describe('the cover rule is a record rule', () => {
  const titleY = (geometry) => geometry.items.find((item) => item.field === 'title').box.y;
  const compose = (slide, layout) => composeSlide(slide, { width: 1280, height: 720, ...(layout ? { layout } : {}) });

  test('a layout whose placeholders are all headings centres a slide with no body, whatever its id', () => {
    const slide = { title: 'Cover', subtitle: 'Subtitle' };
    const headings = { name: 'Opening', placeholders: [{ type: 'title' }, { type: 'subtitle' }] };
    const centred = titleY(compose(slide, headings));
    assert.ok(centred > 720 * 0.25, `${centred}`);
    assert.equal(titleY(compose(slide)), centred, 'no layout record: the same cover');
  });

  test('a layout with a body placeholder is not a cover, even with the id title', () => {
    const slide = { title: 'Not a cover' };
    const body = { id: 'title', name: 'Title', placeholders: [{ type: 'title' }, { type: 'text' }] };
    assert.ok(titleY(compose(slide, body)) < 720 * 0.2);
    // An empty placeholder list is not a heading-only layout: the slide keeps the content origin.
    assert.ok(titleY(compose(slide, { name: 'Blank', placeholders: [] })) < 720 * 0.2);
  });
});

describe('every default-catalog layout composed bare', () => {
  test('validates and composes with a minimal document and no example additions', () => {
    for (const [id, record] of Object.entries(defaultCatalog.layouts)) {
      const deck = { slides: [{ layout: id, title: 'Title' }], catalogs: { default: { source: DEFAULT_CATALOG_SOURCE, layouts: { [id]: record } } } };
      const report = validate(deck, { only: ['format', 'references'] });
      assert.deepEqual(report.findings, [], id);
      const context = resolveSlideContext(deck, 0);
      assert.deepEqual(context.diagnostics, [], id);
      assert.doesNotThrow(() => composeSlide(deck.slides[0], context.options), id);
    }
  });
});
