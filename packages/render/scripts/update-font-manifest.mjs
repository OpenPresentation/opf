// Explicit maintenance command: review any changed bytes and licenses before committing.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {BUNDLED_FONT_MANIFEST} from '../src/font-manifest.js';
const require=createRequire(import.meta.url),hash=data=>createHash('sha256').update(data).digest('hex');
const root=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const manifest=structuredClone(BUNDLED_FONT_MANIFEST);
for(const pkg of manifest.packages){
  const directory=path.dirname(require.resolve(`${pkg.name}/package.json`));
  const installed=JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'));
  // Base and office packs are runtime dependencies. The script pack (FF-19) is an
  // optional peer that development pins exactly as a devDependency.
  const pinned=pkg.pack==='scripts'?root.devDependencies?.[pkg.name]:root.dependencies[pkg.name];
  assert.equal(pinned,installed.version,`Pin ${pkg.name} exactly before reviewing an updated font manifest.`);
  if(pkg.pack==='scripts'){
    assert.equal(root.peerDependencies?.[pkg.name],installed.version,`Declare ${pkg.name} as an exact optional peer.`);
    assert.equal(root.peerDependenciesMeta?.[pkg.name]?.optional,true,`Declare ${pkg.name} as an optional peer.`);
  }
  assert.match(await readFile(path.join(directory,pkg.licenseFile),'utf8'),/SIL Open Font License, Version 1\.1/,`${pkg.name} must carry the SIL Open Font License 1.1.`);
  pkg.version=installed.version;
  pkg.source=`https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}`;
  pkg.licenseSha256=hash(await readFile(path.join(directory,pkg.licenseFile)));
  for(const face of pkg.faces)face.sha256=hash(await readFile(path.join(directory,face.file)));
}
const contents=`// Generated deliberately by scripts/update-font-manifest.mjs; never during build/install.\nconst freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};\nexport const BUNDLED_FONT_MANIFEST=freeze(${JSON.stringify(manifest,null,2)});\n`;
await writeFile(new URL('../src/font-manifest.js',import.meta.url),contents);
console.log('Updated font manifest. Review provenance, licenses, hashes, style metadata and raster differences before committing.');
