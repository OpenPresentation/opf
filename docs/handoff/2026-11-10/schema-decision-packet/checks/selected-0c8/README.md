# Selected failed-step replay

Maintained `pnpm check:changed --files` actually exits0 on source `0c8ce23129557674a04654e194de6ab63ac95785`:17steps PASS, typecheck skipped because no TypeScript/config change was selected,28.9seconds. Exact original summary and plan logs are retained with SHA256/size in receipt.json. This follows exact tracked-Git input restoration, supported readiness-status spelling and the independently reviewed partial-stroke integration correction.

The ten selected paths were:

```
scripts/build-font-tracker.test.mjs
scripts/build-gallery-tracker.test.mjs
scripts/check-text-integrity.test.mjs
docs/programs/release-readiness/burndown.md
scripts/native-acceptance/b07-current-profile.mjs
scripts/native-acceptance/run-b07-current-profile.ps1
scripts/native-acceptance/run-b07-current-profile-self-test.ps1
packages/javascript/test/script-width-estimates.test.mjs
packages/cli/test/image-placeholder-count.test.mjs
packages/integration/test/lh-110-localized-references.test.mjs
```

The selected package tests are the three named files, not their full suites. The original full gate remains44PASS/9RED in [its immutable packet](../final-a3b/README.md). This replay does not supply pinned raster goldens, final coherent CI, physical Office, platform, performance, registry, release or site acceptance.
