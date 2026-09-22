import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {lstat, mkdir, readFile, readdir, realpath, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const resumeRoot = path.resolve(here, '..');
const nodeExpected = path.join(resumeRoot, 'toolchain', 'node_modules', 'node', 'bin', 'node.exe');
const verifyExisting = process.argv.includes('--verify-existing');
const positionalArgs = process.argv.slice(2).filter(argument => argument !== '--verify-existing');
const consumer = await realpath(positionalArgs[0] ?? path.join(resumeRoot, 'registry-consumer'));
const outputNames = (await readdir(here)).sort();
const expectedOutputNames = verifyExisting
  ? ['generate.mjs', 'generation.json', 'source.opf.json', 'source.pptx']
  : ['generate.mjs'];
assert.deepEqual(outputNames, expectedOutputNames, verifyExisting
  ? 'Existing verification accepts only the original generator outputs.'
  : 'Candidate directory must be fresh and contain only its generator.');
assert.equal(process.version, 'v24.21.0', 'Use the exact pinned Node 24.21.0 runtime.');
assert.equal(path.resolve(process.execPath).toLowerCase(), path.resolve(nodeExpected).toLowerCase(), 'Use only the pinned toolchain Node executable.');

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const parseJson = bytes => JSON.parse(bytes.toString('utf8'));
const expectedVersions = new Map([
  ['@openpresentation/opf', '0.11.0'],
  ['@openpresentation/opf-pptx', '0.9.1'],
  ['@openpresentation/opf-render', '0.9.0'],
  ['@openpresentation/opf-editor', '0.8.0'],
  ['@openpresentation/cli', '0.9.0'],
]);
const helperNames = ['fflate', 'fast-xml-parser'];
const allPackageNames = [...expectedVersions.keys(), ...helperNames];
const esmModuleNames = [...expectedVersions.keys()].filter(name => name !== '@openpresentation/cli').concat(helperNames);
const requireConsumer = createRequire(path.join(consumer, 'package.json'));
const lockPath = path.join(consumer, 'package-lock.json');
const lockBytes = await readFile(lockPath);
const lock = parseJson(lockBytes);
const lockPackages = lock.packages ?? {};
const inside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};
const resolveProbe = spawnSync(
  process.execPath,
  ['--input-type=module', '-e', `console.log(JSON.stringify(Object.fromEntries(${JSON.stringify(esmModuleNames)}.map(name => [name, import.meta.resolve(name)]))))`],
  {cwd: consumer, encoding: 'utf8', timeout: 15000, windowsHide: true},
);
assert.equal(resolveProbe.status, 0, resolveProbe.error?.message ?? resolveProbe.stderr);
const publicUrls = JSON.parse(resolveProbe.stdout.trim());
async function resolveManifest(name, entryUrl) {
  try {
    return await realpath(requireConsumer.resolve(name + '/package.json'));
  } catch {
    // Some packages intentionally do not export ./package.json. Keep public ESM
    // resolution for runtime imports; walk upward only to identify the installed
    // package manifest around that already-resolved public entry.
    const entry = entryUrl ? fileURLToPath(entryUrl) : requireConsumer.resolve(name);
    let directory = path.dirname(entry);
    while (inside(consumer, directory)) {
      const candidate = path.join(directory, 'package.json');
      try {
        const manifest = parseJson(await readFile(candidate));
        if (manifest.name === name) return await realpath(candidate);
      } catch {}
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
    throw new Error(`Could not locate installed package manifest for ${name}`);
  }
}
const moduleBindings = {};
for (const name of allPackageNames) {
  const manifestPath = await resolveManifest(name, publicUrls[name] ?? null);
  const packageRoot = path.dirname(manifestPath);
  assert.ok(inside(consumer, manifestPath), `Package manifest escaped the consumer: ${name}`);
  const manifestBytes = await readFile(manifestPath);
  const manifest = parseJson(manifestBytes);
  assert.equal(manifest.name, name);
  const expectedVersion = expectedVersions.get(name);
  if (expectedVersion) assert.equal(manifest.version, expectedVersion, `Unexpected pinned package version for ${name}`);
  const entryUrl = publicUrls[name] ?? null;
  let entryPath;
  let entrypointKind;
  if (name === '@openpresentation/cli') {
    const binRelative = manifest.bin?.opf;
    assert.ok(typeof binRelative === 'string', 'CLI package must expose its opf binary.');
    entryPath = await realpath(path.resolve(packageRoot, binRelative));
    entrypointKind = 'manifest-declared CLI binary (CLI package has no ESM root export)';
  } else {
    assert.ok(entryUrl?.startsWith('file:'), `Expected local public ESM entry for ${name}`);
    entryPath = await realpath(fileURLToPath(entryUrl));
    entrypointKind = 'public ESM root entry';
  }
  assert.ok(inside(consumer, entryPath), `Public entry escaped the consumer: ${name}`);
  assert.ok(inside(packageRoot, entryPath), `Public entry escaped its package: ${name}`);
  const lockEntry = lockPackages['node_modules/' + name];
  assert.equal(lockEntry?.version, manifest.version, `Lock version mismatch for ${name}`);
  assert.ok(typeof lockEntry?.integrity === 'string' && lockEntry.integrity.length > 0, `Missing lock integrity for ${name}`);
  assert.ok(!lockEntry.link, `Linked registry entry is not accepted for ${name}`);
  assert.match(lockEntry.resolved, /^https:\/\/registry\.npmjs\.org\//, `Unexpected registry URL for ${name}`);
  const installPath = path.join(consumer, 'node_modules', ...name.split('/'));
  const installStat = await lstat(installPath);
  assert.ok(!installStat.isSymbolicLink(), `Direct install path is a symlink for ${name}`);
  assert.equal(await realpath(installPath), packageRoot, `Resolved manifest does not match direct install for ${name}`);
  moduleBindings[name] = {
    version: manifest.version,
    packageRoot,
    installPath,
    installPathIsSymbolicLink: installStat.isSymbolicLink(),
    manifestPath,
    manifestSha256: sha(manifestBytes),
    entrypointKind,
    publicEsmEntryUrl: entryUrl,
    entrypointRealpath: entryPath,
    entrypointSha256: sha(await readFile(entryPath)),
    lockResolved: lockEntry.resolved,
    lockIntegrity: lockEntry.integrity,
    lockLink: Boolean(lockEntry.link),
  };
}

const load = async name => import(pathToFileURL(moduleBindings[name].entrypointRealpath).href);
const [{validatePresentation}, {toPptx, fromPptx}, fflateModule, xmlModule] = await Promise.all([
  load('@openpresentation/opf'), load('@openpresentation/opf-pptx'), load('fflate'), load('fast-xml-parser'),
]);
const {unzipSync} = fflateModule.default ?? fflateModule;
const {XMLParser, XMLValidator} = xmlModule.default ?? xmlModule;
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  trimValues: false,
  processEntities: true,
});

