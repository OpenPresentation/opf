import assert from 'node:assert/strict';
import {test} from 'node:test';
import {consumerDependencies} from './consumer-dependencies.mjs';

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
