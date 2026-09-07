# Continue the OPF ecosystem work

The coordinated working branch is `codex/opf-ecosystem-20260907` in these repositories:

| Checkout | Origin |
| --- | --- |
| opf | https://github.com/OpenPresentation/opf |
| opf-render | https://github.com/OpenPresentation/opf-render |
| opf-editor | https://github.com/OpenPresentation/opf-editor |
| opf-pptx | https://github.com/OpenPresentation/opf-pptx |
| pptx-gallery | https://github.com/Data-Advantage/pptx-gallery |
| openpresentation-site | https://github.com/Data-Advantage/openpresentation-site |

Clone the six branches into sibling directories. Use Node.js 24 and pnpm 10.33.2. From the parent directory:

```sh
gh repo clone OpenPresentation/opf -- --branch codex/opf-ecosystem-20260907
gh repo clone OpenPresentation/opf-render -- --branch codex/opf-ecosystem-20260907
gh repo clone OpenPresentation/opf-editor -- --branch codex/opf-ecosystem-20260907
gh repo clone OpenPresentation/opf-pptx -- --branch codex/opf-ecosystem-20260907
gh repo clone Data-Advantage/pptx-gallery -- --branch codex/opf-ecosystem-20260907
gh repo clone Data-Advantage/openpresentation-site -- --branch codex/opf-ecosystem-20260907
```

Install dependencies with `pnpm install --frozen-lockfile` in `opf`, `pptx-gallery` and `openpresentation-site`; use `npm ci` in the three library repositories. Then, from `opf`:

```sh
pnpm build
node scripts/link-ecosystem.mjs
pnpm test
pnpm test:skills
pnpm test:ecosystem
pnpm test:layout
pnpm test:lists
pnpm demo:editor
pnpm pack:ecosystem
pnpm test:packed-ecosystem
```

The link step builds the sibling libraries against the current core. Re-run it after reinstalling dependencies. The ecosystem currently requires coordinated source builds; the older stable registry versions do not contain these new APIs. Generated review artifacts, installed dependencies and local server state are excluded from Git and rebuilt by these commands.

Start the editor with `python3 -m http.server 3102 --directory artifacts/editor` from `opf`. In another terminal start the gallery with `OPF_LOCAL_WORKSPACE=1 pnpm dev --port 3101` from `pptx-gallery`. From `openpresentation-site`, run `OPF_LOCAL_SOURCE=../opf pnpm sync:opf`, then `pnpm dev --port 3103`.

For public-site documentation built from a remote branch instead of the sibling checkout, use `OPF_REPO_REF=codex/opf-ecosystem-20260907 OPF_FORCE_SYNC=1 pnpm sync:opf`.

## Current scope and remaining work

The branch includes shared dynamic layout and pagination, loaded-font measurement and substitutes, rich text/lists, CSV/JSON import, an installable agent CLI, six portable skills, schema-driven properties, copy/import/galleries, canvas resizing/moving/creation/deletion, native PPTX improvements, and site/galleries integration. See [ecosystem quality](plans/ecosystem-quality.md) and [coverage](plans/spec-editor-coverage.md) for evidence and remaining fidelity gaps.

The broader goal is still active. Continuous rich typing, advanced table/media/preset fidelity, native PowerPoint raster comparison, coordinated public npm releases and CI integration remain work. PR #8's health pass and newer upstream site/gallery work must be reconciled with this checkpoint before final review. Local preview tarballs are not evidence of registry publication.
