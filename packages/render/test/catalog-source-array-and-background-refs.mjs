import assert from 'node:assert/strict';
import {resolvePresentation, renderSlideSvg} from '../dist/svg.js';
import {colorSchemes} from '@openpresentation/opf';

// --- catalogs.<kind>.source as an ordered search path (CatalogEntry.source: string | string[]) ---
// First match wins, the engine default catalog is appended implicitly, engines never fetch.
const custom = {id: 'acme-theme', name: 'Acme', colorScheme: 'forest-green', fontScheme: 'aptos'};
const doc = (source, extra = {}) => ({
  name: 'x',
  design: {theme: 'acme-theme'},
  catalogs: {themes: {source}},
  slides: [{title: 'T', text: 'b'}],
  ...extra
});
const sources = {'https://acme.test/themes': [custom]};

// (a) a catalogSources record in a later entry resolves a custom id.
for (const source of [['https://remote.invalid/none', 'https://acme.test/themes'], ['https://acme.test/themes']]) {
  const svg = renderSlideSvg(doc(source), 0, {catalogSources: sources});
  assert.ok(svg.startsWith('<svg'), 'array source renders');
  assert.equal(resolvePresentation(doc(source), {catalogSources: sources}).slides[0].design.theme.id, 'acme-theme');
}
// Same id in two sources: the first match wins.
const first = {...custom, colorScheme: 'cool-horizon'};
const ordered = resolvePresentation(doc(['https://a.test/t', 'https://acme.test/themes']), {
  catalogSources: {'https://a.test/t': [first], 'https://acme.test/themes': [custom]}
}).slides[0].design.theme;
assert.equal(ordered.colorScheme, 'cool-horizon');
const reversed = resolvePresentation(doc(['https://acme.test/themes', 'https://a.test/t']), {
  catalogSources: {'https://a.test/t': [first], 'https://acme.test/themes': [custom]}
}).slides[0].design.theme;
assert.equal(reversed.colorScheme, 'forest-green');
// Non-string entries and an empty array are schema-invalid; with validation off they are ignored defensively.
assert.ok(renderSlideSvg(doc([null, 7, 'https://acme.test/themes']), 0, {catalogSources: sources, validate: false}).startsWith('<svg'));
assert.ok(renderSlideSvg(doc([]), 0, {validate: false, catalogSources: sources, catalogs: {themes: [custom]}}).startsWith('<svg'));

// (b) the bundled default prefix inside the array resolves bundled records.
const bundled = {name: 'x', design: {theme: 'classic'}, catalogs: {themes: {source: ['pkg:@openpresentation/opf/themes']}}, slides: [{title: 'T'}]};
assert.ok(renderSlideSvg(bundled, 0).startsWith('<svg'));
const gallery = {...bundled, catalogs: {themes: {source: ['https://www.pptx.gallery/themes']}}};
assert.ok(renderSlideSvg(gallery, 0).startsWith('<svg'));

// (c) an unknown remote URL in the array still renders with the bundled defaults (no fetch).
const remote = {name: 'x', catalogs: {themes: {source: ['https://unknown.invalid/themes', 'https://other.invalid/themes']}}, slides: [{title: 'T', text: 'b'}]};
assert.equal(renderSlideSvg(remote, 0), renderSlideSvg({name: 'x', slides: [{title: 'T', text: 'b'}]}, 0));
// An unresolved id never throws: the theme falls back and the render reports `unresolved-theme`.
const unresolved = [];
assert.ok(renderSlideSvg(doc(['https://unknown.invalid/themes']), 0, {onDiagnostic: item => unresolved.push(item)}).startsWith('<svg'));
assert.deepEqual(unresolved.map(item => item.code), ['unresolved-theme']);

// socialPlatforms: a custom platform from a catalogSources record in a later array entry.
const social = {
  organization: {id: 'acme', name: 'Acme', socials: {mastodon: '@acme'}},
  design: {footer: {right: {socials: true}}},
  catalogs: {socialPlatforms: {source: ['https://unknown.invalid/sp', 'https://acme.test/sp']}},
  slides: [{title: 'T', text: 'b'}]
};
const platform = {id: 'mastodon', name: 'Mastodon', profileUrlPattern: 'https://masto.test/{handle}', handlePrefix: '@'};
const socialSvg = renderSlideSvg(social, 0, {catalogSources: {'https://acme.test/sp': [platform]}});
assert.ok(socialSvg.includes('masto.test/acme'), 'array socialPlatforms source resolves the custom platform');
assert.ok(renderSlideSvg({...social, organization: {id: 'acme', name: 'Acme', socials: {x: '@acme'}}}, 0).includes('>x.com/acme<'), 'bundled platforms still resolve');

