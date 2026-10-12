import assert from 'node:assert/strict';

/** A standalone host declares the catalog package it imports; pre-0.19 hosts retain core's catalog entry. */
export function consumerDependencies(planned, independentPackages = []) {
  const core = planned['@openpresentation/opf'];
  assert.match(core ?? '', /^\d+\.\d+\.\d+$/, 'An exact published core version is required');
  const [major, minor] = core.split('.').map(Number);
  if (major === 0 && minor < 19) return {...planned};
  const galleries = independentPackages.filter(item => item.name === '@openpresentation/gallery');
  assert.equal(galleries.length, 1, 'The final registry plan must name exactly one independent gallery');
  assert.match(galleries[0].version ?? '', /^2\.\d+\.\d+$/, 'Core 0.19 requires a published gallery 2 version');
  return {...planned, '@openpresentation/gallery': galleries[0].version};
}

export function assertConsumerLock(consumerPlan, lock) {
  for (const [name, version] of Object.entries(consumerPlan)) {
    const entry = lock.packages[`node_modules/${name}`];
    assert.equal(entry?.version, version, `package-lock.json pins ${name}@${version}; run prepare-consumer.mjs --update-lock`);
    assert.match(entry.integrity ?? '', /^sha512-/, `${name} has a registry integrity hash`);
    assert.match(entry.resolved ?? '', /^https:\/\/registry\.npmjs\.org\//, `${name} resolves from the npm registry`);
  }
}

export function assertInstalledConsumerPackage(name, manifest, consumerPlan) {
  assert.equal(manifest.version, consumerPlan[name], `${name} installed at the planned version`);
}
