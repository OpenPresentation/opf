# Rich input line endings: draft checkpoint, September 15, 2026

Base: editor main `76249a18d73b12cf168152ed0be9df533a9d1069`. Node `24.21.0`.

Appending after mixed CRLF/CR endings used to normalize untouched source and collapse the second run into the first run's style/link. `before.json` records the reproducer; `before-test.log` records the failing new regression before the fix.

The candidate maps native textarea LF offsets to original UTF-16 source offsets for typing, formatting, selection and pointer positioning. Untouched endings and metadata remain intact. Inserted newlines follow the first existing source ending, matching scalar editing. Headless formatting/replacement APIs still use original source offsets.

## Completed checks

- `fnm exec --using=24 npm test`: passed all source suites, including new mixed-ending, cross-run CRLF, repeated-character affinity, grapheme and metadata regressions.
- `fnm exec --using=24 npm run typecheck`: passed JavaScript syntax checks (including the new helper and rich-input modules).
- `fnm exec --using=24 npm run validate`: package metadata passed.
- `git diff --check`: passed.

## Preserved failures and outstanding acceptance

- `fnm exec --using=24 npm run test:packed`: the installed rich-text regression suite passed. The complete run failed later in `test/layout.mjs:51`, asserting that composed card items contain `frameBox`, with registry predecessors. It stopped before browser checks. Full output: `packed-install-failure.log.gz`. This is not full installed-package acceptance.
- The existing core `scripts/run-rich-text-browser.mjs` measured harness failed during bundling because current renderer source imports `./font-woff2.js`, which is not available at that source path. Full output: `source-browser-build-failure.log`. No browser assertions ran, and the subsequent estimated command did not run.
- Actual mixed-ending keyboard, pointer, formatting, undo and composition browser regressions, complete installed acceptance and CI remain pending. No renderer or native PowerPoint fidelity claim follows from these model tests.

Keep this PR a draft until those checks are resolved. No package publication or deployment is included.
