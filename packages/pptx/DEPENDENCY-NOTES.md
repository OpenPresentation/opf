# PptxGenJS image-size dependency

PptxGenJS is pinned to 4.0.1 for this release. Its package manifest installs `image-size`, which has unpatched infinite-loop advisories [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) and [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq). The installed dependency remains flagged by npm audit; it is not declared fixed or suppressed.

The inspected PptxGenJS 4.0.1 ESM/CommonJS distributions do not import `image-size`. The only sizing-module reference is in a commented, unused helper. OPF supplies image geometry itself. The image-fit follow-up reads bounded PNG/JPEG/GIF/WebP dimension headers and inline JPEG EXIF orientation; it does not load image-size or decode pixels.

`npm test` blocks both ESM and CommonJS loading of image-size before running the full model suite and checking image-byte preservation for data URIs, local paths and host-resolved bytes. This verifies those OPF operations do not require the affected parser. It is not a guarantee about every upstream PptxGenJS API or future version. A dependency upgrade must retain this check and reassess the advisories; do not accept npm's suggested downgrade to an incompatible PptxGenJS major.

## Compatible raster decoding

Sharp 0.35.4 (Apache-2.0) is pinned for Node-only WebP-to-PNG conversion and loads lazily only when conversion is needed. Its platform packages include libvips and codec licenses; retain the upstream license files distributed by npm. Node 20.9+ and normal optional-platform dependency installation are required. Browser builds use the browser's decoder/canvas and a conditional package import; a bundling check rejects Sharp or the Node adapter in browser output. Ordinary/preserved image exports are tested with Sharp loading blocked.

The dependency audit after adding Sharp reports only the existing image-size/PptxGenJS advisories above; no advisory was reported for the new decoder at that check. The browser bundler esbuild 0.28.2 is development-only. No hosted service, paid API or telemetry was added.
