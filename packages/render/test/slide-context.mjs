// RR-55: the slide context (canvas, theme, colour scheme, font scheme and the family names) comes from core's resolveSlideContext,
// in the one order every engine uses: slide design, deck design, theme, engine default. Composition measures with the families it
// resolves: a deck with `fontScheme: 'roboto'` measures with Roboto, not with the engine default's Aptos.
// OPF 0.15 (FA-20/21/23): the renderer registers no catalog. The host passes core `Catalog[]` as `options.catalogs`; the first
// entry is the host default for bare ids, a named document group (`acme:id`) resolves only from the catalog registered for its
// `source`, and a reference that resolves nowhere falls back to core's engine defaults with one `unresolved-reference`
// diagnostic (or fails under `strictReferences`).
import assert from 'node:assert/strict';
import { resolveSlideContext } from '@openpresentation/opf';
import { ENGINE_DEFAULT_FONT_SCHEME } from '@openpresentation/opf/composition';
import * as bare from '../dist/index.js';
import { catalogs, defaultCatalog, toSvg, resolvePresentation } from './catalog-harness.mjs';

// A measurement that records the family of every style it is asked about.
const recorder = () => {
  const families = new Set();
  return {
    families,
    fonts: { textMeasurement: { measure: (text, size, style) => { families.add(style.fontFamily); return text.length * size * 0.5; }, resolveStyle: (style) => { families.add(style.fontFamily); return style; } } },
  };
};
const slide = { title: 'Quarterly operating review', text: 'Revenue grew in every region.' };
const deck = (design, extra = {}) => ({ name: 'Context', ...(design ? { design } : {}), ...extra, slides: [slide, { ...slide, id: 'second' }] });
const diagnosticsOf = (render) => { const list = []; render((item) => list.push(item)); return list; };
const GALLERY = defaultCatalog.source;

// A deck font scheme wins over the engine default; the measurement is asked about Roboto and never about Aptos.
{
  const { families, fonts } = recorder();
  toSvg(deck({ fontScheme: 'roboto' }), { fonts });
  assert.ok(families.has('Roboto'), `composition measured with Roboto: ${[...families]}`);
  assert.ok(![...families].some((family) => /^Aptos/.test(family)), `and not with Aptos: ${[...families]}`);
}
// No design at all: the engine default font scheme (ENGINE_DEFAULT_FONT_SCHEME, Aptos) is measured, with or without a catalog.
for (const render of [toSvg, bare.toSvg]) {
  const { families, fonts } = recorder();
  render(deck(undefined), { fonts });
  assert.ok(families.has(ENGINE_DEFAULT_FONT_SCHEME.minor) && families.has(ENGINE_DEFAULT_FONT_SCHEME.major), `the engine default scheme is measured: ${[...families]}`);
  assert.ok(!families.has('Roboto'));
}
// A slide font scheme beats the deck's, for that slide only.
{
  const { families, fonts } = recorder();
  const presentation = deck({ fontScheme: 'roboto' });
  presentation.slides[1].design = { fontScheme: 'georgia' };
  toSvg(presentation, 2, { fonts });
  assert.ok([...families].some((family) => /^Georgia|^Gelasio/.test(family)), `slide scheme measured: ${[...families]}`);
}

// The resolved families are what core's resolveSlideContext says for the same deck and catalogs (the renderer then applies the
// look-alike policy), and the font scheme the preview paints with is the record core resolved (records carry no id in 0.15).
{
  const presentation = deck({ fontScheme: 'roboto' });
  const context = resolveSlideContext(presentation, 0, { catalogs });
  const bound = resolvePresentation(presentation).slides[0];
  assert.equal(bound.design.fonts.heading, context.options.fontFamilies.heading);
  assert.equal(bound.design.fonts.body, context.options.fontFamilies.body);
  assert.deepEqual({ width: bound.design.dimensions.width, height: bound.design.dimensions.height }, { width: context.options.width, height: context.options.height });
  assert.deepEqual(bound.design.fontScheme, context.resolved.fontScheme);
  assert.deepEqual(bound.design.fontScheme, defaultCatalog.fontSchemes.roboto, 'the gallery roboto record');
  assert.deepEqual(context.diagnostics, []);
}

// Host catalogs reach the context. A font scheme only a registered host catalog knows resolves to its families: as a bare id when
// that catalog is the first (the host default), and as `acme:id` when the document's `acme` group names that catalog's source.
{
  const source = 'https://catalog.example/font-schemes';
  const hostCatalog = { source, fontSchemes: { 'host-serif': { name: 'Host serif', type: 'serif', major: 'Tinos', minor: 'Tinos' } } };
  const asDefault = recorder();
  toSvg(deck({ fontScheme: 'host-serif' }), { fonts: asDefault.fonts, catalogs: [hostCatalog] });
  assert.ok(asDefault.families.has('Tinos'), `a host default font scheme is measured: ${[...asDefault.families]}`);
  const named = { ...deck({ fontScheme: 'acme:host-serif' }), catalogs: { acme: { source } } };
  const sourced = recorder();
  const sourcedDiagnostics = diagnosticsOf((onDiagnostic) => toSvg(named, { fonts: sourced.fonts, catalogs: [defaultCatalog, hostCatalog], onDiagnostic }));
  assert.ok(sourced.families.has('Tinos'), `a named group's font scheme is measured: ${[...sourced.families]}`);
  assert.deepEqual(sourcedDiagnostics.filter((item) => item.code === 'unresolved-reference'), []);
  // A bare id never reaches a catalog that is registered but not the host default.
  const second = recorder();
  const secondDiagnostics = diagnosticsOf((onDiagnostic) => toSvg(deck({ fontScheme: 'host-serif' }), 1, { fonts: second.fonts, catalogs: [defaultCatalog, hostCatalog], onDiagnostic }));
  assert.ok(!second.families.has('Tinos'), `a bare id resolves in the host default only: ${[...second.families]}`);
  assert.deepEqual(secondDiagnostics.map((item) => [item.code, item.kind, item.reference, item.group, item.source]), [['unresolved-reference', 'fontSchemes', 'host-serif', 'default', GALLERY]]);
  // The named group resolves only from the catalog registered for its own source: not when that catalog is missing, and not
  // when the group names another source, even though a registered catalog holds a record with the same id.
  for (const [name, presentation, registered, groupSource] of [
    ['catalog not registered', named, [defaultCatalog], source],
    ['another source', { ...named, catalogs: { acme: { source: 'https://other.example/font-schemes' } } }, [defaultCatalog, hostCatalog], 'https://other.example/font-schemes'],
  ]) {
    const { families, fonts } = recorder();
    const diagnostics = diagnosticsOf((onDiagnostic) => toSvg(presentation, 1, { fonts, catalogs: registered, onDiagnostic }));
    assert.ok(!families.has('Tinos') && families.has(ENGINE_DEFAULT_FONT_SCHEME.minor), `${name}: the engine default is measured: ${[...families]}`);
    assert.deepEqual(diagnostics.map((item) => [item.code, item.kind, item.reference, item.path, item.group, item.source, item.fallback]), [['unresolved-reference', 'fontSchemes', 'acme:host-serif', 'design.fontScheme', 'acme', groupSource, 'engine-default']], name);
  }
}

