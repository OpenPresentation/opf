// FF-31 (owner policy 2026-09-29): the vendored Intos family is the metric-compatible preview for
// Aptos, Aptos Display, Aptos Narrow and Aptos Serif. It ships inside this package, pinned by upstream
// commit and per-file SHA-256, is part of the default office pack, and every bundled face is embedded
// in an SVG only when the slide names its family. No Aptos file is used here: the width constants below were
// measured once against Aptos 2.01 (aggregate numbers only) and lock the metric-compatibility claim.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {BUNDLED_FONT_MANIFEST, loadFonts} from '../dist/fonts-node.js';
import {svgToPng, renderSlideSvg} from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pkg = BUNDLED_FONT_MANIFEST.packages.find(item => item.name === 'intos');

// Manifest: a vendored, hash-pinned OFL-1.1 package with no Reserved Font Name.
assert.ok(pkg && pkg.vendored === 'fonts/intos' && pkg.pack === 'office' && pkg.embed === 'used');
assert.equal(pkg.license, 'OFL-1.1');
assert.deepEqual(pkg.reservedFontNames, []);
assert.equal(pkg.upstream, 'https://github.com/muglug/intos');
assert.match(pkg.copyright, /^Copyright .* The Intos Project Authors/);
// The entry follows the vendoring schema: version is the pinned upstream commit, every face is the byte-identical upstream file (Git LFS, so a media URL).
const commit = pkg.version;
assert.match(commit, /^[0-9a-f]{40}$/);
assert.equal(pkg.source, `https://github.com/muglug/intos/tree/${commit}/fonts`);
assert.equal(pkg.upstreamLicenseUrl, `https://raw.githubusercontent.com/muglug/intos/${commit}/LICENSE.txt`);
for (const face of pkg.faces) assert.deepEqual(face.upstreamFile, {url: `https://media.githubusercontent.com/media/muglug/intos/${commit}/fonts/${face.file}`, sha256: face.sha256});
assert.equal(pkg.faces.length, 16);
assert.deepEqual([...new Set(pkg.faces.map(face => face.family))].sort(), ['Intos', 'Intos Display', 'Intos Narrow', 'Intos Serif']);
for (const family of ['Intos', 'Intos Display', 'Intos Narrow', 'Intos Serif']) {
  assert.deepEqual(pkg.faces.filter(face => face.family === family).map(face => `${face.weight}${face.italic ? 'i' : ''}`).sort(), ['400', '400i', '700', '700i'], family);
}
for (const face of pkg.faces) assert.match(face.sha256, /^[0-9a-f]{64}$/);
// No replacement family name is a trademark of the font it replaces (owner rule): none contains "Aptos".
assert.ok(pkg.faces.every(face => !/aptos/i.test(face.family)));

const prepared = await loadFonts({pack: 'office'});
const {registry} = prepared, options = {fonts: prepared};
const vendoredFiles = prepared.fontFiles.filter(file => path.basename(path.dirname(file)) === 'intos');
assert.equal(vendoredFiles.length, 16);
const license = await readFile(path.join(path.dirname(vendoredFiles[0]), pkg.licenseFile));
assert.equal(hash(license), pkg.licenseSha256);
assert.match(license.toString('utf8'), /SIL OPEN FONT LICENSE Version 1\.1/);
assert.doesNotMatch(license.toString('utf8'), /with Reserved Font Name/);
for (const file of vendoredFiles) assert.equal(hash(await readFile(file)), pkg.faces.find(face => face.file === path.basename(file)).sha256, path.basename(file));
const notice = (await readFile(path.join(path.dirname(vendoredFiles[0]), pkg.noticeFile))).toString('utf8');
assert.equal(hash(Buffer.from(notice)), pkg.noticeSha256);
assert.ok(notice.includes(commit) && notice.includes('Inter Project Authors') && notice.includes('Gelasio Project Authors'));
// Embedded SVG licenses carry the license and the notice.
const intosEmbedded = prepared.embeddedFonts.filter(face => /^Intos/.test(face.family));
assert.equal(intosEmbedded.length, 16);
assert.ok(intosEmbedded.every(face => face.license.includes('SIL OPEN FONT LICENSE') && face.license.includes('Gelasio Project Authors')));

