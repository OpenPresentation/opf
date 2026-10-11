# Independent macOS data-grid test repair review

Read-only reviewed `/private/tmp/opf-editor-grid-mac-test/test/data-grid-browser.mjs`, SHA256 `314f2c6e60b1237d3214dffc8ea3af63fc87c49593481cad08125263a81ebee5`. No duplicate tests or implementation edits by reviewer. Supervisor byte proof: `/private/tmp/rr20-editor-grid-root-review.json`.

No source blocker. Ten native textbox select-all calls use `ControlOrMeta+A`; helper first asserts the existing textbox is `document.activeElement`, then uses page keyboard without locator auto-focus, then asserts full selection bounds. F2-focus behavior and original numeric/rich-text/commit/validation assertions remain strict. App Ctrl+A/C/Z/Y/Home/End controls remain unchanged.

The sole real clipboard paste uses `ControlOrMeta+V`. This matches source: grid keydown handles copy/cut itself (`src/data-grid.js:1023` onward), while clipboard paste is driven by the browser `paste` event (`:1095`). The exact clipboard contents, document mutation and error assertions remain intact. No runtime/font/version/lock/quarantine/tolerance change.

Evidence `docs/evidence/rr20-macos-grid-selection` retains before, intermediate and corrected logs. Original diagnostic proves Ctrl+A leaves selection 0–0 and produces 3312 rather than required 33. The intermediate paste failure is preserved. Final targeted session 22130 completed exit 0, all 51 checks, log `/private/tmp/rr20-editor-grid-focus-paste-fixed.log`.

This establishes scoped same-host macOS test-harness repair. Author full/type/validate session 32336 is still running; registered full browser suite and CI/other-platform outcomes remain pending. No completed full-release, native Office or registry artifact acceptance is claimed. Prepared release qualification must be rerun against the reviewed repair after normal source integration.

## Expanded dataset repair review

Read-only reviewed the sole additional native textbox selection correction in `test/data-grid-datasets-browser.mjs`. Existing double-click edit must already focus the textbox before keyboard action; full selection bounds are asserted afterward. Original dataset value 80 assertion remains strict. No runtime, format, undo, app-shortcut or tolerance behavior changed. No blocker.

Earlier full browser session 61443 is retained as failed: main grid 51 checks passed, then dataset actual 808 versus required 80 failed. Author isolated diagnostic confirms original value 8 and selection 0–0; this justifies the same native selection correction rather than weakening expected value. Prior type 205/validate/full 70 passes apply to the prior frozen repair, not a final expanded full result. Author serial session 95946 (dataset, eleven browser suites, type/full) is now running; terminal expanded qualification is pending.

Final inspected test hashes:

- `data-grid-browser.mjs`: `314f2c6e60b1237d3214dffc8ea3af63fc87c49593481cad08125263a81ebee5`
- `data-grid-datasets-browser.mjs`: `ea6fe6098aa379abbb04b2af9e6100d8890e40164e48f0fe683c57d7f37f5604`

## Final author freeze and local completion

Clean final head `44def28661d14e2134206a7fca910d17f79a405f` retains both reviewed hashes. Author session 95946 completed exit 0: targeted dataset, all eleven registered browser suites, typecheck 205 and full 70 passed. This supersedes the pending expanded local result, while preserving both original failures. PR #160 has full-ci; exact-head gate 91343 is pending. CI/merge and fresh prepared-release qualification remain separate and incomplete.
