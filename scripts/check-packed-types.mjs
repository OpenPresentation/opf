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
// With `cli`, the isolated installation also holds @openpresentation/cli, which must resolve the same core and export no library
// entry (RR-62: applications use core's `/node`, which the consumer below compiles with every other entry). A second consumer
// imports the root and every subpath except `/node` and `/node/engine` with no Node types at all, so a browser build of core
// never needs them.
export async function checkPackedTypes(directory, {downstream = false, cli = false} = {}) {
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
  if (cli) {
    const cliManifestPath = await installedFile(installed.resolve('@openpresentation/cli/package.json'));
    const cliManifest = JSON.parse(await readFile(cliManifestPath, 'utf8'));
    // RR-62: the CLI is the command; the file API is core's /node, compiled with every other core entry below.
    assert.equal(cliManifest.exports['./api'], undefined, '@openpresentation/cli exports no library entry');
    assert.equal(await realpath(createRequire(cliManifestPath).resolve('@openpresentation/opf/package.json')), await realpath(manifestPath), '@openpresentation/cli must resolve the candidate core tarball');
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
import {validate, type ValidationReport} from '@openpresentation/opf/validator';
import type {Finding} from '@openpresentation/opf/types';
import {composeSlide} from '@openpresentation/opf/composition';
import type {FontFaceSelection, TextStyle} from '@openpresentation/opf/composition';
import {paginate} from '@openpresentation/opf/pagination';
import {importData} from '@openpresentation/opf/data';
import {convertContent, type ConvertedContent} from '@openpresentation/opf/convert';
import {fromMarkdown, toMarkdown} from '@openpresentation/opf/markdown';
import {fromYaml, toYaml, OPFYamlError, type YamlFinding} from '@openpresentation/opf/yaml';
import {parse, stringify, type DeckFormat, type ParseOptions} from '@openpresentation/opf/deck';
import {convert, open, save, OPFApiError, OPFExportError, OPFImportError, OPFValidationError as NodeValidationError, type ConvertOptions, type ConvertResult, type ConvertedFile, type SaveResult} from '@openpresentation/opf/node';
import * as opfNode from '@openpresentation/opf/node';
import {OPFValidationError as CoreValidationError} from '@openpresentation/opf';
const deck: Presentation = {slides: [{title: 'Typed consumer'}]};
const physicalFace: FontFaceSelection = {family: 'Roboto SemiBold', bold: false, italic: false};
const measuredStyle: TextStyle = {fontFamily: 'Roboto SemiBold', fontWeight: 600, fontFace: physicalFace};
// @ts-expect-error Physical style-link flags are booleans, independent of weight.
const invalidFace: FontFaceSelection = {family: 'Roboto', bold: 600, italic: false};
void measuredStyle; void invalidFace;
const report: ValidationReport = validate(deck, {only: ['format']});
const valid: boolean = report.valid;
const firstFinding: Finding | undefined = report.findings[0];
const pages = paginate(deck).presentation;
composeSlide(pages.slides[0]);
const importedTable = importData('Name,Value\\nA,1', {as: 'table'});
const importedChart = importData('Name,Value\\nA,1', {as: 'chart'});
const importedDeck: Presentation = {slides: [importedTable, importedChart]};
const columns: [string, ...string[]] = importedChart.chart.data.columns;
const rows: [unknown[], ...unknown[][]] = importedChart.chart.data.rows;
const tableRows: unknown[][] = importedTable.table.rows;
const dynamicMode: 'chart' | 'table' = Math.random() > 0.5 ? 'chart' : 'table';
const dynamicImport = importData('Name,Value\\nA,1', {as: dynamicMode});
const dynamicDeck: Presentation = {slides: [dynamicImport]};
// @ts-expect-error A literal table request exposes only its table payload.
importedTable.chart;
// @ts-expect-error A literal chart request exposes only its chart payload.
importedChart.table;
void importedDeck; void columns; void rows; void tableRows; void dynamicDeck;
const converted: ConvertedContent = convertContent({text: 'a'}, 'list');
const lossless: boolean = converted.lossless;
// @ts-expect-error unknown content kind must be rejected
convertContent({text: 'a'}, 'unsupported');
void lossless;
const markdownResult = fromMarkdown('# Typed\\n');
const slides: Presentation['slides'] = markdownResult.presentation.slides;
const firstMarkdownFinding: Finding | undefined = markdownResult.findings[0];
const markdown: string = toMarkdown(deck).markdown;
// @ts-expect-error unsupported mode must be rejected
toMarkdown(deck, {unsupported: 'maybe'});
void slides; void firstMarkdownFinding; void firstFinding; void markdown;
const deckFormat: DeckFormat = 'markdown';
const parseOptions: ParseOptions = {format: deckFormat, filename: 'deck.opf.md'};
const parsedDeck: Presentation = parse('# Typed', parseOptions);
const deckText: string = stringify(parsedDeck, {filename: 'deck.opf.md'});
// @ts-expect-error unknown deck format must be rejected
parse('{}', {format: 'toml'});
// @ts-expect-error parse reads text, not a deck
parse(deck);
void deckText;
// RR-62: the Node file API. One core: its classes and Presentation are core's own.
async function typedNode() {
  const written: ConvertResult = await convert('deck.opf.md', 'deck.pdf');
  const returned: ConvertResult = await convert(deck, {format: 'pptx'});
  const file: ConvertedFile | undefined = returned.files[0];
  const bytes: Uint8Array | undefined = file?.bytes;
  const name: string | undefined = file?.name;
  const options: ConvertOptions = {slides: '1-3', scale: 2, fontDirs: ['fonts'], assetDir: '.', force: true, date: '2026-01-01'};
  await convert('deck.opf.md', 'slides/deck.png', options);
  await convert(bytes ?? new Uint8Array(), 'deck.opf.yaml', {signals: true});
  const opened: Presentation = await open('deck.opf.md');
  const imported: Presentation = await open(bytes ?? new Uint8Array());
  const saved: SaveResult = await save(opened, 'deck.opf.yaml', {validate: false});
  const savedFormat: DeckFormat = saved.format;
  const sameClass: typeof CoreValidationError = NodeValidationError;
  const viaNamespace: ValidationReport = opfNode.validate(opened);
  // @ts-expect-error the output is a path, or options with a format
  await convert('deck.opf.md', 42);
  // @ts-expect-error without an output path a format is required
  await convert('deck.opf.md', {scale: 2});
  // @ts-expect-error pdfMode is vector or raster
  await convert('deck.opf.md', 'deck.pdf', {pdfMode: 'fast'});
  // @ts-expect-error save takes no format: the file name names it
  await save(opened, 'deck.opf.yaml', {format: 'yaml'});
  try { await convert('deck.pptx', 'deck.pdf'); } catch (error) {
    if (error instanceof OPFExportError || error instanceof OPFImportError) { const code: string = error.code; const found: Finding[] = error.findings; void code; void found; }
    if (error instanceof OPFApiError) void error.details;
  }
  void written; void name; void imported; void savedFormat; void sameClass; void viaNamespace;
}
void typedNode;
const parsedYaml = fromYaml('slides:\\n  - title: Typed\\n', {aliases: false});
const yamlSlides: Presentation['slides'] = parsedYaml.presentation.slides;
const yamlFinding: YamlFinding | undefined = parsedYaml.findings[0];
const yamlSchemaValid: boolean | null = parsedYaml.schemaValid;
const yamlText: string = toYaml(deck, {schemaComment: true}).yaml;
const yamlError: OPFYamlError['code'] = 'invalid-document';
// @ts-expect-error unknown option must be rejected
toYaml(deck, {style: 'flow'});
void yamlSlides; void yamlFinding; void yamlSchemaValid; void yamlText; void yamlError;
// @ts-expect-error slides must remain an array
const invalid: Presentation = {slides: 42};
// @ts-expect-error unsupported import target must be rejected
importData([], {as: 'unsupported'});
void valid; void invalid;
${downstream ? `
import {renderSlideSvg} from '@openpresentation/opf-render';
import {createEditorSession} from '@openpresentation/opf-editor';
import {toPptx} from '@openpresentation/opf-pptx';
const editor = createEditorSession(deck);
const edited = editor.presentation;
const svg: string = renderSlideSvg(edited, 0);
toPptx(edited); void svg;
` : ''}
`);
  // RR-62: every entry a browser may import, compiled with no Node types (`types: []`): `/node` and `/node/engine` are Node-only.
  const browserImports = entries.filter(([entry]) => entry !== './node' && entry !== './node/engine').map(([entry], index) => `import * as browser${index} from ${JSON.stringify(manifest.name + (entry === '.' ? '' : entry.slice(1)))}; void browser${index};`).join('\n');
  await writeFile(path.join(directory, 'types-browser.ts'), `${browserImports}\nexport {};\n`);
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
  for (const mode of ['NodeNext', 'Bundler', 'Browser']) {
    const input = mode === 'Browser' ? 'types-browser.ts' : 'types-smoke.ts';
    const configuration = `packed-types-${mode}.json`;
    await writeFile(path.join(directory, configuration), JSON.stringify({
      compilerOptions: {target: 'ES2022', module: mode === 'NodeNext' ? 'NodeNext' : 'ESNext', moduleResolution: mode === 'NodeNext' ? 'NodeNext' : 'Bundler', strict: true, skipLibCheck: false, noEmit: true, types: mode === 'Browser' ? [] : ['node'], lib: ['ES2022', 'DOM']},
      files: [input],
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
        assert.ok(resolvedFiles.some(file => file.path === path.join(directory, input)), 'Compiler must report the actual consumer input');
        if (mode === 'Browser') assert.deepEqual(resolvedFiles.filter(file => /[\\/]@types[\\/]node[\\/]/.test(file.path)).map(file => file.path), [], 'A browser consumer of core must not pull in Node types');
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
  console.log(`Packed TypeScript 5.9/7 consumers passed: ${entries.length} exports, NodeNext/Bundler${downstream ? ', installed renderer/editor/PPTX' : ''}${cli ? ', @openpresentation/cli resolving it' : ''}, browser entries without Node types.`);
  return report;
}
