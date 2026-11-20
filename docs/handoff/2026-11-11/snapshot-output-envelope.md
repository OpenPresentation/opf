# Snapshot preparation output-envelope boundary

Base e9996ccc1a4f6f63934ec31da0bc58938cd8f042. The actual Windows041 pure attempt created and verified its source envelope, then failed during prepare: prepare copied execution-envelope.json into its owned output and invoked the real verifier with that copy; assertSevenOutput protected the copy as an external immutable input and rejected its own parent. No native operation occurred; the original failed attempt remains unchanged.

The verifier now uses one narrow output-envelope boundary helper. It ALWAYS applies the existing suite/preparation/worker/consumer/controller overlap guards first. Only an exact canonical output/execution-envelope.json path is recognized as the intended internal copy. Every other envelope path keeps the existing bidirectional external-file overlap refusal. No basename/descendant-wide exemption, callback, fake runtime authority or new prepare framework is introduced. Public prepare, full source-envelope admission, copied bytes, snapshot identities, runner/request binding, writes and worker arguments remain unchanged. The new filesystem test is included in the existing source-identity roster.

Pure drafts use real owned files/directories to cover exact internal and external/sibling positives; unexpected contained copies; all five immutable roots at equal/descendant/ancestor boundaries; external-file overlap; directory aliases; and the fact that inert JSON cannot traverse real digest/source admission. They exercise the production boundary helper, not a synthetic claim of genuine prepare/runtime acceptance. Fresh actual Windows prepare remains the end-to-end regression after root integration.

The initial source review was unexecuted. Worker, launcher, observer, policy, budgets, archive/public/style proofs and old v1 profiles remain unchanged. This is preparation plumbing, not native acceptance.

## Actual bounded focus, 2026-11-11

Root and independent peer accepted the source. Own Node24.21.0/pnpm10.33.2 frozen offline install and both changed-MJS syntax checks passed. The sole new filesystem file passed **23/23, zero RED/skip**,164.3ms, with all five tested source and14 protected identities exact before/after every command. No source repair or retry was needed. Compact receipt and complete focused output retain exact scope.

The existing seven-value-snapshot.test.mjs file remains UNRUN here: it statically imports the public PPTX entry, but this fresh worktree has no packages/pptx/dist/index.js. No product build or donor artifacts were authorized or used. Root's common-runtime cumulative gate must cover that existing file. No PowerShell, process query, Office or genuine fresh preparation ran here. Actual Windows prepare remains the meaningful end-to-end regression, with the original041 pure refusal unchanged.
