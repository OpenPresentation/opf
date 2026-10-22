import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';
import {cellText} from '../dist/data-provenance.js';
import {decodeTextTag, encodeTextTag} from '../dist/code-provenance.js';

const read = async bytes => {
  const diagnostics = [];
  const deck = await fromPptx(bytes, {onDiagnostic: issue => diagnostics.push(issue)});
  return {table: deck.slides[0].table ?? deck.slides[0].blocks.find(block => block.table).table, diagnostics};
};
const edit = (bytes, transform) => {
  const parts = unzipSync(bytes);
  for (const name of Object.keys(parts)) if (/\.(xml|rels)$/.test(name)) parts[name] = strToU8(transform(name, strFromU8(parts[name])));
  return zipSync(parts);
};
const changed = result => result.diagnostics.filter(issue => issue.code === 'table-data-provenance-changed');

// Unresolved sources report exactly once; valid bytes are embedded. No request can escape to the network.
const network = globalThis.fetch;
globalThis.fetch = () => {throw Error('Network access is forbidden in the exporter.');};
try {
  for (const source of ['https://example.invalid/missing.png', 'asset:missing', 'data:image/png;base64,bm90LWFuLWltYWdl', 'data:image/svg+xml;base64,@@@']) {
    const diagnostics = [];
    const bytes = await toPptx({slides: [{title: 'Image', image: source}]}, {onDiagnostic: issue => diagnostics.push(issue)});
    assert.deepEqual(diagnostics.filter(issue => issue.code === 'unresolved-asset').map(issue => issue.path), ['slides.0.image']);
    assert.match(strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']), /Image unavailable/);
  }
  await assert.rejects(toPptx({slides: [{image: 'https://example.invalid/missing.png'}]}, {strictAssets: true}), error => error.code === 'unsupported-asset');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  const diagnostics = [];
  const parts = unzipSync(await toPptx({slides: [{image: png}]}, {onDiagnostic: issue => diagnostics.push(issue)}));
  assert.equal(diagnostics.filter(issue => issue.code === 'unresolved-asset').length, 0);
  assert.match(strFromU8(parts['ppt/slides/slide1.xml']), /<p:pic>/);
  assert.ok(Object.keys(parts).some(name => /^ppt\/media\/.*\.png$/.test(name)));
  const local = await mkdtemp(path.join(tmpdir(), 'opf-local-image-'));
  try {
    await writeFile(path.join(local, 'pixel.png'), Buffer.from(png.split(',')[1], 'base64'));
    const localDiagnostics = [];
    const localParts = unzipSync(await toPptx({slides: [{image: 'pixel.png'}]}, {baseDir: local, strictAssets: true, onDiagnostic: issue => localDiagnostics.push(issue)}));
    assert.match(strFromU8(localParts['ppt/slides/slide1.xml']), /<p:pic>/);
    assert.equal(localDiagnostics.filter(issue => issue.code === 'unresolved-asset').length, 0);
  } finally {await rm(local, {recursive: true, force: true});}
  const resolvedDiagnostics = [];
  const resolved = unzipSync(await toPptx({slides: [{image: 'https://example.invalid/private.png'}]}, {imageResolver: () => png, onDiagnostic: issue => resolvedDiagnostics.push(issue)}));
  assert.match(strFromU8(resolved['ppt/slides/slide1.xml']), /<p:pic>/);
  assert.equal(resolvedDiagnostics.filter(issue => issue.code === 'unresolved-asset').length, 0);

} finally {globalThis.fetch = network;}

const authored = {columns: ['Number', 'Text'], rows: [[12, '12'], [-2.5, 'negative'], [0, null], [1.25, {value: 'styled', style: {fill: '#FF0000'}}]]};
const deck = {slides: [{title: 'Types', table: authored}]};
const bytes = await toPptx(deck);
assert.deepEqual((await read(bytes)).table, authored);
assert.equal(changed(await read(bytes)).length, 0);
assert.deepEqual((await read(await toPptx({slides: [{table: {rows: [[12, '12'], [0, -1.25]]}}]}))).table, {rows: [[12, '12'], [0, -1.25]]});

// A changed native cell keeps displayed text/style, while each untouched sibling still restores its own scalar form.
const editedText = await read(edit(bytes, (name, xml) => name === 'ppt/slides/slide1.xml' ? xml.replace('<a:t>12</a:t>', '<a:t>13</a:t>') : xml));
assert.equal(cellText(editedText.table.rows[0][0]), '13');
assert.equal(editedText.table.rows[0][1], '12');
assert.equal(editedText.table.rows[1][0], -2.5);
assert.equal(changed(editedText).length, 1);
const editedStyle = await read(edit(bytes, (name, xml) => name === 'ppt/slides/slide1.xml' ? xml.replace(/<a:tr\b[^>]*>([\s\S]*?)<\/a:tr>/g, (row, body) => body.includes('<a:t>-2.5</a:t>') ? row.replace(/(<\/a:lnB>)(?:<a:solidFill>[\s\S]*?<\/a:solidFill>|<a:noFill\s*\/>)(\s*<\/a:tcPr>)/, '$1<a:solidFill><a:srgbClr val="00FF00"/></a:solidFill>$2') : row) : xml));
assert.equal(cellText(editedStyle.table.rows[1][0]), '-2.5');
assert.equal(editedStyle.table.rows[1][0].style.fill, '#00FF00');
assert.equal(editedStyle.table.rows[2][0], 0);
assert.equal(changed(editedStyle).length, 1);
const editedTheme = await read(edit(bytes, (name, xml) => name === 'ppt/theme/theme1.xml' ? xml.replace(/(<a:accent1><a:srgbClr val=")[^"]+/, '$100FF00') : xml));
assert.equal(changed(editedTheme).length, 1, 'theme edits guard authored style absence as well');
assert.equal(typeof editedTheme.table.rows[0][0], 'object');

// Native relationship edits are part of a rich cell's evidence even when its r:id and displayed text stay fixed.
const linked = await toPptx({slides: [{table: {rows: [[[{text: 'Link', link: 'https://example.com/original'}], 12]]}}]});
const changedLink = await read(edit(linked, (name, xml) => name === 'ppt/slides/_rels/slide1.xml.rels' ? xml.replace('https://example.com/original', 'https://example.com/edited') : xml));
const linkedValue = changedLink.table.rows[0][0].value ?? changedLink.table.rows[0][0];
assert.equal(linkedValue.find(run => run.text === 'Link').link, 'https://example.com/edited');
assert.equal(changedLink.table.rows[0][1], 12);
assert.equal(changed(changedLink).length, 1);

// Reject malformed authored records and evidence before restoration; records are data, never trusted source.
const malformed = await read(edit(bytes, (name, xml) => /^ppt\/tags\/opfData/.test(name) ? xml.replace(/val="([A-F0-9]+)"/, (_match, value) => {
  const record = decodeTextTag(value);
  delete record.evidence;
  return `val="${encodeTextTag(record)}"`;
}) : xml));
assert.ok(malformed.diagnostics.some(issue => issue.code === 'invalid-data-provenance'));
assert.equal(cellText(malformed.table.rows[0][0]), '12');
for (const provenance of ['references-only', false]) {
  const lossy = await read(await toPptx(deck, {provenance}));
  assert.equal(cellText(lossy.table.rows[0][0]), '12');
  assert.notDeepEqual(lossy.table, authored);
}

// Class-based providers retain inherited methods and their original receiver when script measurement is installed.
class CustomMeasurement {
  constructor() {this.weight = 500; this.measures = 0; this.outlines = 0; this.resolutions = 0;}
  measure(text, size, style) {this.measures++; return text.length * size * (style.fontWeight === this.weight ? .45 : .8);}
  resolveStyle(style) {return {...style, fontWeight: this.weight};}
  resolveFont() {this.resolutions++; return {substitute: false};}
  outlineBounds(text, size) {this.outlines++; return {x: 0, y: -size, width: text.length * size * .45, height: size};}
}
const provider = new CustomMeasurement();
const custom = unzipSync(await toPptx({slides: [{title: 'Custom measured heading', text: 'Body with caller metrics'}]}, {fonts: {textMeasurement: provider}}));
const customXml = strFromU8(custom['ppt/slides/slide1.xml']);
assert.ok(provider.measures > 0 && provider.outlines > 0 && provider.resolutions > 0, 'inherited methods execute with their provider state');
assert.ok([...customXml.matchAll(/<a:rPr\b[^>]*>/g)].every(([run]) => !/\bb="1"/.test(run)), 'inherited chosen weight is retained in native runs');

// A custom provider still measures when the optional renderer is absent. The loader simulates an uninstalled peer.
const temporary = await mkdtemp(path.join(tmpdir(), 'opf custom measurement '));
try {
  const loader = path.join(temporary, 'loader.mjs');
  await writeFile(loader, `export async function resolve(specifier, context, next) {if (specifier === '@openpresentation/opf-render/fonts') {const error = new Error('optional peer absent'); error.code = 'ERR_MODULE_NOT_FOUND'; throw error;} return next(specifier, context);}`);
  const entry = new URL('../dist/index.js', import.meta.url).href;
  const script = `import {toPptx} from ${JSON.stringify(entry)};let calls = 0; const fonts = {textMeasurement: {measure(text, size) {calls++;return text.length * size / 2;},resolveStyle(style) {return style;}}}; const bytes = await toPptx({slides: [{title:'Custom',text:'Caller measurement remains active'}]}, {fonts});if (!calls || !bytes.length) throw Error('Custom measurement was lost');`;
  execFileSync(process.execPath, ['--no-warnings', '--loader', pathToFileURL(loader).href, '--input-type=module', '-e', script], {stdio: 'pipe'});
} finally {await rm(temporary, {recursive: true, force: true});}
console.log('RR-59 integrity: unresolved image diagnostics, exact scalar/style table recovery, native edits, hostile evidence, provenance modes and optional-peer custom measurement passed.');