// --- SolidBackground / GradientBackground / PatternBackground accept ColorRef ---
const scheme = colorSchemes.find(entry => entry.id === 'forest-green');
const withBackground = (background, extra = {}) => ({
  name: 'x',
  variables: {brand: '#FF0000'},
  design: {colorScheme: 'forest-green', background},
  slides: [{title: 'T', text: 'b'}],
  ...extra
});
const firstRect = svg => svg.match(/<rect[^>]*fill="([^"]+)"/)?.[1];
const solid = color => firstRect(renderSlideSvg(withBackground({type: 'solid', color}), 0));
assert.equal(solid('#FF0000'), '#FF0000');
assert.equal(solid('#ff0000'), '#FF0000');
assert.equal(solid('var:brand'), '#FF0000');
assert.equal(solid('accent2'), scheme.accent2.toUpperCase());
assert.equal(solid('primary'), (scheme.primary ?? scheme.accent1).toUpperCase());
assert.equal(solid('dark1'), scheme.dark1.toUpperCase());
// Unresolvable references fall back as a bad literal does (white).
assert.equal(solid('var:missing'), '#FFFFFF');
// A value outside ColorRef is a schema error (FA-07); with validation off the preview still falls back the same way.
assert.throws(() => solid('not-a-colour'), error => error.code === 'invalid-opf');
assert.equal(firstRect(renderSlideSvg(withBackground({type: 'solid', color: 'not-a-colour'}), 0, {validate: false})), '#FFFFFF');
// The resolved fill also decides light/dark text defaults.
const darkText = renderSlideSvg(withBackground({type: 'solid', color: 'var:brand'}, {variables: {brand: '#000000'}}), 0);
assert.equal(firstRect(darkText), '#000000');
assert.ok(darkText.includes(`fill="${scheme.light1.toUpperCase()}"`), 'dark variable background gets light text');

const gradient = renderSlideSvg(withBackground({type: 'gradient', gradient: {angle: 90, stops: [
  {position: 0, color: 'var:brand'}, {position: 0.5, color: 'accent2'}, {position: 1, color: '#00FF00'}]}}), 0);
assert.deepEqual([...gradient.matchAll(/<stop[^>]*stop-color="([^"]+)"/g)].map(match => match[1]), ['#FF0000', scheme.accent2.toUpperCase(), '#00FF00']);

const pattern = renderSlideSvg(withBackground({type: 'pattern', pattern: {preset: 'pct5', foregroundColor: 'var:brand', backgroundColor: 'accent2'}}), 0);
assert.ok(pattern.includes(`fill="${scheme.accent2.toUpperCase()}"`), 'pattern background resolves a scheme slot');
assert.ok(pattern.includes('fill="#FF0000"'), 'pattern foreground resolves a variable');
// A dark var:/slot background chooses the same default text as the equivalent literal (whole SVG identical).
assert.equal(darkText, renderSlideSvg(withBackground({type: 'solid', color: '#000000'}), 0));
const patternWith = color => renderSlideSvg(withBackground({type: 'pattern', pattern: {preset: 'pct5', foregroundColor: '#FFFFFF', backgroundColor: color}}, {variables: {night: '#0F172A'}}), 0);
assert.equal(patternWith('var:night'), patternWith('#0F172A'), 'dark pattern background via var: matches the literal');
assert.ok(patternWith('var:night').includes(`fill="${scheme.light1.toUpperCase()}"`), 'dark pattern background gets light text');
// A pattern background naming the text role paints the same colour that decided the default text (resolved once), not the final text colour.
const textRole = renderSlideSvg(withBackground({type: 'pattern', pattern: {preset: 'pct5', foregroundColor: '#FFFFFF', backgroundColor: 'text'}}), 0);
assert.equal(firstRect(textRole), scheme.dark1.toUpperCase(), 'pattern background text role resolves to its scheme slot');
assert.ok(textRole.includes(`<text`) && !new RegExp(`<text[^>]*fill="${scheme.dark1.toUpperCase()}"`).test(textRole), 'text is not painted in the pattern background colour');
// Roles resolve through the colour scheme only: on a dark background the text role is the scheme's dark1, not the contrast text.
const darkPattern = renderSlideSvg(withBackground({type: 'pattern', pattern: {preset: 'pct5', foregroundColor: 'text', backgroundColor: 'var:night'}}, {variables: {night: '#0F172A'}}), 0);
// RR-07: pct5 is core's 8 x 8 bitmap, a path of unit squares in the foreground colour (it was a hand-drawn circle).
assert.ok(darkPattern.includes(`fill="${scheme.dark1.toUpperCase()}"`) && /<path d="[^"]*" fill="#[0-9A-F]{6}" shape-rendering="crispEdges"/.test(darkPattern));
assert.equal(darkPattern.match(/<path d="[^"]*" fill="([^"]+)" shape-rendering="crispEdges"/)[1], scheme.dark1.toUpperCase(), 'pattern foreground text role is the scheme dark1');
const textStop = renderSlideSvg(withBackground({type: 'gradient', gradient: {angle: 0, stops: [{position: 0, color: 'text'}, {position: 1, color: 'surface'}]}}), 0);
assert.deepEqual([...textStop.matchAll(/stop-color="([^"]+)"/g)].map(match => match[1]), [scheme.dark1.toUpperCase(), scheme.light2.toUpperCase()]);
console.log('Catalog source arrays and ColorRef backgrounds passed.');
