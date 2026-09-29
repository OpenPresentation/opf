// FF-31: the open families that OPF font schemes select (Open Sans, Montserrat, Poppins, PT Serif, Bebas Neue, Lora,
// Merriweather Sans, Source Sans Pro) and the Red Hat families that the policy names as replacements (Segoe UI, Tahoma)
// draw with vendored faces in the office pack, so a strict registry no longer throws for them.
//   - Source Sans Pro is the renamed family Source Sans 3: its requests draw the Source Sans 3 faces and report visual.
//   - Raleway and Playfair Display are not bundled: upstream ships them only as variable fonts, and the Node raster engine
//     (resvg 2.6.2) ignores the weight axis (probed: weights 400 and 700 rendered byte-identically, and Raleway's default
//     instance is Thin), so bold would paint as the default instance.
//   - Faces with a Reserved Font Name are the copyright holder's byte-identical files at a pinned commit.
import assert from 'node:assert/strict';
import {cp, mkdtemp, readFile, readdir, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {fontSchemes} from '@openpresentation/opf/catalogs';
import {renderSvg, svgToPng} from '../dist/index.js';
import {BUNDLED_FONT_MANIFEST, loadBundledFontRegistry, loadOfficeFontRegistry, prepareNodeFonts} from '../dist/fonts-node.js';
import {fontPolicyFor} from '../dist/fonts.js';
import {isUnmodifiedUpstreamUrl} from '../scripts/font-license.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = fileURLToPath(new URL('../', import.meta.url));
const rootPackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const SCHEME_FAMILIES = ['Open Sans', 'Montserrat', 'Poppins', 'PT Serif', 'Bebas Neue', 'Lora', 'Merriweather Sans', 'Source Sans Pro'];
const NOT_BUNDLED = ['Raleway', 'Playfair Display'];
const open = BUNDLED_FONT_MANIFEST.packages.filter(item => item.pack === 'open');

// Manifest: vendored, pinned, license read from the shipped notice, Reserved Font Names recorded.
assert.equal(open.length, 10);
assert.equal(open.reduce((total, item) => total + item.faces.length, 0), 35);
assert.ok(rootPackage.files.includes('fonts'), 'the published package includes the vendored fonts');
for (const item of open) {
  assert.ok(/^fonts\/[a-z0-9-]+$/.test(item.vendored), item.vendored);
  assert.ok(!rootPackage.dependencies?.[item.name] && !rootPackage.devDependencies?.[item.name], `${item.name} is vendored, not a dependency`);
  const directory = path.join(root, item.vendored);
  const noticeBytes = await readFile(path.join(directory, item.licenseFile)), notice = noticeBytes.toString('utf8');
  assert.equal(sha(noticeBytes), item.licenseSha256, item.name);
  assert.match(notice, /SIL Open Font License,? Version 1\.1/i, `${item.name} ships the OFL 1.1 notice`);
  // Only the listed faces are vendored, each pinned by hash.
  const listed = new Set([item.licenseFile, 'PROVENANCE.json', ...item.faces.map(face => face.file)]);
  assert.deepEqual((await readdir(directory)).sort(), [...listed].sort(), `${item.vendored} holds exactly the listed files`);
  for (const face of item.faces) assert.equal(sha(await readFile(path.join(directory, face.file))), face.sha256, face.file);
  // A family with a Reserved Font Name in its own name must be the copyright holder's byte-identical file at a pinned commit.
  if (item.faces.every(face => face.upstreamFile)) for (const face of item.faces) {
    assert.ok(isUnmodifiedUpstreamUrl(face.upstreamFile.url) && face.upstreamFile.sha256 === face.sha256, `${item.name} ${face.file} is byte-identical to its pinned upstream file`);
  } else assert.deepEqual(item.reservedFontNames, [], `${item.name}: an npm-derived (instanced) family must not declare a Reserved Font Name`);
  // PROVENANCE.json says where every byte came from and agrees with the manifest.
  const provenance = JSON.parse(await readFile(path.join(directory, 'PROVENANCE.json'), 'utf8'));
  assert.deepEqual([provenance.license, provenance.licenseSha256, provenance.reservedFontNames, provenance.copyright, provenance.renamedFrom, provenance.upstream.source], [item.license, item.licenseSha256, item.reservedFontNames, item.copyright, item.renamedFrom, item.source]);
  assert.deepEqual(provenance.faces.map(face => [face.file, face.family, face.weight, face.italic, face.sha256]), item.faces.map(face => [face.file, face.family, face.weight, face.italic, face.sha256]));
}
const byName = name => open.find(item => item.name === name);
assert.deepEqual(byName('source-sans-3').reservedFontNames, ['Source']);
assert.equal(byName('source-sans-3').renamedFrom, 'Source Sans Pro');
assert.deepEqual(byName('pt-serif').reservedFontNames, ['PT Sans', 'PT Serif', 'ParaType']);
assert.deepEqual(byName('red-hat-display').reservedFontNames, []);
assert.deepEqual(NOT_BUNDLED.filter(family => open.some(item => item.faces.some(face => face.family === family))), [], 'Raleway and Playfair Display are not bundled');

// Integrity guards on a disposable copy: changed bytes and a missing vendored file are refused.
{
  const copy = await mkdtemp(path.join(tmpdir(), 'opf-open-fonts-'));
  try {
    await writeFile(path.join(copy, 'package.json'), JSON.stringify({type: 'module'}));
    await cp(path.join(root, 'dist'), path.join(copy, 'dist'), {recursive: true});
    await cp(path.join(root, 'fonts'), path.join(copy, 'fonts'), {recursive: true});
    await symlink(path.join(root, 'node_modules'), path.join(copy, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const isolated = await import(pathToFileURL(path.join(copy, 'dist/fonts-node.js')));
    await isolated.loadOfficeFontRegistry();
    const face = path.join(copy, open[0].vendored, open[0].faces[0].file), original = await readFile(face);
    await writeFile(face, Buffer.concat([original, Buffer.from('corrupt')]));
    await assert.rejects(isolated.loadOfficeFontRegistry(), {code: 'font-integrity-mismatch'});
    await writeFile(face, original);
    const notice = path.join(copy, open[0].vendored, open[0].licenseFile), text = await readFile(notice);
    await writeFile(notice, 'Missing original notice');
    await assert.rejects(isolated.loadOfficeFontRegistry(), {code: 'font-integrity-mismatch'});
    await writeFile(notice, text);
    await rm(face);
    await assert.rejects(isolated.loadOfficeFontRegistry(), {code: 'font-resource-unavailable'});
    await writeFile(face, original);
    await isolated.loadOfficeFontRegistry();
  } finally { await rm(copy, {recursive: true, force: true}); }
}

// Every open family a font scheme selects (core catalog plus the four gallery-only legacy schemes) that is bundled resolves to its
// own exact face in a strict office registry.
const strict = await loadOfficeFontRegistry();
const selected = new Set(SCHEME_FAMILIES);
for (const record of fontSchemes.records ?? fontSchemes) for (const family of [record.major, record.minor]) if (fontPolicyFor(family)?.licenseClass === 'open' && !/^Noto /.test(family)) selected.add(family);
for (const family of SCHEME_FAMILIES) assert.ok(selected.has(family) || family === 'Source Sans Pro', `${family} is selected by a font scheme`);
for (const family of [...selected, 'Source Sans 3', 'Red Hat Display', 'Red Hat Text']) {
  if (NOT_BUNDLED.includes(family)) { assert.throws(() => strict.resolveFont({fontFamily: family, fontWeight: 400}), {code: 'font-unavailable'}, family); continue; }
  assert.equal(fontPolicyFor(family).licenseClass, 'open', family);
  for (const fontWeight of [400, 700]) for (const italic of [false, true]) {
    const style = {fontFamily: family, fontWeight, italic};
    if (family === 'Source Sans Pro') {
      // The renamed family answers through a built-in alias: real Source Sans 3 faces, reported visual, in any policy.
      const renamed = strict.resolveFont(style);
      assert.deepEqual([renamed.resolvedFamily, renamed.resolvedWeight, renamed.italic, renamed.compatibility, renamed.substitute], ['Source Sans 3', fontWeight, italic, 'visual', true]);
      continue;
    }
    // Bebas Neue and Red Hat (its statics have no usable italic in resvg) ship no italic: strict lookup says so.
    if (italic && ['Bebas Neue', 'Red Hat Display', 'Red Hat Text'].includes(family)) { assert.throws(() => strict.resolveFont(style), {code: 'font-style-unavailable'}); continue; }
    const resolved = strict.resolveFont(style);
    assert.equal(resolved.resolvedFamily, family, `${family} ${fontWeight}`);
    assert.equal(resolved.substitute, false, family);
    if (family === 'Bebas Neue' && fontWeight === 700) { assert.equal(resolved.compatibility, 'visual', 'Bebas Neue ships one regular weight'); continue; }
    assert.equal(resolved.compatibility, 'exact', `${family} ${fontWeight} ${italic}`);
    assert.ok(strict.textMeasurement.measure('Quarterly operating review 1234', 25, style) > 100, family);
  }
}

// Declared policy replacements now draw: Segoe UI and Tahoma with Red Hat, Arial Black with Montserrat Black.
const visual = await loadOfficeFontRegistry({substitutionPolicy: 'visual'});
const face = (family, fontWeight = 400, italic = false) => { const resolved = visual.resolveFont({fontFamily: family, fontWeight, italic}); return [resolved.resolvedFamily, resolved.resolvedWeight, resolved.compatibility, resolved.styleFallback === true]; };
assert.deepEqual(face('Segoe UI'), ['Red Hat Display', 400, 'visual', false]);
assert.deepEqual(face('Segoe UI', 700), ['Red Hat Display', 700, 'visual', false]);
assert.deepEqual(face('Segoe UI Light'), ['Red Hat Display', 300, 'visual', false]);
assert.deepEqual(face('Segoe UI Semibold'), ['Red Hat Display', 700, 'visual', false], 'no 600 face is vendored (its OS/2 weight 707 would out-rank Bold in resvg), so Semibold snaps to Bold');
assert.deepEqual(face('Segoe UI', 400, true), ['Red Hat Display', 400, 'visual', true], 'italic falls back to upright, reported');
assert.deepEqual(face('Tahoma'), ['Red Hat Text', 400, 'visual', false]);
assert.deepEqual(face('Tahoma', 700), ['Red Hat Text', 700, 'visual', false]);
assert.deepEqual(face('Arial Black'), ['Montserrat', 900, 'visual', false]);
assert.equal(face('Verdana')[0], 'Montserrat');
assert.equal(face('Book Antiqua')[0], 'PT Serif');
assert.equal(face('Candara')[0], 'Source Sans 3');
assert.equal(face('Skeena')[0], 'Open Sans', 'Skeena declares Open Sans');
assert.equal(visual.resolveFont({fontFamily: 'Montserrat', fontWeight: 900}).compatibility, 'exact');
// Bodoni MT and Didot declare Playfair Display, which is not bundled: they use the declared alternate.
assert.equal(face('Bodoni MT')[0], 'Caladea');

// Packs stay separate: the base pack still has only Roboto and points at the office pack; the office pack can leave the open
// families out.
const base = await loadBundledFontRegistry();
assert.equal(base.describeFaces().length, 9);
assert.throws(() => base.resolveFont({fontFamily: 'Open Sans', fontWeight: 400}), error => error.code === 'font-unavailable' && error.details.pack === 'office');
assert.throws(() => base.resolveFont({fontFamily: 'Source Sans Pro', fontWeight: 400}), error => error.code === 'font-unavailable' && error.details.packs.includes('office'));
const without = await loadOfficeFontRegistry({includeOpenFonts: false});
assert.equal(without.describeFaces().length, 33);
assert.throws(() => without.resolveFont({fontFamily: 'Montserrat', fontWeight: 400}), {code: 'font-unavailable'});
assert.throws(() => without.resolveFont({fontFamily: 'Source Sans Pro', fontWeight: 400}), {code: 'font-unavailable'});

// SVG size: the eager list stays at the 33 Office/base faces; the open faces are embed:"used" and are embedded only in an SVG
// whose text names their family.
assert.equal(strict.embeddedFonts.length, 33);
assert.ok(strict.embeddedFonts.every(font => font.embed === undefined));
const defaults = await prepareNodeFonts({pack: 'office'});
assert.equal(defaults.options.embeddedFonts.length, 68, 'prepareNodeFonts supplies every face; the SVG picks the ones its text uses');
assert.equal(defaults.options.embeddedFonts.filter(font => font.embed === 'used').length, 35);
assert.equal(defaults.options.fontFiles.length, 68);
assert.equal((await prepareNodeFonts({pack: 'base'})).options.embeddedFonts.length, 9);
const schemeDocument = family => ({
  design: {fontScheme: 'x-open'},
  catalogs: {fontSchemes: {records: [{$schema: 'https://openpresentation.org/schema/opf-font-scheme/v1', id: 'x-open', name: family, app: 'Google Slides', languageFamily: 'latin', languages: [], major: family, minor: family, textSample: 'x', type: 'sans-serif'}]}},
  slides: [{title: 'Quarterly review', text: 'Revenue grew in every region.'}],
});
const embeddedFamilies = svg => [...new Set([...svg.matchAll(/font-family:"([^"]+)"/g)].map(match => match[1]))].sort();
const montserrat = renderSvg(schemeDocument('Montserrat'), defaults.options);
assert.deepEqual(embeddedFamilies(montserrat), ['Montserrat'].concat(embeddedFamilies(montserrat).filter(family => family !== 'Montserrat' && !open.some(item => item.faces.some(face => face.family === family)))).sort(), 'only Montserrat of the open families is embedded');
const roboto = renderSvg({design: {fontScheme: 'roboto'}, slides: [{title: 'Quarterly review'}]}, defaults.options);
assert.deepEqual(embeddedFamilies(roboto).filter(family => open.some(item => item.faces.some(face => face.family === family))), [], 'a slide that names no open family embeds none of them');
assert.ok(montserrat.length - roboto.length < 3 * 1024 * 1024, `Montserrat adds only its own five faces (${((montserrat.length - roboto.length) / 1048576).toFixed(1)} MiB), not the whole open pack (about 9 MiB)`);
const allFaces = renderSvg(schemeDocument('Open Sans'), {...defaults.options, embeddedFonts: defaults.registry.selectEmbeddedFonts(() => true)});
assert.equal(embeddedFamilies(allFaces).filter(family => family === 'Open Sans').length, 1);

// Raster fidelity: for every vendored face, resvg (the Node raster engine) draws exactly that face for the family/weight/style the
// registry writes into the SVG: same pixels with only that file loaded, different pixels without it.
const svgFor = (family, weight, italic) => `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="70"><rect width="700" height="70" fill="white"/><text x="8" y="48" font-family="${family}" font-weight="${weight}" font-style="${italic ? 'italic' : 'normal'}" font-size="36">Quarterly review 123 Hamburgefonstiv</text></svg>`;
const rasterOptions = fontFiles => ({fontFiles, useBundledFonts: false, loadSystemFonts: false});
const slash = file => file.split(String.fromCharCode(92)).join('/');
for (const item of open) for (const entry of item.faces) {
  const file = defaults.options.fontFiles.find(candidate => path.basename(candidate) === entry.file && slash(candidate).includes(item.vendored));
  assert.ok(file, entry.file);
  const drawn = svgFor(entry.family, entry.weight, entry.italic);
  const all = sha(await svgToPng(drawn, rasterOptions(defaults.options.fontFiles)));
  assert.equal(all, sha(await svgToPng(drawn, rasterOptions([file]))), `${entry.family} ${entry.weight} ${entry.italic}: resvg draws ${entry.file}`);
  assert.notEqual(all, sha(await svgToPng(drawn, rasterOptions(defaults.options.fontFiles.filter(candidate => candidate !== file)))), `${entry.family} ${entry.weight} ${entry.italic}: ${entry.file} is what paints`);
}
// Render a deck in each bundled family to PNG: the family's own face paints (not the sans-serif fallback), and each family paints
// differently from the others.
const hashes = new Map();
for (const family of [...SCHEME_FAMILIES, 'Red Hat Display', 'Red Hat Text']) {
  const svg = renderSvg(schemeDocument(family), defaults.options);
  const drawnFamily = family === 'Source Sans Pro' ? 'Source Sans 3' : family;
  assert.ok(svg.includes(`font-family="${drawnFamily}, sans-serif"`), `${drawnFamily} is named in the SVG`);
  const png = await svgToPng(svg, {...defaults.options, scale: 0.5});
  const fallback = await svgToPng(svg, {fontFiles: [], useBundledFonts: false, loadSystemFonts: false, scale: 0.5});
  const digest = sha(png);
  assert.notEqual(digest, sha(fallback), `${family} paints with its own face`);
  assert.ok(!hashes.has(digest), `${family} differs from ${hashes.get(digest)}`);
  hashes.set(digest, family);
}
console.log('Open families passed: 10 vendored packs and 35 pinned faces (RFN families byte-identical to pinned upstream), notices verified, strict mode does not throw, every face paints as itself in resvg, open faces embed only when named, Red Hat used for Segoe UI and Tahoma.');
