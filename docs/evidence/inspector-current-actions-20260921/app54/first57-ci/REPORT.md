# App54 additive head57 first acceptance attempt — failed

This receipt applies only to head `57e5e59fddbc94346f142dc12d86a916228bf2ae`, tree `d9c3aab543c6a886a85c6ec07dd55e5ab22590cd`, added after `60c91f6b97c75636f533202f4112e09dc01144e4` on [App54](https://github.com/Data-Advantage/pptx-dev/pull/54). It is not acceptance of the subsequent archive-name correction.

| First exact-head result | Identity | Outcome |
| --- | --- | --- |
| [Application CI](https://github.com/Data-Advantage/pptx-dev/actions/runs/35645493900) | run 35645493900, attempt 1 | FAILURE |
| Linux | job 106484827822 | 692 unit tests + 7 standalone controls passed; typecheck failed |
| Windows | job 106484826913 | 692 unit tests + 7 standalone controls passed; typecheck failed |
| Preview | `dpl_Edr9JQjLjtzXXHTeuvuVjkqaLrPG` | ERROR, `module_not_found`, `buildStep`; exact57 head |
| Bugbot | check 106484830897 | NEUTRAL; review did not run because a usage/spend limit was reached |

Both CI jobs observed Node 24.20.0 and failed with the same two TS2307 errors at line 4:40:

```text
docs/evidence/inspector-action-snapshots-20260921/final-inspector-actions.spec.ts
docs/evidence/inspector-action-snapshots-20260921/initial-focused/inspector-actions.spec.ts
Cannot find module './helpers/clipboard' or its corresponding type declarations.
```

Production build and browser steps were skipped on both operating systems. **No browser tests ran for this CI head**, and no browser/timing artifacts were uploaded (`total_count: 0`). The earlier local 39-browser result is pre-curation local evidence, not final committed-tree CI acceptance. Full original job logs and compact compiler/runtime excerpts are retained.

Vercel metadata reports `Command "pnpm exec convex deploy --cmd 'pnpm run build'" exited with 1` on the exact head. The connected build-log endpoint returned `Tool get_deployment_build_logs not found`; no Vercel executable was available on PATH. Precise Vercel compiler lines were not retrieved, so this receipt does not infer them from the GitHub errors. No deployment retry, login or credential access occurred. This preview failure is a release blocker; it is not production acceptance.

## Source and evidence audit

Initially clean working files, staged receipts and all **106** committed additive paths matched. The **93-file** bundle has 92 manifest entries plus its manifest; SHA256 `d7ebcd170ee558c7934ebd99fc38c54a7d4bfdc1f12f13f1bbe12850542d3e07`. Complete coverage and byte hashes passed. After the supervisor began correcting archive extensions/provenance, final verification deliberately used immutable 57 Git blobs; it did not compare them to the intentionally modified working files. See `committed-source-audit.json`, `committed-blobs.json` and `release-audit.json`.

The Python wheel/source-distribution artifact workflow did not trigger: none of this PR's changed paths match `.github/workflows/**`, `scripts/verify-artifact-roundtrip.py` or `sdk/python/**`, and that workflow has no dispatch entrypoint. This is **not applicable**, not a fresh artifact-workflow pass.

The original 60c91f6 Windows browser failure remains preserved in `/private/tmp/opf-inspector-share-guard-20260921/ci/REPORT.md`; this later compile failure does not erase or resolve it. No CI rerun, merge, browser run, deployment, package publication or Office work was performed. Overall acceptance remains incomplete.
