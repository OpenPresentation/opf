---
type: added
packages: []
---
RR-59 (opf#476, test only): `packages/cli/test/installed-regression.mjs` locks the installed-package contract of the CLI offline: `opf render --format svg` embeds Noto Sans JP/SC 400 and 700 for a `ja-JP`/`zh-CN` deck, nothing under `--svg-fonts none` and no CJK face for a Latin-only deck (AUTO-25); `opf export --format pptx` reports a `pptx/unresolved-asset` warning at the slide path for an unresolved image or quote photo and writes the placeholder, `--fail-on warning` exits 1 and writes no file, and an embedded or local PNG exports a native picture (AUTO-26); a connection-refusing preload and a request counter prove zero fetches. It runs in `pnpm test:cli:packed:peers`, the CLI publish workflow and the registry consumer.
