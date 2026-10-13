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
