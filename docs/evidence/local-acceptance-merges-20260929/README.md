# September 29 local-acceptance merge receipts

The owner authorized reviewed local-test merges while Actions credits are
unavailable. The [runtime checkpoint](../../handoff-runtime-2026-09-29.md#local-acceptance-during-the-actions-credit-shortage)
explains the bounded results, original failures and remaining gates.

`merges.json` is a compact public index copied from eleven separately frozen
merge receipts. Each receipt checked the fresh remote head and current target
branch, the reviewed integration tree, then the accepted squash commit's exact
tree and sole parent. Some GitHub synthetic merge refs lagged behind current
main; local `git merge-tree` verified the actual base/head union before merge.
No check or protection was disabled and no Actions rerun was requested.

The original private source-bound logs, screenshots, downloads, compiler probes
and browser traces remain in the coordinating task's durable archive. This file
is not raw acceptance evidence, a fresh production check, a native/physical-font
result, a published-package result or the full compatibility matrix. Public PR
links and immutable commit/tree identities permit independent Git inspection.
The [official registry metadata](registry-latest.json), read at 16:22 UTC, confirms
core 0.11.0, CLI/render 0.9.0, PPTX 0.9.1 and editor 0.8.0, all on Node 24.x.
This metadata snapshot is not a new installed-package acceptance run.

Gallery45 was closed only after its isolated replacement Gallery48 was verified
merged; its original branch/head was preserved. Gallery44 remains open.
