# Core105 descendant integration audit

Accepted core105 `84e914710520a7b0e777fce30e5758ee64a64924`, tree `0317915dcb7b1e4a29eb8a3503b7be4ed7bb6d00`, directly descends from accepted core104 `3d301f1bef2c5d55e7e2a58f1aa53632d9ec8ab1`. Remote main and the clean primary checkout match. All **60** reviewed core104 documentation/evidence blobs remain byte-identical.

| Fresh push gate | Run / job | Outcome |
| --- | --- | --- |
| [OPF CI](https://github.com/OpenPresentation/opf/actions/runs/35644048902) | 35644048902 / 106480049291 | SUCCESS, attempt 1; 19:22:07 UTC |
| [Coordinated public packages](https://github.com/OpenPresentation/opf/actions/runs/35644048907) | 35644048907 / 106480501429 | SUCCESS, attempt 1; 19:31:05 UTC |

Both runs bind to this exact descendant head and observed Node 24.20.0. The completed OPF package/quickstart and coordinated installed-package/browser/registry checks establish **descendant integration acceptance**. They do not rewrite core104's exact postmerge coordinated run 35643638022, which remains canceled after main advanced. No workflow was retried or rerun. The prior 43-file premerge and 33-file exact-postmerge audits were reverified unchanged; see `release-audit.json`.

## Offline native bundle verification

The only additions relative to core104 are **517 files** under `docs/evidence/windows-native-edits-20260921/`; every added file matches its accepted Git blob. The requested standard-library command was run from that bundle on clean primary:

```sh
python3 verify.py
```

Python 3.9.6 exited 0: **516 hashed inventory files**, **56 PPTX CRC/XML/font-program checks**, **0 Office calls**. Input hashes, exact cwd/command, output and unchanged source status are retained in `source-and-native-verification.json` and `native-offline-verify.log`. Manifest SHA256: `53a87939b557e4d2a81fc75e8a39255e535eab27056cfcf2f453d170d2c50de8`. The inventory excludes its own manifest.

The bundle covers finite B picture/furniture edits and C notes ordering; D/E are excluded. Its recorded semantic audit reports nine passing applicable cases. All 21 visual-review image hash references resolve exactly, but this audit did **not** repeat Office behavior, semantic reimport or visual inspection. `native-scope-checkpoint.json` preserves that distinction.

Documented limits remain: UI Change Picture changes geometry; longer current native header text clips; duplicated tagged headers overlap; controlled notes reordering produces refused-open results with failed worker cleanup retained separately from later empty-workspace observations. Native tab tolerance and physical-font acceptance remain separate unresolved gates. The user's Windows supervisor retains sole Office ownership.

Original job logs and compact excerpts are retained; coordinated artifact metadata was collected without downloading its archive. No native branch mutation, browser run, Office call, package publication or deployment was performed. App54's first Windows failure remains preserved and the overall goal remains incomplete.
