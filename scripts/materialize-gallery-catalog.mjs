#!/usr/bin/env node
// Materialize the published gallery's catalog exports for repository checks and example generation.
// These files are ignored build inputs; the gallery repository owns and publishes the records.
// MR-10: once the gallery package is imported (packages/gallery/package.json exists) the directory holds the real, tracked
// package, so this exits cleanly without reading or touching anything. The guard comes before the package imports on purpose.
import {existsSync} from 'node:fs';
import {lstat, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(path.join(root, 'packages/gallery/package.json'))) {
  console.log('packages/gallery is the gallery package, not a generated fixture; nothing to materialize.');
  process.exit(0);
}
const {catalogDisplay, catalogIndexes, catalogManifest, gallery} = await import('@openpresentation/gallery');
const {layoutPreviewIndex, layoutPreviews} = await import('@openpresentation/gallery/previews');
const {SNAPSHOT_KINDS, serializeJson} = await import('./catalog-snapshot.mjs');
const generatedRoot = path.join(root, 'packages/gallery');
const marker = path.join(generatedRoot, '.generated-from-openpresentation-gallery');
try {
  const stat = await lstat(generatedRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (await readFile(marker, 'utf8')) !== 'Generated from @openpresentation/gallery; safe to replace.\n') {
    throw new Error(`${generatedRoot} is not a generated gallery fixture; refusing to replace it`);
  }
  await rm(generatedRoot, {recursive: true});
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  // A directory without our marker is user-owned, even when its marker read failed.
  if (await lstat(generatedRoot).then(() => true, () => false)) throw new Error(`${generatedRoot} is not a generated gallery fixture; refusing to replace it`);
}
await mkdir(generatedRoot, {recursive: true});
await writeFile(marker, 'Generated from @openpresentation/gallery; safe to replace.\n');
const catalogRoot = path.join(generatedRoot, 'catalog');
for (const {kind, catalogKey, recordSchemaId} of SNAPSHOT_KINDS) {
  const dir = path.join(catalogRoot, kind);
  await mkdir(dir, {recursive: true});
  const index = catalogIndexes[catalogKey];
  await writeFile(path.join(dir, 'index.json'), serializeJson(index));
  const records = gallery[catalogKey] ?? catalogDisplay[catalogKey];
  for (const {id, file} of index.records) {
    await writeFile(path.join(dir, file), serializeJson({$schema: recordSchemaId, id, ...records[id]}));
  }
}
await writeFile(path.join(catalogRoot, 'manifest.json'), serializeJson(catalogManifest));

const previewsRoot = path.join(root, 'packages/gallery/previews/layouts');
await mkdir(previewsRoot, {recursive: true});
await writeFile(path.join(previewsRoot, 'index.json'), serializeJson(layoutPreviewIndex));
for (const {id, file, bytes} of layoutPreviewIndex.records) {
  const value = layoutPreviews[id];
  const preview = typeof value === 'string' ? `${value}\n` : undefined;
  if (typeof preview !== 'string' || Buffer.byteLength(preview, 'utf8') !== bytes) throw new Error(`Gallery preview ${id} does not match its index`);
  await writeFile(path.join(previewsRoot, file), preview);
}
