# RR-20 macOS click-entry refusal fixture

At unchanged editor main `b2c9bab8a58b17ec3aa10c6360c0870067943986`, the full click-entry browser test fails at its numeric-edit refusal assertion on macOS with Chromium153, Node24 and the [actual release registry dependencies](dependencies.json). The release dry preparation reproduced the same failure.

The [instrumented before run](before.log) records value12 with selection0–0 before and after Control+A. Delete leaves value2, which is valid; clicking the next cell correctly commits it. The test had not constructed the invalid empty edit it claimed to exercise.

Use Playwright's ControlOrMeta+A so macOS selects all with Meta and Windows/Linux use Control. Assert the full selection and then the empty input before the existing refusal checks. The original editing-path retention, numeric12 preservation, error reporting and all other click/keyboard/touch assertions remain. No editor runtime, dependency, version or tolerance changes.

The [complete after run](after.log) passes against the identical dependencies. This is macOS browser evidence; full-ci is required for cross-platform validation. Native Office is not involved.

A separate fresh strict install of unchanged main’s committed lock uses core0.18.1/renderer0.18.0/PPTX0.18.0 and fails the existing font registry test: its old renderer digest disagrees with the already-updated Japanese font pin. The [failure](old-lock-full-failure.log) is retained. No manifest or lock changes are folded into this test repair. Full verification against the actual published release set is run separately; the metadata-only release prep raises the dependency floors and refreshes its lock. Cross-platform CI and final release-commit gates remain mandatory.

Final release-dependency verification passes:69 package test files,204 syntax files,package metadata validation,and all18 click-entry browser workflows. The [full run](release-dependencies-full.log) and [click run](release-dependencies-click.log) used real core0.18.3/renderer0.18.1/PPTX0.18.1 installed without saving or changing the committed lock. Independent review confirmed the installed Playwright1.63 platform mapping and retained refusal semantics. No baseline failure is claimed to have passed.
