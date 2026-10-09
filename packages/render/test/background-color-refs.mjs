// Slide backgrounds (solid, gradient stops, pattern colours) accept ColorRef: a hex value, a `var:` variable, or a colour scheme
// slot or role. The colour scheme comes from the gallery snapshot, which the test registers as a host does (FA-23).
import assert from 'node:assert/strict';
import {toSvg as render} from '../dist/svg.js';
import {defaultCatalog} from '@openpresentation/opf/catalog';

const toSvg = (deck, index, options = {}) => render(deck, index, {catalogs: [defaultCatalog], ...options});
// --- SolidBackground / GradientBackground / PatternBackground accept ColorRef ---
const scheme = defaultCatalog.colorSchemes['forest-green'];
const withBackground = (background, extra = {}) => ({
  name: 'x',
  variables: {brand: '#FF0000'},
  design: {colorScheme: 'forest-green', background},
  slides: [{title: 'T', text: 'b'}],
  ...extra
});
const firstRect = svg => svg.match(/<rect[^>]*fill="([^"]+)"/)?.[1];
const solid = color => firstRect(toSvg(withBackground({type: 'solid', color}), 1));
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
assert.equal(firstRect(toSvg(withBackground({type: 'solid', color: 'not-a-colour'}), 1, {validate: false})), '#FFFFFF');
// The resolved fill also decides light/dark text defaults.
const darkText = toSvg(withBackground({type: 'solid', color: 'var:brand'}, {variables: {brand: '#000000'}}), 1);
assert.equal(firstRect(darkText), '#000000');
assert.ok(darkText.includes(`fill="${scheme.light1.toUpperCase()}"`), 'dark variable background gets light text');

const gradient = toSvg(withBackground({type: 'gradient', gradient: {angle: 90, stops: [
  {position: 0, color: 'var:brand'}, {position: 0.5, color: 'accent2'}, {position: 1, color: '#00FF00'}]}}), 1);
assert.deepEqual([...gradient.matchAll(/<stop[^>]*stop-color="([^"]+)"/g)].map(match => match[1]), ['#FF0000', scheme.accent2.toUpperCase(), '#00FF00']);

const pattern = toSvg(withBackground({type: 'pattern', pattern: {preset: 'pct5', foregroundColor: 'var:brand', backgroundColor: 'accent2'}}), 1);
assert.ok(pattern.includes(`fill="${scheme.accent2.toUpperCase()}"`), 'pattern background resolves a scheme slot');
assert.ok(pattern.includes('fill="#FF0000"'), 'pattern foreground resolves a variable');
// A dark var:/slot background chooses the same default text as the equivalent literal (whole SVG identical).
assert.equal(darkText, toSvg(withBackground({type: 'solid', color: '#000000'}), 1));
const patternWith = color => toSvg(withBackground({type: 'pattern', pattern: {preset: 'pct5', foregroundColor: '#FFFFFF', backgroundColor: color}}, {variables: {night: '#0F172A'}}), 1);
assert.equal(patternWith('var:night'), patternWith('#0F172A'), 'dark pattern background via var: matches the literal');
assert.ok(patternWith('var:night').includes(`fill="${scheme.light1.toUpperCase()}"`), 'dark pattern background gets light text');
// A pattern background naming the text role paints the same colour that decided the default text (resolved once), not the final text colour.
const textRole = toSvg(withBackground({type: 'pattern', pattern: {preset: 'pct5', foregroundColor: '#FFFFFF', backgroundColor: 'text'}}), 1);
assert.equal(firstRect(textRole), scheme.dark1.toUpperCase(), 'pattern background text role resolves to its scheme slot');
assert.ok(textRole.includes(`<text`) && !new RegExp(`<text[^>]*fill="${scheme.dark1.toUpperCase()}"`).test(textRole), 'text is not painted in the pattern background colour');
// Roles resolve through the colour scheme only: on a dark background the text role is the scheme's dark1, not the contrast text.
const darkPattern = toSvg(withBackground({type: 'pattern', pattern: {preset: 'pct5', foregroundColor: 'text', backgroundColor: 'var:night'}}, {variables: {night: '#0F172A'}}), 1);
// RR-07: pct5 is core's 8 x 8 bitmap, a path of unit squares in the foreground colour (it was a hand-drawn circle).
assert.ok(darkPattern.includes(`fill="${scheme.dark1.toUpperCase()}"`) && /<path d="[^"]*" fill="#[0-9A-F]{6}" shape-rendering="crispEdges"/.test(darkPattern));
assert.equal(darkPattern.match(/<path d="[^"]*" fill="([^"]+)" shape-rendering="crispEdges"/)[1], scheme.dark1.toUpperCase(), 'pattern foreground text role is the scheme dark1');
const textStop = toSvg(withBackground({type: 'gradient', gradient: {angle: 0, stops: [{position: 0, color: 'text'}, {position: 1, color: 'surface'}]}}), 1);
assert.deepEqual([...textStop.matchAll(/stop-color="([^"]+)"/g)].map(match => match[1]), [scheme.dark1.toUpperCase(), scheme.light2.toUpperCase()]);
console.log('ColorRef backgrounds passed.');
