// Explicit maintenance command: review any changed bytes and licenses before committing.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {BUNDLED_FONT_MANIFEST} from '../src/font-manifest.js';
import {ALLOWED_FONT_LICENSES,copyrightLine,detectLicenses,reservedFontNames,upstreamUrl} from './font-license.mjs';
const require=createRequire(import.meta.url),hash=data=>createHash('sha256').update(data).digest('hex');
const root=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const manifest=structuredClone(BUNDLED_FONT_MANIFEST);
manifest.packages=manifest.packages.map(entry=>{
  // Keep the derived license fields directly before `faces` so every entry has the same shape.
  const ordered={};
  for(const [key,value] of Object.entries(entry)){
    if(key==='faces')Object.assign(ordered,{reservedFontNames:[],upstream:null,copyright:null});
    if(!['reservedFontNames','upstream','copyright'].includes(key))ordered[key]=value;
  }
  return ordered;
});
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
  // FF-31: the license is read from the file the package ships, never assumed from the source site.
  const licenseText=await readFile(path.join(directory,pkg.licenseFile),'utf8'),detected=detectLicenses(licenseText);
  assert.deepEqual(detected,[pkg.license],`${pkg.name} declares ${pkg.license} but its ${pkg.licenseFile} reads as ${detected.join('+')||'an unrecognised license'}.`);
  assert.ok(ALLOWED_FONT_LICENSES.includes(pkg.license),`${pkg.name} is licensed ${pkg.license}, which is not an allowed bundled-font license (${ALLOWED_FONT_LICENSES.join(', ')}).`);
  pkg.reservedFontNames=reservedFontNames(licenseText);
  pkg.upstream=upstreamUrl(licenseText);
  pkg.copyright=copyrightLine(licenseText);
  pkg.version=installed.version;
  pkg.source=`https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}`;
  pkg.licenseSha256=hash(await readFile(path.join(directory,pkg.licenseFile)));
  for(const face of pkg.faces)face.sha256=hash(await readFile(path.join(directory,face.file)));
}
const contents=`// Generated deliberately by scripts/update-font-manifest.mjs; never during build/install.\nconst freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};\nexport const BUNDLED_FONT_MANIFEST=freeze(${JSON.stringify(manifest,null,2)});\n`;
await writeFile(new URL('../src/font-manifest.js',import.meta.url),contents);
console.log('Updated font manifest. Review provenance, licenses, hashes, style metadata and raster differences before committing.');
