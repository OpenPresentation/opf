import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {installedIdentity, repositoryIdentity} from './identity.mjs';
import {compareNativeTableColors} from './compare-table-colors.mjs';

export async function compareTables(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    assert.ok(['--consumer', '--suite', '--output', '--pptx-repo'].includes(args[i]), `Unknown option: ${args[i]}`);
    assert.ok(args[i + 1] && !args[i + 1].startsWith('--'), `Missing value: ${args[i]}`);
    assert.ok(!Object.hasOwn(options, args[i]), `Duplicate option: ${args[i]}`);
    options[args[i]] = path.resolve(args[i + 1]);
  }
  for (const key of ['--consumer', '--suite', '--output', '--pptx-repo']) assert.ok(options[key], `Required: ${key}`);
  const suite = JSON.parse(await readFile(path.join(options['--suite'], 'suite.json'), 'utf8'));
  assert.equal(suite.schemaVersion, 1);
  const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const sourceIdentity = {
    ...suite.provenance,
    node: process.version,
    packages: installedIdentity(options['--consumer']),
    suiteRepository: repositoryIdentity(repository, suite.provenance.suiteRepository.files.map(file => file.path)),
    workerRepository: repositoryIdentity(options['--pptx-repo'], suite.provenance.workerRepository.files.map(file => file.path)),
  };
  return compareNativeTableColors({consumer: options['--consumer'], output: options['--output'], sourceIdentity});
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await compareTables(process.argv.slice(2))));
}
