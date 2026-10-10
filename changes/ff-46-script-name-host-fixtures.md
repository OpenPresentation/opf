---
type: added
packages: []
---
FF-46 (opf#362; records and tooling): the font tracker reads per-name host fixtures for the proprietary script, emoji, math and code-table names (`scriptNameHostFixtureEvidence`, assembled by `scripts/assemble-script-name-host-evidence.mjs` from opf-render `test/script-name-hosts.mjs` and `test/script-name-hosts-browser.mjs`, opf-editor `test/font-gate-script-names.mjs` and pptx-gallery `tests/editor-script-names.test.ts`). The open route-face fixtures do not transfer to a proprietary name, so the 22 names that pass the FF-46 native visual comparison now have their own fixture in every host and become `documented-visual`: Aparajita, Arabic Typesetting, Cambria Math, David, FangSong, Gautami, Gisha, Kalinga, Microsoft JhengHei, Microsoft YaHei, MingLiU, Miriam, Nyala, PMingLiU, Segoe UI Emoji, SimHei, SimSun, Sylfaen, Symbol, Tunga, Webdings and Wingdings. The 24 findings of opf#361 keep their status.
