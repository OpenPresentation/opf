import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { registryToolchain } from './registry-toolchain.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const registry = await registryToolchain();
const editor = path.resolve(root, '../opf-editor');
const out = path.join(root, 'artifacts/registry-gallery-editor');
const source = path.join(out, 'source');
const require = createRequire(path.join(root, 'packages/javascript/package.json'));
const { build } = createRequire(require.resolve('tsup'))('esbuild');
const ref = registry.verificationRefs['opf-editor'];
if (!/^[a-f0-9]{40}$/.test(ref ?? '')) throw new Error('Missing immutable editor example ref');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const exampleSources = {};
await mkdir(source, { recursive: true });
for (const file of ['playground.js', 'data-controls.js', 'transfer-controls.js', 'playground.html', 'playground.css', 'galleries.json']) {
  const result = spawnSync('git', ['show', `${ref}:examples/${file}`], { cwd: editor, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Cannot read editor example ${ref}:${file}: ${result.stderr}`);
  exampleSources[file] = sha256(result.stdout);
  const content = file.endsWith('.js') ? result.stdout.replace(/(['"])\.\.\/src\/([^'"/]+)\.js\1/g,
    (_, quote, module) => `${quote}@openpresentation/opf-editor${module === 'index' ? '' : '/' + module}${quote}`) : result.stdout;
  await writeFile(path.join(source, file), content);
}
const bundle = await build({
  entryPoints: [path.join(source, 'playground.js')], outfile: path.join(out, 'playground.js'),
  bundle: true, platform: 'browser', format: 'esm', minify: true, metafile: true,
  plugins: [registry.plugin(true)],
});
for (const file of Object.keys(bundle.metafile.inputs)) {
  if (/opf-(editor|render|pptx)\/(src|dist)\//.test(file) && !file.includes('node_modules/')) {
    throw new Error(`Unpublished library leaked into gallery bundle: ${file}`);
  }
}
const { loadOfficeFontRegistry } = await registry.import('@openpresentation/opf-render/fonts-node');
await writeFile(path.join(out, 'fonts.json'), JSON.stringify((await loadOfficeFontRegistry()).embeddedFonts));
await copyFile(path.join(source, 'playground.css'), path.join(out, 'playground.css'));
await copyFile(path.join(source, 'galleries.json'), path.join(out, 'galleries.json'));
const revision = sha256(Buffer.concat(await Promise.all(['playground.js', 'playground.css'].map(file => readFile(path.join(out, file)))))).slice(0, 12);
const html = (await readFile(path.join(source, 'playground.html'), 'utf8'))
  .replace('http://localhost:3101/spec', '/spec')
  .replace('src="playground.js"', `src="playground.js?v=${revision}"`)
  .replace('href="playground.css"', `href="playground.css?v=${revision}"`);
await writeFile(path.join(out, 'index.html'), html);
const result = spawnSync(process.execPath, ['scripts/build-gallery-snapshot.mjs', '--registry'], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) throw new Error('Gallery snapshot build failed');
await copyFile(path.join(root, 'artifacts/editor/gallery.json'), path.join(out, 'gallery.json'));
const { validatePresentation } = await registry.import('@openpresentation/opf');
const { renderSvgDeck } = await registry.import('@openpresentation/opf-render');
const gallery = JSON.parse(await readFile(path.join(out, 'gallery.json'), 'utf8'));
for (const { id, opf } of gallery.items) {
  const result = validatePresentation(opf);
  if (!result.valid) throw new Error(`Invalid gallery document ${id}: ${JSON.stringify(result.errors)}`);
  renderSvgDeck(opf);
}
const { opfSchemas, listSchemaFields } = await registry.import('@openpresentation/opf-editor/schema');
const fields = listSchemaFields();
await writeFile(path.join(out, 'opf-spec.json'), JSON.stringify({
  schemaDigest: sha256(JSON.stringify(opfSchemas)), fieldCount: fields.length, schemas: opfSchemas, fields,
}));
const files = {};
for (const file of ['index.html', 'playground.js', 'playground.css', 'fonts.json', 'galleries.json', 'gallery.json', 'opf-spec.json']) {
  files[file] = sha256(await readFile(path.join(out, file)));
}
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({
  source: 'npm', packages: registry.packages,
  editorExamples: { commit: ref, files: exampleSources },
  galleryDocuments: gallery.items.length, files,
}, null, 2) + '\n');
await rm(source, { recursive: true });
console.log(`Registry gallery editor built: ${gallery.items.length} validated/rendered documents, ${fields.length} schema fields.`);
