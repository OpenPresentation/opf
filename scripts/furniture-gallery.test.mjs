import assert from 'node:assert/strict';
import test from 'node:test';
import {furnitureGallery} from './furniture-gallery.mjs';
test('the preview graph ships the workspace gallery as exactly one artifact at the version core stages',()=>{
 const artifact={name:'@openpresentation/gallery',version:'0.26.0'};
 const staged={dependencies:{'@openpresentation/gallery':'0.26.0'}};
 assert.deepEqual(furnitureGallery({artifacts:[artifact]},staged),{artifact});
 assert.throws(()=>furnitureGallery({artifacts:[]},staged),/Exactly one/);
 assert.throws(()=>furnitureGallery({artifacts:[artifact,artifact]},staged),/Exactly one/);
 assert.throws(()=>furnitureGallery({artifacts:[artifact]},{dependencies:{'@openpresentation/gallery':'^0.26.0'}}),/stage the version/);
});
