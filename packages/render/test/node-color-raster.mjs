import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { loadFonts, BUNDLED_FONT_MANIFEST, scriptFontPackages } from '../dist/fonts-node.js';
import { toSvg, toPng, toPdf, catalogs } from './catalog-harness.mjs';
import { rasterFontFiles } from '../dist/color-fonts.js';

const options = { pack: 'office', substitutionPolicy: 'visual', fallbackFamily: 'Roboto' };
const renderOptions = { catalogs };
const plain = { slides: [{ title: 'Plain title', text: 'Plain body' }] };
const emoji = (family = 'Noto Color Emoji', bold = false, italic = false) => ({
  name: 'Selected color raster dependency',
  design: { fontScheme: { id: 'emoji-control', heading: family, body: family } },
  slides: [{ title: '\u{1F600}', text: [{ text: '\u{1F469}\u200D\u{1F4BB}', bold, italic }] }],
});
const request = (presentation) => ({ ...options, scripts: 'auto', presentation, renderOptions });
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const slash = (file) => file.replaceAll('\\', '/');
const isMono = (file) => slash(file).endsWith('/noto-emoji/400Regular/NotoEmoji_400Regular.ttf');
const isColor = (file) => slash(file).endsWith('/noto-color-emoji/400Regular/NotoColorEmoji_400Regular.ttf');
const emojiOnly = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120" viewBox="0 0 400 120"><rect width="400" height="120" fill="#fff"/><text x="10" y="90" font-family="Noto Color Emoji, sans-serif" font-size="80" fill="#000">\u{1F600}</text></svg>';
let wholePromise;
const whole = () => (wholePromise ??= loadFonts({ ...options, scripts: ['Zsye'] }));

