**Every package test, file by file** (`C:/opf-work/shapes/integration/logs/branch/`):

| Package | Combined | Failing here | Main | Verdict |
| --- | --- | --- | --- | --- |
| core | 264 of 264 | none (`script-width-estimates` runs with `docs/evidence`) | | pass |
| render | 169 of 169 | none | | pass |
| pptx | 220 of 221 | `keynote-registry-runtime.mjs` (EPERM creating a symlink) | fails on main the same way | environmental |
| editor | 141 of 142 | `codemirror-guard.mjs` (EPERM creating a symlink) | fails on main the same way | environmental |
| gallery | 14 of 14 | | | pass |
| cli | 29 of 29 | | | pass |
| mcp | 2 of 2 | | | pass (`mcp-workerd` too) |
| integration | 3 of 3 | | | pass |

SH-06's own `check:changed` failure on `tests pptx` and `tests editor` is these two symlink tests (they fail on main the same way here).

**Browser suites** (every command of each `test/browser-suites.json`, file by file after its setup, Edge through Playwright's `msedge` channel):
- render 26 of 28: `web-delivery` (needs Playwright's headless shell) fails on main the same way; `font-subsets-browser` fails on main the same way (`metrics-quotes-timeline#0`, also alone).
- pptx 2 of 2: `packed-bundle-browser` exports the 136 core examples byte-identical to Node, the overlay and native-diagram decks included.
- editor 74 of 90, then 76 with the toolbar fix below. The other 14 fail identically on main (run the same way in `C:/opf-work/sh-phase-2-main`): `layout-templates-browser`, `layout-editor-browser`, `source-pane-browser`, `playground-download`, `export-menu-browser`, `agent-handoff-browser`, `presenter-browser`, `rich-input-measured`, `rich-input-estimated`, `hang-indent-perf`, `startup-perf`, `selection-contrast`, `studio-kit`, `studio-perf` (LH-179's server and clipboard harness, perf budgets).
- **Regression found and fixed: editor `mobile-browser` and `mobile-touch-browser`** (both pass on main). SH-06 added Insert shape, Connect and the route select to the playground's slide toolbar: on a phone the row ran 46 pixels past the screen (the page scrolled sideways), and at 1,024 pixels the Redo button ran under the inspector's Content tab. Below 1,100 pixels the route select is left to the connector's Selected shape section (straight by default), on a phone the Connect tool is left out too, and the phone's action row shrinks to the screen; Insert shape stays. Both tests pass now, and `shape-overlays-browser` and `shape-editing-browser` still pass. Vetoable: a phone draws no connectors from the toolbar.
