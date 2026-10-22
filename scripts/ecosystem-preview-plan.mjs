import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const galleryVersion = JSON.parse(readFileSync(new URL('../packages/gallery/package.json', import.meta.url), 'utf8')).version;

export function previewPackages(args = []) {
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--include-cli'), 'Usage: pack-ecosystem.mjs [--include-cli]');
  // MR-23e: every package is in this workspace. The gallery is a preview package too: core depends on it, and the version under
  // development is not on the registry, so the consumer installs it from its own tarball, at its own version (core stages it exactly).
  return [
    ['gallery', 'packages/gallery', galleryVersion],
    ['opf', 'packages/javascript', '0.4.0-preview.11'],
    ['opf-render', 'packages/render', '0.1.0-preview.11'],
    ['opf-editor', 'packages/editor', '0.1.0-preview.11'],
    ['opf-pptx', process.env.OPF_PPTX_ROOT ?? 'packages/pptx', '0.1.0-preview.11'],
    ...(args.length ? [['cli', 'packages/cli', '0.1.0-preview.11']] : []),
  ];
}

// Change only the local stage, never source manifests or registry release contracts.
export function previewManifest(original, version, versions) {
  const manifest = structuredClone(original);
  manifest.version = version;
  for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies'])
    for (const dependency of Object.keys(manifest[section] ?? {}))
      if (versions[dependency]) manifest[section][dependency] = section === 'peerDependencies' ? `^${versions[dependency]}` : versions[dependency];
  delete manifest.scripts;
  delete manifest.devDependencies;
  return manifest;
}
