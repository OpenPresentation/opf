# Publication and preservation ledger

All pushes are normal, without force. Frozen folded leaves were not modified. This is a resumable checkpoint, not acceptance to merge or release.

## Current branches

See [seven checked publication receipts](published-current-branches.json) and [four new drafts](created-resume-prs.json). They retain actual known failures and unrun gates. Canonical/staging final alignment is separately recorded in the closeout.

## Recovery archives — NEVERMERGE

| Repository | Immutable archive commit | Scope |
| --- | --- | --- |
| [OpenPresentation/opf](https://github.com/OpenPresentation/opf/tree/codex/handoff-recovery-20261110/docs/handoff/2026-11-10/final-recovery) | d15846a04c1757a091c6ceb772f8162aedcb91c4 | 7reviewed missing files/483041decodedB; inheritance packet plus3SH21logs |
| [Data-Advantage/openpresentation-site](https://github.com/Data-Advantage/openpresentation-site/tree/codex/handoff-recovery-20261110/docs/handoff/2026-11-10/final-recovery) | abf192cee21aaf612840a9a734762cb80c1bdbd1 | 8trackedcontexts/315842B; own4PRinventory |
| [Data-Advantage/pptx-gallery](https://github.com/Data-Advantage/pptx-gallery/tree/codex/handoff-recovery-20261110/docs/handoff/2026-11-10/final-recovery) | 8608b71a7d2746b4375fda02fc34a342b8093caf | 148tracked+43untrackedcontexts/1628187B; own3PRinventory |
| [Data-Advantage/pptx-dev](https://github.com/Data-Advantage/pptx-dev/tree/codex/handoff-recovery-20261110/docs/handoff/2026-11-10/final-recovery) | 0341b65aac7d7b27631d83f7a9e2ac09f52fab04 | 3tracked+28untrackedcontexts/477225B; own4PRinventory |

All four builtin read-only archive verifiers passed. They never execute/extract/apply archived code. The three private archives preserve159real tracked+71untracked project-file versions/2421254B, separate from stat-only flags. Original historical branches/indexes/worktrees remain unchanged. Private content and exact inventories stay in the matching private repository. Later inventory-only appends may advance the recovery ref; the immutable archive commits above and archive bytes remain exact.

### Already-preserved local variants

- Local3c5 B07 comparison/raw/PNG evidence is byte-exact in publicb35d10dfafa711ce4039eeb497052a4f4294ba6b, codex/evidence-b07-character-bounds-native-sealed. The large comparison restores from its gzip exactly; no redundant uncompressed copy was pushed.
- Experimental897005388dd4617965b6a0e4f719e1c4051f1b46 is ancestor of publishedc1b0fd6ee043d9e8400270cb05dd1040199b24c6, codex/evidence-rr105-native-direction-2026-11-08. It is not a native glyph fix.
- Local nightly-fixtured538 has the exact file blob eace052ada422e43c28fb6515dda6471b514aa6f already merged in main/staging through1079/acc222502c79d199527c62f25386e94fbe99052f.
- Six language-native apparent modifications normalize to the published e1f8 Git blobs; existing archive-review scratch logs are byte-exact in public5e89ZIP. Stat/cache/EOL-only working copies are not new product source.
-64otherwise unmatched local branch/producer heads were proved ancestors of the55db staging code/history and will be reachable through final published integration; one local head is behind its existing remote. Immutable baselines/producer names need not be rewritten merely to align everyoldclone.

### Explicit exclusions

Six opaque site artifact/temp-source/dependency directories remain untouched/unreviewed with unknown contents/counts; they were not blindly published. Existing node_modules, font executables/binaries, credentials/account configuration, rawbrowser/profile/session data and whole scratch directories are excluded. The original detached desktop .tmp helper/cache tree is not authoritative implementation; preserve it locally for optional inspection, never execute its patch helpers blindly. This is not a backup of the entire machine. All identified current authored source and safe project-result deliverables are either pushed, recoverable from the archives, or proved exact published equivalents.

## Local default checkouts

[Fast-forward receipts](primary-checkout-sync.json) show the three clean site defaults updated to origin: Orgmain148/Gallerymain9d/DEVmaster4fed. No remote default branch was changed and no deployment was triggered. Use fresh own worktrees for new changes.

## Final inventory

The final post-push per-repo open-PR snapshot is appended on each repository's recovery branch as docs/handoff/2026-11-10/final-recovery/open-pr-inventory-final.json. Public OPF contains only public OPF records; private inventories stay private. The owner's closeout records the final canonical fullSHA and current counts.
