import assert from 'node:assert/strict';
import test from 'node:test';
import {furnitureGallery} from './furniture-gallery.mjs';
const core={dependencies:{'@openpresentation/gallery':'^2.0.0'}};
test('the preview graph ships the workspace gallery as exactly one artifact at the version core stages; the candidate graph requires exactly one authenticated artifact',()=>{
 const artifact={name:'@openpresentation/gallery',version:'0.26.0'};
 const staged={dependencies:{'@openpresentation/gallery':'0.26.0'}};
 assert.deepEqual(furnitureGallery({artifacts:[artifact]},null,staged),{artifact});
 assert.throws(()=>furnitureGallery({artifacts:[]},null,staged),/Exactly one/);
 assert.throws(()=>furnitureGallery({artifacts:[artifact,artifact]},null,staged),/Exactly one/);
 assert.throws(()=>furnitureGallery({artifacts:[artifact]},null,{dependencies:{'@openpresentation/gallery':'^0.26.0'}}),/stage the version/);
 assert.deepEqual(furnitureGallery({artifacts:[artifact]},{artifacts:[artifact]},core),{artifact});
 assert.throws(()=>furnitureGallery({artifacts:[]},{artifacts:[artifact]},core),/Exactly one/);
 assert.throws(()=>furnitureGallery({artifacts:[artifact,artifact]},{artifacts:[artifact]},core),/Exactly one/);
 assert.throws(()=>furnitureGallery({artifacts:[{...artifact,sha256:'tampered'}]},{artifacts:[artifact]},core),/authenticated candidate graph/);
 assert.throws(()=>furnitureGallery({artifacts:[artifact],published:true},{artifacts:[artifact],published:false},core),/authenticated candidate graph/);
});
