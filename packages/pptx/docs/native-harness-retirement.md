# Retired legacy native helpers

The following entrypoints refuse immediately, before reading or writing evidence,
registering fonts, starting a worker, or calling Office:

- `test/native-chart-colors.ps1`
- `test/native-code.ps1`
- `test/native-quote.ps1`
- `test/native-table-colors.ps1`
- `test/native-font-selection.ps1`
- `test/native-font-advances.ps1`
- `test/native-metric.ps1`
- `test/native-text.ps1`
- `test/native-tab-control.ps1`

Their historical bodies and existing evidence remain for attribution. They are
not supported native acceptance routes. ENG-X03-001 tracks replacement: these
helpers make Office cleanup calls after a COM failure; the advances helper also
has no bounded worker. Do not remove or bypass the retirement guard to resume an
attempt. A historical successful report does not qualify current source.

## Current paths and follow-up

The existing discovered package tests and `test/packed-install.mjs` exercise
package/XML behavior without Office. They do not replace native checks. The
explicit `packed-install.mjs --native` lane still refuses at the retired helper;
it must not silently skip it or report a native pass.

For their own documented scenarios, `docs/native-font-edit.md`,
`docs/native-font-embed.md`, `docs/native-font-inventory.md`,
`docs/native-picture-control.md` and `docs/native-picture-edit.md` describe
separately bounded, owned-fixture controls. They are not replacements for chart,
code, quote, table, font-selection advance, metric, text or original-tab measurements.

Before any of those retired scenarios resumes, ENG-X03-001 requires a reviewed
replacement with a fresh owned input, bounded worker, exact already-open identity
refusal, a failure latch that forbids later Office calls, and offline failure and
ownership controls. Preserve every old attempt and report cleanup as unconfirmed
on failure. No new native acceptance is established by this retirement; replacement controls require the review and ownership checks above.
