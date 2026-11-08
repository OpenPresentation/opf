# LH-106 and LH-178: per-slide language

Implementation branch: `codex/lh-106-slide-language`. Parent coordination: [#1139](https://github.com/OpenPresentation/opf/issues/1139).

The schema, shared script resolver, direction, quotation marks, number formats, Markdown, source completion and PPTX language/provenance now read a slide's language before the deck's. New core, renderer and PPTX tests cover English, Arabic, Japanese and French plus a native-edited slide language.

Vetoable decision: slide `language` accepts the same tag or inline object as deck `language`; omission inherits the whole deck value rather than merging an inline object. A run's `lang` wins. Arabic script-family font schemes are selected with the effective slide language, closing LH-178 without substituting a different authored font.

No existing example is changed by this feature and no golden is rewritten locally. Fresh PowerPoint qualification of the multilingual example is owed to the coordinator. The package checks and PR link are recorded in the PR body when complete.

The new four-slide multilingual example validates with --fail-on warning, renders at 1280×720 and exports successfully. [Review sheet](../../evidence/lh-106-language/multilingual-slides.png): English body, Arabic RTL list with its selected script font, Japanese quotation marks, French grouped number. Existing examples are unchanged; the new example golden belongs to the v0.34 integration workflow.

Verification: 63 focused/core script-font tests, 164 updated vocabulary/schema/rule-documentation tests, SVG feature tests, PPTX feature/native-edit tests and the existing 13-language PPTX suite pass. Initial full check:changed exposed three stale expectations (new Markdown key, the removed loose code-language error now reported as a BCP-47 pattern error, and generated rule docs); these are fixed and the focused rerun passes. Typecheck passes. Documented Windows/sparse-evidence failures remain; final package checks continue in the PR/integration.

Final provenance correction: decks with no slide language overrides do not gain inherited-language sentinel records, preserving legacy exact archive bytes. New direct provenance guards and the feature round-trip test pass; all 31 chartex checks pass, including legacy archive digests. The final PPTX contract run passed its first 77 files, then stopped in the existing keynote-registry-runtime symlink test with Windows EPERM (150 remaining files unrun). The separate check:text failure is the sparse evidence checkout. No known product assertion remains failing locally.
