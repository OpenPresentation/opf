# Canonical site acceptance — 21 September 2026

Production `https://www.openpresentation.org` passed against accepted site commit `a85bcc77d899ce9ba1df659548be564142c16120`, READY deployment `dpl_5nqS4CDckXoBzBf2Zsti6whMyxEY`, and accepted documentation source `120a770041b3f7d3c04ced1ac87675ed0d18292b`. The tested and merged site trees both equal `f3622daa40fa7abdb8ed76291ce02d53a4c73ed5`.

The Node24 verifier passed 321 checks, 11 real Chromium pages and 18 raw resources, with no page errors. Current README, skill install, quickstart, editor, data import, rich text, composition, payload, ecosystem, color and compatibility guidance agrees with the published train. Complete manifest, guide outputs, source mappings, installed runtime/catalog/example hashes and sampled evidence bytes match the reviewed build. All 75 Markdown guides, six skills and 61 evidence links remain represented; the full guide is 1,214,339 bytes.

Two additional live browser tests passed: agent clipboard plus navigation and complete skills byte/hash checks; actual homepage JSON/SVG/PPTX downloads with manifest hashes and OPF validation. The three included screenshots were visually reviewed and retain the existing page layout.

Evidence: `deployment.json`, `current-guides-report.json`, `acceptance-summary.json`, `verification.log`, `browser-downloads.log`, and three `docs-*.png` screenshots. `verify-current-guides.mjs` is the exact read-only verifier used. `artifact-hashes.json` inventories these artifacts. No source changes were needed.

This confirms this site's current public guidance and downloaded bytes. Native Office/font compatibility, automatic repair, placeholder geometry and any remaining release gates remain independently tracked.
