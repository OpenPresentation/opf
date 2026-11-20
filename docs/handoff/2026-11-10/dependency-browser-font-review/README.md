# Browser and emoji dependency review

This successor normally folds the source-reviewed W03/W04 coordinator baseline and the original Playwright proposal. No original Dependabot branch is changed. No golden, install, browser acceptance, full mapper or release is claimed here.

## Playwright — candidate, gates pending

OPF1242 updates four package pins to1.65.0. Its original diff omitted ten maintained Docker references. All ten references now use the official MCR OCI index `sha256:6e3fb709361521eb27161606e6da6d2674e5e89fa16516cb37d6fdd91372273d`, verified by hashing the actual response bytes against the registry digest header. The retained manifest includes amd64 and arm64 platform child identities. Official [release notes](https://github.com/microsoft/playwright/releases/tag/v1.65.0) and [Docker guidance](https://playwright.dev/docs/docker) were reviewed. The package and container versions must agree; the image provides browsers rather than the npm package.

The maintained pin guard passes10image references/four package pins; all six pin-guard tests pass. No new implementation-mirroring test is added. Final installation, coherent mapped checks, actual browser suites and one final pinned golden batch remain owed. No golden hash/tolerance changed.

## Noto Color Emoji — decline pending owner review

OPF1243 changes the exact optional-peer contract from0.4.7 to0.4.8 but omits the manifest version/source/hash updates required by the new font bytes. Both registry tarballs were fetched directly, verified against their published SHA512 integrity and read without installing scripts. The font license is byte-identical OFL1.1, SHA256 `ac564676d10054a8445923dfc2dfb13c042d97888bd27c1b6ec6dfe89a9d8d62`.

The candidate is not a metadata-only update. Its TTF changes13tables, including cmap, GSUB, COLR, CPAL, SVG and advances. Fontkit reports the same1508Unicode characters and the same em/ascent/descent, but glyph count changes42330→42352. More importantly, the actual embedded version moves **2.057→2.055**, with embedded build provenance moving **20260911→20260909**. That is a surprising upstream-font downgrade inside a newer npm patch. The strings are direct font evidence; upstream commits could not be independently retrieved by the documentation reader and are not asserted verified.

Vetoable recommendation: retain the exact existing0.4.7 font/peer pins and decline this proposal until a corrected package or explicit owner decision establishes the intended font revision. No font manifest, font file, peer pin, raster companion, tracker or golden is changed by this review. The original proposal stays open until its concrete review/owner disposition is recorded. If the owner chooses0.4.8, regenerate the manifest through its maintained generator, review these actual font changes and run color/raster/native/browser gates before the final pinned golden batch.

The JSON records retain exact tarball integrity, TTF/license/table hashes and public metadata. Font tarballs/TTFs and node_modules are deliberately not committed.
