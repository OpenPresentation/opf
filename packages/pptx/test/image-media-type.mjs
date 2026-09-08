import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync, zipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { toPptx, fromPptx } from '../dist/index.js';
const parser = new XMLParser({ignoreAttributes:false});
const text = bytes => new TextDecoder().decode(bytes);
const array = value => value == null ? [] : [value].flat();
const fixtures = [['wide.png','image/png'],['wide.jpg','image/jpeg'],['wide.gif','image/gif'],['wide.webp','image/webp']];
const directory = await mkdtemp(join(tmpdir(),'opf-image-types-'));
let checked = 0;
try {
 for (const [filename, mime] of fixtures) {
  const bytes = new Uint8Array(await readFile(new URL(`fixtures/images/${filename}`,import.meta.url)));
  const wrongType = mime === 'image/png' ? 'image/jpeg' : 'image/png';
  const wrongPath = join(directory, mime === 'image/png' ? 'wrong.jpg' : 'wrong.png');
  await writeFile(wrongPath,bytes);
  for (const mode of ['bytes','object','typed-object','uri','path','host-path','host-uri','host-string-path']) {
   let calls = 0;
   const uri = `data:${wrongType};base64,${Buffer.from(bytes).toString('base64')}`;
   const source = mode === 'uri' ? uri : mode === 'path' ? wrongPath : 'https://example.invalid/asset';
   const value = mode === 'bytes' ? bytes : mode === 'object' ? {data:bytes} : mode === 'typed-object' ? {data:bytes,mediaType:wrongType} : mode === 'host-uri' ? uri : mode === 'host-string-path' ? wrongPath : {path:wrongPath};
   const deck = {slides:[{image:{src:source,mediaType:wrongType,alt:'Original image'}}]};
   const options = {imageFormat:"preserve",strictAssets:true,...(['uri','path'].includes(mode) ? {} : {imageResolver:()=>{calls++;return value;}})};
   const output = await toPptx(deck,options), entries = unzipSync(output);
   assert.equal(calls,['uri','path'].includes(mode)?0:1);
   const relationships = array(parser.parse(text(entries['ppt/slides/_rels/slide1.xml.rels'])).Relationships.Relationship);
   const rel = relationships.find(rel=>rel['@_Type'].endsWith('/image'));
   const mediaPath = 'ppt/' + rel['@_Target'].replace(/^\.\.\//,'');
   assert.ok(entries[mediaPath],`${filename} ${mode}: image relationship resolves`);
   assert.deepEqual(entries[mediaPath],bytes,'Compressed image bytes must remain unchanged');
   assert.match(mediaPath,new RegExp(mime==='image/jpeg'?'\\.jpe?g$':`\\.${mime.split('/')[1]}$`));
   const types = parser.parse(text(entries['[Content_Types].xml'])).Types;
   const override = array(types.Override).find(item=>item['@_PartName']==='/'+mediaPath);
   const defaultType = array(types.Default).find(item=>item['@_Extension']===mediaPath.split('.').at(-1));
   assert.equal((override??defaultType)['@_ContentType'],mime,`${filename} ${mode}: native content type`);
   const imported = await fromPptx(output);
   const image = imported.slides[0].blocks.find(block=>block.image).image;
   assert.equal(image.src,`data:${mime};base64,${Buffer.from(bytes).toString('base64')}`);
   assert.equal(image.alt,'Original image');
   if (mode === 'bytes') {
    // Imports must also recover correctly typed data URIs from older/mislabeled
    // native files, independently of this exporter's repaired content types.
    const oldPath = mediaPath.replace(/\.[^.]+$/, mime === 'image/png' ? '.jpg' : '.png');
    entries[oldPath] = entries[mediaPath]; delete entries[mediaPath];
    for (const [part, data] of Object.entries(entries)) {
     if (part.endsWith('.rels')) entries[part] = new TextEncoder().encode(text(data).replaceAll(mediaPath.slice(4),oldPath.slice(4)));
    }
    const legacy = await fromPptx(zipSync(entries));
    assert.equal(legacy.slides[0].blocks.find(block=>block.image).image.src,image.src);
   }
   checked++;
  }
 }
} finally { await rm(directory,{recursive:true,force:true}); }
console.log(`Image media types passed: ${checked} byte/object/data-URI/local/host-path cases, native extensions/content types, byte preservation and imported MIME.`);
