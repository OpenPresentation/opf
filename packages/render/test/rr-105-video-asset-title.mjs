// RR-105 (coverage finding 14): the preview's video placeholder shows the registry asset's title, never the `asset:` id; a title written
// on the value wins, an asset without a title shows its source, and a reference that does not resolve shows "Media".
import assert from 'node:assert/strict';
import { toSvg } from '../dist/index.js';

const deck = {
  assets: {
    walkthrough: { src: 'https://example.com/media/walkthrough.mp4', title: 'Product walkthrough' },
    plain: { src: 'https://example.com/media/plain.mp4' },
    alias: 'asset:walkthrough',
  },
  slides: [
    { type: 'video', title: 'Asset', video: 'asset:walkthrough' },
    { type: 'video', title: 'Override', video: { src: 'asset:walkthrough', title: 'Two minute tour' } },
    { type: 'video', title: 'Untitled', video: 'asset:plain' },
    { type: 'video', title: 'Chained', video: 'asset:alias' },
    { type: 'video', title: 'Missing', video: 'asset:nowhere' },
  ],
};
const expected = ['Product walkthrough', 'Two minute tour', 'https://example.com/media/plain.mp4', 'Product walkthrough', 'Media'];
for (const [index, text] of expected.entries()) {
  const svg = toSvg(deck, index + 1);
  assert.ok(svg.includes(`>${text}<`), `slide ${index + 1}: ${text}`);
  assert.ok(!svg.includes('>asset:'), `slide ${index + 1}: no asset id`);
}
console.log('RR-105 video asset title: preview checks passed.');
