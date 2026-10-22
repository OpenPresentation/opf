import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {previewPackages, previewManifest} from './ecosystem-preview-plan.mjs';

test('default preview set is the gallery and the four engines; only explicit CLI mode adds the CLI', () => {
  const original = previewPackages();
  assert.deepEqual(original.map(([name]) => name), ['gallery', 'opf', 'opf-render', 'opf-editor', 'opf-pptx']);
  assert.deepEqual(previewPackages(['--include-cli']).slice(0, 5), original);
  assert.deepEqual(previewPackages(['--include-cli'])[5], ['cli', 'packages/cli', '0.1.0-preview.11']);
  assert.deepEqual(previewPackages(), original, 'calls do not mutate the default');
  for (const args of [['--unknown'], ['--include-cli', '--include-cli'], ['--include-cli=true'], ['--registry']])
    assert.throws(() => previewPackages(args), /Usage/);
});

test('CLI and engine stages share exact core and compatible preview peers while source contracts stay literal', () => {
  const packages = previewPackages(['--include-cli']);
  const versions = Object.fromEntries(packages.map(([name,, version]) => [`@openpresentation/${name}`, version]));
  const core = JSON.parse(readFileSync(new URL('../packages/javascript/package.json', import.meta.url)));
  const cli = JSON.parse(readFileSync(new URL('../packages/cli/package.json', import.meta.url)));
  const before = structuredClone({core, cli});
  const stagedCore = previewManifest(core, versions[core.name], versions);
  const stagedCli = previewManifest(cli, versions[cli.name], versions);
  assert.deepEqual({core, cli}, before);
  assert.equal(stagedCli.dependencies[core.name], stagedCore.version);
  assert.equal(stagedCli.dependencies['@openpresentation/gallery'], versions['@openpresentation/gallery'], 'the gallery is a preview package: core and the CLI stage the exact preview version');
  assert.equal(stagedCore.dependencies['@openpresentation/gallery'], versions['@openpresentation/gallery']);
  for (const staged of [stagedCore, stagedCli]) assert.ok(!JSON.stringify(staged).includes('workspace:'), 'no workspace: specifier is staged');
  for (const manifest of [stagedCore, stagedCli]) {
    for (const name of ['@openpresentation/opf-render', '@openpresentation/opf-pptx']) {
      assert.equal(manifest.peerDependencies[name], `^${versions[name]}`);
      assert.deepEqual(manifest.peerDependenciesMeta[name], before[manifest.name === core.name ? 'core' : 'cli'].peerDependenciesMeta[name]);
    }
    assert.ok(!manifest.scripts && !manifest.devDependencies);
  }
  assert.equal(stagedCli.version, versions[cli.name]);
  assert.match(stagedCli.version, /-preview\./);
  assert.equal(core.version, before.core.version);
  assert.equal(cli.version, before.cli.version);
});

test('unmapped dependencies and portable package metadata are preserved', () => {
  const original = {name:'fixture',version:'0.19.0',dependencies:{third:'^1.0.0'},optionalDependencies:{'@openpresentation/opf':'^0.19.0'},bin:{opf:'dist/index.js'},files:['dist','skills'],opf:{requiresUnreleasedCore:'0.20.0'}};
  const staged = previewManifest(original, '0.1.0-preview.11', {'@openpresentation/opf':'0.4.0-preview.11'});
  assert.deepEqual(staged.dependencies, original.dependencies);
  assert.equal(staged.optionalDependencies['@openpresentation/opf'], '0.4.0-preview.11');
  for (const key of ['bin','files','opf']) assert.deepEqual(staged[key], original[key]);
  assert.equal(original.optionalDependencies['@openpresentation/opf'], '^0.19.0');
});
