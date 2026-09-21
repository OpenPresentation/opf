# Issue 88 production audit — 2026-09-21

Recommendation: keep [OpenPresentation/opf#88](https://github.com/OpenPresentation/opf/issues/88) open. Homepage/playground baseline is now freshly verified. Inspector editing is live but only the first slide is editable, and a canvas commit rewrites authored JSON spacing. Public agent guidance still contains old pins. Package adoption is independently verified for the gallery bundle and must not substitute for feature acceptance.

This was a read-only production/source audit. No product changes, merges, issue changes, deployments, native PowerPoint actions, or geometry work occurred. Browser edits affected anonymous ephemeral in-memory fixtures only.

## Checklist disposition

| Original issue item | Evidence / disposition |
| --- | --- |
| Verify openpresentation.org `/` and `/playground` baseline | PASS for tested coverage. Existing `hero-editor`, `preview-editing`, and `json-options` suites: 13/13 pass in 30.3s against canonical production with Node 24.21.0 and Chromium. Includes both edit directions, exact source formatting, live typing, cancel, single undo/redo steps, document-local catalog options, rich metadata retention, offline editing, last-valid preview, selected slide, and mobile width. |
| Gallery cards/detail interactive examples and Playground/Editor links | PARTIAL / qualified. `/layouts` has 485 Playground and 485 config Editor links and zero nested anchors; `/layouts/title-slide` has both deep links. `/editor?config=layouts%3Atitle-slide` loads its iframe with one slide, the requested layout, and the complete embedded catalog record. Direct standalone bundle loads. This audit does not establish all gallery dimensions as interactive; the title-slide detail is a static preview + source snippet + links, not a canvas. |
| Author shared json-options using loaded catalog/document context | SOURCE WIRED; this run has no trustworthy complete browser acceptance. `author-edit-pane.tsx` passes catalogs into shared `OpfEditor`; `register-json-field-completion.ts` uses shared `getJsonFieldContext`/`fieldOptionEdit`; `loaded-catalogs.ts` merges enabled loaded gallery records. Custom cursor-based UI probes were inconclusive (wrong initial selection, then asynchronous/filtered suggestions). Do not convert those automation failures into a production regression claim or mark browser completion proved. |
| Inspector/Playground preview-to-JSON, undo/redo, last-valid | PARTIAL. `/playground` ends at `/inspector`. First-slide title edited through an ordinary double click; copied JSON changed; metadata and rich run/link data survived. Monaco undo restored exact original raw JSON, redo restored edited title. Both schema-invalid and syntax-invalid source retained last-valid renderer offline, removed edit overlay while invalid, and recovered. Remaining: only first slide editable; canvas commits normalize whole-source formatting. |
| Docs interactive examples and stale public guidance | PARTIAL. Playground has visible `Header & footer` example. `pptx-dev/docs/browser-opf-workflow.md` already names core0.11/render0.9/pptx0.9.1/editor0.8; do not regress it. Live stale claims remain in `/agents` (CLI0.8.1 repeatable pin) and gallery `/llms.txt` (bundle upgrades once past0.10.1). Broad docs/API walkthrough remains a gate. |
| Actual published routes + graph separate from coverage | PARTIAL with fresh production evidence. Production gallery manifest reports shipped five-package train and all eight listed files match SHA-256. Production Inspector renderer markers report0.9.0. This is not a fresh installed-package run or Linux/Windows CI result and is not native/font compatibility acceptance. |

## Actionable product findings

1. **Inspector mounts only slide 0's canvas.** `pptx-dev/components/playground/preview-pane.tsx:145` explicitly gates the overlay with `editor && i === 0`. Live two-slide fixture had two renderer roots, three SVGs, one overlay, zero `slides.1.*` canvas targets. Require a later-slide ordinary pointer/keyboard edit and undo acceptance before describing arbitrary-slide preview editing.
2. **Inspector normalizes authored JSON spacing on a canvas commit.** `pptx-dev/components/playground/playground-shell.tsx:193` calls `convert(toJsonText(document), "json", format)`, and `lib/playground/opf-codec.ts:36` uses `JSON.stringify(doc, null, 2) + "\n"`. `inspector-before.json` exactly retains `"name"  :   ` from the authored source; `inspector-after.json` normalizes that spacing and adds a trailing newline when only the title was edited. Semantic metadata/rich text survived; raw source preservation did not. Undo from Monaco restored the exact authored buffer in this test.
3. **Stale live public guidance.** `openpresentation-site/app/agents/page.tsx:84` and production `/agents` say pin CLI0.8.1; `pptx-gallery/app/llms.txt/route.ts:62` and production `/llms.txt` say the gallery editor bundle upgrades after pins pass0.10.1. Production bundle is already core0.11/render0.9/pptx0.9.1/editor0.8/cli0.9.

## Overlay hit-testing interpretation

The base `[data-opf-renderer]` SVG is underneath the canvas overlay. A trial click on its rich-link anchor times out with the overlay intercepting pointer events. This is **not by itself a user interaction failure**: `elementFromPoint` finds the overlay's equivalent text inside an anchor with the same safe href, and an ordinary trial click on the overlay anchor passes. A real ordinary click opened no popup; it behaves as part of the editing surface. No `force:true` was used for this audit's real edit or overlay anchor checks. The existing security test uses `force:true` on the covered renderer, which cannot prove the visible editing surface's behavior. New acceptance should target visible canvas controls and explicitly establish desired link behavior and later-slide behavior. Do not assert all overlay handling is broken from the base selector timeout.

## Test harness caveats and superseded probes

- `audit-browser.mjs` first queried gallery `#preview` in the parent page. `/editor` intentionally uses an iframe, so that timeout is a test-target error. Correct frame-aware check in `final-browser.mjs` passes and retrieves the requested one-slide document.
- Initial Author cursor probes captured `No suggestions` / unrelated schema entries. Subsequent probes still did not establish a full categorical apply/undo path. Preserve logs as an incomplete check, not a product failure.
- Initial consolidated script recorded one `Unresolved OPF schema: #/$defs/Placeholder` page error without URL attribution; later frame-aware/route-attributed runs recorded zero errors. This audit does not establish its provenance; do not attribute it to gallery merely because the consolidated script later visited gallery.
- One gallery-to-pptx.dev Copy probe read content before ready and could not JSON-parse it. It does not prove the deep link broken. The link URL is correct and gallery Editor config handoff passes.
- Existing local node_modules are stale: openpresentation-site resolves core0.9.0 while its package manifest is0.11.0. The selected 13 browser tests do not import core; they test live browser behavior. No dependency reinstall was done here. Do not call this fresh installed-package acceptance.

## Exact commands

```sh
# Issue snapshot (read-only; saved JSON includes comments).
gh issue view 88 --repo OpenPresentation/opf --json title,body,state,comments,url > /private/tmp/opf-issue88-20260921/issue88.json

# Run from /Users/michael/Source/openpresentation-site.
OPF_SITE_URL=https://www.openpresentation.org '/Users/michael/Library/Application Support/fnm/node-versions/v24.21.0/installation/bin/node' node_modules/@playwright/test/cli.js test tests/e2e/hero-editor.spec.ts tests/e2e/preview-editing.spec.ts tests/e2e/json-options.spec.ts --output=/private/tmp/opf-issue88-20260921/site-test-results > /private/tmp/opf-issue88-20260921/site-playwright.log 2>&1

# Saved autonomous anonymous browser probes. These include intentionally qualified/failed probes; see caveats above.
'/Users/michael/Library/Application Support/fnm/node-versions/v24.21.0/installation/bin/node' /private/tmp/opf-issue88-20260921/audit-browser.mjs > /private/tmp/opf-issue88-20260921/browser.log 2>&1
'/Users/michael/Library/Application Support/fnm/node-versions/v24.21.0/installation/bin/node' /private/tmp/opf-issue88-20260921/followup-browser.mjs > /private/tmp/opf-issue88-20260921/followup.log 2>&1
'/Users/michael/Library/Application Support/fnm/node-versions/v24.21.0/installation/bin/node' /private/tmp/opf-issue88-20260921/final-browser.mjs > /private/tmp/opf-issue88-20260921/final.log 2>&1
```

`agent-browser` skill was applied. Cached native CLI0.37.1 used a fresh `issue88` session with installed Chromium path `/Users/michael/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` for initial production navigation/snapshot; Playwright continued reproducible acceptance.

## Evidence files

- `issue88.json`: exact GitHub issue/checklist/comment state at audit time.
- `site-playwright.log`: all13 passing tests, timings, exact suite names.
- `browser-results.json`, `followup-results.json`, `final-results.json`: timestamped results, version context, incomplete probes, and error observations.
- `inspector-before.json`, `inspector-after.json`: exact copied raw-source buffers.
- `inspector-edit.png`, `inspector-last-valid.png`, `inspector-overlay.png`, `inspector-overlay-real-link.png`: browser evidence.
- `gallery-config-editor-accepted.png`: correct iframe source and requested layout preview; visually inspected.
- `gallery-editor-manifest.json`: deployed package provenance; `browser-results.json` contains all8 matching hashes.
- `gallery-llms-excerpt.txt` (exact first 100 lines), `site-agents.png`: stale live guidance.
- `site-home.png`, `site-playground.png`: production baseline captures.
- Several `author-*.png` and `gallery-route-*.png` screenshots preserve intermediate probe state; they are not categorical-option pass evidence.

Source HEADs: openpresentation-site1e28978cb27899c3708e25b9d4baf2f2eb83d597; pptx-dev761885b98092657fbbd05ffa529316d8b635539a; gallery main as synchronized by parent.

## Local environment observation

The initial `pnpm --version` probe waited and was stopped. `/Users/michael/Source/pptx-dev/.pnpm-store/` subsequently appeared untracked; `stat` reports birth/modification Sep21 05:38:23 local. It contains `v11/index.db`, `v11/index.db-wal`, `v11/index.db-shm`, total48KB. Causation is uncertain because other agents may be installing dependencies; it was not deleted or modified intentionally.

Only the exact first 100 lines of the gallery llms.txt capture are committed,
covering the stale-version finding. gallery-llms-capture.json records the full
input hash and excerpt bounds. The full local capture includes an unrelated
legacy chart slug rejected by the existing text-integrity gate. No allowlist or
source gate was changed. Original capture hashes are in original-SHA256SUMS;
SHA256SUMS hashes the committed evidence files.
