import assert from 'node:assert/strict';
export function furnitureGallery(manifest,candidate,coreManifest){
 const matches=manifest.artifacts.filter(item=>item.name==='@openpresentation/gallery');
 if(candidate){assert.equal(matches.length,1,'Exactly one candidate artifact is required for @openpresentation/gallery');assert.deepEqual(manifest,candidate,'Furniture artifacts differ from the authenticated candidate graph');return {artifact:matches[0]};}
 // MR-23e: the gallery is a workspace package, so the preview graph ships it beside core as its own tarball, at the exact version
 // the staged core depends on (a registry range cannot name a version that is not published yet).
 assert.equal(matches.length,1,'Exactly one gallery artifact is required: the gallery is a workspace package');
 assert.equal(coreManifest.dependencies?.['@openpresentation/gallery'],matches[0].version,'Core must stage the version of the gallery artifact');
 return {artifact:matches[0]};
}
