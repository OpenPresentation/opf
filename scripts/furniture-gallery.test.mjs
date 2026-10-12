import assert from 'node:assert/strict';
import test from 'node:test';
import {furnitureGallery} from './furniture-gallery.mjs';
const core={dependencies:{'@openpresentation/gallery':'^2.0.0'}};
test('normal preview graph uses only declared registry gallery; candidate graph requires exactly one artifact',()=>{
 assert.deepEqual(furnitureGallery({artifacts:[]},null,core),{range:'^2.0.0'});
 const artifact={name:'@openpresentation/gallery',version:'2.0.0'};
 assert.deepEqual(furnitureGallery({artifacts:[artifact]},{authorized:true},core),{artifact});
 assert.throws(()=>furnitureGallery({artifacts:[]},{authorized:true},core),/Exactly one/);
 assert.throws(()=>furnitureGallery({artifacts:[artifact,artifact]},{authorized:true},core),/Exactly one/);
 assert.throws(()=>furnitureGallery({artifacts:[artifact]},null,core),/Unauthenticated/);
});
test('normal gallery selection rejects absent, alias, remote and tag dependency sources',()=>{
 for(const range of [undefined,'file:../gallery','link:../gallery','https://example.invalid/gallery.tgz','latest'])assert.throws(()=>furnitureGallery({artifacts:[]},null,{dependencies:{'@openpresentation/gallery':range}}),/ordinary gallery registry/);
});
