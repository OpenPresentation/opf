import assert from 'node:assert/strict';
import {readFile, writeFile, realpath, mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const require = createRequire(new URL('../packages/javascript/package.json', import.meta.url));
const tools = createRequire(import.meta.url);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const contained = (root, file) => file.startsWith(root + path.sep);

async function fileIdentity(file) {
  const actual = await realpath(file);
  const bytes = await readFile(actual);
  return {path: actual, bytes: bytes.length, sha256: sha256(bytes)};
}

// This is a source-alias guard, not a security sandbox; ordinary Node options remain allowed.
export function assertPackedTypeEnvironment({nodeOptions = process.env.NODE_OPTIONS, nodePath = process.env.NODE_PATH, execArgv = process.execArgv} = {}) {
  const injectionOption = /(?:^|[\s"'])(?:--(?:import|loader|experimental-loader|require)(?:=|[\s"']|$)|-r)/;
  assert.ok(!injectionOption.test(nodeOptions ?? '') && !nodePath && !execArgv.some(arg => injectionOption.test(arg)), 'Installed verification must not alias packages through import/require/loaders or NODE_PATH.');
}

// Compile only the isolated installation, with no source aliases or skipLibCheck.
export async function checkPackedTypes(directory, {downstream = false} = {}) {
  assertPackedTypeEnvironment();
  directory = await realpath(directory);
  const installed = createRequire(path.join(directory, 'package.json'));
  const packageFiles = [];
  async function installedFile(file) {
    const identity = await fileIdentity(file);
    assert.ok(contained(directory, identity.path), `Installed declaration input escaped consumer: ${identity.path}`);
    packageFiles.push(identity);
    return identity.path;
  }
  const manifestPath = await installedFile(installed.resolve('@openpresentation/opf/package.json'));
  const nodeTypesPath = await installedFile(installed.resolve('@types/node/package.json'));
  const nodeTypes = JSON.parse(await readFile(nodeTypesPath, 'utf8'));
  assert.equal(nodeTypes.version, require('@types/node/package.json').version, 'Consumer Node types must match the exact locked test tool version');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (downstream) {
    for (const name of ['@openpresentation/opf-render', '@openpresentation/opf-editor', '@openpresentation/opf-pptx']) {
      const consumer = createRequire(await installedFile(installed.resolve(name)));
      await installedFile(installed.resolve(`${name}/package.json`));
      assert.equal(await realpath(consumer.resolve('@openpresentation/opf/package.json')), await realpath(manifestPath), `${name} must resolve the candidate core tarball`);
    }
  }
  const entries = Object.entries(manifest.exports).filter(([, target]) => typeof target === 'object');
  for (const [entry, target] of entries) {
    assert.ok(target.types && target.import, `${entry} needs runtime and declaration targets`);
    await installedFile(path.resolve(path.dirname(manifestPath), target.types));
  }
  const imports = entries.map(([entry], index) => {
    const specifier = manifest.name + (entry === '.' ? '' : entry.slice(1));
    return `import * as entry${index} from ${JSON.stringify(specifier)}; void entry${index};`;
  }).join('\n');
  await writeFile(path.join(directory, 'types-smoke.ts'), `${imports}
import type {Presentation} from '@openpresentation/opf/types';
import {validatePresentation} from '@openpresentation/opf/validator';
import {composeSlide} from '@openpresentation/opf/composition';
import type {FontFaceSelection, TextStyle} from '@openpresentation/opf/composition';
import {paginatePresentation} from '@openpresentation/opf/pagination';
import {createDataContent} from '@openpresentation/opf/data';
import {convertContent, type ConvertedContent} from '@openpresentation/opf/convert';
const deck: Presentation = {slides: [{title: 'Typed consumer'}]};
const physicalFace: FontFaceSelection = {family: 'Roboto SemiBold', bold: false, italic: false};
const measuredStyle: TextStyle = {fontFamily: 'Roboto SemiBold', fontWeight: 600, fontFace: physicalFace};
// @ts-expect-error Physical style-link flags are booleans, independent of weight.
const invalidFace: FontFaceSelection = {family: 'Roboto', bold: 600, italic: false};
void measuredStyle; void invalidFace;
const valid: boolean = validatePresentation(deck).valid;
const pages = paginatePresentation(deck).presentation;
composeSlide(pages.slides[0]);
createDataContent('Name,Value\\nA,1', {as: 'table'});
const converted: ConvertedContent = convertContent({text: 'a'}, 'list');
const lossless: boolean = converted.lossless;
// @ts-expect-error unknown content kind must be rejected
convertContent({text: 'a'}, 'unsupported');
void lossless;
// @ts-expect-error slides must remain an array
const invalid: Presentation = {slides: 42};
// @ts-expect-error unsupported import target must be rejected
createDataContent([], {as: 'unsupported'});
void valid; void invalid;
${downstream ? `
import {renderSvg} from '@openpresentation/opf-render';
import {createEditorSession} from '@openpresentation/opf-editor';
import {toPptx} from '@openpresentation/opf-pptx';
const editor = createEditorSession(deck);
const edited = editor.document;
const svg: string = renderSvg(edited);
toPptx(edited); void svg;
` : ''}
`);
  const reportDirectory = path.join(directory, 'artifacts/packed-types');
  await mkdir(reportDirectory, {recursive: true});
  const compilers = [];
  for (const [resolver, name, entrypoint] of [
    [require, 'typescript', require.resolve('typescript/bin/tsc')],
    [tools, '@typescript/native', fileURLToPath(new URL('./typecheck.mjs', import.meta.url))],
  ]) {
    const packageFile = await fileIdentity(resolver.resolve(`${name}/package.json`));
    const packageManifest = JSON.parse(await readFile(packageFile.path, 'utf8'));
    let standardLibrary = await realpath(path.join(path.dirname(packageFile.path), 'lib'));
    let nativeTool;
    if (name === '@typescript/native') {
      const platformPackage = `@typescript/typescript-${process.platform}-${process.arch}`;
      assert.equal(packageManifest.optionalDependencies?.[platformPackage], packageManifest.version, 'Native compiler must be an exact locked optional dependency');
      const platformManifest = await fileIdentity(createRequire(packageFile.path).resolve(`${platformPackage}/package.json`));
      assert.equal(JSON.parse(await readFile(platformManifest.path, 'utf8')).version, packageManifest.version);
      standardLibrary = await realpath(path.join(path.dirname(platformManifest.path), 'lib'));
      nativeTool = {packageFile: platformManifest, executable: await fileIdentity(path.join(standardLibrary, process.platform === 'win32' ? 'tsc.exe' : 'tsc'))};
    }
    compilers.push({name, version: packageManifest.version, packageFile, entrypoint: await fileIdentity(entrypoint), standardLibrary, ...(nativeTool ? {nativeTool} : {})});
  }
  const report = {node: process.version, platform: process.platform, consumer: directory, downstream, nodeTypesVersion: nodeTypes.version, packageFiles, compilers, results: []};
  const errors = [];
  for (const mode of ['NodeNext', 'Bundler']) {
    const configuration = `packed-types-${mode}.json`;
    await writeFile(path.join(directory, configuration), JSON.stringify({
      compilerOptions: {target: 'ES2022', module: mode === 'Bundler' ? 'ESNext' : 'NodeNext', moduleResolution: mode, strict: true, skipLibCheck: false, noEmit: true, types: ['node'], lib: ['ES2022', 'DOM']},
      files: ['types-smoke.ts'],
    }));
    for (const compiler of compilers) {
      const label = `${mode}-${compiler.version}`;
      const result = spawnSync(process.execPath, [compiler.entrypoint.path, '--project', configuration, '--listFiles', '--pretty', 'false'], {cwd: directory, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
      await writeFile(path.join(reportDirectory, `${label}.stdout.txt`), result.stdout ?? '');
      await writeFile(path.join(reportDirectory, `${label}.stderr.txt`), result.stderr ?? '');
      const resolvedFiles = [];
      let failure;
      try {
        if (result.error) throw result.error;
        for (const line of (result.stdout ?? '').split(/\r?\n/)) {
          const file = line.trim();
          if (!path.isAbsolute(file) || !/\.(?:[cm]?tsx?|jsx?|json)$/i.test(file)) continue;
          const identity = await fileIdentity(file);
          const standardLibrary = path.dirname(identity.path) === compiler.standardLibrary && /^lib(?:\..+)?\.d\.ts$/.test(path.basename(identity.path));
          assert.ok(contained(directory, identity.path) || standardLibrary, `Compiler resolved an application declaration outside consumer: ${identity.path}`);
          resolvedFiles.push({...identity, role: standardLibrary ? 'compiler-standard-library' : 'consumer'});
        }
        assert.ok(resolvedFiles.some(file => file.path === path.join(directory, 'types-smoke.ts')), 'Compiler must report the actual consumer input');
        assert.equal(result.status, 0, `${label}: compiler exited ${result.status}; see retained diagnostics`);
      } catch (error) {
        failure = error.message;
        errors.push(error);
      }
      report.results.push({mode, compiler: compiler.version, configuration: await fileIdentity(path.join(directory, configuration)), status: result.status, signal: result.signal, resolvedFiles, ...(failure ? {error: failure} : {})});
    }
  }
  await writeFile(path.join(reportDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (errors.length) throw new AggregateError(errors, `Packed type checks failed in ${errors.length} compiler/mode combinations; see ${reportDirectory}`);
  console.log(`Packed TypeScript 5.9/7 consumers passed: ${entries.length} exports, NodeNext/Bundler${downstream ? ', installed renderer/editor/PPTX' : ''}.`);
  return report;
}
