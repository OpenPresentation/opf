import assert from 'node:assert/strict';

export function previewPackages(args = []) {
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--include-cli'), 'Usage: pack-ecosystem.mjs [--include-cli]');
  return [
    ['opf', 'packages/javascript', '0.4.0-preview.11'],
    ['opf-render', '../opf-render', '0.1.0-preview.11'],
    ['opf-editor', '../opf-editor', '0.1.0-preview.11'],
    ['opf-pptx', process.env.OPF_PPTX_ROOT ?? '../opf-pptx', '0.1.0-preview.11'],
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