const runSpecs = [
  {text: 'Regular ', fontFamily: 'Carlito', fontSize: 18},
  {text: 'Bold ', fontFamily: 'Carlito', fontSize: 20, bold: true},
  {text: 'Italic ', fontFamily: 'Carlito', fontSize: 22, italic: true},
  {text: 'BoldItalic', fontFamily: 'Carlito', fontSize: 24, bold: true, italic: true},
];
const source = {
  design: {
    theme: 'classic',
    fontScheme: {
      major: 'Carlito',
      minor: 'Carlito',
      type: 'sans-serif',
      heading: {family: 'Carlito'},
      body: {family: 'Carlito'},
      accent: {family: 'Carlito'},
      code: {family: 'Carlito'},
    },
  },
  slides: [{type: 'text', layout: 'blank', text: runSpecs}],
};
const expectedText = runSpecs.map(run => run.text).join('');
const sourceBefore = JSON.stringify(source);
const sourceValidation = validatePresentation(source);
assert.equal(sourceValidation.valid, true, JSON.stringify(sourceValidation.errors));
assert.deepEqual(sourceValidation.warnings, []);
assert.equal(expectedText, 'Regular Bold Italic BoldItalic');
assert.equal(/[\t\r\n]/.test(expectedText), false);
assert.deepEqual(
  Object.fromEntries(['major', 'minor', 'heading', 'body', 'accent', 'code'].map(key => [key, typeof source.design.fontScheme[key] === 'string' ? source.design.fontScheme[key] : source.design.fontScheme[key]?.family])),
  {major: 'Carlito', minor: 'Carlito', heading: 'Carlito', body: 'Carlito', accent: 'Carlito', code: 'Carlito'},
);
assert.equal(Object.hasOwn(source.slides[0], 'title'), false);
assert.equal(Object.hasOwn(source.slides[0], 'notes'), false);

