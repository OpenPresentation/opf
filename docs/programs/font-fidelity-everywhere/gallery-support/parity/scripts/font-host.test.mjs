import assert from 'node:assert/strict';
import test from 'node:test';
import {FONT_HOST_MODELS, createFontHosts} from './font-host.mjs';

test('the modelled hosts are the gallery editor, the Node loader and the earlier office-only model', () => {
  assert.deepEqual(FONT_HOST_MODELS, ['gallery', 'node-auto', 'office-only']);
});

test('an unknown model is rejected before anything is loaded', async () => {
  await assert.rejects(createFontHosts({renderDir: '/nonexistent', model: 'browser'}), /PARITY_FONT_HOST must be one of gallery, node-auto, office-only, not browser/);
});
