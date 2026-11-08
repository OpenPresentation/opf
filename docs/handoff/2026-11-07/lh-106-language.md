# LH-106 and LH-178: per-slide language

Implementation branch: `codex/lh-106-slide-language`. Parent coordination: [#1139](https://github.com/OpenPresentation/opf/issues/1139).

The schema, shared script resolver, direction, quotation marks, number formats, Markdown, source completion and PPTX language/provenance now read a slide's language before the deck's. New core, renderer and PPTX tests cover English, Arabic, Japanese and French plus a native-edited slide language.

Vetoable decision: slide `language` accepts the same tag or inline object as deck `language`; omission inherits the whole deck value rather than merging an inline object. A run's `lang` wins. Arabic script-family font schemes are selected with the effective slide language, closing LH-178 without substituting a different authored font.

No existing example is changed by this feature and no golden is rewritten locally. Fresh PowerPoint qualification of the multilingual example is owed to the coordinator. The package checks and PR link are recorded in the PR body when complete.
