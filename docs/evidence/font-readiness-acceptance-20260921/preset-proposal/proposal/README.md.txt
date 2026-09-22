# AuthorShell proposal awaiting approval

[Proposed patch](author-shell-proposed.patch) and [review note](REVIEW.md) are review artifacts only. The product checkout was not edited. Root has requested explicit user approval before application or application testing; no further product edit attempt is authorized here while that approval is pending.

The patch changes only AuthorShell and depends on the separately prepared `CanvasSourceOverride` bridge interface. It uses public session identity, exact source/format and semantic before/after checks, public history depths and a one-shot callback token. It does not compare snapshot object identity or access private history.

Static verification used **Node24.21.0**. The whole-project typecheck substituted the proposed file through an in-memory TypeScript compiler host, with `noEmit` and incremental output disabled: **0 diagnostics**. ESLint `lintText` used the actual product file path/config: **28 errors / 12 warnings**, the same as the untouched baseline, with no added or removed diagnostic signatures. This is not a clean-lint or runtime acceptance claim. Commands and results are retained in `check-proposal.cjs`, `typecheck.json`, the lint JSON files and `verification.json`.

No product build, browser test, CI, deployment, commit or push was performed for this proposal. [Source identity](source-identity.json) pins accepted base `e40c287b64fcbcfb85fb4a8a50641aea8e3e54a8`, the unchanged AuthorShell, proposed result, patch and bridge dependency. `SHA256SUMS` covers this directory's artifacts. Behavioral and source/history acceptance remains required after approval, as listed in the review note.
