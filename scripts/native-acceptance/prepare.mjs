import assert from 'node:assert/strict';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {digest, installedIdentity, repositoryIdentity} from './identity.mjs';
import {fontRouteSourcePaths,selectFontRoutes} from './font-routes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(here, '../..');
export function parseArguments(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    assert.ok(['--consumer', '--output', '--pptx-repo', '--font-routes'].includes(key), `Unknown option: ${key}`);
    assert.ok(args[i + 1] && !args[i + 1].startsWith('--'), `Missing value: ${key}`);
    assert.ok(!Object.hasOwn(options, key), `Duplicate option: ${key}`);
    options[key] = key==='--font-routes'?selectFontRoutes(args[i+1]):path.resolve(args[i + 1]);
  }
  for (const key of ['--consumer', '--output', '--pptx-repo']) assert.ok(options[key], `Required: ${key}`);
  return options;
}

async function trackedInputs(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    assert.ok(!entry.isSymbolicLink(), 'Suite source must not contain symlinks');
    if (entry.isDirectory()) files.push(...await trackedInputs(path.join(directory, entry.name), relative));
    else files.push(`scripts/native-acceptance/${relative}`);
  }
  return files.sort();
}

export async function prepare(args) {
  const options = parseArguments(args);
  const output = options['--output'];
  for (const source of [repository, options['--consumer'], options['--pptx-repo']]) {
    assert.ok(output !== source && !source.startsWith(output + path.sep), 'Output must not contain a source directory');
  }
  const provenance = {
    packages: installedIdentity(options['--consumer']),
    suiteRepository: repositoryIdentity(repository, [...await trackedInputs(here),...(options['--font-routes']?[fontRouteSourcePaths()[1]]:[])]),
    workerRepository: repositoryIdentity(options['--pptx-repo'], [
      'test/native-process.ps1', 'test/native-process-check.ps1', 'test/native-furniture-control.ps1',
      'test/native-furniture-harness-check.ps1', 'test/native-picture-control.ps1',
      'test/native-picture-harness-check.ps1', 'test/native-table-colors.ps1',
    ]),
    node: process.version,
    nativeAcceptance: false,
    registryAcceptance: false,
  };
  const {generatePrimaryFixtures, generateChartModes, generateTableColors, generateFontInputs} = await import('./generate.mjs');
  const fontRouteNames=options['--font-routes'];
  const generated = await generatePrimaryFixtures({consumer: options['--consumer'], output, sourceIdentity: provenance,...(fontRouteNames?{fontRouteNames}:{})});
  if(fontRouteNames){
    const suite={schemaVersion:1,provenance,...generated,cases:generated.cases.map(entry=>({...entry,worker:'furniture'}))};
    return sealSuite(output,suite);
  }
  const chartModes = await generateChartModes({consumer: options['--consumer'], output, sourceIdentity: provenance});
  const tableColors = await generateTableColors({consumer: options['--consumer'], output, sourceIdentity: provenance});
  const fonts = await generateFontInputs({consumer: options['--consumer'], output});
  const chartCases = [];
  for (const entry of chartModes.cases.filter(entry => entry.input)) {
    const actionPlan = `actions/${entry.id}.json`;
    await writeFile(path.join(output, actionPlan), '[]\n', {flag: 'wx'});
    chartCases.push({...entry, actionPlan, worker: 'furniture'});
  }
  const suite = {
    schemaVersion: 1, provenance, ...generated, chartModes, tableColors, fontInventory: fonts.fontInventory,
    cases: [
      ...generated.cases.map(entry => ({...entry, worker: 'furniture'})),
      ...chartCases,
      ...tableColors.cases.map(entry => ({...entry, worker: 'table-colors'})),
    ],
  };
  assert.equal(new Set(suite.cases.map(entry => entry.id)).size, suite.cases.length, 'Duplicate case id');
  return sealSuite(output,suite);
}

/** Independently seal every generated file, including subset sources and diagnostics. */
export async function sealSuite(output,suite){
  // The output is generated locally; only fixtures and code belong in Git.
  // Hash the complete output tree independently of a generator's file listing.
  const files = [];
  async function walk(directory, prefix = '') {
    for (const entry of await readdir(directory, {withFileTypes: true})) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      assert.ok(!entry.isSymbolicLink(), 'Generated suite contains a symlink');
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative);
      else {
        const bytes = await readFile(path.join(directory, entry.name));
        files.push({path: relative, sha256: digest(bytes), bytes: bytes.length});
      }
    }
  }
  await walk(output);
  suite.files = files.sort((a, b) => a.path.localeCompare(b.path));
  await writeFile(path.join(output, 'suite.json'), JSON.stringify(suite, null, 2) + '\n', {flag: 'wx'});
  return suite;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const suite = await prepare(process.argv.slice(2));
  console.log(JSON.stringify({cases: suite.cases.length, files: suite.files.length, nativeAcceptance: false,...(suite.scope?{scope:suite.scope}:{}), output: path.resolve(parseArguments(process.argv.slice(2))['--output'])}));
}
