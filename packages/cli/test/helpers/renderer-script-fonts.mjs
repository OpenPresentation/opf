import assert from 'node:assert/strict';

export function rendererScriptFonts(renderer, selectedVersion) {
  assert.equal(renderer.name, '@openpresentation/opf-render', 'script font pins must come from the selected renderer');
  assert.equal(renderer.version, selectedVersion, 'installed renderer must match the selected packed peer');
  return ['@expo-google-fonts/noto-sans-jp', '@expo-google-fonts/noto-sans-sc'].map(name => {
    const version = renderer.peerDependencies?.[name];
    assert.match(version ?? '', /^\d+\.\d+\.\d+$/, `${name} must have an exact renderer peer pin`);
    return `${name}@${version}`;
  });
}

export function selectedRendererScriptFonts({rendererManifest, rendererVersion, stagedRenderer}) {
  return stagedRenderer
    ? rendererScriptFonts(stagedRenderer.stagedManifest, stagedRenderer.version)
    : rendererScriptFonts(rendererManifest, rendererVersion);
}
