// fa-stale-refs: history (a 0.14 generator; OPF 0.15 is docs/programs/format-audit/0.15-design.md in core).
// Run once with opf-render 0.14.0 on core 0.14.0 (the last renderer with design.slideImage) to write the FA-23 reference
// renders: node test/fixtures/make-image-treatments-014.mjs. Each 0.15 treatment is written back as the 0.14 slideImage
// it replaces. Kept for provenance; the 0.15 renderer cannot run it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolveSlideContext } from '@openpresentation/opf';
import { composeSlide } from '@openpresentation/opf/composition';
import { renderSlideSvg, svgToPng } from '../../dist/index.js';
import { COLOR_SCHEME, TREATMENTS, samplePicture } from './image-treatments.mjs';

const out = new URL('./image-treatments-0.14/', import.meta.url);
mkdirSync(out, { recursive: true });
const picture = await samplePicture();
function document014(treatment) {
  const slide = { title: 'Lakeside at sunset', blocks: [{ type: 'text', text: 'The picture keeps its frame; the copy composes beside it.' }] };
  const design = { colorScheme: { id: 'custom', name: 'Custom', ...COLOR_SCHEME } };
  if (treatment.background) {
    // 0.15 paints an image background over the scheme's default slide background (light1).
    design.background = { type: 'solid', color: COLOR_SCHEME.light1 };
    slide.design = { slideImage: { src: 'asset:photo', position: 'background', ...treatment.background } };
  }
  if (treatment.block) {
    const { fit, ...rest } = treatment.block, { edge, ...band } = treatment.placement;
    slide.design = { slideImage: { src: 'asset:photo', position: edge, ...band, ...(fit ? { fill: fit === 'contain' ? 'fit' : 'crop' } : {}), ...rest } };
  }
  if (treatment.watermark) design.watermark = { src: 'asset:photo', ...treatment.watermark };
  return { design, assets: { photo: { src: picture, alt: 'Lake at sunset' } }, slides: [slide] };
}
const reference = { renderer: '0.14.0', core: '0.14.0', scale: 0.5, treatments: {} };
for (const treatment of TREATMENTS) {
  const deck = document014(treatment);
  const context = resolveSlideContext(deck, 0, {});
  const geometry = composeSlide(deck.slides[0], context.options);
  const png = await svgToPng(renderSlideSvg(deck, 0), { scale: reference.scale });
  writeFileSync(new URL(`${treatment.slug}.png`, out), png);
  const image = geometry.slideImage;
  reference.treatments[treatment.slug] = {
    written014: deck.slides[0].design?.slideImage ?? null,
    items: geometry.items.map(item => ({ path: item.path, box: item.box })),
    ...(image ? { frame: { region: image.region, box: image.box, shape: image.shape.path, ...(image.overlay ? { overlay: image.overlay.shape.path } : {}) } } : {})
  };
}
writeFileSync(new URL('reference.json', out), JSON.stringify(reference, null, 2) + '\n');
console.log(`wrote ${TREATMENTS.length} reference renders`);
