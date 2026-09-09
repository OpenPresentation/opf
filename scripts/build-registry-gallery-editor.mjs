import { mkdir, readFile, writeFile, copyFile, rm, realpath, readdir } from 'node:fs/promises';
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
// Host controls can evolve without republishing unchanged library packages.
const ref = registry.exampleRefs?.['opf-editor'] ?? registry.verificationRefs['opf-editor'];
if (!/^[a-f0-9]{40}$/.test(ref ?? '')) throw new Error('Missing immutable editor example ref');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const exampleSources = {};
const contained = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
};
await mkdir(out, { recursive: true });
const actualRoot = await realpath(root), actualOut = await realpath(out);
if (!contained(actualRoot, actualOut)) throw new Error('Gallery output must stay inside the workspace');
await mkdir(source, { recursive: true });
const actualSource = await realpath(source);
if (!contained(actualOut, actualSource)) throw new Error('Gallery staging must stay inside the output directory');
for (const file of ['playground.js', 'data-controls.js', 'transfer-controls.js', 'pptx-controls.js', 'playground.html', 'playground.css', 'galleries.json']) {
  const result = spawnSync('git', ['show', `${ref}:examples/${file}`], { cwd: editor, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Cannot read editor example ${ref}:${file}: ${result.stderr}`);
  exampleSources[file] = sha256(result.stdout);
  const content = file.endsWith('.js') ? result.stdout.replace(/(['"])\.\.\/src\/([^'"/]+)\.js\1/g,
    (_, quote, module) => `${quote}@openpresentation/opf-editor${module === 'index' ? '' : '/' + module}${quote}`) : result.stdout;
  await writeFile(path.join(source, file), content);
}
const bundle = await build({
  entryPoints: [path.join(source, 'playground.js')], outfile: path.join(out, 'playground.js'),
  bundle: true, platform: 'browser', format: 'esm', minify: true, metafile: true, legalComments: 'linked',
  plugins: [registry.plugin(true)],
});
// Keep every bundled license in a linked file; normalize only license text,
// never JavaScript or whitespace inside runtime string literals.
const licensePath = path.join(out, 'playground.js.LEGAL.txt');
const licenses = [(await readFile(licensePath, 'utf8')).replace(/[\t ]+$/gm, '')];
const supplements = JSON.parse(await readFile(path.join(root, 'scripts/bundled-license-supplements.json'), 'utf8'));
const ownLicense = await readFile(path.join(root, 'LICENSE'), 'utf8');
const mitTerms = ownLicense.slice(ownLicense.indexOf('Permission is hereby granted'));
if (!mitTerms.startsWith('Permission is hereby granted')) throw new Error('MIT license template is unavailable');
const packageDirectories = new Set();
for (const input of Object.keys(bundle.metafile.inputs)) {
  if (!input.replaceAll('\\', '/').includes('/node_modules/')) continue;
  let directory = path.dirname(path.resolve(input));
  while (directory !== path.dirname(directory)) {
    try {
      const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
      if (pkg.name || path.basename(directory) === 'pptxgenjs') {
        packageDirectories.add(directory);
        break;
      }
      directory = path.dirname(directory);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      directory = path.dirname(directory);
    }
  }
}
for (const directory of [...packageDirectories].sort()) {
  const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  const files = (await readdir(directory)).filter(name => /^(license|copying)(\..*)?$/i.test(name)).sort();
  if (!files.length) {
    const key = `${pkg.name}@${pkg.version}`, supplement = supplements[key];
    if (supplement) {
      if (sha256(supplement.text) !== supplement.sha256) throw new Error(`License supplement hash mismatch: ${key}`);
      licenses.push(`${key} — ${supplement.source}\n\n${supplement.text}`);
    } else {
      const readme = (await readdir(directory)).find(name => /^readme(?:\.[a-z]+)?$/i.test(name));
      const text = readme ? await readFile(path.join(directory, readme), 'utf8') : '';
      const declaration = text.match(/^##? License\s*\r?\n([\s\S]*)$/im)?.[1];
      if (pkg.license !== 'MIT' || !/^\s*\(?MIT\)?(?:\s|$)/.test(declaration ?? '')) throw new Error(`Bundled package has no recognized license notice: ${key}`);
      const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name;
      licenses.push(`${key} — published ${readme} and package.json license declaration: MIT${author ? '\nPackage author: ' + author : ''}\n\n${declaration}${declaration.includes('Permission is hereby granted') ? '' : '\n\nMIT terms:\n' + mitTerms}`);
    }
  }
  for (const file of files) {
    licenses.push(`${pkg.name ?? path.basename(directory)}${pkg.version ? '@' + pkg.version : ''} — ${file}\n\n${(await readFile(path.join(directory, file), 'utf8')).replace(/[\t ]+$/gm, '')}`);
  }
}
await writeFile(licensePath, (licenses.join('\n\n') + '\n').replace(/\r\n?/g, '\n'));
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
for (const file of ['index.html', 'playground.js', 'playground.js.LEGAL.txt', 'playground.css', 'fonts.json', 'galleries.json', 'gallery.json', 'opf-spec.json']) {
  files[file] = sha256(await readFile(path.join(out, file)));
}
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({
  source: 'npm', packages: registry.packages,
  editorExamples: { commit: ref, files: exampleSources },
  galleryDocuments: gallery.items.length, files,
}, null, 2) + '\n');
if (await realpath(source) !== actualSource || await realpath(out) !== actualOut) throw new Error('Gallery staging location changed during build');
await rm(source, { recursive: true });
console.log(`Registry gallery editor built: ${gallery.items.length} validated/rendered documents, ${fields.length} schema fields.`);
