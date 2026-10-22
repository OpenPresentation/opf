// FF-31: every bundled font package must carry a verified, allowed license.
// The license is read from the LICENSE/OFL file the installed package ships (or, for a vendored entry, the file in its
// fonts/<name> directory), detected by text, and compared with what src/font-manifest.js declares and with the allowlist.
// File and license hashes must still match. New manifest entries must include license, licenseFile, licenseSha256,
// reservedFontNames, upstream and copyright: run `node scripts/update-font-manifest.mjs` to fill them.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BUNDLED_FONT_MANIFEST} from '../src/font-manifest.js';
import {ALLOWED_FONT_LICENSES,RFN_PENDING_UNMODIFIED_UPSTREAM,copyrightLine,declaresReservedFontName,detectLicense,detectLicenses,isUnmodifiedUpstreamUrl,modifiedFaceUsesReservedName,nameContainsReservedName,pinnedRawUpstream,provenUnmodified,reservedFontNames,upstreamUrl} from '../scripts/font-license.mjs';

const require=createRequire(import.meta.url),hash=data=>createHash('sha256').update(data).digest('hex');
const rootPackage=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));

// Detector self-checks: each allowed license is recognised, copyleft and unknown texts are not accepted.
const mitText='MIT License\n\nCopyright (c) 2020 Example\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.\n';
const oflDivider='-----------------------------------------------------------\nSIL OPEN FONT LICENSE Version 1.1 - 26 February 2007\n-----------------------------------------------------------\n';
const fixtures={
  'OFL-1.1':`Copyright 2020 The X Project Authors, with Reserved Font Name "X"\n\n${oflDivider}`,
  'Apache-2.0':'                                 Apache License\n                           Version 2.0, January 2004\n',
  'UFL-1.0':'-------------------------------\nUBUNTU FONT LICENCE Version 1.0\n-------------------------------\n',
  MIT:mitText,
};
for(const [id,text] of Object.entries(fixtures)){
  assert.equal(detectLicense(text),id,`detector must recognise ${id}`);
  assert.ok(ALLOWED_FONT_LICENSES.includes(id),`${id} is on the allowlist`);
}
assert.equal(detectLicense('GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007'),'GPL');
assert.equal(detectLicense('GNU LESSER GENERAL PUBLIC LICENSE\nVersion 3'),'LGPL');
assert.equal(detectLicense('GNU AFFERO GENERAL PUBLIC LICENSE\nVersion 3'),'AGPL');
for(const id of ['GPL','LGPL','AGPL','proprietary'])assert.ok(!ALLOWED_FONT_LICENSES.includes(id),`${id} must not be allowed`);
assert.equal(detectLicense('Copyright (c) Some Foundry. All rights reserved. Not for redistribution.'),null,'unrecognised text has no license');
assert.deepEqual(detectLicenses(`${fixtures['OFL-1.1']}\n${mitText}`),['OFL-1.1','MIT'],'mixed texts are reported as mixed');
assert.equal(detectLicense(`${fixtures['OFL-1.1']}\n${mitText}`),null,'mixed texts are not accepted as one license');
assert.deepEqual(reservedFontNames(fixtures['OFL-1.1']),['X']);
assert.deepEqual(reservedFontNames(`Copyright 2020 The Y Authors (https://example.test/y)\n\n${oflDivider}"Reserved Font Name" refers to any names specified as such after the copyright statement(s).\n`),[],'the OFL definition of RFN is not a declaration');
assert.equal(upstreamUrl('Copyright 2011 The Roboto Project Authors (https://github.com/googlefonts/roboto-classic)\n'),'https://github.com/googlefonts/roboto-classic');
assert.equal(copyrightLine('\n  Copyright 2011 A\nrest'),'Copyright 2011 A');

