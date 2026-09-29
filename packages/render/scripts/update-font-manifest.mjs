// Explicit maintenance command: review any changed bytes and licenses before committing.
//   node scripts/update-font-manifest.mjs            re-hash installed npm packages (base, office, scripts) and the vendored faces
//   node scripts/update-font-manifest.mjs --vendor   also re-download every vendored family from its recorded upstream
//
// A vendored entry (FF-31) is a directory inside this package (`vendored`, for example fonts/carlito): only the listed faces,
// the upstream license notice as OFL.txt and, for the open pack, a generated PROVENANCE.json. Two kinds exist:
//   - git upstream (every face has upstreamFile { url, sha256 }): the copyright holder's byte-identical files at one commit
//     (`version`), from one repository directory. Required for a family with an OFL Reserved Font Name. The notice comes from
//     `upstreamLicenseUrl`, or from OFL.txt next to the faces when that is absent.
//   - npm-derived (faces have npmFile; entry name and version are the npm package): instanced statics of a family with no
//     Reserved Font Name. `npm pack` needs network and a `tar` on PATH.
// --vendor downloads the recorded URLs or npm version, reads the SPDX id from the notice that ships, refuses a package
// without a permissive font license (OFL-1.1, Apache-2.0, MIT, UFL-1.0), copies only the listed faces and rewrites the
// hashes. Without --vendor the files are only re-hashed, and a git-upstream face must still equal its recorded upstream file.
// To bump a family, edit its recorded commit or version (and face URLs), run --vendor, then review the diff.
import {readFile,writeFile,mkdir,mkdtemp,copyFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {BUNDLED_FONT_MANIFEST} from '../src/font-manifest.js';
import {ALLOWED_FONT_LICENSES,copyrightLine,detectLicenses,pinnedRawUpstream,provenUnmodified,reservedFontNames,upstreamUrl} from './font-license.mjs';
const require=createRequire(import.meta.url),hash=data=>createHash('sha256').update(data).digest('hex');
const vendorMode=process.argv.includes('--vendor');
const repoRoot=fileURLToPath(new URL('../',import.meta.url));
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

async function download(url){
  const response=await fetch(url);
  assert.ok(response.ok,`${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
// Vendor a git upstream: each face and the notice are downloaded from their recorded commit-pinned raw URLs.
async function fetchGit(pkg,target){
  const parts=pinnedRawUpstream(pkg.faces[0].upstreamFile.url);
  assert.ok(parts&&parts.commit===pkg.version,`${pkg.name}: faces must be pinned to the entry's commit (version).`);
  const licenseUrl=pkg.upstreamLicenseUrl??`https://raw.githubusercontent.com/${parts.repository}/${parts.commit}/${parts.directory}/${pkg.licenseFile}`;
  assert.ok(licenseUrl.includes(pkg.version),`${pkg.name}: the notice URL must name the pinned commit.`);
  await rm(target,{recursive:true,force:true});
  await mkdir(target,{recursive:true});
  await writeFile(path.join(target,pkg.licenseFile),await download(licenseUrl));
  for(const face of pkg.faces){
    assert.ok(face.upstreamFile.url.includes(pkg.version),`${pkg.name}: ${face.file} URL must name the pinned commit.`);
    await writeFile(path.join(target,face.file),await download(face.upstreamFile.url));
  }
}
// Vendor an npm package version (families with no Reserved Font Name only).
async function fetchNpm(pkg,target){
  const work=await mkdtemp(path.join(tmpdir(),'opf-vendor-'));
  try{
    // Prefer the npm that launched this script; otherwise the npm on PATH (a .cmd shim on Windows).
    const cli=process.env.npm_execpath?.endsWith('npm-cli.js')?process.env.npm_execpath:undefined;
    const npm=cli?process.execPath:process.platform==='win32'?'npm.cmd':'npm';
    const run=(command,args)=>{
      const full=cli&&command===npm?[cli,...args]:args;
      const result=spawnSync(command,full,{cwd:work,encoding:'utf8',shell:!cli&&process.platform==='win32'&&command===npm});
      assert.equal(result.status,0,`${command} ${full.join(' ')} failed: ${result.stderr}`);
      return result.stdout;
    };
    const packed=JSON.parse(run(npm,['pack',`${pkg.name}@${pkg.version}`,'--json','--pack-destination','.','--ignore-scripts']))[0];
    assert.equal(packed.version,pkg.version,`${pkg.name}: fetched ${packed.version}, expected ${pkg.version}`);
    run('tar',['-xzf',packed.filename]);
    const upstream=path.join(work,'package');
    await rm(target,{recursive:true,force:true});
    await mkdir(target,{recursive:true});
    await copyFile(path.join(upstream,pkg.npmLicenseFile),path.join(target,pkg.licenseFile));
    for(const face of pkg.faces)await copyFile(path.join(upstream,face.npmFile),path.join(target,face.file));
    pkg.integrity=packed.integrity;
  }finally{await rm(work,{recursive:true,force:true});}
}

for(const [index,pkg] of manifest.packages.entries()){
  // FF-31: a vendored entry is a directory of upstream files inside this package (for example fonts/carlito).
  const vendored=pkg.vendored!==undefined,fromGit=vendored&&pkg.faces.every(face=>face.upstreamFile);
  const directory=vendored?path.join(repoRoot,pkg.vendored):path.dirname(require.resolve(`${pkg.name}/package.json`));
  if(vendored){
    assert.match(pkg.vendored,/^fonts\/[a-z0-9-]+$/,`${pkg.name}: vendored must be a fonts/<name> directory.`);
    assert.ok(!root.dependencies?.[pkg.name]&&!root.devDependencies?.[pkg.name],`${pkg.name} is vendored; remove it from dependencies.`);
    if(vendorMode&&fromGit)await fetchGit(pkg,directory);
    else if(vendorMode)await fetchNpm(pkg,directory);
  }else{
    const installed=JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'));
    // Base and office packs are runtime dependencies. The script pack (FF-19) is an
    // optional peer that development pins exactly as a devDependency.
    const pinned=pkg.pack==='scripts'?root.devDependencies?.[pkg.name]:root.dependencies[pkg.name];
    assert.equal(pinned,installed.version,`Pin ${pkg.name} exactly before reviewing an updated font manifest.`);
    if(pkg.pack==='scripts'){
      assert.equal(root.peerDependencies?.[pkg.name],installed.version,`Declare ${pkg.name} as an exact optional peer.`);
      assert.equal(root.peerDependenciesMeta?.[pkg.name]?.optional,true,`Declare ${pkg.name} as an optional peer.`);
    }
    pkg.version=installed.version;
    pkg.source=`https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}`;
  }
  // FF-31: the license is read from the file the package ships, never assumed from the source site.
  const licenseBytes=await readFile(path.join(directory,pkg.licenseFile)),licenseText=licenseBytes.toString('utf8'),detected=detectLicenses(licenseText);
  assert.deepEqual(detected,[pkg.license],`${pkg.name} declares ${pkg.license} but its ${pkg.licenseFile} reads as ${detected.join('+')||'an unrecognised license'}.`);
  assert.ok(ALLOWED_FONT_LICENSES.includes(pkg.license),`${pkg.name} is licensed ${pkg.license}, which is not an allowed bundled-font license (${ALLOWED_FONT_LICENSES.join(', ')}).`);
  pkg.reservedFontNames=reservedFontNames(licenseText);
  pkg.upstream=upstreamUrl(licenseText);
  pkg.copyright=copyrightLine(licenseText);
  pkg.licenseSha256=hash(licenseBytes);
  for(const face of pkg.faces){
    face.sha256=hash(await readFile(path.join(directory,face.file)));
    if(fromGit){
      // Byte-identical to the copyright holder's file at the pinned commit. In --vendor mode the download defines the pin.
      if(vendorMode)face.upstreamFile={url:face.upstreamFile.url,sha256:face.sha256};
      assert.ok(provenUnmodified(face),`${pkg.vendored}/${face.file} (sha256 ${face.sha256}) is not the recorded unmodified upstream file ${face.upstreamFile?.url} (sha256 ${face.upstreamFile?.sha256}); vendored fonts must be byte-identical upstream files.`);
    }
  }
  if(fromGit){
    const parts=pinnedRawUpstream(pkg.faces[0].upstreamFile.url);
    pkg.source=`https://github.com/${parts.repository}/tree/${pkg.version}/${parts.directory}`;
  }else if(vendored)pkg.source=`https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}`;
  if(pkg.pack==='open'){
    // Provenance beside the faces: what is needed to re-fetch and verify them, written from the manifest only.
    const provenance={
      upstream:fromGit?{source:pkg.source,commit:pkg.version,...(pkg.upstreamLicenseUrl?{licenseUrl:pkg.upstreamLicenseUrl}:{})}:{package:pkg.name,version:pkg.version,source:pkg.source,...(pkg.integrity?{integrity:pkg.integrity}:{})},
      license:pkg.license,licenseFile:pkg.licenseFile,licenseSha256:pkg.licenseSha256,
      reservedFontNames:pkg.reservedFontNames,copyright:pkg.copyright,
      ...(pkg.renamedFrom?{renamedFrom:pkg.renamedFrom}:{}),
      faces:pkg.faces.map(face=>({file:face.file,family:face.family,weight:face.weight,italic:face.italic,sha256:face.sha256,...(face.upstreamFile?{upstreamUrl:face.upstreamFile.url}:{npmFile:face.npmFile})})),
    };
    await writeFile(path.join(directory,'PROVENANCE.json'),JSON.stringify(provenance,null,2)+'\n');
    // Stable key order: identity, vendoring, license, derived license fields, faces.
    const order=['name','vendored','version','pack','source','license','licenseFile','licenseSha256','upstreamLicenseUrl','npmLicenseFile','integrity','renamedFrom','reservedFontNames','upstream','copyright','faces'];
    assert.deepEqual(Object.keys(pkg).filter(key=>!order.includes(key)),[],`${pkg.name}: unknown manifest keys`);
    manifest.packages[index]=Object.fromEntries(order.filter(key=>pkg[key]!==undefined).map(key=>[key,pkg[key]]));
  }
}
const contents=`// Generated deliberately by scripts/update-font-manifest.mjs; never during build/install.\nconst freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};\nexport const BUNDLED_FONT_MANIFEST=freeze(${JSON.stringify(manifest,null,2)});\n`;
await writeFile(new URL('../src/font-manifest.js',import.meta.url),contents);
console.log(`Updated font manifest${vendorMode?' from freshly downloaded upstream sources':''}. Review provenance, licenses, hashes, style metadata and raster differences before committing.`);
