# Fixture sources

These synthetic test presentations and edit actions are maintained with the OPF
test code. `fixtures.mjs` supplies the primary layout/furniture/picture cases;
`features/` supplies the eight authored design cases. Update the corresponding
SHA-256 records in `feature-inputs.json` when deliberately changing those sources.

`wide.png` and `chartex-fallback-main.json` originate in the MIT-licensed
`OpenPresentation/opf-pptx` repository (`test/fixtures/images/wide.png` and
`test/fixtures/chartex-fallback-main.json`). The chart file retains its reviewed
fallback digests. A mismatch requires reviewing the changed export rather than
automatically replacing the baseline. Historical binary archives are not bundled.

Font files are not tracked here. Preparation materializes seven unmodified
Roboto faces and their OFL-1.1 license from the installed packages, verifying the
renderer manifest's face and license hashes. No font service is contacted and
no fonts are registered by preparation.

`list-description-native-edit` targets the first description's exact native shape
and changes its size to 36 pt and color to red, leaving its words and the second
entry untouched. It requires the worker's reviewed `set-text-style` action and
the converter's list-role recovery fix. Preview and export use the same prepared
font handle. After native save/reopen, import must retain the edited line as the
first entry's description, including its new styling; generation alone cannot
establish that acceptance. Older sealed suites remain unchanged.
