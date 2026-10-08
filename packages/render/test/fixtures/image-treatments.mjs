// The 15 pptx.gallery image treatments as OPF 0.15 documents (FA-23): a full-slide photo is an image background, every
// other picture is an image block, placed at an edge band. test/image-treatments.mjs renders each one and compares it with
// the reference the 0.14 renderer drew from the same treatment written as its 0.14 slide-level image
// (test/fixtures/image-treatments-0.14/, see its README for how it was made).
import sharp from 'sharp';

// Every slot, so no catalog colour scheme is involved; the canvas is light1 (core defaultSlideBackground).
export const COLOR_SCHEME = Object.freeze({
  dark1: '#101820', light1: '#F4F1EA', dark2: '#2B3A4A', light2: '#E4DED2',
  accent1: '#1F5AA6', accent2: '#C2410C', accent3: '#15803D', accent4: '#7C3AED', accent5: '#C0C8D0', accent6: '#0E7490',
  hyperlink: '#1F5AA6', followedHyperlink: '#7C3AED'
});

// One description per treatment. `background` is an image background; `block` holds the image block's treatment keys and
// `placement` its edge band. `watermark` keeps design.watermark, which 0.15 did not change.
export const TREATMENTS = Object.freeze([
  { slug: 'full-bleed', background: {} },
  { slug: 'text-overlay', background: { overlay: { color: '#000000', opacity: 0.45 } } },
  { slug: 'caption-overlay', background: { overlay: { color: 'dark1', opacity: 0.6, edge: 'bottom', size: 0.25 } } },
  { slug: 'side-by-side', block: {}, placement: { edge: 'left', size: 0.5 } },
  { slug: 'masked-shape', block: { shape: 'hexagon' }, placement: { edge: 'right', size: 0.45, inset: true } },
  { slug: 'circular-crop', block: { shape: 'circle', border: { color: 'accent1', width: 4 } }, placement: { edge: 'left', size: 0.4, inset: true } },
  { slug: 'rounded-card', block: { shape: 'rounded', cornerRadius: 0.08, border: { color: '#10182080', width: 3 } }, placement: { edge: 'right', size: 0.5, inset: true } },
  { slug: 'duotone', background: { recolor: { dark: 'accent1', light: 'light1' } } },
  { slug: 'background-blur', background: { opacity: 0.35 } },
  { slug: 'image-strip', block: { recolor: 'grayscale' }, placement: { edge: 'top', size: 0.3 } },
  { slug: 'collage-grid', block: { overlay: { color: 'accent1', opacity: 0.3 } }, placement: { edge: 'bottom', size: 0.35 } },
  { slug: 'device-frame', block: { fit: 'contain', aspectRatio: 1.6, border: { color: 'dark1', width: 8 } }, placement: { edge: 'right', size: 0.55, inset: true } },
  { slug: 'cutout-subject', block: { fit: 'contain' }, placement: { edge: 'right', size: 0.4 } },
  { slug: 'watermark', watermark: { opacity: 0.12 } },
  { slug: 'cinematic-crop', block: { aspectRatio: 2.39, opacity: 0.9, overlay: { color: '#000000', opacity: 0.5, edge: 'left', size: 0.2 } }, placement: { edge: 'top', size: 0.7 } }
]);

/** A deterministic 160x100 picture (horizontal red ramp, vertical green ramp, blue checker) as a PNG data URI. */
export async function samplePicture() {
  const width = 160, height = 100, raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    raw.set([Math.round(x * 255 / (width - 1)), Math.round(y * 255 / (height - 1)), ((x >> 4) + (y >> 4)) % 2 ? 200 : 40], (y * width + x) * 3);
  }
  const png = await sharp(raw, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 9 }).toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

/** The 0.15 document for one treatment. */
export function treatmentDocument(treatment, picture) {
  const slide = { title: 'Lakeside at sunset' };
  const body = { type: 'text', text: 'The picture keeps its frame; the copy composes beside it.' };
  if (treatment.background) slide.design = { background: { type: 'image', src: 'asset:photo', ...treatment.background } };
  if (treatment.block) slide.blocks = [{ type: 'image', image: 'asset:photo', ...treatment.block, placement: treatment.placement }, body];
  else slide.blocks = [body];
  return {
    $schema: 'https://openpresentation.org/schema/opf/v1',
    name: `image-treatments/${treatment.slug}`,
    design: { colorScheme: { ...COLOR_SCHEME }, ...(treatment.watermark ? { watermark: { src: 'asset:photo', ...treatment.watermark } } : {}) },
    assets: { photo: { src: picture, alt: 'Lake at sunset' } },
    slides: [slide]
  };
}
