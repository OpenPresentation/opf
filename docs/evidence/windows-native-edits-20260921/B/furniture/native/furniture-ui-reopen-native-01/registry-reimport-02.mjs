import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {readFile, realpath, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runRoot = path.resolve(here);
const artifactRoot = path.resolve(here, '..');
const registryRun = path.join(artifactRoot, 'furniture-ui-replace-01');
const manifestPath = path.join(registryRun, 'generation-manifest.json');
const previousImportPath = path.join(registryRun, 'ui-import-corrected.opf.json');
const previousComparisonPath = path.join(registryRun, 'ui-comparison-corrected.json');
const reportPath = path.join(here, 'registry-reimport-02.analysis.json');
const importPath = path.join(here, 'registry-reimport-02.opf.json');
const savedPptxPath = path.join(here, 'native-furniture-control.pptx');
const inputPptxPath = path.join(here, 'inputs', 'input.pptx');
const nativeReportPath = path.join(here, 'report.json');
const requestPath = path.join(here, 'request.json');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const parseJson = bytes => JSON.parse(Buffer.from(bytes).toString('utf8').replace(/^\uFEFF/, ''));
const asArray = value => value == null ? [] : Array.isArray(value) ? value : [value];
const checks = [];
const failures = [];
const evidence = {};
const record = (name, passed, observed, expected) => {
  const item = {name, passed: Boolean(passed), observed, expected};
  checks.push(item);
  if (!item.passed) failures.push({name, observed, expected});
  return item.passed;
};

function stable(value) { return JSON.stringify(value); }

function imageHash(image) {
  if (image?.srcSha256) return image.srcSha256;
  const src = image?.src ?? image?.data;
  if (typeof src !== 'string') return null;
  const comma = src.indexOf(',');
  return comma >= 0 ? sha(Buffer.from(src.slice(comma + 1), 'base64')) : null;
}

function normalizeZipPath(value) {
  const normalized = path.posix.normalize(value.replaceAll('\\', '/'));
  assert.ok(normalized !== '..' && !normalized.startsWith('../'), `Archive relationship escapes: ${value}`);
  return normalized.replace(/^\.\//, '');
}

function parseArchive(filePath, fflate, parser) {
  const bytes = readFileSync(filePath);
  const entries = fflate.unzipSync(new Uint8Array(bytes));
  const parsePart = part => {
    assert.ok(entries[part], `Missing archive part ${part}`);
    return parser.parse(Buffer.from(entries[part]).toString('utf8'));
  };
  return {bytes, entries, parsePart};
}

function targetPicture(archive) {
  const slidePart = 'ppt/slides/slide2.xml';
  const slide = archive.parsePart(slidePart);
  const tree = slide?.['p:sld']?.['p:cSld']?.['p:spTree'];
  assert.ok(tree, 'Slide 2 shape tree missing.');
  const relsPart = 'ppt/slides/_rels/slide2.xml.rels';
  const relationships = asArray(archive.parsePart(relsPart)?.Relationships?.Relationship);
  const matches = [];
  for (const pic of asArray(tree['p:pic'])) {
    const nv = pic['p:nvPicPr'] ?? {};
    const cNvPr = nv['p:cNvPr'] ?? {};
    const tagsId = nv['p:nvPr']?.['p:custDataLst']?.['p:tags']?.['@_r:id'];
    if (!tagsId) continue;
    const tagsRel = relationships.find(rel => rel['@_Id'] === tagsId);
    assert.ok(tagsRel, `Picture tag relationship ${tagsId} missing.`);
    const tagPart = normalizeZipPath(path.posix.join(path.posix.dirname(slidePart), tagsRel['@_Target']));
    const tagDoc = archive.parsePart(tagPart);
    const tag = asArray(tagDoc?.['p:tagLst']?.['p:tag']).find(item => item['@_name'] === 'OPF_FURNITURE_V1');
    if (!tag) continue;
    const tagHex = tag['@_val'] ?? '';
    let tagJson = null;
    try { tagJson = JSON.parse(Buffer.from(tagHex, 'hex').toString('utf8')); } catch { /* keep raw payload evidence */ }
    if (tagJson?.role !== 'image' || String(tagJson?.group) !== '1' || Number(tagJson?.part) !== 0) continue;
    const embedId = pic['p:blipFill']?.['a:blip']?.['@_r:embed'];
    const mediaRel = relationships.find(rel => rel['@_Id'] === embedId);
    assert.ok(mediaRel, `Picture media relationship ${embedId} missing.`);
    const mediaPart = normalizeZipPath(path.posix.join(path.posix.dirname(slidePart), mediaRel['@_Target']));
    const mediaBytes = archive.entries[mediaPart];
    assert.ok(mediaBytes, `Picture media part ${mediaPart} missing.`);
    matches.push({
      shapeId: cNvPr['@_id'] ?? null,
      shapeName: cNvPr['@_name'] ?? null,
      alt: cNvPr['@_descr'] ?? '',
      tagHex,
      tagJson,
      tagPart,
      tagRelationshipId: tagsId,
      mediaPart,
      mediaSha256: sha(Buffer.from(mediaBytes)),
      mediaBytes: mediaBytes.length,
      mediaRelationshipId: embedId,
    });
  }
  assert.equal(matches.length, 1, `Expected exactly one tagged OPF picture; found ${matches.length}.`);
  return matches[0];
}

async function main() {
  let outcomeError = null;
  let imported = null;
  let importedBytes = null;
  let previousDocument = null;
  let inputDocument = null;
  let currentDocument = null;
  const diagnostics = [];
  let manifest = null, nativeReport = null, request = null;
  let registryBinding = null;
  let beforePicture = null, afterPicture = null;

  try {
    manifest = parseJson(await readFile(manifestPath));
    nativeReport = parseJson(await readFile(nativeReportPath));
    request = parseJson(await readFile(requestPath));
    previousDocument = parseJson(await readFile(previousImportPath));
    const previousComparison = parseJson(await readFile(previousComparisonPath));
    const inputBytes = await readFile(inputPptxPath);
    const savedBytes = await readFile(savedPptxPath);
    const actualSavedSha = sha(savedBytes);
    const actualInputSha = sha(inputBytes);
    evidence.inputs = {
      inputPptx: {path: inputPptxPath, sha256: actualInputSha},
      savedPptx: {path: savedPptxPath, sha256: actualSavedSha},
      previousImport: {path: previousImportPath, sha256: sha(await readFile(previousImportPath))},
      previousComparison: {path: previousComparisonPath, sha256: sha(await readFile(previousComparisonPath))},
    };
    record('UI-reopened deck matches native saved/reopened observations', actualSavedSha === nativeReport.saved.sha256 &&
      actualSavedSha === nativeReport.reopened.sha256, actualSavedSha,
      {saved: nativeReport.saved.sha256, reopened: nativeReport.reopened.sha256});
    record('input copy matches the native source snapshot', actualInputSha === request.source.snapshotSha256 &&
      actualInputSha === request.source.sha256, actualInputSha,
      {requestSource: request.source.sha256, snapshot: request.source.snapshotSha256});
    record('previous import evidence is a passed result for the original UI Change Picture deck',
      previousComparison.passed === true && previousComparison.sourceFiles?.savedPptx?.sha256 === actualInputSha,
      {passed: previousComparison.passed, importedPptxSha256: previousComparison.sourceFiles?.savedPptx?.sha256, inputSha256: actualInputSha},
      {passed: true, importedPptxSha256: actualInputSha});

    const expectedNode = manifest.node;
    const expectedExecutable = await realpath(manifest.nodeExecutable);
    const actualExecutable = await realpath(process.execPath);
    const registry = manifest.publicRegistry;
    const lockHash = sha(await readFile(registry.lockFile));
    const packageRecord = registry.packages.find(item => item.name === '@openpresentation/opf-pptx');
    const publicEntry = registry.esmEntrypoints.find(item => item.name === '@openpresentation/opf-pptx');
    assert.ok(packageRecord && publicEntry, 'Missing pinned @openpresentation/opf-pptx package or public ESM entry.');
    const packageManifestPath = await realpath(packageRecord.manifestPath);
    const packageEntryPath = await realpath(packageRecord.entrypoint);
    const publicEntryPath = await realpath(fileURLToPath(publicEntry.url));
    const installedManifestBytes = await readFile(packageManifestPath);
    const installedManifest = parseJson(installedManifestBytes);
    const entryBytes = await readFile(packageEntryPath);
    const lock = parseJson(await readFile(registry.lockFile));
    const locked = lock.packages?.['node_modules/@openpresentation/opf-pptx'];
    const consumer = await realpath(registry.consumer);
    const packageWithinConsumer = packageManifestPath.startsWith(consumer + path.sep) && packageEntryPath.startsWith(consumer + path.sep);
    const bindingOk = process.version === expectedNode && actualExecutable === expectedExecutable &&
      lockHash === registry.lockSha256 && publicEntryPath === packageEntryPath && packageWithinConsumer &&
      installedManifest.name === packageRecord.name && installedManifest.version === packageRecord.version &&
      sha(installedManifestBytes) === packageRecord.manifestSha256 && sha(entryBytes) === packageRecord.entrypointSha256 &&
      locked?.version === packageRecord.version && locked?.resolved === packageRecord.resolved && locked?.integrity === packageRecord.integrity;
    registryBinding = {node: process.version, expectedNode, executable: actualExecutable, expectedExecutable,
      consumer, packageManifestPath, packageEntryPath, publicEntryPath, packageWithinConsumer, packageVersion: installedManifest.version,
      lockSha256: lockHash, expectedLockSha256: registry.lockSha256,
      entrypointSha256: sha(entryBytes), expectedEntrypointSha256: packageRecord.entrypointSha256,
      locked: {version: locked?.version ?? null, resolved: locked?.resolved ?? null, integrity: locked?.integrity ?? null},
      expectedLock: {version: packageRecord.version, resolved: packageRecord.resolved, integrity: packageRecord.integrity}};
    record('current registry public ESM consumer binding', bindingOk, registryBinding, 'Node, lock, package manifest, installed entrypoint and public import resolve to the retained registry binding');

    const pptxModule = await import(publicEntry.url);
    assert.equal(typeof pptxModule.fromPptx, 'function', 'Public PPTX ESM entry does not export fromPptx.');
    currentDocument = await pptxModule.fromPptx(savedBytes, {onDiagnostic: item => diagnostics.push(item)});
    inputDocument = await pptxModule.fromPptx(inputBytes, {onDiagnostic: item => diagnostics.push(item)});
    imported = currentDocument;
    importedBytes = Buffer.from(JSON.stringify(currentDocument, null, 2) + '\n');
    await writeFile(importPath, importedBytes, {flag: 'wx'});
    evidence.import = {moduleUrl: publicEntry.url, fromPptxExport: true,
      outputPath: importPath, outputSha256: sha(importedBytes), diagnostics};

    const fflateRecord = registry.packages.find(item => item.name === 'fflate');
    const xmlRecord = registry.packages.find(item => item.name === 'fast-xml-parser');
    assert.ok(fflateRecord && xmlRecord, 'Missing pinned registry archive/XML helper records.');
    const require = createRequire(import.meta.url);
    const fflate = require(await realpath(fflateRecord.entrypoint));
    const xmlModule = require(await realpath(xmlRecord.entrypoint));
    const XMLParser = xmlModule.XMLParser ?? xmlModule.default?.XMLParser;
    assert.equal(typeof fflate.unzipSync, 'function');
    const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '@_', parseAttributeValue: false,
      trimValues: false, allowBooleanAttributes: true, removeNSPrefix: false});
    const beforeArchive = parseArchive(inputPptxPath, fflate, parser);
    const afterArchive = parseArchive(savedPptxPath, fflate, parser);
    beforePicture = targetPicture(beforeArchive);
    afterPicture = targetPicture(afterArchive);
    evidence.nativePicture = {before: beforePicture, after: afterPicture};
    record('native UI picture media bytes survive open-save-close-reopen lifecycle',
      beforePicture.mediaSha256 === afterPicture.mediaSha256 && afterPicture.mediaSha256 === imageHash(previousDocument.slides?.[1]?.design?.header?.left?.image),
      {beforeSha256: beforePicture.mediaSha256, afterSha256: afterPicture.mediaSha256,
        previousImportSha256: imageHash(previousDocument.slides?.[1]?.design?.header?.left?.image)},
      'target media hash is unchanged through the PowerPoint lifecycle and matches the prior registry import');
    record('furniture tag payload and picture shape identity survive lifecycle',
      beforePicture.tagHex === afterPicture.tagHex && beforePicture.shapeId === afterPicture.shapeId &&
      beforePicture.shapeName === afterPicture.shapeName && afterPicture.tagJson?.role === 'image' &&
      String(afterPicture.tagJson?.group) === '1' && Number(afterPicture.tagJson?.part) === 0,
      {before: {shapeId: beforePicture.shapeId, shapeName: beforePicture.shapeName, tagHex: beforePicture.tagHex},
        after: {shapeId: afterPicture.shapeId, shapeName: afterPicture.shapeName, tagHex: afterPicture.tagHex}},
      'same tagged picture identity and exact OPF_FURNITURE_V1 hex payload; relationship ids/filenames may be renumbered');
    const beforeImage = inputDocument?.slides?.[1]?.design?.header?.left?.image ?? null;
    const previousImage = previousDocument?.slides?.[1]?.design?.header?.left?.image ?? null;
    const currentImage = currentDocument?.slides?.[1]?.design?.header?.left?.image ?? null;
    const currentImageHash = imageHash(currentImage);
    record('public reimport returns current replacement image bytes and saved current alt',
      currentImageHash === afterPicture.mediaSha256 && (currentImage?.alt ?? '') === afterPicture.alt,
      {currentImageHash, nativeMediaSha256: afterPicture.mediaSha256,
        previousImportedAlt: previousImage?.alt ?? '', currentImportedAlt: currentImage?.alt ?? '',
        beforeReopenImportedAlt: beforeImage?.alt ?? '', nativeAlt: afterPicture.alt},
      'current image bytes resolve through the saved picture relationship and importer alt equals saved p:cNvPr descr');

    const normalize = doc => {
      const copy = structuredClone(doc);
      const image = copy?.slides?.[1]?.design?.header?.left?.image;
      if (image !== undefined) copy.slides[1].design.header.left.image = '<target-image-bytes-excluded>';
      return copy;
    };
    const sameNonTarget = stable(normalize(currentDocument)) === stable(normalize(previousDocument));
    const priorImageMatchesInput = imageHash(previousImage) === beforePicture.mediaSha256;
    const importerImageChangedToNativeCurrent = currentImageHash === afterPicture.mediaSha256 && currentImageHash !== imageHash(previousImage);
    const altConsistent = (currentImage?.alt ?? '') === afterPicture.alt;
    evidence.importComparison = {sameNonTarget, priorImageMatchesInput, importerImageChangedToNativeCurrent, altConsistent,
      previousImportPath, previousImportSha256: sha(await readFile(previousImportPath)),
      currentImportPath: importPath, currentImportSha256: sha(importedBytes),
      previousImageHash: imageHash(previousImage), currentImageHash, beforeMediaSha256: beforePicture.mediaSha256,
      afterMediaSha256: afterPicture.mediaSha256, currentNativeAlt: afterPicture.alt, currentImportedAlt: currentImage?.alt ?? ''};
    record('reimported non-target OPF content is unchanged and current picture is not stale',
      sameNonTarget && priorImageMatchesInput && importerImageChangedToNativeCurrent && altConsistent,
      evidence.importComparison, 'all non-target imported content matches; prior target matches input media; current target matches lifecycle-saved media and alt');
  } catch (error) {
    outcomeError = {message: error?.message ?? String(error), stack: error?.stack ?? null};
    failures.push({name: 'analysis execution', ...outcomeError});
  }

  const scriptSha256 = sha(await readFile(fileURLToPath(import.meta.url)));
  const report = {
    schemaVersion: 1,
    scope: 'Offline reimport of a PowerPoint UI-edited deck after the native open/save/close/reopen lifecycle. This uses the current public registry @openpresentation/opf-pptx ESM entry and independently resolves the current saved slide-2 picture, tag payload, media bytes, and alt from OOXML. No Office/UI call is made by this script.',
    createdAt: new Date().toISOString(),
    scriptPath: fileURLToPath(import.meta.url),
    scriptSha256,
    runtime: {node: process.version, executable: await realpath(process.execPath)},
    registryBinding,
    evidence,
    checks,
    failures,
    error: outcomeError,
    passed: failures.length === 0,
    limitations: [
      'This analysis did not perform the Office UI lifecycle; it consumes and hashes the retained native worker outputs.',
      'Package-level preservation is established by resolved current relationships, exact media bytes and exact tag payload; relationship identifiers and part filenames may legitimately be rewritten.',
      'The lock, package manifest and package entrypoint are bound to the retained registry manifest; this does not prove every transitive dependency byte or renderer fidelity.',
    ],
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({passed: report.passed, checks: checks.length, failures, reportPath, importPath}));
  if (!report.passed) process.exitCode = 1;
}

await main();
