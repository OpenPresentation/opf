# PptxGenJS runtime provenance

OPF PPTX 0.5.1 ships the exact, unmodified PptxGenJS 4.0.1 ESM distribution in `vendor/pptxgenjs`, with its MIT license, upstream archive integrity and per-file SHA-256 hashes. Its actual JSZip dependency is declared directly. Ordinary npm installations therefore omit the unused image-size parser without requiring consumer overrides. This removes the affected dependency; it does not patch the parser. Published OPF PPTX 0.5.0 retains the older graph.

The inspected PptxGenJS 4.0.1 ESM/CommonJS distributions do not import `image-size`. The only sizing-module reference is in a commented, unused helper. OPF supplies image geometry itself. The image-fit follow-up reads bounded PNG/JPEG/GIF/WebP dimension headers and inline JPEG EXIF orientation; it does not load image-size or decode pixels.

`npm test` requires image-size to be absent, then blocks both ESM and CommonJS loading before running the full model suite and checking image-byte preservation for data URIs, local paths and host-resolved bytes. Browser bundling retains upstream's Node built-in exclusions through the vendor directory's package metadata. This is not a guarantee about every upstream PptxGenJS API or future version.

Every build checks the vendored code and license against `UPSTREAM.json`. `node scripts/vendor-pptxgenjs.mjs` is an explicit maintainer command that fetches the pinned official npm archive, verifies its SHA-512 integrity and reads only the named distribution/license entries. It is never run by builds or installations. Review the upstream source, actual imports, license and audit before changing versions; retain tests and reassess [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) and [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq). Do not accept npm's incompatible PptxGenJS downgrade suggestion.

## Compatible raster decoding

Sharp 0.35.4 (Apache-2.0) is pinned for Node-only WebP-to-PNG conversion and loads lazily only when conversion is needed. Its platform packages include libvips and codec licenses; retain the upstream license files distributed by npm. This package requires Node 24 and normal optional-platform dependency installation. Browser builds use the browser's decoder/canvas and a conditional package import; a bundling check rejects Sharp or the Node adapter in browser output. Ordinary/preserved image exports are tested with Sharp loading blocked.

The candidate's complete npm audit reports no known vulnerabilities in the installed graph. npm does not audit vendored source as an installed PptxGenJS package: maintainers must also review upstream PptxGenJS advisories and releases when updating or auditing the vendor directory. The browser bundler esbuild 0.28.2 and Playwright are development-only. No hosted service, paid API or telemetry was added.

## Repeatable patch comparison

After `npm ci`, run `npm test` and `npm run test:packed`. The packed check installs the actual tarball into a fresh temporary consumer, audits its complete graph, checks shipped upstream hashes/license and exercises editable table export/reimport. It does not use consumer overrides.

Run `npm run test:browser` for real browser WebP pixel preservation and rich, conditional and merged/styled table import/preview/export/reimport checks. Local Windows runs use installed Microsoft Edge; other environments first run `npx playwright install --with-deps chromium`. CI and release jobs run the Chromium checks on their built candidate. These assertions cover the named fixtures, not arbitrary Office files.

For a comparison against the preceding release, create a separate empty directory, run `npm init -y` there, then `npm install --ignore-scripts --no-audit --no-fund @openpresentation/opf-pptx@0.5.0`. From this repository run `npm run test:compare-published -- <absolute-consumer-directory> <report.json>`. The script verifies the reference version and registry lockfile integrity, then compares every installed core example's PPTX bytes. The older reference deliberately contains the dependency being removed; it is only a comparison input. Explicit replacement images and fallback fonts make the comparison reproducible. Matching bytes do not establish original-asset fidelity or native viewer equivalence.
