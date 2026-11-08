# LH-121: localized timeline status labels

Branch: `codex/lh-121-localized-status`. Coordination: [#1139](https://github.com/OpenPresentation/opf/issues/1139).

Vetoable decision: generated status words live beside the language engine vocabulary, shared by composition and both drawing engines. Regional variants inherit their language's words; Chinese scripts have distinct entries. The supported set is documented explicitly. A language without generated words keeps status markers and progress, with no English insertion; authored text is preserved. The existing guarded rule still rejects words when they reduce source-label sizes.

Status vocabulary coverage, regional/script matching, explicit-text preservation, RTL and no-shrink regressions are part of the PR. Preview and native sheets/goldens belong to the integration workflow; no golden is regenerated locally.

Supported set: 27 language/script vocabulary entries, explicitly listed in docs/dynamic-composition.md. Twelve core timeline tests pass, including every entry and size preservation. Focused The existing 68 script-font/language-tag tests and SVG/PPTX tests pass for French, Arabic, Japanese and Traditional Chinese, and all 16 existing shared-timeline exports/edit/import controls pass. French and Arabic witnesses validate without warnings and export with measured fonts. Check:changed was invoked but its queued build was cancelled at the coordinator's request to reserve the three heavy-check slots for the v0.33 release. No new heavy check was started; Biome and lightweight focused checks pass. Integration owns full type/package CI and workflow goldens.

[Before/after sheet](../../evidence/lh-121-localized-status/french-arabic-before-after.png). Native inputs: `C:/opf-work/lh-121-localized-status/artifacts/lh-121/french.pptx` and `arabic.pptx`; matching previews end in `-after.png`. Arabic explicitly selects the existing noto-sans-arabic record, whose concrete major/minor face is Noto Naskh Arabic. No Office automation was run by this lane.
