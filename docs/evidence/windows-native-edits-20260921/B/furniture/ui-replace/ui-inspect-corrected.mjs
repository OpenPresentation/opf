import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile, realpath, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const parseJson = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const asArray = value => value == null ? [] : Array.isArray(value) ? value : [value];
const stringify = value => JSON.stringify(value);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const uiDirectory = here;
const inputPptx = path.join(here, 'input.pptx');
const editedPptx = path.join(here, 'native-ui-edited.pptx');
const replacementPng = path.join(here, 'replacement.png');
const requestPath = path.join(here, 'ui-request.json');
const uiResultPath = path.join(here, 'ui-result.json');
const manifestPath = path.join(here, 'generation-manifest.json');
const importOutput = path.join(here, 'ui-import-corrected.opf.json');
const comparisonOutput = path.join(here, 'ui-comparison-corrected.json');
const checks = [];
const failures = [];
const evidence = {};
let manifest = null;
let request = null;
let uiResult = null;
let currentImport = null;
let beforeImport = null;
let diagnosticsBefore = [];
let diagnosticsCurrent = [];

function record(name, passed, observed, expected, detail = null) {
  const item = {name, passed: Boolean(passed), observed, expected};
  if (detail !== null) item.detail = detail;
  checks.push(item);
  if (!item.passed) failures.push({name, observed, expected, detail});
  return item.passed;
}

async function attempt(name, fn) {
  try {
    const value = await fn();
    record(name, true, value ?? 'completed', 'completed');
    return {ok: true, value};
  } catch (error) {
    record(name, false, error?.message ?? String(error), 'completed');
    return {ok: false, error};
  }
}

function normalizeZipPath(value) {
  const normalized = path.posix.normalize(value.replaceAll('\\', '/'));
  assert.ok(!normalized.startsWith('../') && normalized !== '..', `ZIP relationship escapes archive: ${value}`);
  return normalized.replace(/^\.\//, '');
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function centralDirectory(bytes, unzipped) {
  const buffer = Buffer.from(bytes);
  const eocdMin = Math.max(0, buffer.length - 22 - 0xffff);
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= eocdMin; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  assert.notEqual(eocd, -1, 'ZIP end-of-central-directory record missing.');
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  let offset = directoryOffset;
  for (let index = 0; index < entryCount; index++) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50, `Invalid central directory entry ${index}.`);
    const crc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const flags = buffer.readUInt16LE(offset + 8);
    const nameBytes = buffer.subarray(offset + 46, offset + 46 + nameLength);
    const name = nameBytes.toString((flags & 0x800) ? 'utf8' : 'latin1');
    if (!name.endsWith('/')) {
      const content = unzipped[name];
      assert.ok(content instanceof Uint8Array, `ZIP member could not be inflated: ${name}`);
      const actualCrc = crc32(content);
      entries.push({name, crc32: crc.toString(16).padStart(8, '0'), actualCrc32: actualCrc.toString(16).padStart(8, '0'),
        crcMatches: actualCrc === crc, compressedSize, uncompressedSize});
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function createArchive(filePath, fflate) {
  return readFile(filePath).then(bytes => {
    const entries = fflate.unzipSync(new Uint8Array(bytes));
    const crcEntries = centralDirectory(bytes, entries);
    return {bytes, entries, crcEntries, sha256: sha(bytes)};
  });
}

function parseXml(archive, part, parser) {
  const bytes = archive.entries[part];
  assert.ok(bytes, `Missing XML part ${part}`);
  return parser.parse(Buffer.from(bytes).toString('utf8'));
}

function childTags(node, parser, slidePart, archive) {
  const nv = node?.['p:nvPicPr'] ?? node?.['p:nvSpPr'] ?? node?.['p:nvGraphicFramePr'] ?? node?.['p:nvCxnSpPr'];
  const tagsRelId = nv?.['p:nvPr']?.['p:custDataLst']?.['p:tags']?.['@_r:id'];
  if (!tagsRelId) return {relationshipId: null, relationshipTarget: null, relationshipType: null, tags: []};
  const relPart = `${path.posix.dirname(slidePart)}/_rels/${path.posix.basename(slidePart)}.rels`;
  const relDocument = parseXml(archive, relPart, parser);
  const relationships = asArray(relDocument?.Relationships?.Relationship);
  const relationship = relationships.find(item => item['@_Id'] === tagsRelId);
  assert.ok(relationship, `Slide tag relationship ${tagsRelId} missing in ${relPart}`);
  const targetPath = normalizeZipPath(path.posix.join(path.posix.dirname(slidePart), relationship['@_Target']));
  const tagDocument = parseXml(archive, targetPath, parser);
  const tags = asArray(tagDocument?.['p:tagLst']?.['p:tag']).map(tag => {
    const valueHex = tag['@_val'] ?? '';
    const validHex = valueHex.length % 2 === 0 && /^[0-9a-f]*$/i.test(valueHex);
    const decodedText = validHex ? Buffer.from(valueHex, 'hex').toString('utf8') : null;
    let decodedJson = null;
    try { decodedJson = decodedText == null ? null : JSON.parse(decodedText); } catch { /* malformed tag bytes remain visible */ }
    return {name: tag['@_name'] ?? null, valueHex, decodedText, decodedJson, tagPart: targetPath};
  });
  return {relationshipId: tagsRelId, relationshipTarget: targetPath, relationshipType: relationship['@_Type'], tags};
}

function textsUnder(node) {
  const texts = [];
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'a:t') {
        for (const item of asArray(child)) texts.push(typeof item === 'string' ? item : item?.['#text'] ?? '');
      } else visit(child);
    }
  };
  visit(node);
  return texts;
}

