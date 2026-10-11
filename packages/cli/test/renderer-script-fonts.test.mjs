import assert from 'node:assert/strict';
import test from 'node:test';
import {rendererScriptFonts, selectedRendererScriptFonts} from './helpers/renderer-script-fonts.mjs';

const manifest = (version, pin) => ({name: '@openpresentation/opf-render', version, peerDependencies: {'@expo-google-fonts/noto-sans-jp': pin, '@expo-google-fonts/noto-sans-sc': pin}});

test('packed peer script fonts follow the exact selected renderer release', () => {
  for (const [version, pin] of [['0.18.0', '0.4.3'], ['0.18.1', '0.4.4']]) {
    assert.deepEqual(rendererScriptFonts(manifest(version, pin), version), [`@expo-google-fonts/noto-sans-jp@${pin}`, `@expo-google-fonts/noto-sans-sc@${pin}`]);
  }
});

test('missing or ranged pins and a stale renderer cannot substitute a font graph', () => {
  for (const pin of [undefined, '^0.4.4', '*']) assert.throws(() => rendererScriptFonts(manifest('0.18.1', pin), '0.18.1'), /exact renderer peer pin/);
  assert.throws(() => rendererScriptFonts(manifest('0.18.0', '0.4.3'), '0.18.1'), /match the selected packed peer/);
});


test('explicit staged renderer identity selects its pins instead of registry development pins', () => {
  const registry = {rendererManifest: manifest('0.18.0', '0.4.3'), rendererVersion: '0.18.0'};
  const stagedRenderer = {version: '0.19.0-next.0', stagedManifest: manifest('0.19.0-next.0', '0.4.4')};
  assert.deepEqual(selectedRendererScriptFonts({...registry, stagedRenderer}), ['@expo-google-fonts/noto-sans-jp@0.4.4', '@expo-google-fonts/noto-sans-sc@0.4.4']);
  assert.deepEqual(selectedRendererScriptFonts(registry), ['@expo-google-fonts/noto-sans-jp@0.4.3', '@expo-google-fonts/noto-sans-sc@0.4.3']);
  assert.throws(() => selectedRendererScriptFonts({...registry, stagedRenderer: {...stagedRenderer, version: '0.18.0'}}), /match the selected packed peer/);
});
