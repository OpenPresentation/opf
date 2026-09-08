# Rich table cells

The coordinated rich-table release set is core 0.5.0, CLI 0.2.0, renderer 0.3.0, PPTX 0.3.0 and editor 0.2.0. Earlier versions do not form a supported installation for rich table arrays. Exact published sources are pinned in `release-plan.json`.

The canonical form is `TextRun[]` directly in a body cell or column label. Existing scalar cells and string labels remain valid. Core measures rich runs for overflow and pagination. The renderer uses the existing rich text painter and source traces; the editor consequently exposes its existing formatting and typing controls. PPTX export preserves the original run content and explicit line breaks as native editable runs, with shared fitted font sizes.

## Reproduce

Build core and link coordinated sibling sources with `node scripts/link-ecosystem.mjs --packages-only`. Wait for core builds to finish before testing linked downstream packages: building core replaces its `dist` directory. Run `pnpm test` in core, then `npm test` in each downstream repository. Focused regressions are `packages/javascript/test/rich-table.test.mjs` in core and `test/rich-table.mjs` in renderer/PPTX.

Build the interactive editor check from core:

```sh
node scripts/build-rich-table-browser.mjs
python3 -m http.server 3137 --bind 127.0.0.1 --directory artifacts/rich-table-browser
```

Open `http://127.0.0.1:3137/`. The page reports 14 checks for cell/header formatting, mixed-style typing, empty cells and undo. Double-click the mixed-style cell, type, and choose Done for a native pointer/keyboard check. `OPF_EDITOR_ROOT` and `OPF_RENDER_ROOT` can select isolated worktrees instead of sibling directories. The builder needs the renderer's built font loader; all test fonts are served locally.

## Evidence and remaining work

Core, renderer, editor and PPTX model suites pass under Node 24; focused core/renderer/PPTX rich-table checks also pass under Node 20. The unchanged scalar corpus retains all 805 renderer raster baselines. Export tests inspect native runs, whitespace and paragraphs, explicit false header emphasis, font resolution, point sizes, scripts, links, RGB/alpha and input immutability. Browser checks pass in the Codex in-app browser, including an additional pointer/keyboard commit.

Native PPTX table import still flattens runs to strings. Native PowerPoint rendering, cross-engine interaction, real OS IME, merged cells, cell fills/borders/alignment and advanced table controls remain unverified or unimplemented. The registry gates exercise rich table formatting, SVG traces, PPTX export, undo and TypeScript types through the installed package set. Source, packed and registry checks remain separate from native viewer evidence.