function geometryOf(shape, type) {
  const xfrm = type === 'pic' ? shape['p:spPr']?.['a:xfrm'] :
    type === 'sp' ? shape['p:spPr']?.['a:xfrm'] :
    type === 'graphicFrame' ? shape['p:xfrm'] : shape['p:spPr']?.['a:xfrm'];
  const off = xfrm?.['a:off'] ?? {};
  const ext = xfrm?.['a:ext'] ?? {};
  const rect = type === 'pic' ? shape['p:blipFill']?.['a:srcRect'] ?? {} : {};
  const emu = {left: Number(off['@_x'] ?? 0), top: Number(off['@_y'] ?? 0),
    width: Number(ext['@_cx'] ?? 0), height: Number(ext['@_cy'] ?? 0),
    rotation: Number(xfrm?.['@_rot'] ?? 0),
    cropLeft: Number(rect['@_l'] ?? 0), cropTop: Number(rect['@_t'] ?? 0),
    cropRight: Number(rect['@_r'] ?? 0), cropBottom: Number(rect['@_b'] ?? 0)};
  const points = {left: emu.left / 12700, top: emu.top / 12700,
    width: emu.width / 12700, height: emu.height / 12700, rotationDegrees: emu.rotation / 60000,
    cropLeftPercent: emu.cropLeft / 1000, cropTopPercent: emu.cropTop / 1000,
    cropRightPercent: emu.cropRight / 1000, cropBottomPercent: emu.cropBottom / 1000};
  return {emu, points};
}

function slideRecords(archive, parser) {
  const slideParts = Object.keys(archive.entries).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) =>
    Number(a.match(/slide(\d+)/)?.[1]) - Number(b.match(/slide(\d+)/)?.[1]));
  const all = {};
  for (const slidePart of slideParts) {
    const document = parseXml(archive, slidePart, parser);
    const tree = document?.['p:sld']?.['p:cSld']?.['p:spTree'];
    assert.ok(tree, `Slide tree missing in ${slidePart}`);
    const records = [];
    for (const type of ['pic', 'sp', 'graphicFrame', 'cxnSp']) {
      const key = `p:${type}`;
      for (const node of asArray(tree[key])) {
        const nv = node['p:nvPicPr'] ?? node['p:nvSpPr'] ?? node['p:nvGraphicFramePr'] ?? node['p:nvCxnSpPr'] ?? {};
        const cNvPr = nv['p:cNvPr'] ?? {};
        const tagInfo = childTags(node, parser, slidePart, archive);
        const geometry = geometryOf(node, type);
        let media = null;
        if (type === 'pic') {
          const embedId = node['p:blipFill']?.['a:blip']?.['@_r:embed'];
          const relPart = `${path.posix.dirname(slidePart)}/_rels/${path.posix.basename(slidePart)}.rels`;
          const relDoc = parseXml(archive, relPart, parser);
          const rel = asArray(relDoc?.Relationships?.Relationship).find(item => item['@_Id'] === embedId);
          if (rel) {
            const mediaPath = normalizeZipPath(path.posix.join(path.posix.dirname(slidePart), rel['@_Target']));
            const bytes = archive.entries[mediaPath];
            media = {relationshipId: embedId, relationshipTarget: mediaPath, relationshipType: rel['@_Type'], sha256: bytes ? sha(bytes) : null, bytes: bytes?.length ?? null};
          }
        }
        records.push({type, id: cNvPr['@_id'] ?? null, name: cNvPr['@_name'] ?? null,
          alt: cNvPr['@_descr'] ?? '', title: cNvPr['@_title'] ?? '', text: textsUnder(node),
          geometry, tags: tagInfo.tags, tagRelationship: {id: tagInfo.relationshipId, target: tagInfo.relationshipTarget, type: tagInfo.relationshipType}, media});
      }
    }
    records.sort((a, b) => Number(a.id) - Number(b.id) || a.type.localeCompare(b.type));
    all[slidePart] = records;
  }
  return all;
}

