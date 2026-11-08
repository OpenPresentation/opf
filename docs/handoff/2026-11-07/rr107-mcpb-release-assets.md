# RR-107 / A7: checked Claude Desktop release assets

This is separate v0.34 work on `codex/rr-107-release-mcpb`, tracked by [the unified release checklist](https://github.com/OpenPresentation/opf/issues/1139). It does not modify the v0.33 integration branch, publish packages, create a release or install a connector.

## Implemented contract

`npm-publish.yml` builds and protocol-checks the full-font `.mcpb` after the normal workspace build, writes a standard versioned SHA-256 file, and retains only those two files in the `mcpb` artifact. Rehearsals run the same check. The GitHub release job downloads the artifact and attaches missing files only after registry/provenance verification.

Existing release notes are preserved. A retry verifies an existing asset pair without replacing it. If only the bundle exists, the missing checksum is calculated from the already-uploaded bytes, since a rebuilt zip can have different timestamps. If only the checksum exists, a new bundle is uploaded only when its hash matches. An inconsistent pair fails with no overwrite. No dependency, publishing permission, environment or owner setup changed.

The real Windows run found an existing `import(require.resolve(...))` bug in font pruning. The builder now uses a small tested subprocess that converts the installed renderer path to a file URL. A maintained package test launches that exact entry point on the native platform and checks actual resolved font files; it runs on Windows in the integration's required full CI.

## Local evidence

Node 24.20.0, pnpm 10.33.2, Windows. The source baseline is main's 0.32.1 package graph, not a staged or published 0.34 release.

- Locked install and the MCP dependency build passed.
- Full bundle build and `--check` passed: 81.2 MiB, 4,362 files, 11 model tools, viewer, `show_deck`, Office and script fonts. The final diagnostic archive SHA-256 is `e712c6cea71c105796bbb9b910dee06b7cb0527c34ad44925d2e79521fd1207b`. No archive was uploaded to an existing release.
- Seven integrity/retry tests passed. They cover complete and partial uploads, preserving different original zip bytes, mismatches and tampered artifacts, with no network calls.
- All 66 release/workflow tests passed after the portability corrections (48 release tests and 18 workflow tests).
- Native Windows font-subprocess regression test passed.
- Three existing release-test failures were independently reproduced on the unchanged baseline, then fixed as platform-specific test assumptions: changelog lookups now accept the native separator, and the smoke test compares every exact absolute tarball spec instead of expecting a POSIX-only prefix. The intended assertions remain strict.
- Sparse evidence was materialized from exact Git blobs for required tracker/text checks. No evidence bytes were edited. The release-report and text checks passed; the unrelated generated gallery tracker is already stale and is left for its normal refresh workflow.

`OPF_TRACKER_STALE=warn pnpm check:changed` completed with all selected root checks and build passing. Its sole nonzero step was the MCP suite: 48 passed, one skipped and seven cancelled by three workerd setup hooks (`spawn UNKNOWN`). The new font subprocess passed inside that suite. An independent direct `workerd.exe --version` probe also failed `spawnSync UNKNOWN`, without invoking OPF. No new assertion failed. Require normal Linux CI and the integration's full CI on a working Windows host before acceptance. Do not regenerate goldens or trackers for this tooling change. Final trusted release rehearsal and the real v0.34 attachment remain acceptance steps after merge.

The compact [verification receipt](../../evidence/rr107-mcpb/verification.json) records the baseline, diagnostic bundle digest and performed versus pending checks.

## Prerequisite metadata

The fresh-main base ends at RR-104. To satisfy the tracker's contiguous-ID invariant, this branch carries the exact RR-105 row/logs from the v0.33 integration and RR-106 row/logs from the wave-2 assembly. Their original in-progress statuses are preserved. These are prerequisite metadata for integration, not new qualification acceptance; reconcile with the final integration handoff rather than inventing status changes.

## Vetoable decisions

Publish the full font bundle as the single official download; leave lite bundles as an explicit source-build option. Use `opf-<version>.mcpb.sha256` beside the versioned bundle. Preserve existing public bytes and fail on checksum inconsistency instead of using `--clobber`. Public download links on the sites wait for the actual v0.34 release asset.
