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

This case is a semantic edit stress test, not a visual-fit example: the original
description box is about 24 pt high, so a 36 pt edit can overflow it. The worker
does not enlarge the box. If PowerPoint changes the shape geometry, source-role
recovery may conservatively refuse the changed topology; report that result
separately rather than treating source recovery as proof of visual fit.

`list-description-native-save` uses the same shared document and prepared font
handle as `list-description-native-edit`, with an empty action plan. It isolates
PowerPoint save/reopen behavior from the description style edit. Generate a new
sealed suite for this control; existing suites and attempts remain unchanged.

`furniture-layouts` clones the inherited/local/inherited furniture document with
explicit Text / Two columns / Two columns layouts and no actions. Its native
save/reopen witness covers inherited shared-header carriers on two distinct
layout variants alongside local picture/header/footer content. Generate a fresh
sealed suite; this case does not replace earlier attempts.
