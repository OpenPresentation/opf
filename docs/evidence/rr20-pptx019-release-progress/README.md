# PPTX 0.19 release progress

All 17 ordinary qualification steps passed against independently verified registry Core 0.19.0, Renderer 0.19.1 and Gallery 2.0.0, including 132 package tests, packed installation and both browser cases. Independent and supervisor reviews confirmed the eight metadata paths; no runtime or test source changed. The canonical assembler consumed five fragments, with reviewed source-fragment wording corrections applied before assembly.

[Release preparation #252](https://github.com/OpenPresentation/opf-pptx/pull/252) at `742c818b3195eadf56f4bcc1fbf33f95d3252f58` matches the qualified metadata exactly. The shared gate passed all four checks and confirmation, then merged at `6bb89f1e69326532d063bacadd3bbd2acf54bd8c` on 2026-10-12 at 12:35:12 UTC. The supervisor verified exact reviewed-tree equality and synced the clean default checkout.

The exact release-commit gate passed all six checks, including Windows and Node 22/26, plus confirmation at 13:12:25 UTC. PPTX 0.19.0 is trusted-published and independently verified at tag/gitHead `6bb89f1e69326532d063bacadd3bbd2acf54bd8c`, workflow `38254108977`. Publisher 19739 and independent verifier 68090 exited 0; all ten checks pass, including exact integrity, SLSA provenance, 14 valid signatures with zero invalid/missing, GitHub Release and latest. T36 closes; progress is 29/40. Editor/CLI publication, final registry/site acceptance and native T24/T31 remain open. Native Windows acceptance remains unrun and is separate from the four offline native control checks.

The 12:36:42 UTC inventory has six open site PRs and 46 issues, complete pagination, eight clean synced defaults and no changed existing open PR heads. The copied receipts and their hashes are listed in `copies.json`.
