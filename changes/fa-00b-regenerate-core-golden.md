---
type: added
packages: []
---
FA-00b: the `regenerate-core-golden` workflow (`gh workflow run regenerate-core-golden.yml -f branch=<branch>`) regenerates core's examples golden fixture for a pull request branch of this repository. It first proves its environment reproduces main's committed fixture byte for byte, then renders the branch, commits only the lock's `scripts/fixtures/*.sha256.json` with every changed slide (deck, index, old and new hash) in the message and the job summary, and pushes it without force (`scripts/core-golden.mjs`, `pnpm check:core-golden`).
