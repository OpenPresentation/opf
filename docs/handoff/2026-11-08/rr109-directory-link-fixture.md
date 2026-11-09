# RR-109 / RR-105 directory-link fixture on Windows

Fresh main fef5d76e06bae126d6cdda0e3f7658e42c49db03 reproduces a real Office-free test harness failure: the directory target in font-routes.test.mjs uses an unspecified symlink type, which defaults to file on Windows and fails with EPERM before the suite sealer can inspect it. After the required core build, the focused baseline is3pass/1fail solely at that link creation. Initial fresh-checkout missing-build output remains recorded separately.

The one-line test-only correction requests junction on win32 and dir elsewhere. The directory target, entire control flow, strict symlink refusal assertion, cleanup and all other assertions remain unchanged. All four focused controls pass on actual Windows with no admin fallback, skipped assertion, Office construction or production/font/runtime-policy edit. This is a vetoable fixture-platform choice, not new native qualification or permission to follow reparse points.

Exact sparse corpus, painting and two chart-history inputs are restored from Git bytes before mapped checks; no fixture data or generated tracker is regenerated. Required mapped result and raw before/after receipts follow here before the final branch freeze.

## Final verification

[Exact raw receipts](rr109-directory-link-data/verification.json) preserve both fresh-checkout and built-baseline failures, the4focused after passes,44maintained native-acceptance tooling passes and the one mapped run. The complete normalized source is proved identical to main except the one link-type argument; all assertions/cleanup and production/spec/skills/workflow/lockfile trees stay unchanged.

Mapped77.6seconds: eight steps pass, typecheck skips, only gallery-tracker fails for missing sparse historical evidence. Reusing the existing033proof input set restores1817files/45,984,638bytes, each independently authenticated against this branch's Git blob identity before writing. Strict tracker18tests and freshness then pass (863records/313unaddressed). No tracker regeneration, policy relaxation, admin fallback, Office or native acceptance. This source correction is ready for final integration; bundle-cap causality remains a separate read-only task after the coordinator's final fold.
