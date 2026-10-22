import assert from 'node:assert/strict';
// MR-23e: the gallery is a workspace package, so the preview graph ships it beside core as its own tarball, at the exact version
// the staged core depends on (a registry range cannot name a version that is not published yet). MR-34: the gallery is always in the
// workspace; the old candidate graph (an unpublished gallery commit built beside a published core) is gone.
export function furnitureGallery(manifest,coreManifest){
 const matches=manifest.artifacts.filter(item=>item.name==='@openpresentation/gallery');
 assert.equal(matches.length,1,'Exactly one gallery artifact is required: the gallery is a workspace package');
 assert.equal(coreManifest.dependencies?.['@openpresentation/gallery'],matches[0].version,'Core must stage the version of the gallery artifact');
 return {artifact:matches[0]};
}