const pptxBytes = Buffer.from(await toPptx(source, {strictAssets: true}));
assert.equal(JSON.stringify(source), sourceBefore, 'The public exporter mutated the authored input.');
const reimportDiagnostics = [];
const reimported = await fromPptx(pptxBytes, {onDiagnostic: diagnostic => reimportDiagnostics.push(diagnostic)});
const reimportValidation = validatePresentation(reimported);
const reimportSlide = reimported?.slides?.[0];
const importedTextValue = reimportSlide?.text;
const importedRuns = (importedTextValue === undefined ? [] : Array.isArray(importedTextValue) ? importedTextValue : [importedTextValue]).map(run => {
  if (typeof run === 'string') return {text: run, fontFamily: null, fontSize: null, bold: false, italic: false};
  return {
    text: run?.text ?? '', fontFamily: run?.fontFamily ?? null,
    fontSize: run?.fontSize ?? null, bold: Boolean(run?.bold), italic: Boolean(run?.italic),
  };
});
const expectedRuns = runSpecs.map(run => ({
  text: run.text, fontFamily: run.fontFamily, fontSize: run.fontSize,
  bold: Boolean(run.bold), italic: Boolean(run.italic),
}));
const reimportSemanticText = typeof importedTextValue === 'string'
  ? importedTextValue
  : typeof reimportSlide?.title === 'string'
    ? reimportSlide.title
    : typeof reimportSlide?.subtitle === 'string'
      ? reimportSlide.subtitle
      : '';
const richRunStylingPreserved = JSON.stringify(importedRuns) === JSON.stringify(expectedRuns);
const semanticReimportPassed = (
  reimportValidation.valid === true
  && reimported.slides?.length === 1
  && reimportSlide?.notes === undefined
  && reimportSemanticText === expectedText
);

const pptxObject = unzipSync(pptxBytes);
const members = Object.keys(pptxObject).sort();
const xmlParts = [];
const parseErrors = [];
const declarations = [];
const themeSlots = [];
const themeFontRefs = [];
const slideRunRecords = [];
const slideStats = [];
const local = name => name.split(':').at(-1);
const asArray = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
function walk(node, member, ancestors = [], currentPath = []) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((item, index) => walk(item, member, ancestors, [...currentPath, `[${index}]`]));
    return;
  }
  for (const [tag, child] of Object.entries(node)) {
    if (tag === '#text' || tag.startsWith('?') || tag.startsWith('xmlns:')) continue;
    const tagLocal = local(tag);
    const values = asArray(child);
    for (let index = 0; index < values.length; index++) {
      const value = values[index];
      const current = [...currentPath, `${tag}${values.length > 1 ? `[${index}]` : ''}`];
      if (tagLocal === 'fontRef' && value && typeof value === 'object') {
        themeFontRefs.push({member, path: current.join('/'), attributes: Object.fromEntries(Object.entries(value).filter(([key]) => !key.includes(':')).sort(([a], [b]) => a.localeCompare(b)))});
      }
      if (['latin', 'ea', 'cs', 'font'].includes(tagLocal) && value && typeof value === 'object' && Object.hasOwn(value, 'typeface')) {
        const family = value.typeface;
        const ancestorLocals = ancestors.map(local);
        const slot = ['majorFont', 'minorFont'].find(candidate => ancestorLocals.includes(candidate)) ?? null;
        let category = 'other-font-declaration';
        if (member.startsWith('ppt/theme/')) category = tagLocal === 'font' ? 'theme-script-fallback' : 'theme-primary';
        else if (typeof family === 'string' && family.startsWith('+')) category = 'theme-token-inherited';
        else if (ancestors.some(parent => ['rPr', 'endParaRPr'].includes(local(parent)))) category = 'character-run-property';
        else if (ancestors.some(parent => ['defRPr', 'defPPr', 'lvl1pPr', 'lvl2pPr', 'lvl3pPr', 'lvl4pPr', 'lvl5pPr', 'lvl6pPr', 'lvl7pPr', 'lvl8pPr', 'lvl9pPr'].includes(local(parent)))) category = 'master-or-layout-style';
        declarations.push({member, path: current.join('/'), category, slot, element: tagLocal, typeface: family, script: value.script ?? null});
      }
      walk(value, member, [...ancestors, tag], current);
    }
  }
}
function findNodes(node, wantedLocal, pathParts = []) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((item, index) => findNodes(item, wantedLocal, [...pathParts, `[${index}]`]));
  return Object.entries(node).flatMap(([tag, child]) => {
    if (tag === '#text' || tag.startsWith('?') || tag.startsWith('xmlns:')) return [];
    return asArray(child).flatMap((value, index) => {
      const itemPath = [...pathParts, `${tag}${asArray(child).length > 1 ? `[${index}]` : ''}`];
      const here = local(tag) === wantedLocal ? [{path: itemPath.join('/'), node: value}] : [];
      return [...here, ...findNodes(value, wantedLocal, itemPath)];
    });
  });
}
function nodeText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(nodeText).join('');
  if (typeof value === 'object') return typeof value['#text'] === 'string' ? value['#text'] : '';
  return '';
}

