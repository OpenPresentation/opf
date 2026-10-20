---
type: fixed
---
RR-97: the `unresolved-asset` diagnostic of an image the renderer cannot draw (a background, picture block, logo, watermark, picture bullet or `asset:` reference) now names the source in its message, for example `Image "./assets/missing.jpg" was not resolved to an embedded PNG, JPEG, GIF, WebP or SVG data URI`, and says how to fix it (fix the path, embed the image as a data URI, or resolve it in the host). The code, path, reason, `source`, placeholder and every pixel are unchanged. A test now pins the warning for a missing background, a missing picture block and a resolvable image.
