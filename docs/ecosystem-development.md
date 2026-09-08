# Local ecosystem development

Keep `opf`, `opf-render`, `opf-pptx`, `opf-editor`, and `pptx-gallery` in the same parent directory. Install each repository's dependencies normally, then run these commands from `opf`:

```sh
pnpm build
node scripts/link-ecosystem.mjs
pnpm test:ecosystem
pnpm test:gallery
```

The link command replaces only the installed `@openpresentation/opf` package in sibling `node_modules` with a symlink to this checkout and builds the toolkit packages. It does not save machine-specific paths in package manifests or lockfiles. Reinstalling dependencies can replace the links; rerun the command afterwards.

The published compatible set is core 0.6.0, CLI 0.3.0, renderer 0.4.0, PPTX 0.4.0 and editor 0.3.0. Clean registry installs include shared composition and content-aware table rows without sibling links. `release-plan.json` records exact versions and immutable verification sources; `pnpm test:registry-ecosystem` and `pnpm test:registry-fidelity` exercise those installed packages. Source links are for coordinated development.

To browse the gallery with the linked package:

```sh
cd ../pptx-gallery
OPF_LOCAL_WORKSPACE=1 pnpm dev
```

Layout detail pages have an interactive composition example. The flag expands Turbopack's local root to include the sibling package; production builds use the gallery root.

`pnpm test:ecosystem` validates the dynamic composition fixture, edits and undoes a composition, renders SVG/PNG/PDF, exports editable PPTX, checks OOXML text-box coordinates against the shared geometry, and imports the result back into schema-valid OPF. Artifacts are written to a temporary directory and its location is printed.

For tests that should read current source without modifying installed packages, use Node's local loader after building OPF:

```sh
node --import ./scripts/register-local-opf.mjs ../opf-render/test/smoke.mjs
```

The loader redirects only `@openpresentation/opf` imports to this checkout. Ordinary dependencies still resolve from the consuming repository.

For full gallery render coverage, run `pnpm test:gallery -- --render` (or invoke the script with `--render`). The test validates all 854 generated documents and can render them with the local SVG engine.

Build OPF before starting a linked gallery. Stop and restart the gallery around clean OPF rebuilds; removing the linked `dist` directory during compilation can leave Turbopack with stale missing-module errors.

`pnpm test:pagination` verifies long-text and table pagination through SVG and editable PPTX, including exact source reconstruction, table row counts, and absence of extra exporter-created pages. It writes review artifacts under `artifacts/pagination/`.

`pnpm test:fonts` verifies actual-font measurement across editor, SVG, pagination, and PPTX. See [font fidelity](font-fidelity.md) for loading and embedding local fonts and for current native PowerPoint limits.