assert.ok(declaresReservedFontName(fixtures['OFL-1.1']));
assert.ok(!declaresReservedFontName(`Copyright 2020 The Y Authors

${oflDivider}"Reserved Font Name" refers to any names specified as such after the copyright statement(s).
`));
const pinnedRaw='https://raw.githubusercontent.com/google/fonts/23e54b51ddffbc7713c583748e3bd86f62b1fa4a/ofl/carlito/Carlito-Regular.ttf';
assert.ok(isUnmodifiedUpstreamUrl(pinnedRaw));
assert.ok(!isUnmodifiedUpstreamUrl(pinnedRaw.replace('23e54b51ddffbc7713c583748e3bd86f62b1fa4a','main')),'a branch name is not a pin');
assert.ok(!isUnmodifiedUpstreamUrl(pinnedRaw.replace('/google/fonts/','/someone/else/')),'repository must be allowlisted');
assert.ok(!isUnmodifiedUpstreamUrl('https://www.npmjs.com/package/@fontsource/raleway/v/5.3.0'),'a repackaged npm file is not upstream');

// Reserved Font Name parsing fails closed.
const rfnHeader=text=>`${text}

${oflDivider}`;
assert.deepEqual(reservedFontNames(rfnHeader('Copyright 2020 The Z Authors, with Reserved Font Name Zed.')),['Zed'],'unquoted names are read');
assert.deepEqual(reservedFontNames(rfnHeader('Copyright 2020 The Z Authors (Reserved Font Name "Zed")')),['Zed'],'parenthesised names are read');
assert.deepEqual(reservedFontNames(rfnHeader('Copyright 2020 A, with Reserved Font Names "Alpha" and "Beta"')),['Alpha','Beta']);
assert.throws(()=>reservedFontNames(rfnHeader('Copyright 2020 The Z Authors. This font has no Reserved Font Name.')),/no name could be read/,'a mention with no readable name must throw, not report none');
assert.throws(()=>reservedFontNames(rfnHeader('Copyright 2020 The Z Authors. Reserved Font Name (see notes).')),/no name could be read/);
assert.deepEqual(reservedFontNames(rfnHeader('Copyright 2020 The Z Authors')),[]);
assert.deepEqual(reservedFontNames(['Copyright 2020 The Z Authors','','This Font Software is licensed under the SIL Open Font License, Version 1.1.','"Reserved Font Name" refers to any names specified as such after the copyright statement(s).',''].join(String.fromCharCode(10))),[],'the definition paragraph is not a declaration even without a divider');
assert.ok(nameContainsReservedName(['Carlito','Carlito_400Regular.ttf'],['Carlito']));
assert.ok(nameContainsReservedName(['My CARLITO Pro'],['Carlito']),'case-insensitive');
assert.ok(!nameContainsReservedName(['Noto Sans JP','NotoSansJP_400Regular.ttf'],['Source']),'a family that does not use the reserved name is fine when modified');

// The RFN predicate the manifest check uses: a modified face named with the reserved name is caught, proof clears it.
const upstreamSha='f6418f708baede9789daef5d458c0f53d2a888af9820e8062934e504fedc6595';
const subsetFace={file:'400Regular/Carlito_400Regular.ttf',family:'Carlito',weight:400,italic:false,sha256:'ca019755404c45627a8566915df99068949dc32ee2bce48d6aeee7542d2a0a89'};
assert.ok(modifiedFaceUsesReservedName({reservedFontNames:['Carlito'],faces:[subsetFace]}),'a subset named Carlito needs proof');
assert.ok(modifiedFaceUsesReservedName({reservedFontNames:['Carlito'],faces:[{...subsetFace,upstreamFile:{url:pinnedRaw,sha256:upstreamSha}}]}),'an upstreamFile hash that differs from the face is not proof');
assert.ok(modifiedFaceUsesReservedName({reservedFontNames:['Carlito'],faces:[{...subsetFace,sha256:upstreamSha,upstreamFile:{url:pinnedRaw.replace('23e54b51ddffbc7713c583748e3bd86f62b1fa4a','main'),sha256:upstreamSha}}]}),'an unpinned URL is not proof');
assert.ok(!modifiedFaceUsesReservedName({reservedFontNames:['Carlito'],faces:[{...subsetFace,sha256:upstreamSha,upstreamFile:{url:pinnedRaw,sha256:upstreamSha}}]}),'a byte-identical pinned upstream face is fine');
assert.ok(!modifiedFaceUsesReservedName({reservedFontNames:['Source'],faces:[{...subsetFace,family:'Noto Sans JP',file:'NotoSansJP_400Regular.ttf'}]}),'a modified face that does not use the reserved name is fine');
// Instanced (npm-derived) faces: the name-contains rule rejects a modified face named with its reserved name (Carlito, Raleway, Lora, Playfair
// Display) and allows one that does not (Bitter reserves "Bitter Pro" but is named "Bitter"; Noto Sans JP reserves "Source").
for(const [family,file,reserved] of [['Carlito','Carlito_400Regular.ttf','Carlito'],['Raleway','Raleway_400Regular.ttf','Raleway'],['Lora','Lora_400Regular.ttf','Lora'],['Playfair Display','PlayfairDisplay_400Regular.ttf','Playfair Display'],['Bitter Pro','Bitter_400Regular.ttf','Bitter Pro'],['Bitter Pro','Bitter_Pro_400Regular.ttf','Bitter Pro']])
  assert.ok(modifiedFaceUsesReservedName({reservedFontNames:[reserved],faces:[{file:`400Regular/${file}`,family,weight:400,italic:false,sha256:'0'.repeat(64),npmFile:`400Regular/${file}`}]}),`an instanced ${family} (${file}) is named with its Reserved Font Name`);
