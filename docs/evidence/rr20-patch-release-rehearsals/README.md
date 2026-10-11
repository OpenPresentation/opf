# Patch release rehearsals, 2026-10-11

These are local release-prerequisite results, not publication or final release-commit acceptance.

## PPTX 0.18.1

The prescribed release tool prepared a disposable checkout based on main `5b6c793ba0f91bd5ac21c0c6eef0091ec3760fa1`. Its changes are limited to version/dependency metadata, lockfile and assembled changelog/fragments. Core floor is `^0.18.3`; renderer peer is `^0.18.1` and development pin is `0.18.1`. [Metadata hashes](pptx-prep-metadata.json) identify the tested files.

- `npm ci --ignore-scripts` passed with the generated lock.
- [Full `npm test`](pptx-test.log) exited 0: all 128 discovered test files, browser build, runner and fragment checks passed.
- [Packed-install check](pptx-packed.log) exited 0 against registry core 0.18.3 and renderer 0.18.1: 68 byte-matched files, 54 verified registry signatures, 15 attestations and provenance interoperability.

The scratch checkout predates the pending npm CI repair #244. A fresh actual prep and required release-commit gates remain necessary after prerequisites merge. There is no PPTX 0.18.1 publication claim here.

## Editor CI prerequisite

Reviewed npm CI repair #157 at `adf5ef23dd0ad69b05bafe6b3396022eb1ea96c1` incorporates font-pin prerequisite #154, merged at `4c29be041bb3b4ea67b4b086e69c13395542377c`.

[Independent packed check](editor-packed.log) exited 0: 123 byte-matched files, 23 model suites, offline browser workflow, 135 verified registry signatures and 24 attestations. This checks the prerequisite source against registry dependencies; editor 0.18.1 prep, final CI and publication remain outstanding.