// The office pack is base + the six Office substitutes + Intos; the base pack never carries Intos.
// One rule for every vendored pack (Intos and the open families): embed "used". registry.embeddedFonts is the eager list of
// faces embedded in every SVG (the 9 base and 24 Office npm faces); the vendored faces are in the handle's embeddedFonts and in
// registry.lazyFonts, and an SVG embeds them only when its text names the family.
assert.equal(registry.embeddedFonts.length, 9 + 24);
assert.ok(!registry.embeddedFonts.some(face => /^Intos/.test(face.family)));
assert.ok(intosEmbedded.every(face => face.embed === 'used'));
assert.equal(registry.lazyFonts.filter(face => /^Intos/.test(face.family)).length, 16);
assert.ok(!(await loadFonts({pack: 'base'})).registry.describeFaces().some(face => /^Intos/.test(face.family)));
await assert.rejects(loadFonts({pack: 'aptos'}), {code: 'invalid-font-pack'});
// The default strict (metric) office registry resolves the Aptos family without asking for visual mode.
assert.equal((await loadFonts({pack: 'office', substitutionPolicy: 'metric'})).registry.resolveFont({fontFamily: 'Aptos', fontWeight: 400}).resolvedFamily, 'Intos');
assert.equal(registry.textMeasurement.resolveFont({fontFamily: 'Intos', fontWeight: 400}).substitute, false);

// Metric compatibility: the shaped width of one string, in thousandths of the font size, equals the
// width measured in the real Aptos 2.01 faces (bit for bit), in every style the policy claims.
const sample = 'Quarterly operating review: AVATAR affine 2026 fi ffl';
for (const [family, weight, italic, expected] of [
  ['Aptos', 400, false, 21861.328125], ['Aptos', 700, false, 23089.84375], ['Aptos', 400, true, 21726.07421875],
  ['Aptos Display', 700, false, 21892.08984375], ['Aptos Narrow', 400, false, 20163.0859375], ['Aptos Serif', 400, false, 23292.96875],
]) {
  assert.equal(registry.textMeasurement.measure(sample, 1000, {fontFamily: family, fontWeight: weight, italic}), expected, `${family} ${weight}${italic ? 'i' : ''}`);
  const resolved = registry.resolveFont({fontFamily: family, fontWeight: weight, italic});
  assert.deepEqual([resolved.compatibility, resolved.substitute, resolved.resolvedFamily.startsWith('Intos')], ['metric', true, true]);
}
// Real Aptos is never bundled or embedded: the source family stays the requested one.
assert.ok(registry.embeddedFonts.every(face => !/aptos/i.test(face.family)));

// Weights outside the metric claim (400 and 700) behave as Calibri's do. Under the default metric policy they are refused
// (main refused every Aptos weight there, since Aptos had no metric replacement); under visual policy the nearest Intos face
// draws and is reported visual, so a deck that previews on main under visual policy still previews.
const visualPolicy = (await loadFonts({pack: 'office', substitutionPolicy: 'visual'})).registry;
for (const [family, calibri] of [['Aptos', 'Calibri']]) for (const weight of [300, 500, 600, 800]) {
  const metricCode = (() => { try { registry.resolveFont({fontFamily: family, fontWeight: weight}); return 'resolved'; } catch (error) { return error.code; } })();
  const calibriCode = (() => { try { registry.resolveFont({fontFamily: calibri, fontWeight: weight}); return 'resolved'; } catch (error) { return error.code; } })();
  assert.equal(metricCode, calibriCode, `Aptos at ${weight} follows Calibri under metric policy`);
  const drawn = visualPolicy.resolveFont({fontFamily: family, fontWeight: weight});
  assert.deepEqual([drawn.resolvedFamily, drawn.compatibility, drawn.substitute], ['Intos', 'visual', true], `Aptos at ${weight} previews with Intos under visual policy`);
  assert.ok([400, 700].includes(drawn.resolvedWeight));
}
for (const family of ['Aptos Display', 'Aptos Narrow', 'Aptos Serif']) assert.equal(visualPolicy.resolveFont({fontFamily: family, fontWeight: 600}).resolvedFamily.startsWith('Intos'), true, family);

