import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {strFromU8, unzipSync} from 'fflate';
import {toPptx} from '../src/index.js';

// The vendored PptxGenJS master hard-codes Arial bullets on all nine bodyStyle
// levels. Export rewrites them to the theme minor font reference; the vendor
// bytes themselves stay unchanged (verified by scripts/verify-vendor.mjs).
const VENDOR_ARIAL = '<a:buFont typeface="Arial" pitchFamily="34" charset="0"/>';
const vendor = await readFile(new URL('../vendor/pptxgenjs/pptxgen.es.js', import.meta.url), 'utf8');
assert.equal(vendor.split(VENDOR_ARIAL).length - 1, 9, 'Vendored master shape changed; review themeMasterBulletFonts');

const master = 'ppt/slideMasters/slideMaster1.xml', theme = 'ppt/theme/theme1.xml';
const parts = bytes => unzipSync(new Uint8Array(bytes));
const text = (entries, name) => strFromU8(entries[name]);
const bulletFonts = entries => Object.entries(entries).filter(([name]) => /\.xml$/.test(name))
  .flatMap(([name, value]) => [...strFromU8(value).matchAll(/<a:buFont\b[^>]*\btypeface="([^"]*)"/g)].map(match => ({part: name, typeface: match[1]})));
const minorLatin = entries => text(entries, theme).match(/<a:minorFont><a:latin typeface="([^"]*)"/)?.[1];
const bodyStyle = entries => text(entries, master).match(/<p:bodyStyle>[\s\S]*?<\/p:bodyStyle>/)[0];

// Carlito-only design: no non-Carlito bullet font anywhere, including slide list markers.
const carlito = {design: {fontScheme: {major: 'Carlito', minor: 'Carlito'}}, slides: [
  {title: 'Plain control', text: 'Current content'},
  {title: 'List', bullets: ['One', {text: 'Two', level: 1}, 'Three']},
]};
const first = await toPptx(carlito, {strictAssets: true});
const entries = parts(first);
assert.equal(minorLatin(entries), 'Carlito');
const masterBullets = [...bodyStyle(entries).matchAll(/<a:buFont\b[^>]*\/>/g)].map(match => match[0]);
assert.deepEqual(masterBullets, Array(9).fill('<a:buFont typeface="+mn-lt"/>'));
assert.doesNotMatch(text(entries, master), /typeface="Arial"/);
const fonts = bulletFonts(entries);
assert.ok(fonts.some(font => /^ppt\/slides\//.test(font.part)), 'Expected explicit slide list marker fonts');
const nonCarlito = fonts.filter(font => font.typeface !== 'Carlito' && font.typeface !== '+mn-lt');
assert.deepEqual(nonCarlito, [], JSON.stringify(nonCarlito));
// The only theme reference resolves to the Carlito minor font.
assert.ok(fonts.filter(font => font.typeface === '+mn-lt').every(font => font.part === master));

// Byte-deterministic output.
assert.equal(Buffer.compare(Buffer.from(first), Buffer.from(await toPptx(carlito, {strictAssets: true}))), 0);

// The default scheme's master bullets follow its own (Aptos) minor font.
const aptos = parts(await toPptx({slides: [{title: 'Plain control', text: 'Current content'}]}, {strictAssets: true}));
assert.equal(minorLatin(aptos), 'Aptos');
assert.equal(bulletFonts(aptos).filter(font => font.part === master && font.typeface === '+mn-lt').length, 9);
assert.doesNotMatch(text(aptos, master), /typeface="Arial"/);

console.log(JSON.stringify({test: 'master-bullet-font', passed: true, masterBullets: masterBullets.length}));
