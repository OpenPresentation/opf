# Independent CLI prerelease readiness review

Read-only inspected stable four-path working diff in `/private/tmp/opf-cli-prerelease-readiness`, base `1921a28c6d4eea090dc368c13c75ca1b359bdc39`; final commit and author source gates pending. No tests, installs, APIs or implementation edits by reviewer.

No blocker within documented exact-version/caret support. Stable caret excludes all prereleases; explicit prerelease caret admits prereleases only on its numeric tuple and compares identifiers in order: numeric before nonnumeric, numeric magnitude, lexical nonnumeric ordering, shorter equal-prefix sequence first. Stable releases continue through existing numeric caret logic. Exact comparison unchanged. Preexisting unsupported range forms/caret limitations are not expanded or waived.

Fifteen focused cases include stable positive, 0.18 negative, stable-required rejection of next.0, explicit same-tuple prerelease positives/negatives, numeric beta.10 vs beta.2, shorter identifiers and numeric-before-alpha. Actual doctor fixture adds next.0 separately, asserting installed true/readiness false/missing stable requirement while JSON/YAML/Markdown remain ready; existing stable 0.19 positive and 0.18 negative assertions remain. Shared fixture helper/defaults, manifests, lock, optional flags and engine-feature loading are unchanged. Genuine CLI fixed fragment accurately describes the readiness correction, not publication.

Author retained actual baseline false-positive (`original:true`, npm semver:false) in `/private/tmp/rr20-cli-prerelease-before-oracle.log`; ten boundary cases agree with npm bundled semver 7.8.1 in `/private/tmp/rr20-cli-prerelease-semver-oracle.log`. These are author evidence, not a reviewer retest. Focused fifteen pass; source build/doctor/mapped session 25373 remains running after honest original gallery1 dependency refusal. Final source/registry/breaking/publication gates remain separate.

Inspected hashes:

- `packages/cli/src/install.ts`: `171b6da0f1aef1df457b7f68bf4d42cb91a7511661180a864d76e04b4f87f582`
- `packages/cli/test/doctor.test.mjs`: `02316355282c5837d4e19c532b7dc408a08ef6c076dac3799d6b17f5d40df247`
- `packages/cli/test/install-ranges.test.mjs`: `6b5ca859451414a4d18f366f2449b239f2a1be229497d6bb6b3484b3bfa26c57`
- `changes/rr-20-cli-prerelease-readiness.md`: `1679f58a5bc4348cf7271665286576c4385672c5f816640aed447e29c800fd26`

Final clean author freeze `d195f5e0b809576a8af09af2f51dc86bd51d43bb`: focused doctor/range22 passed, CLI198 units/95 commands passed; mapped source remains failed solely genuine minor and missing published19 peer prerequisites. No full new staged graph claim.