test('the same demand handle preserves color SVG and exact PNG/raster-PDF companion bytes', async () => {
  const deck = emoji(), fonts = await loadFonts(request(deck)), eager = await whole();
  const svg = toSvg(deck, 1, { ...renderOptions, fonts });
  assert.equal(svg, toSvg(deck, 1, { ...renderOptions, fonts: eager }));
  assert.match(svg, /font-family="Noto Color Emoji/);
  assert(!svg.includes('font-family="Noto Emoji'), 'the SVG keeps the actual color family');
  assert.equal(fonts.fontFiles.filter(isMono).length, 1);
  assert.equal(fonts.fontFiles.filter(isColor).length, 1);
  assert.deepEqual(fonts.registry.scriptSelection.packages, ['@expo-google-fonts/noto-color-emoji', '@expo-google-fonts/noto-emoji']);
  for (const pkg of BUNDLED_FONT_MANIFEST.packages.filter((pkg) => pkg.color || pkg.name === '@expo-google-fonts/noto-emoji')) {
    const resolved = fonts.registry.resolveFont({ fontFamily: pkg.faces[0].family, fontWeight: 700, italic: false });
    assert.equal(resolved.resolvedWeight, 400, 'the companion follows the effective selected face, never an invented bold file');
    const file = fonts.fontFiles.find(pkg.color ? isColor : isMono);
    assert.equal(sha(await readFile(file)), pkg.faces[0].sha256);
  }
  assert.deepEqual(await toPng(svg, { fonts, scale: 0.5 }), await toPng(svg, { fonts: eager, scale: 0.5 }));
  assert.deepEqual(await toPdf(svg, { fonts, raster: true, scale: 0.5 }), await toPdf(svg, { fonts: eager, raster: true, scale: 0.5 }));
});

test('demand raster paints the pinned monochrome glyph, not a blank or another font fallback', async () => {
  const fonts = await loadFonts(request(emoji())), mono = fonts.fontFiles.find(isMono);
  assert(mono);
  const png = await toPng(emojiOnly, { fonts });
  const reference = await toPng(emojiOnly, { fonts: { fontFiles: [mono], useBundledFonts: false, loadSystemFonts: false } });
  assert.deepEqual(png, reference, 'independent mono-only file list proves the exact paint source');
  assert.notDeepEqual(png, await toPng(emojiOnly, { fonts: { ...fonts, fontFiles: fonts.fontFiles.filter((file) => file !== mono) } }), 'removing the companion changes the raster');
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let ink = 0;
  for (let i = 0; i < data.length; i += info.channels) if (Math.min(data[i], data[i + 1], data[i + 2]) < 245) ink++;
  assert(ink > 500, 'existing emoji silhouette criterion on an explicit white background');
  assert.equal(rasterFontFiles(fonts.fontFiles).some(isColor), false);
  assert.equal(rasterFontFiles(fonts.fontFiles).filter(isMono).length, 1);
});

test('plain documents do not resolve/read color dependencies or load unrelated scripts/styles', async () => {
  const fonts = await loadFonts(request(plain));
  assert.equal(fonts.fontFiles.length, 2, 'unchanged plain-title/body demand');
  assert(!fonts.fontFiles.some(isMono));
  assert(!fonts.fontFiles.some(isColor));
  assert.deepEqual(fonts.registry.scriptSelection.packages, []);
  assert.deepEqual(fonts.pending(plain, renderOptions), []);
});

test('edits prepare the effective raster dependency once and preserve the same handle through repeat/concurrent ensure', async () => {
  const fonts = await loadFonts(request(plain)), edited = emoji('Segoe UI Emoji', true, true);
  assert(fonts.pending(edited, renderOptions).some((file) => file.includes('noto-emoji/')));
  const [first, second] = await Promise.all([fonts.ensure(edited, { renderOptions }), fonts.ensure(edited, { renderOptions })]);
  assert.equal(first.lazy.filter((face) => face.package === '@expo-google-fonts/noto-emoji').length, 1);
  assert.deepEqual(second.lazy, []);
  assert.deepEqual(fonts.pending(edited, renderOptions), []);
  assert.equal(fonts.fontFiles.filter(isMono).length, 1);
  assert.equal(fonts.fontFiles.filter(isColor).length, 1);
  assert.equal(new Set(fonts.fontFiles).size, fonts.fontFiles.length);
  assert(!fonts.fontFiles.some((file) => /noto-sans-(math|jp)|stix|roboto-mono/.test(slash(file))));
  const count = fonts.fontFiles.length;
  await fonts.ensure(plain, { renderOptions });
  await fonts.ensure(edited, { renderOptions });
  assert.equal(fonts.fontFiles.length, count);
  const svg = toSvg(edited, 1, { ...renderOptions, fonts });
  assert.deepEqual(await toPng(svg, { fonts }), await toPng(svg, { fonts: await whole() }));
});

test('a caller-owned same-name face does not acquire a manifest raster dependency', async () => {
  const eager = await whole(), own = eager.fontFiles.find((file) => slash(file).endsWith('/roboto/400Regular/Roboto_400Regular.ttf'));
  assert(own);
  const doc = {...emoji(), slides: [{title: 'Caller text', text: 'Own namespace'}]};
  const fonts = await loadFonts({...request(doc), pack: 'none', faces: [{path: own, family: 'Noto Color Emoji', weight: 400, italic: false, license: 'Apache-2.0'}]});
  assert.deepEqual(fonts.fontFiles, [own]);
  assert.equal(fonts.registry.resolveFont({fontFamily: 'Noto Color Emoji', fontWeight: 400}).resolvedFamily, 'Noto Color Emoji');
  assert(!fonts.fontFiles.some(isMono));
});

const symbols = {slides: [{id: 'symbols', title: 'Symbols', subtitle: 'Codes', text: [{text: 'Check: '}, {text: '\uF0FC\uF06C l', fontFamily: 'Wingdings'}, {text: ' alpha '}, {text: 'abg', fontFamily: 'Symbol'}, {text: ' web '}, {text: '\uF041', fontFamily: 'Webdings'}]}]};
const symbolPackages = scriptFontPackages(['Zsym']).map((pkg) => pkg.name);
const emojiPackages = ['@expo-google-fonts/noto-color-emoji', '@expo-google-fonts/noto-emoji'];

test('initial script reporting keeps declared package order and actual symbol SVG/PNG bytes', async () => {
  const fonts = await loadFonts(request(symbols)), reference = await loadFonts({...options, scripts: ['Zsym']});
  assert.deepEqual(fonts.registry.scriptSelection.packages, symbolPackages);
  const svg = toSvg(symbols, 1, {...renderOptions, fonts});
  assert.equal(svg, toSvg(symbols, 1, {...renderOptions, fonts: reference}));
  assert.deepEqual(await toPng(svg, {fonts}), await toPng(svg, {fonts: reference}));
});

test('incremental script reporting preserves the prior ensure prefix, current declared order and deduplication', async () => {
  const fonts = await loadFonts(request(emoji()));
  assert.deepEqual(fonts.registry.scriptSelection.packages, emojiPackages);
  await fonts.ensure(symbols, {renderOptions});
  const expected = [...emojiPackages, ...symbolPackages];
  assert.deepEqual(fonts.registry.scriptSelection.packages, expected);
  await fonts.ensure(plain, {renderOptions});
  await fonts.ensure(symbols, {renderOptions});
  await fonts.ensure(emoji(), {renderOptions});
  assert.deepEqual(fonts.registry.scriptSelection.packages, expected);
  assert.equal(new Set(fonts.registry.scriptSelection.packages).size, expected.length);
});

const childCode = String.raw`
import fs from 'node:fs/promises';import {registerHooks,syncBuiltinESMExports}from'node:module';import {createHash}from'node:crypto';
const [mode,moduleURL,galleryURL]=process.argv.slice(1),calls=[];let block=mode==='missing',corrupt=mode==='integrity',protectedFile,protectedBefore;
registerHooks({resolve(specifier,context,next){if(specifier.includes('@expo-google-fonts/'))calls.push(specifier);if(block&&specifier==='@expo-google-fonts/noto-emoji/package.json')throw Object.assign(Error('Not installed'),{code:'MODULE_NOT_FOUND'});return next(specifier,context);}});
const original=fs.readFile;
fs.readFile=async function(file,...args){const value=await original.call(this,file,...args);if(String(file).endsWith('NotoEmoji_400Regular.ttf')){protectedFile=file;protectedBefore=createHash('sha256').update(value).digest('hex');if(corrupt){const altered=Buffer.from(value);altered[altered.length-1]^=1;return altered;}}return value;};syncBuiltinESMExports();
const {loadFonts}=await import(moduleURL),{gallery}=await import(galleryURL),renderOptions={catalogs:[gallery]},plain={slides:[{title:'Plain title',text:'Plain body'}]},emoji={design:{fontScheme:{id:'emoji-control',heading:'Noto Color Emoji',body:'Noto Color Emoji'}},slides:[{title:'\u{1F600}',text:'\u{1F469}\u200D\u{1F4BB}'}]},request=presentation=>({pack:'office',substitutionPolicy:'visual',fallbackFamily:'Roboto',scripts:'auto',presentation,renderOptions});
const fonts=await loadFonts(request(plain)),before=fonts.fontFiles.length,unusedCalls=calls.filter(specifier=>specifier.includes('noto-emoji')).length;
let refusal;try{await fonts.ensure(emoji,{renderOptions});}catch(error){refusal={name:error.name,code:error.code,details:error.details};}
const afterFailure=fonts.fontFiles.length,packagesAfterFailure=[...fonts.registry.scriptSelection.packages];block=false;corrupt=false;fs.readFile=original;syncBuiltinESMExports();
const retry=await fonts.ensure(emoji,{renderOptions}),mono=fonts.fontFiles.filter(file=>String(file).replaceAll('\\','/').endsWith('/noto-emoji/400Regular/NotoEmoji_400Regular.ttf'));
const protectedAfter=protectedFile?createHash('sha256').update(await original(protectedFile)).digest('hex'):null;
console.log(JSON.stringify({before,unusedCalls,refusal,afterFailure,packagesAfterFailure,packagesAfterRetry:fonts.registry.scriptSelection.packages,retry:retry.lazy,mono:mono.length,unique:new Set(fonts.fontFiles).size===fonts.fontFiles.length,pending:fonts.pending(emoji,renderOptions),protectedBefore,protectedAfter}));
`;
for (const mode of ['missing', 'integrity']) test(`${mode} raster companion refuses with the typed public error; no package mutation and same-handle retry succeeds`, () => {
  const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', childCode, mode, new URL('../dist/fonts-node.js', import.meta.url).href, new URL('../../gallery/dist/index.js', import.meta.url).href], { encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024 }));
  assert.equal(result.unusedCalls, 0, 'unrelated plain text never resolves the raster companion');
  assert.equal(result.refusal.name, 'OPFFontError');
  assert.equal(result.refusal.code, mode === 'missing' ? 'font-resource-unavailable' : 'font-integrity-mismatch');
  if (mode === 'missing') assert.deepEqual(result.refusal.details.packages, ['@expo-google-fonts/noto-emoji']);
  if (mode === 'integrity') { assert.match(result.protectedBefore, /^[a-f0-9]{64}$/); assert.equal(result.protectedAfter, result.protectedBefore); }
  assert.equal(result.afterFailure, result.before);
  assert.deepEqual(result.packagesAfterFailure, [], 'failed reads cannot publish phantom or reordered packages');
  assert.deepEqual(result.packagesAfterRetry, emojiPackages, 'retry reports the successful current batch in declared order');
  assert.equal(result.mono, 1);
  assert.equal(result.unique, true);
  assert.equal(result.retry.filter((face) => face.package === '@expo-google-fonts/noto-emoji').length, 1);
  assert.deepEqual(result.pending, []);
});