function furniturePicture(slides) {
  const records = slides['ppt/slides/slide2.xml'] ?? [];
  const tagged = records.filter(record => record.type === 'pic' && record.tags.some(tag => {
    if (tag.name !== 'OPF_FURNITURE_V1') return false;
    return tag.decodedJson?.role === 'image' && String(tag.decodedJson?.group) === '1' && Number(tag.decodedJson?.part) === 0;
  }));
  assert.equal(tagged.length, 1, `Expected one slide-2 image furniture tag; found ${tagged.length}.`);
  return tagged[0];
}

function withoutTargetPicture(slides, target) {
  const normalized = {};
  for (const [slide, records] of Object.entries(slides)) {
    normalized[slide] = records.filter(record => !(slide === 'ppt/slides/slide2.xml' && record.type === 'pic' && record.id === target.id)).map(record => ({
      ...record,
      tags: record.tags.map(tag => ({name: tag.name, valueHex: tag.valueHex, decodedJson: tag.decodedJson})),
      tagRelationship: {type: record.tagRelationship.type, present: Boolean(record.tagRelationship.id)},
      media: record.media ? {sha256: record.media.sha256, bytes: record.media.bytes} : null,
    }));
  }
  return normalized;
}

function currentFurnitureImage(document) {
  return document?.slides?.[1]?.design?.header?.left?.image ?? null;
}

function imageSha(image) {
  if (image?.srcSha256) return image.srcSha256;
  const source = image?.src ?? image?.data ?? null;
  if (typeof source !== 'string') return null;
  const comma = source.indexOf(',');
  return comma >= 0 ? sha(Buffer.from(source.slice(comma + 1), 'base64')) : null;
}

function normalizeImportedNonTarget(document) {
  const copy = structuredClone(document);
  const target = copy?.slides?.[1]?.design?.header?.left;
  if (target && Object.hasOwn(target, 'image')) target.image = '<target-image-excluded-for-content-comparison>';
  return copy;
}

const runtimeInfo = {node: process.version, executable: process.execPath};
let inputBytes = null, editedBytes = null, replacementBytes = null;
let inputArchive = null, editedArchive = null;
let inputSlides = null, editedSlides = null, inputTarget = null, editedTarget = null;
let importerEntry = null, importDiagnostics = {before: [], current: []};
let fflate = null, parser = null;

await attempt('load request, UI result, and generation manifest', async () => {
  request = parseJson(await readFile(requestPath));
  uiResult = parseJson(await readFile(uiResultPath));
  manifest = parseJson(await readFile(manifestPath));
  return {requestSha256: sha(await readFile(requestPath)), uiResultSha256: sha(await readFile(uiResultPath)), manifestSha256: sha(await readFile(manifestPath))};
});