// A reference no catalog has never throws: a font scheme, theme or colour scheme falls back to core's engine default and a layout
// to automatic composition, each with one `unresolved-reference` diagnostic that names the reference, the group and its source.
{
  const report = (presentation, index = 0) => diagnosticsOf((onDiagnostic) => toSvg(presentation, index + 1, { onDiagnostic }));
  const fields = (item) => [item.code, item.kind, item.reference, item.path, item.group, item.source, item.fallback];
  assert.deepEqual(report(deck({ fontScheme: 'no-such-scheme' })).map(fields), [['unresolved-reference', 'fontSchemes', 'no-such-scheme', 'design.fontScheme', 'default', GALLERY, 'engine-default']]);
  for (const diagnostic of report(deck({ fontScheme: 'no-such-scheme' }))) assert.match(diagnostic.message, /no-such-scheme/);
  assert.deepEqual(report(deck({ theme: 'no-such-theme' })).map(fields), [['unresolved-reference', 'themes', 'no-such-theme', 'design.theme', 'default', GALLERY, 'engine-default']]);
  assert.deepEqual(report(deck({ colorScheme: 'no-such-colors' })).map(fields), [['unresolved-reference', 'colorSchemes', 'no-such-colors', 'design.colorScheme', 'default', GALLERY, 'engine-default']]);
  const engineDefault = toSvg(deck(undefined), 1);
  assert.equal(toSvg(deck({ fontScheme: 'no-such-scheme' }), 1), engineDefault, 'an unknown font scheme draws the engine default');
  assert.equal(toSvg(deck({ theme: 'no-such-theme' }), 1), engineDefault, 'an unknown theme draws the engine default theme');
  assert.equal(toSvg(deck({ colorScheme: 'no-such-colors' }), 1), engineDefault, 'an unknown colour scheme draws the engine default colours');
  // The engine defaults are the gallery's minimal theme's draw fields with cool-horizon and Aptos.
  assert.equal(toSvg(deck({ theme: 'minimal' }), 1), engineDefault, 'the gallery minimal theme draws as the engine default');
  const unlaidOut = { ...deck(undefined), slides: [{ ...slide, layout: 'no-such-layout' }] };
  const layouts = report(unlaidOut);
  assert.equal(toSvg(unlaidOut, 1), toSvg({ ...unlaidOut, slides: [slide] }, 1), 'an unknown layout composes automatically');
  assert.deepEqual(layouts.map(fields), [['unresolved-reference', 'layouts', 'no-such-layout', 'slides.0.layout', 'default', GALLERY, 'automatic']]);
  // With no catalog registered, a gallery id is unresolved too (no source is known), and `"default": false` turns the host
  // default off for the document.
  assert.deepEqual(diagnosticsOf((onDiagnostic) => bare.toSvg(deck({ fontScheme: 'roboto' }), 1, { catalogs: [], onDiagnostic })).map(fields), [['unresolved-reference', 'fontSchemes', 'roboto', 'design.fontScheme', 'default', undefined, 'engine-default']]);
  assert.deepEqual(report({ ...deck({ fontScheme: 'roboto' }), catalogs: { default: false } }).map(fields), [['unresolved-reference', 'fontSchemes', 'roboto', 'design.fontScheme', 'default', undefined, 'engine-default']]);
}

// strictReferences: the render fails instead of falling back, with core's diagnostics.
assert.throws(() => toSvg(deck({ theme: 'no-such-theme' }), 1, { strictReferences: true }), (error) => {
  assert.ok(error instanceof bare.OPFRenderError);
  assert.equal(error.code, 'unresolved-reference');
  assert.deepEqual(error.details.diagnostics.map((item) => [item.code, item.kind, item.reference, item.path]), [['unresolved-reference', 'themes', 'no-such-theme', 'design.theme']]);
  return true;
});
assert.ok(toSvg(deck({ fontScheme: 'roboto' }), 1, { strictReferences: true }).startsWith('<svg'), 'a resolved reference renders under strictReferences');

console.log('Slide context: core resolveSlideContext supplies the font families (roboto measures with Roboto); host Catalog[] reach it (host default, named groups by source only); unresolved references fall back to the engine defaults with unresolved-reference, or fail under strictReferences.');
