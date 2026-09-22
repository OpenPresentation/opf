Current onboarding still recommends earlier package trains and calls published CLI/editor APIs local previews. Align README, installation, live editor, ecosystem and content guides with Node 24 and core 0.11.0 / CLI and renderer 0.9.0 / PPTX 0.9.1 / editor 0.8.0. Clarify the actual remaining editor, font and native compatibility work, and correct source skill prose.

The published npm tarballs, including CLI 0.9.0's bundled skill snapshot, remain immutable. Historical introduction versions and recorded native/portability evidence retain their scope. This does not close issue #88, change package versions, or advance native/font/repair acceptance.

Validation:

- Node 24.21.0 smoke against the fresh installed published consumer: canvas/schema exports; guarded block insertion, duplication and removal; rich content/metadata preservation; undo/redo and stale-patch rejection; table contrast behavior; CLI version/create/validate; six bundled skills, status and idempotent reinstall.
- Text-integrity check: 3,723 text files plus supported binary/compressed assets, passed.
- All 58 relative links in the nine changed files resolve; skill links remain inside their individual folders.
- `git diff --check` passed. Exact-head package and coordinated CI remain required before merge.

Audited current root docs, package READMEs and six skills/references for outdated pins and availability claims. Dated handoffs, evidence, release checkpoints, migration history and historical API introduction versions were not rewritten. No current acceptance/handoff checkpoint was added while application and site deployment verification is still in progress.
