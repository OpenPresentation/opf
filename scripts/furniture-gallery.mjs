import assert from 'node:assert/strict';
export function furnitureGallery(manifest,candidate,coreManifest){
 const matches=manifest.artifacts.filter(item=>item.name==='@openpresentation/gallery');
 if(candidate){assert.equal(matches.length,1,'Exactly one candidate artifact is required for @openpresentation/gallery');assert.deepEqual(manifest.artifacts,candidate.artifacts,'Furniture artifacts differ from the authenticated candidate graph');return {artifact:matches[0]};}
 assert.equal(matches.length,0,'Unauthenticated gallery artifacts cannot replace a registry dependency');
 const range=coreManifest.dependencies?.['@openpresentation/gallery'];
 assert.match(range??'',/^[~^]?\d+\.\d+\.\d+$/,'Core must declare an ordinary gallery registry version range');
 return {range};
}
