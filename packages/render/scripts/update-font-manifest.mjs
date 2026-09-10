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
  assert.equal(root.dependencies[pkg.name],installed.version,`Pin ${pkg.name} exactly before reviewing an updated font manifest.`);
  pkg.version=installed.version;
  pkg.source=`https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}`;
  pkg.licenseSha256=hash(await readFile(path.join(directory,pkg.licenseFile)));
  for(const face of pkg.faces)face.sha256=hash(await readFile(path.join(directory,face.file)));
}
const contents=`// Generated deliberately by scripts/update-font-manifest.mjs; never during build/install.\nconst freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};\nexport const BUNDLED_FONT_MANIFEST=freeze(${JSON.stringify(manifest,null,2)});\n`;
await writeFile(new URL('../src/font-manifest.js',import.meta.url),contents);
console.log('Updated font manifest. Review provenance, licenses, hashes, style metadata and raster differences before committing.');
