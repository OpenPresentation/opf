# Completion browser acceptance — 21 September 2026

Final rebuilt local app: **24/24 passed in 59.0 seconds, zero retries**. Node 24.21.0, Playwright 1.63.0, Chromium 153.0.8010.12, macOS arm64. Build ID `x7f5cZgYzndzg77jtikNr`; working tree based on `c558dcc3a2e362bc238eb433a2db97fa682dfcc8`. Tested source/lock hashes and exact commands are in `control-evidence.json`.

Five new cases verify Title Subtitle and Text 2x additions against hand-authored exact source and the public helper's semantic result; LF/CRLF, compact rich runs, notes, metadata, raw escapes, and one-step undo/redo; escaped-current omission and preservation of prior undo history; invalid/newer source and inline catalog recovery; and format/New run cancellation. All original 19 browser cases also passed.

The old build on port 4326 failed the Title Subtitle test at the actual missing Enum Member, as expected. Its visible popup and failure trace are retained. The earlier empty-no-op prototype was rejected: keyboard navigation found the current value below the virtualized viewport, but accepting it consumed an undo step. Final behavior omits the unchanged current value from actionable suggestions. The regression traverses the popup with actual ArrowDown keys, checks absence, dismisses Escape, and immediately undoes/redoes the previous real edit. No assertion was relaxed to accept the spurious history entry.

Final structural popup and escaped-current alternatives screenshots were reviewed. The requested choices are visible, source stays readable with authored compact formatting/escapes, and no new clipping or overlap was observed. This reviews completion UI, not native PowerPoint rendering.

Evidence directories and logs:

- Final suite: `/private/tmp/opf-completion-full-browser-20260921`, companion `.log`.
- Expected old-build failure: `/private/tmp/opf-completion-negative-control-20260921`, companion `.log`.
- Rejected no-op history failure: `/private/tmp/opf-completion-noop-browser-20260921`, companion `.log`.
- Initial focused suite: `/private/tmp/opf-completion-browser-20260921`, companion `.log`.
- Initial sandbox launch failure: `/private/tmp/opf-completion-browser-20260921-sandbox-launch`, companion `/private/tmp/opf-completion-browser-20260921.sandbox-launch.log`. Chromium could not register its macOS Mach port; no test interaction occurred. Subsequent browser launches used the approved sandbox escalation.

The owned old-build server on 4326 was stopped and connection refusal verified. Parent-owned 4327 was left running.

New browser coverage checks inline catalog changes. Parent unit tests cover loaded-catalog provider isolation; this does not claim a new asynchronous browser catalog-prop race test. Fresh CI, production deployment, native/font compatibility, and the overall goal remain separate parent-owned gates. Only `tests/e2e/completion-preservation.spec.ts` was changed by this subagent; parent owns product changes.
