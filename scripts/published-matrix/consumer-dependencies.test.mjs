import assert from 'node:assert/strict';
import {test} from 'node:test';
import {consumerDependencies, catalogGenerationForCore, assertCatalogGeneration, assertInstalledCatalog} from './consumer-dependencies.mjs';

const libraries = {'@openpresentation/opf': '0.19.0', '@openpresentation/opf-render': '0.19.1', '@openpresentation/opf-pptx': '0.19.0', '@openpresentation/opf-editor': '0.19.0'};
test('v2 standalone consumer declares the independently planned gallery and preserves library pins', () => {
  const before = structuredClone(libraries);
  assert.deepEqual(consumerDependencies(libraries, [{name: '@openpresentation/gallery', version: '2.0.0'}]), {...libraries, '@openpresentation/gallery': '2.0.0'});
  assert.deepEqual(consumerDependencies(libraries, [{name: '@openpresentation/gallery', version: '2.0.1'}]), {...libraries, '@openpresentation/gallery': '2.0.1'});
  assert.deepEqual(libraries, before);
});
test('legacy published controls retain their four-package dependency contract', () => {
  const legacy = {...libraries, '@openpresentation/opf': '0.18.4'};
  assert.deepEqual(consumerDependencies(legacy, [{name: '@openpresentation/gallery', version: '1.0.0'}]), legacy);
  assert.deepEqual(consumerDependencies(legacy), legacy);
});
test('v2 refuses absent, duplicate, old, prerelease or nonregistry version identities', () => {
  for (const entries of [[], [{name: '@openpresentation/gallery', version: '1.0.0'}], [{name: '@openpresentation/gallery', version: '2.0.0-next.0'}], [{name: '@openpresentation/gallery', version: 'file:../gallery'}], [{name: '@openpresentation/gallery', version: '2.0.0'}, {name: '@openpresentation/gallery', version: '2.0.0'}]]) assert.throws(() => consumerDependencies(libraries, entries));
});

test('actual lock and installed validators bind the direct gallery version', async () => {
  const {assertConsumerLock, assertInstalledConsumerPackage} = await import('./consumer-dependencies.mjs');
  const plan = consumerDependencies(libraries, [{name: '@openpresentation/gallery', version: '2.0.0'}]);
  const lock = {packages: Object.fromEntries(Object.entries(plan).map(([name, version]) => [`node_modules/${name}`, {version, integrity: 'sha512-fixture', resolved: `https://registry.npmjs.org/${name}/fixture.tgz`}] ))};
  assertConsumerLock(plan, lock);
  for (const [name, version] of Object.entries(plan)) assertInstalledConsumerPackage(name, {version}, plan);
  const wrong = structuredClone(lock);wrong.packages['node_modules/@openpresentation/gallery'].version = '1.0.0';
  assert.throws(() => assertConsumerLock(plan, wrong), /gallery@2.0.0/);
  delete wrong.packages['node_modules/@openpresentation/gallery'];
  assert.throws(() => assertConsumerLock(plan, wrong));
  assert.throws(() => assertInstalledConsumerPackage('@openpresentation/gallery', {version: '1.0.0'}, plan));
  for (const [key, value] of [['resolved', 'file:../gallery'], ['integrity', '']]) {
    const invalid = structuredClone(lock);invalid.packages['node_modules/@openpresentation/gallery'][key] = value;
    assert.throws(() => assertConsumerLock(plan, invalid));
  }
});

test('current core 0.20 binds Gallery 3 while keeping exact library pins', () => {
  const current = {...libraries, '@openpresentation/opf': '0.20.1'};
  assert.deepEqual(consumerDependencies(current, [{name: '@openpresentation/gallery', version: '3.0.0'}]), {...current, '@openpresentation/gallery': '3.0.0'});
  for (const entries of [[], [{name: '@openpresentation/gallery', version: '2.0.0'}], [{name: '@openpresentation/gallery', version: '4.0.0'}], [{name: '@openpresentation/gallery', version: '3.0.0-next.0'}], [{name: '@openpresentation/gallery', version: 'file:../gallery'}], [{name: '@openpresentation/gallery', version: '3.0.0'}, {name: '@openpresentation/gallery', version: '3.0.0'}]]) assert.throws(() => consumerDependencies(current, entries));
  assert.throws(() => consumerDependencies(libraries, [{name: '@openpresentation/gallery', version: '3.0.0'}]));
});

test('core 0.24 binds Gallery 4, which still declares catalog generation 3', () => {
  const current = {...libraries, '@openpresentation/opf': '0.24.2'};
  assert.deepEqual(consumerDependencies(current, [{name: '@openpresentation/gallery', version: '4.0.0'}]), {...current, '@openpresentation/gallery': '4.0.0'});
  for (const version of ['3.0.0', '5.0.0', '4.0.0-next.0']) assert.throws(() => consumerDependencies(current, [{name: '@openpresentation/gallery', version}]));
  assertInstalledCatalog('0.24.2', {version: '4.0.0', opf: {catalogSchema: 3}}, 3, {'@openpresentation/gallery': '4.0.0'});
});

test('catalog generation binds each reviewed train and rejects missing, wrong or future identities', () => {
  for (const [core, generation] of [['0.18.4', 1], ['0.19.0', 2], ['0.20.1', 3], ['0.24.2', 3]]) {
    assert.equal(catalogGenerationForCore(core), generation);
    assertCatalogGeneration(core, generation);
    for (const wrong of [undefined, 0, 1, 2, 3, 4, '3'].filter(value => value !== generation)) assert.throws(() => assertCatalogGeneration(core, wrong));
  }
  for (const core of ['0.25.0', '1.0.0', '0.20.1-next.0', 'file:../opf', undefined]) assert.throws(() => catalogGenerationForCore(core));
});

test('installed Gallery identity and manifest/export generation must agree with the current plan', () => {
  const plan = consumerDependencies({'@openpresentation/opf': '0.20.1'}, [{name: '@openpresentation/gallery', version: '3.0.0'}]);
  const manifest = {version: '3.0.0', opf: {catalogSchema: 3}};
  assertInstalledCatalog('0.20.1', manifest, 3, plan);
  for (const bad of [{...manifest, version: '3.0.1'}, {...manifest, version: '2.0.0'}, {...manifest, opf: {catalogSchema: 2}}, {...manifest, opf: {catalogSchema: 4}}, {...manifest, opf: {}}, {version: '3.0.0'}]) assert.throws(() => assertInstalledCatalog('0.20.1', bad, 3, plan));
  for (const generation of [undefined, 2, 4, '3']) assert.throws(() => assertInstalledCatalog('0.20.1', manifest, generation, plan));
});
