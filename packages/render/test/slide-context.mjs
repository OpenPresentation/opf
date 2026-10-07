// RR-55: the slide context (canvas, theme, colour scheme, font scheme and the family names) comes from core's resolveSlideContext,
// in the one order every engine uses: slide design, deck design, theme, default. Composition measures with the families it
// resolves: a deck with `fontScheme: 'roboto'` measures with Roboto, not with the default scheme's Aptos.
import assert from 'node:assert/strict';
import { resolveSlideContext } from '@openpresentation/opf';
import { renderSlideSvg, renderSvg, resolvePresentation } from '../dist/index.js';

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

// A deck font scheme wins over the default; the measurement is asked about Roboto and never about Aptos.
{
  const { families, fonts } = recorder();
  renderSvg(deck({ fontScheme: 'roboto' }), { fonts });
  assert.ok(families.has('Roboto'), `composition measured with Roboto: ${[...families]}`);
  assert.ok(![...families].some((family) => /^Aptos/.test(family)), `and not with Aptos: ${[...families]}`);
}
// No design at all: the default scheme (aptos) is measured.
{
  const { families, fonts } = recorder();
  renderSvg(deck(undefined), { fonts });
  assert.ok([...families].some((family) => /^Aptos/.test(family)), `the default scheme is Aptos: ${[...families]}`);
  assert.ok(!families.has('Roboto'));
}
// A slide font scheme beats the deck's, for that slide only.
{
  const { families, fonts } = recorder();
  const presentation = deck({ fontScheme: 'roboto' });
  presentation.slides[1].design = { fontScheme: 'georgia' };
  renderSlideSvg(presentation, 1, { fonts });
  assert.ok([...families].some((family) => /^Georgia|^Gelasio/.test(family)), `slide scheme measured: ${[...families]}`);
}

// The resolved families are what core's resolveSlideContext says for the same deck (the renderer then applies the look-alike policy).
{
  const presentation = deck({ fontScheme: 'roboto' });
  const context = resolveSlideContext(presentation, 0);
  const bound = resolvePresentation(presentation).slides[0];
  assert.equal(bound.design.fonts.heading, context.options.fontFamilies.heading);
  assert.equal(bound.design.fonts.body, context.options.fontFamilies.body);
  assert.deepEqual({ width: bound.design.dimensions.width, height: bound.design.dimensions.height }, { width: context.options.width, height: context.options.height });
  assert.equal(bound.design.fontScheme.id, 'roboto');
}

// Host catalogs reach the context: a font scheme only `options.catalogs` knows resolves to its families.
{
  const record = { $schema: 'https://openpresentation.org/schema/opf-font-scheme/v1', id: 'host-serif', name: 'Host serif', type: 'serif', major: 'Tinos', minor: 'Tinos' };
  const { families, fonts } = recorder();
  renderSvg(deck({ fontScheme: 'host-serif' }), { fonts, catalogs: { fontSchemes: [record] } });
  assert.ok(families.has('Tinos'), `a host font scheme is measured: ${[...families]}`);
  // Records a catalog source names (`catalogSources`) reach it too, ahead of the host's `catalogs`.
  const source = 'https://catalog.example/font-schemes';
  const sourced = recorder();
  renderSvg({ ...deck({ fontScheme: 'host-serif' }), catalogs: { fontSchemes: { source } } }, { fonts: sourced.fonts, catalogSources: { [source]: [record] } });
  assert.ok(sourced.families.has('Tinos'), `a sourced font scheme is measured: ${[...sourced.families]}`);
}

// An id no catalog has never throws: a font scheme falls back to the default scheme with one diagnostic, a theme to `minimal`, a colour
// scheme to `cool-horizon`, a layout to none (the slide composes with no layout record); each is reported.
{
  const diagnostics = [];
  renderSlideSvg(deck({ fontScheme: 'no-such-scheme' }), 0, { onDiagnostic: (item) => diagnostics.push(item) });
  assert.deepEqual(diagnostics.map((item) => [item.code, item.path, item.id]), [['unresolved-font-scheme', 'design.fontScheme', 'no-such-scheme']]);
  const themes = [];
  assert.ok(renderSlideSvg(deck({ theme: 'no-such-theme' }), 0, { onDiagnostic: (item) => themes.push(item) }).startsWith('<svg'));
  assert.deepEqual(themes.map((item) => [item.code, item.id]), [['unresolved-theme', 'no-such-theme']]);
  const schemes = [];
  assert.equal(renderSlideSvg(deck({ colorScheme: 'no-such-colors' }), 0, { onDiagnostic: (item) => schemes.push(item) }), renderSlideSvg(deck({ colorScheme: 'cool-horizon' }), 0), 'an unknown colour scheme draws the cool-horizon colours');
  assert.deepEqual(schemes.map((item) => [item.code, item.id]), [['unresolved-color-scheme', 'no-such-colors']]);
  const unknownTheme = renderSlideSvg(deck({ theme: 'no-such-theme' }), 0);
  assert.equal(unknownTheme, renderSlideSvg(deck({ theme: 'minimal' }), 0), 'an unknown theme draws the minimal theme');
  const layouts = [];
  const unlaidOut = { ...deck(undefined), slides: [{ ...slide, layout: 'no-such-layout' }] };
  assert.equal(renderSlideSvg(unlaidOut, 0, { onDiagnostic: (item) => layouts.push(item) }), renderSlideSvg({ ...unlaidOut, slides: [slide] }, 0));
  assert.deepEqual(layouts.map((item) => [item.code, item.id, item.path]), [['unresolved-layout', 'no-such-layout', 'slides.0.layout']]);
}
console.log('Slide context: core resolveSlideContext supplies the font families (roboto measures with Roboto), host catalogs and sources reach it, unresolved ids fall back and are reported.');