if (manifest) {
  runtimeInfo.node = process.version;
  runtimeInfo.executable = await realpath(process.execPath);
  const registry = manifest.publicRegistry;
  const nodeExecutable = await realpath(manifest.nodeExecutable);
  record('pinned Node version and executable', process.version === manifest.node && runtimeInfo.executable === nodeExecutable,
    {node: process.version, executable: runtimeInfo.executable}, {node: manifest.node, executable: nodeExecutable});
  const lockHash = sha(await readFile(registry.lockFile));
  record('consumer lockfile hash matches generation manifest', lockHash === registry.lockSha256,
    lockHash, registry.lockSha256);

  const packageChecks = [];
  for (const pkg of registry.packages ?? []) {
    try {
      const manifestFile = await realpath(pkg.manifestPath);
      const entrypoint = await realpath(pkg.entrypoint);
      const manifestBytes = await readFile(manifestFile);
      const entryBytes = await readFile(entrypoint);
      const installedManifest = parseJson(manifestBytes);
      const lock = parseJson(await readFile(registry.lockFile));
      const lockKey = `node_modules/${pkg.name}`;
      const locked = lock.packages?.[lockKey];
      const packageOk = installedManifest.name === pkg.name && installedManifest.version === pkg.version &&
        sha(manifestBytes) === pkg.manifestSha256 && sha(entryBytes) === pkg.entrypointSha256 &&
        locked?.version === pkg.version && locked?.resolved === pkg.resolved && locked?.integrity === pkg.integrity;
      packageChecks.push({name: pkg.name, version: pkg.version, manifestPath: manifestFile,
        manifestSha256: sha(manifestBytes), expectedManifestSha256: pkg.manifestSha256,
        entrypoint: entrypoint, entrypointSha256: sha(entryBytes), expectedEntrypointSha256: pkg.entrypointSha256,
        lock: {version: locked?.version ?? null, resolved: locked?.resolved ?? null, integrity: locked?.integrity ?? null},
        expectedLock: {version: pkg.version, resolved: pkg.resolved, integrity: pkg.integrity}, passed: packageOk});
    } catch (error) {
      packageChecks.push({name: pkg.name, passed: false, error: error?.message ?? String(error)});
    }
  }
  const allPackagesOk = packageChecks.length > 0 && packageChecks.every(pkg => pkg.passed);
  record('registry package manifests, entrypoints, lock versions/resolved/integrity match', allPackagesOk,
    packageChecks.map(pkg => ({name: pkg.name, passed: pkg.passed, version: pkg.version})), 'all listed package bindings match');
  evidence.packageBindings = packageChecks;

  const pptxPackage = registry.packages?.find(pkg => pkg.name === '@openpresentation/opf-pptx');
  const esmEntry = registry.esmEntrypoints?.find(item => item.name === '@openpresentation/opf-pptx');
  if (pptxPackage && esmEntry) {
    const pathHash = sha(await readFile(await realpath(pptxPackage.entrypoint)));
    const esmPath = await realpath(fileURLToPath(esmEntry.url));
    const packageEntryPath = await realpath(pptxPackage.entrypoint);
    const samePath = esmPath === packageEntryPath && pathHash === pptxPackage.entrypointSha256;
    record('public PPTX ESM entrypoint matches package hash', samePath,
      {esmEntry: esmPath, sha256: pathHash}, {packageEntry: packageEntryPath, sha256: pptxPackage.entrypointSha256});
    importerEntry = esmEntry.url;
  } else record('public PPTX ESM entrypoint available', false, esmEntry ?? null, 'manifest entry for @openpresentation/opf-pptx');
}

await attempt('read source, edited deck, and replacement image', async () => {
  inputBytes = await readFile(inputPptx);
  editedBytes = await readFile(editedPptx);
  replacementBytes = await readFile(replacementPng);
  const hashes = {inputPptx: sha(inputBytes), editedPptx: sha(editedBytes), replacementPng: sha(replacementBytes)};
  evidence.files = hashes;
  record('UI request hashes agree with saved artifacts', request.sourceSha256 === hashes.inputPptx &&
    request.replacementSha256 === hashes.replacementPng && uiResult.savedSha256 === hashes.editedPptx,
    hashes, {inputPptx: request.sourceSha256, editedPptx: uiResult.savedSha256, replacementPng: request.replacementSha256});
  record('request/result paths identify the owned saved copy', path.resolve(request.ownedEditedPath) === path.resolve(editedPptx) &&
    path.resolve(uiResult.savedPath) === path.resolve(editedPptx), {request: request.ownedEditedPath, result: uiResult.savedPath}, editedPptx);
  const sourceNow = await readFile(request.sourcePath);
  const baseline = manifest?.fixtures?.find(fixture => fixture.id === 'baseline-inherited-local');
  record('input deck matches retained baseline and source stayed byte-identical', sha(sourceNow) === request.sourceSha256 &&
    hashes.inputPptx === request.sourceSha256 && baseline?.sha256 === hashes.inputPptx && uiResult.sourceUnchanged === true && uiResult.inputUnchanged === true,
    {sourceNowSha256: sha(sourceNow), requestSourceSha256: request.sourceSha256, inputPptxSha256: hashes.inputPptx,
      baselineSha256: baseline?.sha256, uiResultSourceUnchanged: uiResult.sourceUnchanged, uiResultInputUnchanged: uiResult.inputUnchanged},
    'original source, owned input snapshot, and manifest baseline hashes agree; UI result records both unchanged');
  return hashes;
});

