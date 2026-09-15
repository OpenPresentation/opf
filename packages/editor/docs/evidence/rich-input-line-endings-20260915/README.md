# Rich input line endings: browser and package acceptance, September 15, 2026

Base: editor main `76249a18d73b12cf168152ed0be9df533a9d1069`. Node `24.21.0`.

Appending after mixed CRLF/CR endings used to normalize untouched source and collapse the second run into the first run's style/link. `before.json` records the reproducer; `before-test.log` records the failing new regression before the fix.

The candidate maps native textarea LF offsets to original UTF-16 source offsets for typing, formatting, selection and pointer positioning. Untouched endings and metadata remain intact. Inserted newlines follow the first existing source ending, matching scalar editing. Headless formatting/replacement APIs still use original source offsets.

## Completed checks

- `fnm exec --using=24 npm test`: passed all source suites, including new mixed-ending, cross-run CRLF, repeated-character affinity, grapheme and metadata regressions.
- `fnm exec --using=24 npm run typecheck`: passed JavaScript syntax checks (including the new helper and rich-input modules).
- `fnm exec --using=24 npm run validate`: package metadata passed.
- `git diff --check`: passed.

## Initial failures (preserved)

- `fnm exec --using=24 npm run test:packed`: the installed rich-text regression suite passed. The complete run failed later in `test/layout.mjs:51`, asserting that composed card items contain `frameBox`, with registry predecessors. It stopped before browser checks. Full output: `packed-install-failure.log.gz`. This is not full installed-package acceptance.
- The existing core `scripts/run-rich-text-browser.mjs` measured harness failed during bundling because current renderer source imports `./font-woff2.js`, which is not available at that source path. Full output: `source-browser-build-failure.log`. No browser assertions ran, and the subsequent estimated command did not run.

## Browser and coordinated acceptance

The focused `test/rich-input-browser.mjs` uses public package exports rather than renderer source internals. It passes ten actual pointer/keyboard workflows in measured, estimated and prepared-painting modes, both from the checkout and from the fresh coordinated consumer (60 mode/workflow executions). Browser errors and external requests are empty, font faces are disposed, and source/installed runtime bytes remain unchanged during verification.

Coverage includes mixed CRLF/CR, no-op opening, separate styled runs and links, live isolated drafts, draft undo/redo, concurrent notes, one session undo, newline deletion/insertion, caret mapping, forward/reverse pointer selection, formatting the exact post-CRLF range, wraps, ligature words and decomposed marks, trailing spaces, cancellation, simulated composition guards, CRLF split across styled runs, and trailing blank-line carets. Caret checks use logical SVG DOM ranges; they do not certify caret positions inside painted ligatures or arbitrary font/bidi support.

The identical browser harness against immutable editor main `76249a18d73b12cf168152ed0be9df533a9d1069` fails after typing: the second SVG fragment has normalized offsets and no longer matches the original source. `before-browser.json.gz` and its log preserve this independently reproduced regression. The baseline fixture used an isolated copy of that commit's distributables with the same checkout dependencies.

A fixture using bundled Roboto explicitly rejected U+0302; that rejection is preserved in `roboto-mark-rejection.json.gz`. Final fixtures load bundled Arimo, which supports the unchanged decomposed source. No source normalization or missing-glyph fallback was introduced.

Existing core `pnpm pack:ecosystem`, `pnpm test:packed-ecosystem`, and `pnpm test:packed-browser` passed on Node 24.21.0. The latter exercised eight installed browser suites with 276 assertions and eight trusted pointer/keyboard scenarios. The coordinated archives use the current core, renderer and PPTX candidates with editor runtime `90e57c3`; their prerelease versions are local test labels, not registry releases. See the preserved archive manifest, logs and browser report.

The existing `scripts/test-installed-code.mjs` audit also passed, comparing 79 installed JavaScript runtime files with the staged archives, checking archive/lock integrity and exercising the existing installed code-model and real browser workflows. Its complete report and log are retained as `installed-runtime-audit.*.gz`.

Run the new fixture from the editor checkout:

```sh
fnm exec --using=24 npm run test:rich-input-browser -- artifacts/rich-input-browser.json measured
fnm exec --using=24 npm run test:rich-input-browser -- artifacts/rich-input-browser-estimated.json estimated
# Requires the candidate renderer with prepared-painting exports:
fnm exec --using=24 npm run test:rich-input-browser -- artifacts/rich-input-browser-painted.json painted
# Reuse a consumer created by the core repository's existing package tooling:
fnm exec --using=24 npm run test:rich-input-browser -- artifacts/rich-input-installed.json measured ../opf/artifacts/npm/consumer
```

Installed mode requires font preparation and all browser runtime inputs to resolve inside the consumer's `node_modules`, records their hashes and lockfile hash, and verifies they remain unchanged. Test tooling is supplied by the verification checkout. CI now runs measured/estimated checkout workflows and measured coordinated installed workflows. Prepared painting is exercised explicitly when its newer renderer API is available; the editor's independent CI retains its previously pinned renderer.

The implementation commit `90e57c3` passed GitHub CI run `34948773824`. The added browser/CI changes require their own successful CI run before merging. The predecessor-only `npm run test:packed` failure above remains a separate release compatibility gate, not a passing test. Real OS IME, broader shaping/native-font compatibility, and native PowerPoint fidelity are not established here. No package publication or deployment is included.
