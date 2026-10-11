# Actual registry patch adoption

On 2026-10-11 the supervisor regenerated the committed consumer lock from core 0.18.4, renderer/PPTX/editor 0.18.2 and CLI 0.18.1, after independent publication verification. Gallery remains independently published 1.0.0.

The frozen four-library consumer passed NodeNext/Bundler type checks and emitted compilation (64209 exit 0). The full five-package registry ecosystem check (40137 exit 0) and separate four-library consumer (72518 exit 0) passed. Installed runtime bytes bind npm archives; no local package overrides were used. The CLI offline regression passed 16 checks. Browser harness generation is recorded separately from executed browser checks in the raw logs.

The registry gallery generator (16348 exit 0) validated and rendered 653 documents and generated 767 schema fields using immutable editor examples f35326ac0d0df72ba5c0168768851c1b3b37295d. Site acceptance remains pending. Showcase generation exposed a missing embedded-font problem during review; that output is not accepted.

Earlier setup failures remain at /private/tmp/rr20-patch-registry-ecosystem.log (missing sibling harness checkouts) and /private/tmp/rr20-patch-registry-ecosystem-with-harnesses.log (missing editor Playwright tooling). Both prerequisites were installed before the successful unchanged test replay. The first source full verification stopped on two missing renderer fontkit dependencies. After frozen renderer installation, unchanged full verification 70586 passed (exit 0); source-full.json binds its original log.

Original successful receipts are copied unchanged and bound by SHA256SUMS. Source-lock CI, merged records, all site gates, native Office and v0.19 remain separate requirements.
