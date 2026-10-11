# Main-site actual registry patch adoption qualification

Owned serial runner 84360 terminal exit 0. Node 24.21.0, pnpm 10.33.2. Actual installed core 0.18.4 and renderer/PPTX/editor 0.18.2, with the source snapshot pinned to core e09461624a64fb58761c28475c2b354984deb165; published CLI README byte-equivalence to ceb8a5a42269d9f1574c203adfd76b807e61a603 was separately established.

Passed: typecheck; full site test (27 executable snippets, hosted guide/starter regressions, release metadata/showcase hashes, bundled fonts, font-hotlink and ignore-build tests); production Next build including prebuild verification of 197 font assets and built font-hotlink check; all 75 e2e tests on the localhost production build. Browser checks include exact showcase downloads, vector PDF/PNG/SVG exports, multi-slide PDF/ZIP, editable PPTX, edited image/hidden slide preservation, invalid draft export refusal and all 894 sitemap pages/79,155 internal references.

Root's unmodified paired showcase generator replay matched all four independently reviewed rehearsal hashes; source fix PR626 is separate. No driver-only assets were used for final acceptance. Current local site diff includes package/lock/starter updates owned by the other adoption agent and this worker's release metadata/showcase/source snapshot tasks; no production deployment or Workers release build was executed. This qualifies the local patch adoption site only, not a deployed site or v0.19/native acceptance.

Receipts: rr20-mainsite-patch-acceptance-transcript.log; rr20-mainsite-patch-acceptance/{typecheck,test,build,test-e2e}.log; rr20-mainsite-patch-installed-identities.json; rr20-mainsite-patch-acceptance-hashes.json; rr20-showcase-final-paired-review.json. No source edits were required during acceptance.