for (const member of members) {
  if (!member.endsWith('.xml') && !member.endsWith('.rels')) continue;
  const bytes = Buffer.from(pptxObject[member]);
  const text = new TextDecoder().decode(bytes);
  const xmlValidation = XMLValidator.validate(text);
  if (xmlValidation !== true) parseErrors.push({member, error: xmlValidation});
  const document = parser.parse(text);
  walk(document, member);
  xmlParts.push({member, bytes: bytes.length, sha256: sha(bytes), valid: xmlValidation === true});
  if (member.startsWith('ppt/theme/') && member.endsWith('.xml')) {
    const schemes = findNodes(document, 'fontScheme');
    for (const {node: scheme} of schemes) {
      for (const slotName of ['majorFont', 'minorFont']) {
        const slotEntry = Object.entries(scheme ?? {}).find(([key]) => local(key) === slotName);
        const slot = asArray(slotEntry?.[1])[0];
        if (!slot) continue;
        const valueOf = name => asArray(Object.entries(slot).find(([key]) => local(key) === name)?.[1])[0]?.typeface ?? null;
        const supplemental = Object.entries(slot)
          .filter(([key]) => local(key) === 'font')
          .flatMap(([,value]) => asArray(value).map(item => ({script: item.script ?? null, typeface: item.typeface ?? ''})));
        themeSlots.push({member, slot: slotName, latin: valueOf('latin'), eastAsian: valueOf('ea'), complexScript: valueOf('cs'), supplementalScriptFaces: supplemental});
      }
    }
  }
  if (member.startsWith('ppt/slides/') && member.endsWith('.xml')) {
    const runs = findNodes(document, 'r');
    for (const {path: runPath, node: run} of runs) {
      const rprEntry = Object.entries(run ?? {}).find(([key]) => local(key) === 'rPr');
      const rpr = asArray(rprEntry?.[1])[0] ?? {};
      const face = name => asArray(Object.entries(rpr).find(([key]) => local(key) === name)?.[1])[0]?.typeface ?? null;
      slideRunRecords.push({
        member, path: runPath,
        text: asArray(Object.entries(run ?? {}).find(([key]) => local(key) === 't')?.[1]).map(nodeText).join(''),
        fontSizeHundredthsPoint: rpr.sz ?? null, bold: rpr.b === '1', italic: rpr.i === '1',
        typefaces: {latin: face('latin'), ea: face('ea'), cs: face('cs')},
      });
    }
    const placeholders = findNodes(document, 'ph');
    slideStats.push({member, shapeCount: findNodes(document, 'sp').length, placeholderCount: placeholders.length,
      tableCount: findNodes(document, 'tbl').length, hardBreakCount: findNodes(document, 'br').length,
      slideTextTabCount: slideRunRecords.filter(run => run.member === member).reduce((sum, run) => sum + (run.text.match(/\t/g) ?? []).length, 0)});
  }
}
assert.equal(parseErrors.length, 0, JSON.stringify(parseErrors));
assert.ok(xmlParts.length > 0);
assert.ok(members.includes('ppt/slides/slide1.xml'));
assert.equal(slideStats.length, 1);
assert.equal(slideStats[0].placeholderCount, 0, 'Candidate slide XML must not contain placeholder shapes.');
assert.equal(slideStats[0].tableCount, 0);
assert.equal(slideStats[0].hardBreakCount, 0);
assert.equal(slideStats[0].slideTextTabCount, 0);
assert.deepEqual(slideRunRecords.filter(run => run.text.length > 0).map(run => ({
  text: run.text, size: Number(run.fontSizeHundredthsPoint) / 100, bold: run.bold, italic: run.italic,
  latin: run.typefaces.latin,
})), [
  {text: 'Regular ', size: 18, bold: false, italic: false, latin: 'Carlito'},
  {text: 'Bold ', size: 20, bold: true, italic: false, latin: 'Carlito'},
  {text: 'Italic ', size: 22, bold: false, italic: true, latin: 'Carlito'},
  {text: 'BoldItalic', size: 24, bold: true, italic: true, latin: 'Carlito'},
]);
assert.equal(semanticReimportPassed, true, JSON.stringify({reimportValidation, importedRuns, reimportDiagnostics}));

