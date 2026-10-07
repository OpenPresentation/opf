// RR-17 (FF-41, FF-43): every Latin family has its own fixture in the Node host. For each family the policy names, in each of the four
// styles, the Node registry (office pack, visual substitution, the gallery's fallback family) must
//   - resolve to the route family and the manifest face the fixture model says (no unintended fallback), report the tier the policy
//     declares and say `visual` for a style the route lacks (a style gap is never counted as the real face),
//   - shape probe strings at the advance the face's own file gives (fontkit, with the policy's disabled features), within 0.1 px at 40 px,
//   - put that family, weight and slope into the SVG it draws, with textLength equal to the registry's measured advance within 0.1 px, and
//   - paint through resvg with that file: the same pixels with only the route face loaded as with every face, different pixels without it.
// It writes artifacts/latin-family-hosts/node.json (per family: route, files, lazy bytes, style gaps) for the evidence behind the tracker.
import assert from 'node:assert/strict';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {create} from 'fontkit';
import {svgToPng, renderSlideSvg} from '../dist/index.js';
import {loadFonts} from '../dist/fonts-node.js';
import {ALIASES, PROBES, RUNS, STYLES, expectedFace, faceFile, familyDeck, label, latinFamilies, neededFaces, runFace} from './latin-family-fixture.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const prepared = await loadFonts({pack: 'office', substitutionPolicy: 'visual', fallbackFamily: 'Roboto'}), {registry} = prepared;
const slash = file => file.split(String.fromCharCode(92)).join('/');
const families = latinFamilies();
assert.ok(families.length >= 85, `the fixture covers ${families.length} Latin families`);
// The families the tracker lists as Latin must all be in: nothing routes to a missing face.
for (const name of ['Aptos', 'Aptos Display', 'Aptos Mono', 'Aptos Narrow', 'Aptos Serif', 'Arial', 'Calibri', 'Courier New', 'Times New Roman', 'Georgia', 'Garamond', 'Segoe UI', 'Liberation Sans', 'Liberation Serif', 'Liberation Mono', 'Raleway', 'Playfair Display', 'Source Sans Pro']) assert.ok(families.some(entry => entry.family === name), `${name} is in the fixture`);

const fontCache = new Map();
const fontOf = async face => {
  const file = path.join(root, faceFile(face));
  if (!fontCache.has(file)) fontCache.set(file, create(await readFile(file)));
  return fontCache.get(file);
};
const direct = (font, text, size, disabled) => font.layout(text, disabled ? Object.fromEntries(disabled.map(tag => [tag, false])) : undefined).positions.reduce((sum, p) => sum + p.xAdvance, 0) / font.unitsPerEm * size;
const rasterOptions = fontFiles => ({ fonts: {fontFiles, useBundledFonts: false}, scale: 0.5});
const pathOf = face => prepared.fontFiles.find(file => slash(file).endsWith(`/${slash(faceFile(face)).replace(/^node_modules\//, '')}`));
const report = [];
let styleChecks = 0, paintChecks = 0;

