# Seven-repository branch audit — September 10, 2026

Requested audit: identify uncommitted changes and changes not incorporated into each repository's remote default branch; integrate useful, ready work. `pptx-dev` uses `origin/master`; the other six use `origin/main`.

At the start, all tracked working trees were clean. The only untracked directory was `opf-pptx/artifacts/`, containing generated browser bundles, reports, fixture decks, and a local review helper. It contains no tracked source. [PPTX PR #32](https://github.com/OpenPresentation/opf-pptx/pull/32) adds a root ignore rule while retaining every file on disk.

The original core checkout `/Users/michael/Source/opf` and detached native review checkout `/private/tmp/opf-native-review-20260910` were also clean. The original core `main` was behind, with no unique commits. The detached native review checkout is an intentional historical snapshot and should remain at its reviewed commit.

## Method

Fetch each remote, inspect every local/remote branch and worktree, and distinguish git ancestry from incorporated changes. Squash merges deliberately have different commit identities. For all 17 nontrivial branches matched to merged PRs, the branch tip tree is identical to its merged PR tree. Six integration branch tips are ancestors of their merged release branches. Patch-equivalent branches are separately classified. Closed branches are checked against their documented replacements; absence from `git branch --merged` alone is not evidence of missing work.

The [inventory](inventory.json) retains the original 53 apparently unmerged distinct branch heads, reviewed default commits, relevant file/commit lists, PR matches, and disposition. Forty-seven were already incorporated or explicitly superseded. The remaining six are the four coordinated header/footer candidates, one old research note, and one old copy branch.

## Important work

| Repository | Finding and action |
| --- | --- |
| `opf` | Shared header/footer candidate at `fc3d6344c9ad5c195dcee4bac56ca76edf1f8213` remains unfinished. Historical `.pen` analysis at `f0d9b71d3ba1a8eddadbc90c96a11a9c1b031e14` is preserved, with stale architecture/examples and proposed schema fields; it is not current implementation work. |
| `opf-render` | Shared header/footer candidate at `4e11b9557b589e3a9d04c7c97b4a0c66bce83d94` remains unfinished. |
| `opf-editor` | Shared header/footer candidate at `e0c817fb372a5639f9fd1c829e85bf21fb1ba241` remains unfinished. |
| `opf-pptx` | Shared header/footer candidate at `d06bc9c72aef16fdbe345704309f53ed97321417` remains unfinished. Ignore generated local artifacts through PR #32. |
| `openpresentation-site` | No missing source work; remaining historical heads are patch-equivalent. |
| `pptx-gallery` | No missing source work; remaining historical heads are patch-equivalent. |
| `pptx-dev` | Recover useful changes from closed PR #6 via [PR #33](https://github.com/Data-Advantage/pptx-dev/pull/33), reconciled with current local workflows. Its documentation accounts for every file in the old 27-file draft. |

The four `codex/shared-furniture-20260910` branches are important and safely pushed. They already share measured header/footer layout across the four packages, but semantic reimport of current native text/images is incomplete, 657 changed corpus rasters have not completed before/after review, and fresh Node 24 installed-package acceptance is outstanding. Their recorded source tests are not a substitute for these gates. Do not merge the draft just to make the branch list empty or restore its old Node 20 acceptance instructions. Continue from its `docs/plans/shared-furniture-layout.md`, updated to the current Node 24 runtime policy.

The old research branch is not lost. Its recommendations need a fresh schema/design review before adoption; wholesale merging would present outdated statements as current guidance. Preserve it without changing the active roadmap.

No historical branch or generated artifact is deleted by this audit. No native Office, font-identity, tab-positioning, or image acceptance gate is changed. No package versions are published by this cleanup. Merge/deployment outcomes for the cleanup PRs belong in the final acceptance record rather than being inferred from branch creation.
