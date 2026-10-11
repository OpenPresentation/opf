#!/usr/bin/env node
// Materialize the published gallery's catalog exports for repository checks and example generation.
// These files are ignored build inputs; the gallery repository owns and publishes the records.
import {lstat, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {catalogDisplay, catalogIndexes, catalogManifest, gallery} from '@openpresentation/gallery';
import {layoutPreviewIndex, layoutPreviews} from '@openpresentation/gallery/previews';
import {SNAPSHOT_KINDS, serializeJson} from './catalog-snapshot.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
for (const [slug, html] of Object.entries(layoutPreviews)) {
  await writeFile(path.join(previewsRoot, `${slug}.html`), `${html}\n`);
}
