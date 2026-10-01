// Picture bullets (core 0.11.4 `design.listBullet: "image"`) in the parity harness.
// The PPTX writes a bullet picture as `a:buBlip` inside a text paragraph, not as a picture shape, while the preview
// draws one aria-hidden `<image>` per list entry. The harness must not read the `a:blip` inside `a:buBlip` as the
// shape's own picture, and compares the bullets separately (count and bytes).

const BU_BLIP = /<a:buBlip>.*?<\/a:buBlip>/gs;

// The shape body without its bullet pictures, so a text shape with `a:buBlip` bullets is not read as a picture.
export const withoutBulletBlips = body => body.replace(BU_BLIP, '');

// The relationship ids of the `a:buBlip` bullets in a shape body, one per bulleted paragraph, in order.
export const bulletBlipRids = body => [...body.matchAll(BU_BLIP)].map(m => m[0].match(/<a:blip\b[^>]*\br:embed="([^"]+)"/)?.[1] ?? null);

// A preview `<image>` is a picture bullet when it is hidden from assistive technology and drawn inside a list.
export const isPreviewBullet = (attrs, path) => attrs['aria-hidden'] === 'true' && /(^|\.)(items|bullets)(\.|$)/.test(path ?? '');