const packageRecords = manifest?.publicRegistry?.packages ?? [];
const fflateRecord = packageRecords.find(pkg => pkg.name === 'fflate');
const xmlRecord = packageRecords.find(pkg => pkg.name === 'fast-xml-parser');
if (fflateRecord && xmlRecord) {
  try {
    const require = createRequire(import.meta.url);
    fflate = require(await realpath(fflateRecord.entrypoint));
    const xmlModule = require(await realpath(xmlRecord.entrypoint));
    const XMLParser = xmlModule.XMLParser ?? xmlModule.default?.XMLParser;
    assert.equal(typeof fflate.unzipSync, 'function');
    assert.equal(typeof XMLParser, 'function');
    parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '@_', parseAttributeValue: false,
      trimValues: false, allowBooleanAttributes: true, removeNSPrefix: false});
    record('registry archive/XML helpers available', true,
      {fflateVersion: fflateRecord.version, xmlParserVersion: xmlRecord.version}, 'pinned installed helpers');
  } catch (error) {
    record('registry archive/XML helpers available', false, error?.message ?? String(error), 'pinned installed helpers');
  }
}

if (fflate && parser && inputBytes && editedBytes) {
  try {
    inputArchive = await createArchive(inputPptx, fflate);
    editedArchive = await createArchive(editedPptx, fflate);
    const crcBadInput = inputArchive.crcEntries.filter(entry => !entry.crcMatches);
    const crcBadEdited = editedArchive.crcEntries.filter(entry => !entry.crcMatches);
    record('ZIP central-directory CRCs match every uncompressed member', crcBadInput.length === 0 && crcBadEdited.length === 0,
      {input: {members: inputArchive.crcEntries.length, failures: crcBadInput}, edited: {members: editedArchive.crcEntries.length, failures: crcBadEdited}},
      'zero CRC mismatches');
    inputSlides = slideRecords(inputArchive, parser);
    editedSlides = slideRecords(editedArchive, parser);
    inputTarget = furniturePicture(inputSlides);
    editedTarget = furniturePicture(editedSlides);
    evidence.archive = {
      input: {sha256: inputArchive.sha256, entryCount: inputArchive.crcEntries.length, badCrc: crcBadInput},
      edited: {sha256: editedArchive.sha256, entryCount: editedArchive.crcEntries.length, badCrc: crcBadEdited},
      slideParts: {input: Object.keys(inputSlides), edited: Object.keys(editedSlides)},
      targetPictureBefore: inputTarget,
      targetPictureAfter: editedTarget,
    };
    record('tagged slide-2 picture independently located', true,
      {before: {id: inputTarget.id, name: inputTarget.name, tags: inputTarget.tags}, after: {id: editedTarget.id, name: editedTarget.name, tags: editedTarget.tags}},
      'one OPF_FURNITURE_V1 image tag on slide2');
    const mediaNames = new Set([...Object.keys(inputArchive.entries), ...Object.keys(editedArchive.entries)]
      .filter(name => /^ppt\/media\//.test(name) && !name.endsWith('/')));
    const mediaChanges = [];
    for (const name of [...mediaNames].sort()) {
      const before = inputArchive.entries[name], after = editedArchive.entries[name];
      const beforeHash = before ? sha(before) : null, afterHash = after ? sha(after) : null;
      if (beforeHash !== afterHash) mediaChanges.push({part: name, beforeSha256: beforeHash, afterSha256: afterHash,
        beforeBytes: before?.length ?? null, afterBytes: after?.length ?? null});
    }
    evidence.media = {changed: mediaChanges,
      originalTarget: inputTarget.media, editedTarget: editedTarget.media,
      replacementPngSha256: sha(replacementBytes), inputTargetMatchesManifestImage: inputTarget.media?.sha256 === manifest?.inputs?.image?.sha256,
      editedTargetMatchesReplacementPng: editedTarget.media?.sha256 === sha(replacementBytes)};
    record('current slide picture media bytes match the selected replacement', editedTarget.media?.sha256 === sha(replacementBytes),
      {before: inputTarget.media, after: editedTarget.media, replacementSha256: sha(replacementBytes)}, 'edited picture relationship content SHA equals replacement.png');
    const expectedMediaChanges = mediaChanges.length === 2 && mediaChanges.some(item => item.beforeSha256 === manifest?.inputs?.image?.sha256 && item.afterSha256 === null) &&
      mediaChanges.some(item => item.beforeSha256 === null && item.afterSha256 === sha(replacementBytes));
    record('original media bytes match the fixture image; only old target and selected replacement media changed', inputTarget.media?.sha256 === manifest?.inputs?.image?.sha256 &&
      editedTarget.media?.sha256 === sha(replacementBytes) && expectedMediaChanges,
      {originalTargetSha256: inputTarget.media?.sha256, expectedOriginalSha256: manifest?.inputs?.image?.sha256,
        changedMediaParts: mediaChanges}, 'one old target media part removed and one replacement media part added');

    const tagBefore = inputTarget.tags.find(tag => tag.name === 'OPF_FURNITURE_V1');
    const tagAfter = editedTarget.tags.find(tag => tag.name === 'OPF_FURNITURE_V1');
    const tagHexPreserved = Boolean(tagBefore && tagAfter && tagBefore.valueHex === tagAfter.valueHex);
    const tagRelationshipPresent = Boolean(inputTarget.tagRelationship.id && inputTarget.tagRelationship.target && inputTarget.tagRelationship.type &&
      editedTarget.tagRelationship.id && editedTarget.tagRelationship.target && editedTarget.tagRelationship.type);
    const tagRelationshipIdPreserved = inputTarget.tagRelationship.id === editedTarget.tagRelationship.id;
    evidence.tag = {before: {relationship: inputTarget.tagRelationship, tag: tagBefore},
      after: {relationship: editedTarget.tagRelationship, tag: tagAfter},
      tagHexPreserved, tagRelationshipPresent, tagRelationshipIdPreserved,
      tagRelationshipTargetPreserved: inputTarget.tagRelationship.target === editedTarget.tagRelationship.target};
    record('OPF_FURNITURE_V1 payload remains attached through saved tag relationship', tagHexPreserved && tagRelationshipPresent,
      {tagHexPreserved, tagRelationshipPresent, tagRelationshipIdPreserved,
        before: {relationship: inputTarget.tagRelationship, tag: tagBefore}, after: {relationship: editedTarget.tagRelationship, tag: tagAfter}},
      'current picture has a resolvable OPF_FURNITURE_V1 relationship and the exact source hex value; relationship renumbering is recorded separately');
    record('shape identity retained by Change Picture', inputTarget.id === editedTarget.id && inputTarget.name === editedTarget.name,
      {before: {id: inputTarget.id, name: inputTarget.name}, after: {id: editedTarget.id, name: editedTarget.name}},
      'same PowerPoint shape id and name');

    const beforeGeometry = inputTarget.geometry, afterGeometry = editedTarget.geometry;
    const geometryKeys = ['left', 'top', 'width', 'height', 'rotation', 'cropLeft', 'cropTop', 'cropRight', 'cropBottom'];
    const geometryDrift = Object.fromEntries(geometryKeys.map(key => [key, {
      beforeEmu: beforeGeometry.emu[key], afterEmu: afterGeometry.emu[key], deltaEmu: afterGeometry.emu[key] - beforeGeometry.emu[key],
      before: key.startsWith('crop') ? beforeGeometry.points[`${key}Percent`] : key === 'rotation' ? beforeGeometry.points.rotationDegrees : beforeGeometry.points[key],
      after: key.startsWith('crop') ? afterGeometry.points[`${key}Percent`] : key === 'rotation' ? afterGeometry.points.rotationDegrees : afterGeometry.points[key],
      delta: (key.startsWith('crop') ? afterGeometry.points[`${key}Percent`] - beforeGeometry.points[`${key}Percent`] :
        key === 'rotation' ? afterGeometry.points.rotationDegrees - beforeGeometry.points.rotationDegrees : afterGeometry.points[key] - beforeGeometry.points[key]),
    }]));
    evidence.geometry = {before: beforeGeometry, after: afterGeometry, drift: geometryDrift,
      exactUnchanged: geometryKeys.every(key => beforeGeometry.emu[key] === afterGeometry.emu[key]),
      layoutWithinPointTolerance: ['left', 'top', 'width', 'height'].every(key => Math.abs(afterGeometry.points[key] - beforeGeometry.points[key]) <= 0.02),
      metadataOrCropChanged: ['rotation', 'cropLeft', 'cropTop', 'cropRight', 'cropBottom'].some(key => beforeGeometry.emu[key] !== afterGeometry.emu[key])};
    record('tagged picture geometry drift recorded separately from content', true, evidence.geometry, 'raw EMU and point deltas recorded');

    const otherBefore = withoutTargetPicture(inputSlides, inputTarget);
    const otherAfter = withoutTargetPicture(editedSlides, editedTarget);
    const otherContentUnchanged = stringify(otherBefore) === stringify(otherAfter);
    evidence.otherShapes = {unchanged: otherContentUnchanged, before: otherBefore, after: otherAfter};
    record('all non-target slide body, title, and furniture shapes unchanged', otherContentUnchanged,
      {beforeSha256: sha(Buffer.from(stringify(otherBefore))), afterSha256: sha(Buffer.from(stringify(otherAfter))),
        differingSlides: Object.keys(otherBefore).filter(slide => stringify(otherBefore[slide]) !== stringify(otherAfter[slide]))},
      'same names, ids, text, geometry, and tags for every non-target p:sp/p:pic/graphicFrame/connector');

    const selectedFixture = manifest?.fixtures?.find(fixture => fixture.id === 'baseline-inherited-local');
    const omittedImageFromManifestInventory = Boolean(selectedFixture &&
      !(selectedFixture.slides?.[1]?.furnitureShapes ?? []).some(shape => shape.kind === 'image' || shape.name === inputTarget.name));
    evidence.manifestInventory = {baselineFixtureSha256: selectedFixture?.sha256 ?? null,
      sourceInputMatchesManifest: selectedFixture?.sha256 === sha(inputBytes),
      targetShapeName: inputTarget.name,
      manifestHasTargetInAllShapeNames: selectedFixture?.slides?.[1]?.allShapeNames?.includes(inputTarget.name) ?? false,
      manifestListsTargetInFurnitureShapes: !omittedImageFromManifestInventory};
    record('manifest inventory omission is not used to locate the target', inputTarget.name === 'OPF image 1' && omittedImageFromManifestInventory,
      evidence.manifestInventory, 'target found from slide XML/tag relationship independently of furnitureShapes');
  } catch (error) {
    record('PPTX archive/XML/relationship analysis completed', false, error?.message ?? String(error), 'parse both deck archives and their current slide relationships');
  }
}

if (importerEntry && manifest) {
  await attempt('reimport source and saved current deck with public registry PPTX module', async () => {
    const module = await import(importerEntry);
    assert.equal(typeof module.fromPptx, 'function', 'Public @openpresentation/opf-pptx entry has no fromPptx export.');
    const original = await module.fromPptx(inputBytes, {onDiagnostic: item => diagnosticsBefore.push(item)});
    const current = await module.fromPptx(editedBytes, {onDiagnostic: item => diagnosticsCurrent.push(item)});
    beforeImport = original;
    currentImport = current;
    await writeFile(importOutput, JSON.stringify(current, null, 2) + '\n', {flag: 'wx'});
    return {moduleEntry: importerEntry, sourceSlides: original.slides?.length, currentSlides: current.slides?.length,
      currentImportPath: importOutput, currentImportSha256: sha(await readFile(importOutput))};
  });
}

if (beforeImport && currentImport && inputTarget && editedTarget) {
  const beforeImage = currentFurnitureImage(beforeImport);
  const currentImage = currentFurnitureImage(currentImport);
  const oldMediaSha = inputTarget.media?.sha256 ?? null;
  const replacementSha = sha(replacementBytes);
  const currentImageHash = imageSha(currentImage);
  const beforeImageHash = imageSha(beforeImage);
  evidence.import = {
    currentImageLocation: 'slides[1].design.header.left.image',
    beforeImage: beforeImage ?? null,
    currentImage: currentImage ?? null,
    beforeImageHash,
    currentImageHash,
    oldMediaSha,
    replacementSha,
    expectedCurrentAltFromXml: editedTarget.alt,
    importerDiagnosticsBefore: diagnosticsBefore,
    importerDiagnosticsCurrent: diagnosticsCurrent,
  };
  record('reimported furniture image uses current replacement bytes', currentImageHash === replacementSha,
    {beforeImageHash, currentImageHash, originalMediaSha: oldMediaSha, replacementSha}, 'current imported furniture image SHA equals replacement.png SHA');
  record('reimported current alt matches saved slide-2 p:pic alt', (currentImage?.alt ?? '') === editedTarget.alt,
    {beforeAlt: beforeImage?.alt ?? null, currentAlt: currentImage?.alt ?? null, savedNativeAlt: editedTarget.alt}, 'OPF current alt equals current native p:cNvPr descr (empty string when absent)');
  record('reimported furniture image changed from input content', beforeImageHash === oldMediaSha && currentImageHash !== beforeImageHash,
    {beforeImageHash, currentImageHash, oldMediaSha}, 'original current import matches original media and edited import differs');

  const sameNonTargetImport = stringify(normalizeImportedNonTarget(beforeImport)) === stringify(normalizeImportedNonTarget(currentImport));
  const originalSlideCount = beforeImport.slides?.length ?? null;
  const currentSlideCount = currentImport.slides?.length ?? null;
  evidence.importedOtherContent = {sameNonTargetImport, originalSlideCount, currentSlideCount,
    beforeSlideSummaries: (beforeImport.slides ?? []).map(slide => ({title: slide.title, section: slide.section, blocks: slide.blocks, design: slide.design, effectiveHeader: slide.effectiveHeader, effectiveFooter: slide.effectiveFooter})),
    currentSlideSummaries: (currentImport.slides ?? []).map(slide => ({title: slide.title, section: slide.section, blocks: slide.blocks, design: slide.design, effectiveHeader: slide.effectiveHeader, effectiveFooter: slide.effectiveFooter}))};
  record('reimported title, body, and non-target furniture content unchanged', sameNonTargetImport,
    {beforeSha256: sha(Buffer.from(stringify(normalizeImportedNonTarget(beforeImport)))), afterSha256: sha(Buffer.from(stringify(normalizeImportedNonTarget(currentImport)))), originalSlideCount, currentSlideCount},
    'whole imported document matches after excluding only slide-2 target image object');
}

if (currentImport) await attempt('write current imported OPF evidence', async () => ({path: importOutput, sha256: sha(await readFile(importOutput))}));

const report = {
  schemaVersion: 1,
  scope: 'Offline read-only inspection of an actual PowerPoint UI Change Picture saved file and public registry importer result. No Office/UI reopen was performed here; no native worker observation is claimed. Media/content, metadata/tags, and geometry are assessed separately; picture shape identity is inferred only from saved package fields.',
  createdAt: new Date().toISOString(),
  runtime: runtimeInfo,
  sourceFiles: {
    request: {path: requestPath, sha256: request ? sha(await readFile(requestPath)) : null},
    uiResult: {path: uiResultPath, sha256: uiResult ? sha(await readFile(uiResultPath)) : null},
    generationManifest: {path: manifestPath, sha256: manifest ? sha(await readFile(manifestPath)) : null},
    inputPptx: {path: inputPptx, sha256: inputBytes ? sha(inputBytes) : null},
    savedPptx: {path: editedPptx, sha256: editedBytes ? sha(editedBytes) : null},
    replacementPng: {path: replacementPng, sha256: replacementBytes ? sha(replacementBytes) : null},
  },
  importedEvidence: currentImport ? {path: importOutput, sha256: sha(await readFile(importOutput))} : null,
  evidence,
  checks,
  failures,
  passed: failures.length === 0,
  limitations: [
    'This is archive/XML/import analysis only; it does not prove PowerPoint reopen behavior after saving.',
    'Imported layout, native geometry and crop/reflow fidelity are separate from image-byte retention and metadata retention.',
    'The generation manifest records package lock, package manifest and entrypoint hashes; this report does not claim every transitive package byte is bound.',
  ],
};
const scriptHash = sha(await readFile(fileURLToPath(import.meta.url)));
report.scriptSha256 = scriptHash;
await writeFile(comparisonOutput, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({passed: report.passed, checks: checks.length, failures, comparisonOutput,
  importOutput: currentImport ? importOutput : null}));
if (!report.passed) process.exitCode = 1;
