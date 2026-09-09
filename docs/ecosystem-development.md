# Local ecosystem development

Keep `opf`, `opf-render`, `opf-pptx`, `opf-editor`, and `pptx-gallery` in the same parent directory. Install each repository's dependencies normally, then run these commands from `opf`:

```sh
pnpm build
node scripts/link-ecosystem.mjs
pnpm test:ecosystem
pnpm test:gallery
```

The link command replaces only the installed `@openpresentation/opf` package in sibling `node_modules` with a link to this checkout and builds the toolkit packages. It also links the renderer into editor/converter consumers. It does not save machine-specific paths in package manifests or lockfiles. Reinstalling dependencies can replace the links; rerun the command afterwards. Use `--packages-only` to omit the gallery checkout.

On Windows, directory junctions work without granting file-symlink privileges. The linker refuses a package parent that resolves outside the sibling checkout's `node_modules`, and replaces existing links without following them into source. npm/pnpm orchestration invokes the package manager's JavaScript entrypoint with the selected Node runtime instead of running a batch shim through a shell. Paths with spaces and shell metacharacters remain literal arguments. The supported npm-installed and npm-exec package-manager layouts are discovered from `PATH` or the matching `npm_execpath`; a missing manager returns an explicit installation error.

The core packed-install smoke check also uses this Windows invocation. Node 20/24 local evidence on the `codex/windows-test-harness-20260909` branch: all 414 core tests plus composition/pagination/data/rich-text/list suites pass, and actual local tarballs install into fresh temporary projects and pass 519 packed-entry checks. New isolated tests execute real npm builds, replace existing junctions, retain literal arguments, and reject an external `node_modules` parent without modifying its package. Windows/macOS CI repeats the core packed installation on both supported runtimes. These are local unpublished tarballs, not republished core 0.7.0 or proof of native rendering fidelity.

The published compatible set is core 0.7.0, CLI 0.5.0, renderer 0.5.1, PPTX 0.5.2 and editor 0.4.0. Clean registry installs include shared composition and styled table rows without sibling links. `release-plan.json` records exact versions and immutable verification sources; `pnpm test:registry-ecosystem` and `pnpm test:registry-fidelity` exercise those installed packages. Source links are for coordinated development.

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
