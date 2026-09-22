# Windows acceptance diagnosis — run 35607744175

Commit: `de3c3c06185055b3c6b6812e590ec15fe4001307`. Result: 16/18 pass. The only two failures are the LF and CRLF Author categorical-choice cases; all Inspector exact-source, shared furniture, recovery, export, worker, security, and other Author tests pass.

## Concrete root cause

The Author test requests role `option` with exact accessible name `Dark, Enum Member`. Both failure snapshots contain the intended visible suggestion with exact accessible name, but its role is `listitem`. The cursor remains the intended quoted theme value at line 5, column 15.

This is an intentional platform distinction in installed Monaco 0.56.0. `esm/vs/editor/contrib/suggest/browser/suggestWidget.js:180` contains:

```js
getRole: () => isWindows ? 'listitem' : 'option',
```

The exact dependency source is retained as `monaco-suggestWidget.js` with SHA-256 `710e4d9bf8cb8621d134eaba750fb2ef0609e94eff0ce84a33f99f2863b79b5a`. Trace archives and full accessibility/error snapshots remain in their test subdirectories. `diagnosis.json` records exact returns, cursor/choice presence, dependency version, and source hash.

## Clipboard boundary now proven on Windows

The new observer captures an unmodified submitted LF buffer with 43 LF and zero CRLF; real OS readback contains 43 CRLF. The CRLF-authored case captures and reads 43 CRLF. The app preserves each initial source style. All Inspector exact source/edit/history checks also pass Windows. The remaining failure does not involve string normalization.

## Narrow test correction

Only `tests/e2e/author-json-options.spec.ts` changes. A categoricalChoice helper uses Monaco's documented platform role (`listitem` on Windows, `option` elsewhere), with the same exact `Enum Member` accessible label. Cursor assertions, ordinary visible clicks, built-in/document/loaded-catalog assertions, and strict exact-source undo/redo comparisons are unchanged. No application code changed.

Local Node24 Chromium verification against the existing production build:

```sh
env -u OPF_BROWSER_STORAGE_STATE OPF_APP_URL=http://127.0.0.1:4325 '/Users/michael/Library/Application Support/fnm/node-versions/v24.21.0/installation/bin/node' node_modules/@playwright/test/cli.js test tests/e2e/author-json-options.spec.ts --output=/private/tmp/opf-issue88-monaco-role-results > /private/tmp/opf-issue88-monaco-role.log 2>&1
```

2/2 pass. `tsc --noEmit` and `git diff --check` pass. Typecheck log: `/private/tmp/opf-issue88-monaco-role-typecheck.log`.

A fresh Windows CI run remains required before app merge and canonical production acceptance. Production suite runbook/list is prepared separately at `/private/tmp/opf-issue88-final-production-20260921`; no canonical production tests have been run for this unmerged commit.