for(const [family,file,reserved] of [['Bitter','Bitter_400Regular.ttf','Bitter Pro'],['Noto Sans JP','NotoSansJP_400Regular.ttf','Source']])
  assert.ok(!modifiedFaceUsesReservedName({reservedFontNames:[reserved],faces:[{file:`400Regular/${file}`,family,weight:400,italic:false,sha256:'0'.repeat(64),npmFile:`400Regular/${file}`}]}),`an instanced ${family} does not carry the Reserved Font Name ${reserved}`);
assert.deepEqual(pinnedRawUpstream(pinnedRaw),{repository:'google/fonts',commit:'23e54b51ddffbc7713c583748e3bd86f62b1fa4a',directory:'ofl/carlito',file:'Carlito-Regular.ttf'});
assert.equal(pinnedRawUpstream(pinnedRaw.replace('23e54b51ddffbc7713c583748e3bd86f62b1fa4a','main')),null);

// Manifest checks against the installed npm packages and the vendored directories this package ships.
const packages=BUNDLED_FONT_MANIFEST.packages;
assert.ok(packages.length>0,'the manifest bundles at least one font package');
const rows=[],rfnPackages=[],vendoredEntries=[];
for(const pkg of packages){
  const label=`${pkg.name}@${pkg.version}`,vendored=pkg.vendored!==undefined;
  for(const field of ['name','version','pack','source','license','licenseFile','licenseSha256','reservedFontNames','upstream','copyright'])
    assert.ok(pkg[field]!==undefined&&pkg[field]!==null&&pkg[field]!=='',`${label}: manifest entry is missing "${field}"; run scripts/update-font-manifest.mjs`);
  assert.ok(Array.isArray(pkg.reservedFontNames)&&pkg.reservedFontNames.every(name=>typeof name==='string'&&name),`${label}: reservedFontNames must be an array of names (empty when none)`);
  assert.match(pkg.upstream,/^https?:\/\//,`${label}: upstream must be a URL`);
  assert.ok(ALLOWED_FONT_LICENSES.includes(pkg.license),`${label}: ${pkg.license} is not an allowed bundled-font license (${ALLOWED_FONT_LICENSES.join(', ')})`);

  let directory;
  if(vendored){
    // FF-31 vendored entry inside this package. Two kinds: unmodified upstream files from one pinned directory of one repository
    // (required for a family with a Reserved Font Name), or instanced statics copied from a recorded npm version (a family with none).
    const fromGit=pkg.faces.every(face=>face.upstreamFile);
    vendoredEntries.push(pkg.name);
    assert.match(pkg.vendored,/^fonts\/[a-z0-9-]+$/,`${label}: vendored must be a fonts/<name> directory inside this package`);
    assert.ok(rootPackage.files.includes('fonts')||rootPackage.files.includes(pkg.vendored),`${label}: package.json "files" must publish ${pkg.vendored}`);
    for(const field of ['dependencies','devDependencies','peerDependencies'])assert.equal(rootPackage[field]?.[pkg.name],undefined,`${label}: a vendored entry must not also be an npm ${field} entry`);
    if(!fromGit){
      assert.match(pkg.version,/^\d+\.\d+\.\d+$/,`${label}: an npm-derived vendored entry records the exact npm version it was copied from`);
      assert.equal(pkg.source,`https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}`,`${label}: source must be the exact npm package URL`);
      assert.ok(pkg.faces.every(face=>typeof face.npmFile==='string'&&!face.upstreamFile),`${label}: npm-derived faces record npmFile and no upstreamFile`);
      // OFL stops a MODIFIED font from carrying its Reserved Font Name in its name; an instance named otherwise (Bitter reserves "Bitter Pro") is fine.
      assert.ok(!modifiedFaceUsesReservedName(pkg),`${label}: instanced (modified) faces must not carry the Reserved Font Name ${pkg.reservedFontNames.join(', ')} in their family or file name; ship the copyright holder's unmodified files (upstreamFile) instead`);
      directory=fileURLToPath(new URL(`../${pkg.vendored}/`,import.meta.url));
    }else{
    assert.match(pkg.version,/^[0-9a-f]{40}$/,`${label}: a vendored git entry's version is the pinned upstream commit`);
    const parts=pkg.faces.map(face=>pinnedRawUpstream(face.upstreamFile?.url??''));
    assert.ok(parts.every(Boolean),`${label}: every vendored face needs upstreamFile with a pinned raw URL`);
    for(const [index,face] of pkg.faces.entries()){
      assert.ok(provenUnmodified(face),`${label}: vendored ${face.file} must be the byte-identical allowlisted upstream file (upstreamFile.sha256 equal to its own)`);
      assert.deepEqual([parts[index].repository,parts[index].commit,parts[index].directory],[parts[0].repository,pkg.version,parts[0].directory],`${label}: every face must come from the same upstream directory at commit ${pkg.version}`);
      assert.equal(parts[index].file,face.file,`${label}: vendored file name must match its upstream name`);
    }
    assert.equal(pkg.source,`https://github.com/${parts[0].repository}/tree/${pkg.version}/${parts[0].directory}`,`${label}: source must be the pinned upstream directory`);
    directory=fileURLToPath(new URL(`../${pkg.vendored}/`,import.meta.url));
    }
  }else{
    assert.equal(pkg.source,`https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}`,`${label}: source must be the exact npm package URL`);
    // RR-63: every npm font package is an exact optional peer dependency (the host installs the faces it uses), pinned as a devDependency for tests.
    const pinned=rootPackage.devDependencies?.[pkg.name];
    assert.equal(pinned,pkg.version,`${label}: package.json must pin this exact version (no range)`);
    assert.equal(rootPackage.peerDependencies?.[pkg.name],pkg.version,`${label}: declare it as an exact optional peer`);
    assert.equal(rootPackage.peerDependenciesMeta?.[pkg.name]?.optional,true,`${label}: the peer must be optional`);
    assert.equal(rootPackage.dependencies?.[pkg.name],undefined,`${label}: a font package must not be a runtime dependency`);
    assert.match(pinned,/^\d+\.\d+\.\d+$/,`${label}: pin must be an exact version`);
    directory=path.dirname(require.resolve(`${pkg.name}/package.json`));
    const installed=JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'));
    assert.equal(installed.version,pkg.version,`${label}: installed version differs from the manifest`);
    assert.ok(String(installed.license??'').split(/\s+(?:AND|OR)\s+|[\s()]+/).includes(pkg.license),`${label}: installed package.json license "${installed.license}" does not mention ${pkg.license}`);
  }

  const licenseBytes=await readFile(path.join(directory,pkg.licenseFile)),licenseText=licenseBytes.toString('utf8');
  assert.equal(hash(licenseBytes),pkg.licenseSha256,`${label}: license file sha256 changed`);
  const detected=detectLicenses(licenseText);
  assert.deepEqual(detected,[pkg.license],`${label}: declared ${pkg.license} but ${pkg.licenseFile} reads as ${detected.join('+')||'an unrecognised license'}`);
  assert.deepEqual(reservedFontNames(licenseText),[...pkg.reservedFontNames].sort(),`${label}: reservedFontNames differ from the copyright block in ${pkg.licenseFile}`);
  assert.equal(copyrightLine(licenseText),pkg.copyright,`${label}: copyright differs from ${pkg.licenseFile}`);
  assert.equal(upstreamUrl(licenseText),pkg.upstream,`${label}: upstream differs from ${pkg.licenseFile}`);

  // RFN rule (owner decision 2026-09-29): OFL stops a MODIFIED version from using the reserved name in its name. A face is
  // modified unless it proves it is the byte-identical upstream file (upstreamFile); it is a problem only when its family or
  // file name also contains a reserved name. Such a package must be listed as pending, and the list may only shrink.
  assert.ok(!declaresReservedFontName(licenseText)||pkg.reservedFontNames.length>0,`${label}: the license declares a Reserved Font Name that could not be parsed`);
  for(const face of pkg.faces)if(face.upstreamFile)assert.ok(provenUnmodified(face),`${label}: ${face.file} upstreamFile must be a pinned allowlisted URL with a sha256 equal to the face's own`);
  if(pkg.reservedFontNames.length>0)rfnPackages.push(pkg.name);
  if(modifiedFaceUsesReservedName(pkg))assert.ok(pkg.name in RFN_PENDING_UNMODIFIED_UPSTREAM,`${label} serves a modified face whose name contains the Reserved Font Name ${pkg.reservedFontNames.join(', ')}: every face needs upstreamFile { url, sha256 } with a pinned URL from an allowlisted upstream repository and a sha256 equal to the face's own (byte-identical, not subsetted, instanced or converted)`);
  else assert.ok(!(pkg.name in RFN_PENDING_UNMODIFIED_UPSTREAM),`${label}: no modified face uses a reserved name (or none is declared); remove it from RFN_PENDING_UNMODIFIED_UPSTREAM`);

  assert.ok(pkg.faces.length>0,`${label}: no faces listed`);
  for(const face of pkg.faces){
    assert.ok(!path.isAbsolute(face.file)&&!face.file.split(/[\\/]/).includes('..'),`${label}: face path must stay inside the package: ${face.file}`);
    assert.equal(hash(await readFile(path.join(directory,face.file))),face.sha256,`${label}: ${face.file} sha256 changed`);
    rows.push({label,declared:pkg.license,detected:detected.join('+'),rfn:pkg.reservedFontNames.join(',')||'none',face:`${face.family} ${face.weight}${face.italic?' italic':''}`});
  }
}
assert.equal(new Set(packages.map(pkg=>pkg.name)).size,packages.length,'each package appears once in the manifest');
for(const name of Object.keys(RFN_PENDING_UNMODIFIED_UPSTREAM))assert.ok(packages.some(pkg=>pkg.name===name),`${name} is in RFN_PENDING_UNMODIFIED_UPSTREAM but not in the manifest`);
console.log(`Font licenses verified for ${packages.length} packages, ${rows.length} faces. vendored upstream files: ${vendoredEntries.join(', ')||'none'}. Reserved Font Names: ${rfnPackages.length} packages (${rfnPackages.map(name=>name.replace('@expo-google-fonts/','')).join(', ')}); pending unmodified upstream files: ${Object.keys(RFN_PENDING_UNMODIFIED_UPSTREAM).map(name=>name.replace('@expo-google-fonts/','')).join(', ')||'none'}.`);
if(process.argv.includes('--table'))for(const row of rows)console.log(`${row.face}\t${row.label}\tdeclared ${row.declared}\tdetected ${row.detected}\tRFN ${row.rfn}`);
