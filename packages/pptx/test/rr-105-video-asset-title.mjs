// RR-105 (coverage finding 14): a video that names a registry asset (`"video": "asset:walkthrough"`) shows the asset's title on its
// placeholder, in the PPTX as in the preview, never the `asset:` id; the import still gives the reference and the asset back.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {strFromU8, unzipSync} from 'fflate';
import {toPptx, toSvg, fromPptx} from './helpers/default-catalog.mjs';

const deck = () => ({
  language: 'en-US', design: {background: 'light1'},
  assets: {walkthrough: {src: 'https://example.com/media/walkthrough.mp4', alt: 'Product walkthrough video', title: 'Product walkthrough', mediaType: 'video/mp4'}},
  slides: [
    {type: 'video', title: 'Asset video', video: 'asset:walkthrough'},
    {type: 'video', title: 'Override', video: {src: 'asset:walkthrough', title: 'Two minute tour'}},
    {type: 'video', title: 'Untitled asset', video: 'asset:plain'},
  ],
});
const caption = xml => [...xml.matchAll(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="OPF media [^"]* caption[^"]*"[\s\S]*?<\/p:sp>/g)].map(([shape]) => [...shape.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join('')).join(' ');

test('the placeholder caption is the asset title (an override on the value wins), in the PPTX and the preview', async () => {
  const source = deck();
  source.assets.plain = {src: 'https://example.com/media/plain.mp4'};
  const entries = unzipSync(await toPptx(source));
  const expected = ['Product walkthrough', 'Two minute tour', 'https://example.com/media/plain.mp4'];
  for (const [index, text] of expected.entries()) {
    assert.equal(caption(strFromU8(entries[`ppt/slides/slide${index + 1}.xml`])), text, `slide ${index + 1} PPTX caption`);
    const svg = toSvg(source, index + 1);
    assert.ok(svg.includes(`>${text}<`), `slide ${index + 1} preview caption`);
    assert.ok(!svg.includes('>asset:'), `slide ${index + 1} preview shows no asset id`);
  }
});

test('the video reference and its asset come back from the import', async () => {
  const source = deck();
  source.slides = source.slides.slice(0, 2);
  const imported = await fromPptx(await toPptx(source));
  assert.deepEqual(imported.slides.map(slide => slide.video), source.slides.map(slide => slide.video));
  assert.deepEqual(imported.assets, source.assets);
});