// Rendering: the default (Aptos) scheme measures and draws with Intos, and a standalone SVG embeds only the Intos faces
// its text draws (family, weight and style): Intos regular for the body and Intos Display bold for the title, not the other
// six styles of those families and not the unused Narrow and Serif families. RR-61: nor any eager npm face the text does not draw.
const deck = {name: 'Aptos preview', slides: [{id: 'a', title: 'Quarterly operating review', text: 'Revenue grew in every region.'}]};
const source = JSON.stringify(deck);
const svg = renderSlideSvg(deck, 0, options);
assert.equal(JSON.stringify(deck), source);
const drawn = [...new Set([...svg.matchAll(/font-family="([^"]+)"/g)].map(match => match[1]))].sort();
assert.deepEqual(drawn, ['Intos Display, sans-serif', 'Intos, sans-serif']);
const faces = [...svg.matchAll(/@font-face\{font-family:"([^"]+)";font-weight:(\d+);font-style:(\w+)/g)].map(match => `${match[1]} ${match[2]} ${match[3]}`);
const embedded = faces.map(face => face.replace(/ \d+ \w+$/, ''));
assert.deepEqual(faces.filter(face => /^Intos/.test(face)).sort(), ['Intos 400 normal', 'Intos Display 700 normal']);
assert.ok(!embedded.includes('Intos Narrow') && !embedded.includes('Intos Serif'), 'unused Intos families stay out of the SVG');
assert.deepEqual([...new Set(embedded)].sort(), ['Intos', 'Intos Display'], 'RR-61: no eager npm face (Roboto, Carlito, ...) the text does not draw');
const baseSvg = renderSlideSvg({name: 'Roboto', design: {fontScheme: 'roboto'}, slides: [{id: 'r', title: 'Title', text: 'Body'}]}, 0, {fonts: (await loadFonts())});
assert.ok(!/font-family:"Intos/.test(baseSvg), 'the base pack has no Intos');
assert.equal(renderSlideSvg(deck, 0, {fonts: (await loadFonts({pack: 'office'}))}), svg, 'same bytes and input replay identically');
// A slide that names none of the Intos families embeds none of them.
const roboto = renderSlideSvg({name: 'Roboto', design: {fontScheme: 'roboto'}, slides: [{id: 'r', title: 'Title', text: 'Body'}]}, 0, options);
assert.ok(!/font-family:"Intos/.test(roboto) && /font-family:"Roboto"/.test(roboto));
// Node raster output draws from the same files.
const png = await svgToPng(svg, {...options, scale: 0.5});
assert.ok(png.byteLength > 1000);
const robotoDeck = {...deck, design: {fontScheme: 'roboto'}};
assert.notDeepEqual(png, await svgToPng(renderSlideSvg(robotoDeck, 0, options), {...options, scale: 0.5}));

// Integrity: a changed or missing vendored file is refused, like every pinned package.
if (existsSync(new URL('../dist/fonts-node.js', import.meta.url))) {
  const root = fileURLToPath(new URL('../', import.meta.url)), temporary = await mkdtemp(path.join(tmpdir(), 'opf-aptos-pack-'));
  try {
    await writeFile(path.join(temporary, 'package.json'), JSON.stringify({type: 'module'}));
    await cp(path.join(root, 'dist'), path.join(temporary, 'dist'), {recursive: true});
    await cp(path.join(root, 'fonts'), path.join(temporary, 'fonts'), {recursive: true});
    await mkdir(path.join(temporary, 'node_modules'), {recursive: true});
    for (const name of ['fontkit', 'bidi-js', 'pako', 'harfbuzzjs', '@openpresentation', '@resvg', '@expo-google-fonts']) await symlink(path.join(root, 'node_modules', name), path.join(temporary, 'node_modules', name), process.platform === 'win32' ? 'junction' : 'dir');
    const isolated = await import(pathToFileURL(path.join(temporary, 'dist/fonts-node.js')));
    await isolated.loadFonts({pack: 'office'});
    const file = path.join(temporary, 'fonts/intos', pkg.faces[0].file), original = await readFile(file);
    await writeFile(file, Buffer.concat([original, Buffer.from('corrupt')]));
    await assert.rejects(isolated.loadFonts({pack: 'office'}), {code: 'font-integrity-mismatch'});
    await writeFile(file, original);
    const licenseFile = path.join(temporary, 'fonts/intos', pkg.licenseFile);
    await writeFile(licenseFile, 'Missing original notice');
    await assert.rejects(isolated.loadFonts({pack: 'office'}), {code: 'font-integrity-mismatch'});
    await writeFile(licenseFile, license);
    await rm(file);
    await assert.rejects(isolated.loadFonts({pack: 'office'}), {code: 'font-resource-unavailable'});
    // The base pack does not read the vendored directory.
    await isolated.loadFonts({pack: 'base'});
  } finally { await rm(temporary, {recursive: true, force: true}); }
}
console.log(JSON.stringify({test: 'aptos-preview', commit, faces: pkg.faces.length, embeddedIntosFaces: faces.filter(face => /^Intos/.test(face)).length, svgBytes: svg.length}));
