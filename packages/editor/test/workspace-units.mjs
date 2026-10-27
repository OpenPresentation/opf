import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEME_TOKENS, layoutOptionsFor as publicLayoutOptionsFor, normalizeTheme, normalizeThemeTokens } from '../dist/workspace.js';
import { retainedSlideIndex } from '../dist/slide-retention.js';
import { parseSourceText, reportSource } from '../dist/workspace-source.js';
import { layoutOptionsFor, describeFontChange, fontSubstitutionNotes } from '../dist/workspace-measure.js';
import { gallery } from '@openpresentation/gallery';

// CE-06, the parts of the embeddable editor that need no browser: the theme contract against the stylesheet and its document, the slide kept by its
// id, the verdict on the text of the source pane, and the measurement helpers. test/workspace-browser.mjs mounts the whole editor.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---- the theme contract ------------------------------------------------------------------------------------------------------------------
const tokensCss = readFileSync(path.join(root, 'src', 'styles', 'tokens.css'), 'utf8');
const lightBlock = /:root,\s*\.opf-ui\s*\{([^}]*)\}/.exec(tokensCss)?.[1] ?? '';
const declared = new Set([...lightBlock.matchAll(/(--opf-ui-[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
assert.ok(declared.size >= 25, 'the light block of tokens.css was read');
assert.deepEqual([...new Set(Object.values(THEME_TOKENS))].sort(), [...declared].sort(), 'THEME_TOKENS names exactly the tokens tokens.css declares: no token is left out of the contract and none is invented');
assert.equal(new Set(Object.values(THEME_TOKENS)).size, Object.values(THEME_TOKENS).length, 'no two short names share a token');

// docs/theming.md lists every short name with its token (a contract nobody wrote down is not one).
const doc = path.join(root, 'docs', 'theming.md');
assert.ok(existsSync(doc), 'docs/theming.md documents the token contract');
const text = readFileSync(doc, 'utf8');
for (const [short, token] of Object.entries(THEME_TOKENS)) {
  assert.ok(text.includes(`\`${short}\``) && text.includes(`\`${token}\``), `docs/theming.md lists ${short} and ${token}`);
}

assert.deepEqual(normalizeThemeTokens({ accent: '#0a7', '--opf-ui-border': '#ddd', font: 'Georgia', radius: 8, text: null }), { '--opf-ui-accent': '#0a7', '--opf-ui-border': '#ddd', '--opf-ui-font': 'Georgia', '--opf-ui-radius': '8' }, 'short and full names, numbers as strings, null skipped');
assert.deepEqual(normalizeThemeTokens(undefined), {});
assert.throws(() => normalizeThemeTokens({ acent: 'red' }), /"acent" is not an editor token/);
assert.throws(() => normalizeThemeTokens({ '--other': 'red' }), /not an editor token/);
assert.throws(() => normalizeThemeTokens(['accent']), /must be an object/);
assert.deepEqual(normalizeTheme(undefined), { colorScheme: 'inherit', tokens: {}, dark: {} });
assert.deepEqual(normalizeTheme({ colorScheme: 'auto', tokens: { accent: 'red' }, dark: { background: 'black' } }), { colorScheme: 'auto', tokens: { '--opf-ui-accent': 'red' }, dark: { '--opf-ui-bg': 'black' } });
assert.throws(() => normalizeTheme({ colorScheme: 'sepia' }), /colorScheme/);
assert.throws(() => normalizeTheme('dark'), /must be an object/);

// ---- the slide kept by its id --------------------------------------------------------------------------------------------------------------
const slides = (...ids) => ids.map((id) => ({ id }));
assert.equal(retainedSlideIndex(slides('a', 'b', 'c'), slides('c', 'a', 'b'), 1), 2, 'a reorder keeps the slide by its id');
assert.equal(retainedSlideIndex(slides('a', 'b', 'c'), slides('a', 'c'), 1), 1, 'a removed slide clamps to its position');
assert.equal(retainedSlideIndex(slides('a', 'b', 'c'), slides('a'), 2), 0, 'and to the deck');
assert.equal(retainedSlideIndex([{}, {}, {}], [{}, {}], 2), 1, 'a deck without ids keeps the position, clamped');
assert.equal(retainedSlideIndex(slides('a', 'a', 'b'), slides('b', 'a', 'a'), 1), 1, 'an id that is not unique is not followed');
assert.equal(retainedSlideIndex(slides('a'), [], 0), 0, 'an empty deck gives 0');

// ---- the verdict on the source text ----------------------------------------------------------------------------------------------------------
const valid = JSON.stringify({ name: 'Ok', slides: [{ id: 'a', title: 'A' }] });
assert.deepEqual(parseSourceText('json', valid), { document: { name: 'Ok', slides: [{ id: 'a', title: 'A' }] }, message: '' });
assert.match(parseSourceText('json', '[1]').message, /JSON object/);
assert.match(parseSourceText('json', '{ nope').message, /./);
assert.match(parseSourceText('json', '{"a":1,"a":2}').message, /Duplicate key "a"/, 'a repeated key is refused, as in the pane');
assert.match(parseSourceText('yaml', 'name: [unclosed').message, /./, 'YAML that does not parse says why');
assert.equal(parseSourceText('yaml', 'name: Deck\nslides:\n  - title: One\n').document.name, 'Deck');
assert.equal(parseSourceText('md', '---\nname: Deck\n---\n\n# One\n').document.name, 'Deck');

const ok = reportSource('json', valid, { catalogs: [gallery] });
assert.equal(ok.valid, true);
assert.deepEqual(ok.status, { kind: 'valid', warnings: 0 });
const invalid = reportSource('json', JSON.stringify({ name: 'Bad', slides: 'nope' }));
assert.equal(invalid.valid, false);
assert.equal(invalid.status.kind, 'invalid');
assert.ok(invalid.status.errors >= 1 && invalid.findings.length >= 1);
const syntax = reportSource('json', '{ nope');
assert.equal(syntax.status.kind, 'syntax');
assert.equal(syntax.status.format, 'json');
assert.equal(syntax.valid, false);
const warned = reportSource('json', JSON.stringify({ name: 'W', slides: [{ id: 'a', layout: 'no-such-layout', title: 'A' }] }));
assert.equal(warned.status.kind, 'valid');
assert.ok(warned.status.warnings >= 1, 'a reference that resolves nowhere is a warning, not an error');

// ---- measurement and font notes -------------------------------------------------------------------------------------------------------------
assert.equal(publicLayoutOptionsFor, layoutOptionsFor, 'the public ./workspace entry exports the helper the playground example imports');
assert.deepEqual(layoutOptionsFor(undefined, {}, 0, []), {}, 'no fonts handle: nothing to measure with');
const plain = { textMeasurement: () => ({ width: 1, height: 1 }) };
assert.deepEqual(layoutOptionsFor({ registry: {} }, {}, 0, []), { fonts: { registry: {} } }, 'a handle without a measurement is passed through');
assert.equal(typeof layoutOptionsFor(plain, { slides: [{ title: 'x' }] }, 0, [gallery]).fonts, 'object');
// The script planner comes with the handle's measurement (the renderer's registry has `forScripts`): it is asked for this deck's scripts.
const asked = [];
const planned = { measure: () => ({ width: 1 }), forScripts: (profile) => { asked.push(profile); return { planned: true }; } };
assert.deepEqual(layoutOptionsFor({ textMeasurement: planned }, { slides: [{ title: 'x' }] }, 0, [gallery]), { fonts: { textMeasurement: { planned: true } } });
assert.equal(asked.length, 1, 'forScripts is asked once, with the resolved script fonts of the slide');
const noPlanner = { textMeasurement: { measure: () => ({ width: 1 }) } };
assert.deepEqual(layoutOptionsFor(noPlanner, { slides: [{ title: 'x' }] }, 0, [gallery]), { fonts: noPlanner }, 'a measurement without a planner is passed through');
{
  // With the renderer's real handle the options measure exactly as the renderer's own createScriptTextMeasurement does.
  const { loadFonts } = await import('@openpresentation/opf-render/fonts-node');
  const { createScriptTextMeasurement } = await import('@openpresentation/opf-render/fonts');
  const { resolveScriptFonts } = await import('@openpresentation/opf/composition');
  const real = await loadFonts({ pack: 'office' });
  const text = 'Héllo Wörld, Ελληνικά — mixed';
  const greek = { name: 'G', language: 'el-GR', slides: [{ title: text }] };
  const options = layoutOptionsFor(real, greek, 0, [gallery]);
  const reference = createScriptTextMeasurement(real.textMeasurement, resolveScriptFonts(greek, { slideIndex: 0, catalogs: [gallery] }));
  const style = { fontFamily: 'Roboto', fontWeight: 400 };
  assert.notEqual(options.fonts.textMeasurement, real.textMeasurement, 'the measurement is planned for the slide');
  assert.equal(options.fonts.textMeasurement.measure(text, 24, style), reference.measure(text, 24, style), 'the same widths as createScriptTextMeasurement');
  assert.ok(options.fonts.textMeasurement.measure(text, 24, style) > 0);
}
assert.match(describeFontChange({ requestedFamily: 'Calibri', resolvedFamily: 'Carlito', compatibility: 'metric', resolvedWeight: 400 }), /Calibri → Carlito · Metric substitute/);
assert.match(describeFontChange({ requestedFamily: 'Roboto', resolvedFamily: 'Roboto', requestedWeight: 500, resolvedWeight: 400 }), /that weight is not available/);
assert.deepEqual(fontSubstitutionNotes({ substitutions: [
  { requestedFamily: 'Calibri', requestedWeight: 400, italic: false, resolvedFamily: 'Carlito', resolvedWeight: 400, compatibility: 'metric' },
  { requestedFamily: 'Calibri', requestedWeight: 400, italic: false, resolvedFamily: 'Carlito', resolvedWeight: 400, compatibility: 'metric' },
] }).length, 1, 'one note per requested face');
assert.deepEqual(fontSubstitutionNotes(undefined), []);

console.log('workspace unit checks passed');
