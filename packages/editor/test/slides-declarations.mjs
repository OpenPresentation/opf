import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gallery} from '@openpresentation/gallery';
import {prepareAddSlide} from '@openpresentation/opf-editor/slides';

const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(manifest.exports['./slides'].types,'./dist/slides.d.ts');
const source=await readFile(new URL('../src/slides.d.ts',import.meta.url),'utf8');
const shipped=await readFile(new URL('../dist/slides.d.ts',import.meta.url),'utf8');
assert.equal(shipped,source,'the shipped declaration matches authored types');
const deck={slides:[{title:'Original'}]};
const result=prepareAddSlide(deck,{layout:'cover',catalogs:[gallery],title:'With host catalog'});
assert.equal(result.presentation.slides[1].layout,'cover');
assert.equal(result.presentation.slides[1].title,'With host catalog');
const sourceUrl='https://example.invalid/owned-catalog';
const record=prepareAddSlide(deck,{layout:'owned',record:{...gallery.layouts.cover,id:'owned'},recordSource:sourceUrl});
assert.ok(JSON.stringify(record.presentation.catalogs).includes(sourceUrl),'the public import forwards actual recordSource semantics');
assert.deepEqual(deck,{slides:[{title:'Original'}]},'dry prepare does not mutate source');
console.log('slide public-import/declaration catalog and record-source controls passed');
