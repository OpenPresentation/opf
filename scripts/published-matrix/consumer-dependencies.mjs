import assert from 'node:assert/strict';

/** Reviewed package generations; a future core train must declare its catalog contract explicitly. */
export function catalogGenerationForCore(core) {
  assert.match(core ?? '', /^\d+\.\d+\.\d+$/, 'An exact published core version is required');
  const [major, minor] = core.split('.').map(Number);
  if (major === 0 && minor < 19) return 1;
  if (major === 0 && minor === 19) return 2;
  if (major === 0 && minor >= 20 && minor <= 24) return 3;
  assert.fail(`No reviewed catalog generation for core ${core}`);
}

/** The published gallery major a core minor depends on: Gallery 4.0.0 (core 0.24) still declares catalogSchema 3. */
export function galleryMajorForCore(core) {
  const generation = catalogGenerationForCore(core);
  if (generation === 1) return undefined;
  return Number(core.split('.')[1]) >= 24 ? 4 : generation;
}

export function assertCatalogGeneration(core, generation) {
  assert.equal(generation, catalogGenerationForCore(core), 'Published catalog generation matches the planned core');
}

/** A standalone host declares the catalog package it imports; pre-0.19 hosts retain core's catalog entry. */
export function consumerDependencies(planned, independentPackages = []) {
  const core = planned['@openpresentation/opf'];
  const generation = catalogGenerationForCore(core);
  if (generation === 1) return {...planned};
  const galleryMajor = galleryMajorForCore(core);
  const galleries = independentPackages.filter(item => item.name === '@openpresentation/gallery');
  assert.equal(galleries.length, 1, 'The final registry plan must name exactly one independent gallery');
  assert.match(galleries[0].version ?? '', new RegExp(`^${galleryMajor}\\.\\d+\\.\\d+$`), `Core ${core} requires a published gallery ${galleryMajor} version`);
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

export function assertInstalledCatalog(core, manifest, exportedGeneration, consumerPlan) {
  assertInstalledConsumerPackage('@openpresentation/gallery', manifest, consumerPlan);
  assertCatalogGeneration(core, exportedGeneration);
  assert.equal(manifest.opf?.catalogSchema, exportedGeneration, 'Installed gallery manifest and exported catalog generation agree');
}
