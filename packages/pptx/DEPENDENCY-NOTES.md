# PptxGenJS image-size dependency

PptxGenJS is pinned to 4.0.1 for this release. Its package manifest installs `image-size`, which has unpatched infinite-loop advisories [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) and [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq). The installed dependency remains flagged by npm audit; it is not declared fixed or suppressed.

The inspected PptxGenJS 4.0.1 ESM/CommonJS distributions do not import `image-size`. The only sizing-module reference is in a commented, unused helper. OPF supplies image geometry itself.

`npm test` blocks both ESM and CommonJS loading of image-size before running the full model suite and checking image-byte preservation for data URIs, local paths and host-resolved bytes. This verifies those OPF operations do not require the affected parser. It is not a guarantee about every upstream PptxGenJS API or future version. A dependency upgrade must retain this check and reassess the advisories; do not accept npm's suggested downgrade to an incompatible PptxGenJS major.
