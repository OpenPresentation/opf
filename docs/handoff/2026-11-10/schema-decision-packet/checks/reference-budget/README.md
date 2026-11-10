# Reference ownership budget refusal

Frozen `ed51a7e8a6636bb2e08c9a446a7d22c21ad81066` preflight omitted the new `written` and authored `stroke` fields. An actual one-helper writer record, replicated only as serialized metadata, crossed the unchanged 4 MiB hex reader limit at 14,224 helpers (4,194,426 bytes); 14,223 wrote 4,194,128 bytes. The old preflight accepted both. Other existing count/cache budgets remain within bounds. No large workbook, full PPTX export, native application or cap change was used. The full stroke adds104 UTF8 bytes per same-index helper.

`old-boundary.json` is the original observed result. To replay, install the frozen ed51 checkout and run `node replay-old-boundary.mjs /path/to/ed51 /tmp/result.json`. The recipe refuses a different chart source by exact SHA256. It imports the actual source writer and preflight, not a duplicate approximation.

The repair accounts for the actual authored stroke and a conservative bound on the native paint key. RGB is six digits; alpha255 bounds any alpha byte, and zero-width has exact alpha0. Resolved EMU width and dash are used directly. The cap stays4MiB. The maintained new test obtains real writer fields for partial width and `none`, computes adjacent exact serialized boundaries, requires the below case accepted and the above case refused. Before rebuilding, both controls failed against frozen ed51 dist (missing expected exception); the source-only repair passed both. Built-package verification is still pending in this snapshot.

The final common ca895 built-package boundary controls now pass2/2. The4MiBcap is unchanged; the initial pre-repair refusals and source-only checks remain separate historical results.
