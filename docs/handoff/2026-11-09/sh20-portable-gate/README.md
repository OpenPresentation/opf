# SH-20 portable gate dependency resolution

This narrow repair follows the coordinator's failed Linux PPTX job128977303339 in CI42561029621. The tool's `layout-xml.mjs` used an absolute Windows developer checkout to load `fast-xml-parser`, preventing the existing fresh-output refusal test from reaching its guard on Linux.

Fresh `origin/main`9545016583ccfa151077cda4d51043ac6505a140 was checked out with maintained `agent-worktree.mjs` and normally fast-forwarded to integration6d5d61edc5c78a5c92128dd517c7dd6257d52331. Worktree `C:/opf-work/sh20-portable`, branch `codex/sh-20-portable-gate`. No chart implementation is included; its separate owner representation review remains pending.

The production change is one dependency-resolution expression: `createRequire(new URL('../../../packages/pptx/package.json', import.meta.url))`. The other active SH-20 JavaScript and PowerShell tools were inspected; no other absolute developer runtime dependency path was found. Historical evidence paths are preserved.

The new package-discovered `sh20-layout-xml.mjs` test calls the actual production parser from an empty unrelated directory, with filesystem reads restricted to this checkout. It checks decoded text, layout identity/category, algorithm parameters, numeric constraints, nested iteration, shape adjustments/rotation/visibility and presentation selection. This detects the defect on Windows even if the old checkout happens to exist. It neither launches nor attaches to Office.

The first harness setup used a permission flag alias removed in Node24 and failed before import. That setup failure is retained separately. After selecting Node's supported permission flag, the unchanged parser fails on the former developer path, and the one-line repaired parser passes. The test is an execution and semantic regression, not a source-string assertion.

Vetoable decision **SH20-PORTABLE-GATE** is recorded in the Shapes burndown. Output guards, sealed inputs, scoring thresholds, domain eligibility, COM scripts and existing refusal assertions remain byte-for-byte unchanged. Qualification results and artifact identities will be sealed here after the required checks complete. Parent review, GitHub publication, combined CI and release acceptance remain owed.
