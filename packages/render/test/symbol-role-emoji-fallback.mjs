// Two preview/export parity gaps (opf-pptx#169). (1) A symbol-encoded family (Wingdings, Symbol, Webdings) named as a font-scheme role
// keeps its name through slide binding, so the script-font planner maps the private-use codes through the symbol table and draws the
// open symbol glyphs, as it does for a symbol run; the role used to resolve to the open symbol face, which dropped the encoding and made
// toSvg throw missing-glyph. (2) The emoji fallback has a second designated face, the monochrome Noto Emoji, so a host with only
// @expo-google-fonts/noto-emoji installed previews and exports emoji instead of throwing missing-glyph; the colour face stays first.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {toPng, toSvg} from '../dist/index.js';
import {loadFonts} from '../dist/fonts-node.js';
import {designatedFamilies, glyphFallbackFamilies, mapSymbolText as mapCodes} from '../dist/fonts.js';
const mapSymbolText = (family, text) => mapCodes(family, text).map(item => item.unicode).join('');

const require = createRequire(import.meta.url);
const deck = (title, text, design) => ({$schema: 'https://openpresentation.org/schema/opf/v1', name: 'symbol-role-emoji', slides: [{title, text}], ...(design ? {design} : {})});
const scheme = (heading, body) => ({fontScheme: {id: 'x', heading, body}});
const svgOf = (presentation, fonts) => { const out = toSvg(presentation, {fonts}); return Array.isArray(out) ? out.join('\n') : String(out); };
const textRuns = svg => [...svg.matchAll(/<(?:text|tspan)\b([^>]*)>([^<]*)(?=<)/g)].map(([, attributes, text]) => [/font-family="([^"]*)"/.exec(attributes)?.[1], text]);

// 1. A symbol family as a font-scheme role.
{
  const cases = [['Wingdings', ''], ['Wingdings', ''], ['Symbol', ''], ['Webdings', '']];
  for (const [family, code] of cases) for (const roles of [[family, family], [family, 'Aptos'], ['Aptos', family]]) {
    const presentation = deck(roles[0] === family ? `${code} title` : 'Title', roles[1] === family ? `${code} body` : 'Body', {...scheme(...roles)});
    const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation});
    const svg = svgOf(presentation, fonts);
    const mapped = mapSymbolText(family, code);
    assert.ok(mapped && mapped !== code, `${family} ${code.codePointAt(0).toString(16)} maps to a Unicode equivalent`);
    assert.ok(svg.includes(mapped), `${family} as ${roles.join('/')}: the mapped glyph ${mapped.codePointAt(0).toString(16)} is drawn`);
    assert.ok(!textRuns(svg).some(([, text]) => /[-]/.test(text)), `${family}: no private-use code is drawn (the aria-label keeps the source text)`);
    assert.ok(!new RegExp(`font-family="[^"]*${family}`, 'i').test(svg), `${family}: the SVG never names the proprietary family`);
  }
  // The role case draws the same glyph as the run-level symbol path (a run that names the family itself).
  const check = '';
  const role = deck('Role', check, scheme('Aptos', 'Wingdings'));
  const run = deck('Run', {runs: [{text: check, fontFamily: 'Wingdings'}]}, scheme('Aptos', 'Aptos'));
  const roleFonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: role});
  const runFonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: run});
  const roleGlyphs = textRuns(svgOf(role, roleFonts)).filter(([, text]) => text.includes(mapSymbolText('Wingdings', check)));
  assert.ok(roleGlyphs.length, 'the role deck draws the mapped check mark');
  let runSvg;
  try { runSvg = svgOf(run, runFonts); } catch { runSvg = undefined; }
  if (runSvg) assert.deepEqual(roleGlyphs.map(([family]) => family), textRuns(runSvg).filter(([, text]) => text.includes(mapSymbolText('Wingdings', check))).map(([family]) => family), 'the same open face draws the glyph by role and by run');
  // Raster output paints the glyph: the page differs from the same deck without it.
  const blank = deck('Role', ' ', scheme('Aptos', 'Wingdings'));
  assert.notDeepEqual(await toPng(svgOf(role, roleFonts), {fonts: roleFonts}), await toPng(svgOf(blank, roleFonts), {fonts: roleFonts}), 'the raster draws the symbol glyph');
  // A deck that names no symbol family resolves its roles exactly as before: the role still resolves to the replacement face.
  const plain = deck('Plain', 'Plain', scheme('Segoe UI Semibold', 'Aptos'));
  const plainSvg = svgOf(plain, await loadFonts({pack: 'office', substitutionPolicy: 'visual', presentation: plain}));
  assert.ok(!/wingdings|symbol/i.test(plainSvg));
}

// 2. The second designated emoji face.
assert.deepEqual(designatedFamilies('Zsye'), ['Noto Color Emoji', 'Noto Emoji']);
assert.deepEqual(designatedFamilies('Zsye', true), ['Noto Color Emoji', 'Noto Emoji']);
const chain = glyphFallbackFamilies('\u{1F680}', {});
assert.equal(chain.indexOf('Noto Emoji'), chain.indexOf('Noto Color Emoji') + 1, 'the monochrome face directly follows the colour face');
{
  const rocket = '\u{1F680}';
  const presentation = deck(`Go ${rocket}`, `Launch ${rocket}`);
  const monochrome = require.resolve('@expo-google-fonts/noto-emoji/400Regular/NotoEmoji_400Regular.ttf');
  const colour = require.resolve('@expo-google-fonts/noto-color-emoji/400Regular/NotoColorEmoji_400Regular.ttf');
  const face = (path, family) => ({path, family, weight: 400, italic: false, scripts: ['Zsye'], fallbackOnly: true});
  const emojiFamilies = svg => [...new Set(textRuns(svg).filter(([, text]) => text.includes(rocket)).map(([family]) => family.split(',')[0].trim()))];
  // Only the monochrome face is loaded (the colour package is not installed): the emoji is drawn with it, in preview and raster export.
  const only = await loadFonts({pack: 'office', substitutionPolicy: 'visual', faces: [face(monochrome, 'Noto Emoji')]});
  assert.deepEqual(emojiFamilies(svgOf(presentation, only)), ['Noto Emoji']);
  const blank = deck('Go', 'Launch');
  const emojiPng = await toPng(svgOf(presentation, only), {fonts: only});
  assert.notDeepEqual(emojiPng, await toPng(svgOf(blank, only), {fonts: only}), 'the raster paints the monochrome emoji');
  assert.deepEqual(await toPng(svgOf(presentation, only), {fonts: only}), emojiPng, 'deterministic raster');
  // Both faces loaded: the colour face stays first.
  const both = await loadFonts({pack: 'office', substitutionPolicy: 'visual', faces: [face(colour, 'Noto Color Emoji'), face(monochrome, 'Noto Emoji')]});
  assert.deepEqual(emojiFamilies(svgOf(presentation, both)), ['Noto Color Emoji']);
  // Installed packages through scripts: 'auto' (both are devDependencies here): the colour face.
  const auto = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation});
  assert.deepEqual(emojiFamilies(svgOf(presentation, auto)), ['Noto Color Emoji']);
}
console.log('Symbol role and emoji fallback passed: symbol-encoded font-scheme roles map their codes, and Noto Emoji backs up Noto Color Emoji.');