const fontMetadataPath = path.join(resumeRoot, 'font-edit-fixture-01', 'generation.json');
const fontMetadataBytes = await readFile(fontMetadataPath);
const fontMetadata = parseJson(fontMetadataBytes);
const contentTypesText = new TextDecoder().decode(pptxObject['[Content_Types].xml']);
const fontMembers = members.filter(name => /.(?:ttf|otf|woff2?|eot|fntdata|odttf)$/i.test(name) || /(?:^|\/)fonts\//i.test(name));
const svgMembers = members.filter(name => /\.svg$/i.test(name));
const fontBearingSvgMembers = svgMembers.filter(name => /font-face|@font-face|data:font/i.test(new TextDecoder().decode(pptxObject[name])));
assert.deepEqual(fontMembers, [], 'Fixture generation must not embed/copy font programs.');
assert.deepEqual(fontBearingSvgMembers, [], 'Fixture must not contain font-bearing SVG.');

const sourcePath = path.join(here, 'source.opf.json');
const pptxPath = path.join(here, 'source.pptx');
if (verifyExisting) {
  const originalGenerationBytes = await readFile(path.join(here, 'generation.json'));
  const originalGeneration = parseJson(originalGenerationBytes);
  assert.deepEqual(await readFile(sourcePath), Buffer.from(JSON.stringify(source, null, 2) + '\n'), 'Recreated OPF source must be byte-identical to the preserved source.');
  assert.deepEqual(await readFile(pptxPath), pptxBytes, 'Recreated PPTX must be byte-identical to the preserved native-free generation.');
  assert.equal(originalGeneration.source.sha256, sha(await readFile(sourcePath)));
  assert.equal(originalGeneration.source.presentationSha256, sha(await readFile(pptxPath)));
} else {
  await writeFile(sourcePath, JSON.stringify(source, null, 2) + '\n', {flag: 'wx'});
  await writeFile(pptxPath, pptxBytes, {flag: 'wx'});
}
const consumerPackageBytes = await readFile(path.join(consumer, 'package.json'));
const priorGenerationBytes = verifyExisting ? await readFile(path.join(here, 'generation.json')) : null;
const priorGeneration = priorGenerationBytes ? parseJson(priorGenerationBytes) : null;
const generation = {
  schemaVersion: 1,
  kind: 'opf-carlito-embedding-candidate-fixture',
  scope: 'Offline candidate generation only. No font registration, Office/COM, UI, embedding save, PDF, renderer call, font copy, or native acceptance.',
  runtime: {nodeVersion: process.version, executable: path.resolve(process.execPath), executableSha256: sha(await readFile(process.execPath))},
  registryConsumer: {
    realpath: consumer,
    packageJsonSha256: sha(consumerPackageBytes),
    lockfilePath: lockPath,
    lockfileSha256: sha(lockBytes),
    lockfileVersion: lock.lockfileVersion,
    bindingScope: 'Five direct OPF registry packages plus two XML/ZIP helpers are bound by lock entry version/resolved URL/integrity, package manifest hash, and resolved public ESM entry hash. This does not bind every transitive installed byte.',
    packages: moduleBindings,
  },
  permittedCarlitoInventoryReference: {
    sourceGenerationPath: path.relative(resumeRoot, fontMetadataPath).replaceAll('\\', '/'),
    sourceGenerationSha256: sha(fontMetadataBytes),
    package: fontMetadata.package,
    license: fontMetadata.license,
    fontManifest: fontMetadata.fontManifest,
    exactPermittedFaces: fontMetadata.fonts,
    fontProgramBytesReadOrCopied: false,
  },
  generator: {path: path.basename(fileURLToPath(import.meta.url)), sha256: sha(await readFile(fileURLToPath(import.meta.url)))},
  source: {file: path.basename(sourcePath), sha256: sha(await readFile(sourcePath)), presentationSha256: sha(pptxBytes), slideCount: source.slides.length, expectedText, sourceFontSchemeFamilies: source.design.fontScheme},
  exporter: {publicFunction: '@openpresentation/opf-pptx.toPptx', strictAssets: true, sourceMutationFree: true},
  ...(verifyExisting ? {inventoryVerification: {
    mode: 'offline deterministic regeneration and byte comparison; no exporter output was written',
    supersedesReport: 'generation.json',
    supersededReportSha256: sha(priorGenerationBytes),
    supersededGeneratorSha256: priorGeneration.generator.sha256,
    generatedSourceAndPptxBytesMatchedPreservedFiles: true,
  }} : {}),
  reimport: {
    publicFunction: '@openpresentation/opf-pptx.fromPptx',
    passed: semanticReimportPassed,
    validation: reimportValidation,
    diagnostics: reimportDiagnostics,
    semanticText: reimportSemanticText,
    classification: reimportSlide?.title === expectedText ? 'single text box inferred into slide.title by public importer geometry heuristic' : 'content field',
    importedTextRuns: importedRuns,
    expectedRuns,
    richRunStylingPreservedByImporter: richRunStylingPreserved,
    limitation: 'The public importer recovers the exact text and validates the OPF, but this one-box import classifies it as a title and does not preserve rich-run styles. All four styles are independently checked in the saved slide XML.',
  },
  packageInspection: {
    zipMemberCount: members.length,
    xmlRelPartCount: xmlParts.length,
    xmlParts,
    slideStats,
    slideRunRecords,
    fontDeclarations: declarations,
    themeFontSlots: themeSlots,
    unresolvedThemeFontReferences: themeFontRefs,
    allConcreteTypefaces: [...new Set(declarations.map(record => record.typeface).filter(value => value && !String(value).startsWith('+')))].sort(),
    concreteNonCarlitoTypefaces: [...new Set(declarations.map(record => record.typeface).filter(value => value && !String(value).startsWith('+') && String(value).toLowerCase() !== 'carlito'))].sort(),
    notesSlideParts: members.filter(name => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name)),
    notesMasterParts: members.filter(name => /^ppt\/notesMasters\/notesMaster\d+\.xml$/.test(name)),
    slideMasterParts: members.filter(name => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(name)),
    slideLayoutParts: members.filter(name => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(name)),
    fontProgramMembers: fontMembers,
    svgMembers,
    fontBearingSvgMembers,
    contentTypeFontMentions: /font/i.test(contentTypesText),
  },
  nativeFontsGate: {status: 'pending', requiredObservation: 'A separately reviewed bounded read-only native PowerPoint Presentation.Fonts inventory must show only the permitted Carlito family/style inventory. Font Name, Bold, and Italic properties do not prove exact physical font-file identity. XML declarations do not prove which theme fallback faces PowerPoint enumerates or uses.'},
  limitations: [
    'Declared OOXML families and theme script fallback references are not a native PowerPoint Presentation.Fonts collection observation.',
    'This generation records package font declarations only; it does not identify the physical font used for any glyph.',
    'No embedding was requested and the fixture contains no font programs; embedded-font parsing or persistence is not tested.',
  ],
};
const generationPath = path.join(here, 'generation.json');
const finalGenerationPath = path.join(here, verifyExisting ? 'generation-corrected.json' : 'generation.json');
await writeFile(finalGenerationPath, JSON.stringify(generation, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({
  passed: true,
  node: process.version,
  sourceSha256: generation.source.sha256,
  presentationSha256: generation.source.presentationSha256,
  lockfileSha256: generation.registryConsumer.lockfileSha256,
  xmlParts: xmlParts.length,
  declaredFonts: [...new Set(generation.packageInspection.allConcreteTypefaces)].length,
  notesSlideParts: generation.packageInspection.notesSlideParts.length,
  notesMasterParts: generation.packageInspection.notesMasterParts.length,
  placeholderCount: slideStats[0].placeholderCount,
  reimportPassed: semanticReimportPassed,
  nativeFontsGate: 'pending',
  report: path.basename(finalGenerationPath),
}, null, 0));