for (const entry of families) {
  const record = {family: entry.family, route: entry.route, tier: entry.tier, gaps: []};
  for (const [weight, italic] of STYLES) {
    const expected = expectedFace(entry, weight, italic);
    const style = {fontFamily: entry.family, fontWeight: weight, italic};
    const resolved = registry.resolveFont(style);
    const where = `${entry.family} ${label(weight, italic)}`;
    assert.equal(resolved.resolvedFamily, entry.route, `${where}: draws ${entry.route}`);
    assert.deepEqual([resolved.resolvedWeight, resolved.italic], [expected.face.weight, expected.face.italic], `${where}: the face the style resolves to`);
    const gap = !expected.exactWeight || expected.styleGap;
    if (gap) record.gaps.push(label(weight, italic));
    if (gap) assert.equal(resolved.compatibility, 'visual', `${where}: a style the route lacks is reported visual, never as the real face`);
    else if (entry.alias) assert.equal(resolved.compatibility, 'visual', `${where}: a renamed open family answers visual`);
    else assert.equal(resolved.compatibility, entry.tier, `${where}: tier`);
    // Shaped advances: the registry measures what the face's file gives.
    const font = await fontOf(expected.face);
    for (const text of PROBES) {
      const measured = registry.textMeasurement.measure(text, 40, style), want = direct(font, text, 40, entry.disabledFeatures);
      assert.ok(Math.abs(measured - want) < 0.1, `${where}: "${text}" measures ${measured}, the face gives ${want}`);
    }
    styleChecks += 1;
  }
  // One deck per family: heading and body in the family, the four styles in one paragraph.
  const svg = renderSlideSvg(familyDeck(entry.family), 0, { fonts: {textMeasurement: registry.textMeasurement}});
  const runs = new Map();
  for (const match of svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)) {
    const [, attributes, content] = match;
    const attribute = name => new RegExp(`\\s${name}="([^"]*)"`).exec(attributes)?.[1];
    runs.set(content, {family: attribute('font-family')?.split(',')[0].trim().replace(/^['"]|['"]$/g, ''), weight: Number(attribute('font-weight') ?? 400), italic: attribute('font-style') === 'italic', length: Number(attribute('textLength')), size: Number(attribute('font-size'))});
  }
  for (const [text, style] of RUNS) {
    const run = runs.get(text);
    assert.ok(run, `${entry.family}: the deck draws "${text}"`);
    const expected = runFace(entry, style);
    assert.equal(run.family, entry.route, `${entry.family} "${text}": the SVG names ${entry.route}`);
    assert.equal(run.weight, expected.face.weight, `${entry.family} "${text}": weight`);
    if (!expected.styleGap) assert.equal(run.italic, expected.face.italic, `${entry.family} "${text}": slope`);
    const measured = registry.textMeasurement.measure(text, run.size, {fontFamily: entry.route, fontWeight: expected.face.weight, italic: expected.face.italic});
    assert.ok(Math.abs(run.length - measured) < 0.1, `${entry.family} "${text}": textLength ${run.length} equals the measured advance of ${entry.route} ${expected.face.weight} (${measured})`);
  }
  // Paint: resvg draws the route face from its file, and not another one.
  for (const found of neededFaces(entry)) {
    const file = pathOf(found.face);
    assert.ok(file, `${entry.family}: ${found.file} is among the registry's font files`);
    const drawn = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="70"><rect width="700" height="70" fill="white"/><text x="8" y="48" font-family="${found.face.family}" font-weight="${found.face.weight}" font-style="${found.face.italic ? 'italic' : 'normal'}" font-size="36" fill="black">Hamburgefonstiv 1234</text></svg>`;
    const everything = sha(await svgToPng(drawn, rasterOptions(prepared.fontFiles)));
    assert.equal(everything, sha(await svgToPng(drawn, rasterOptions([file]))), `${entry.family}: resvg draws ${found.face.family} ${found.face.weight} from ${path.basename(file)}`);
    assert.notEqual(everything, sha(await svgToPng(drawn, rasterOptions(prepared.fontFiles.filter(candidate => candidate !== file)))), `${entry.family}: ${path.basename(file)} is what paints`);
    paintChecks += 1;
  }
  const faces = neededFaces(entry);
  record.files = faces.map(found => found.file);
  record.lazyFiles = faces.filter(found => found.lazy).map(found => found.file);
  record.lazyBytes = (await Promise.all(faces.filter(found => found.lazy).map(async found => (await stat(path.join(root, found.file))).size))).reduce((a, b) => a + b, 0);
  report.push(record);
}

assert.deepEqual(Object.keys(ALIASES), ['source sans pro']);
const outDirectory = path.resolve(root, process.argv[2] ?? 'artifacts/latin-family-hosts');
await mkdir(outDirectory, {recursive: true});
await writeFile(path.join(outDirectory, 'node.json'), `${JSON.stringify({node: process.version, families: report.length, styleChecks, paintChecks, report}, null, 1)}\n`);
console.log(`Latin family hosts (Node): ${report.length} families, ${styleChecks} family-styles resolved to the route face at the face's own advances, ${paintChecks} route faces painted by resvg as themselves.`);
