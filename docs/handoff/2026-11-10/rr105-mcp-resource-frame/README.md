# RR-105 MCP viewer resource frame

Source base: normal fresh-main alignment to reviewed `45564d256b3b89018259e55e9cf37d396d7780c6`, tree `c389dcbb34614efa2237228d10a8b299bc43a087`. Original 519 aggregate and the frozen font leaf stay unchanged.

## Actual cause

The original shared stdio suite passed validation (54.87 seconds) and conversion (7.68 seconds), then its first resource test failed in 414.605 ms. The 65.5 seconds was cumulative suite time, not a process TTL or request timeout. Helpers and production stdio have no such TTL. The exact built HTML had 10,289,372 raw bytes but required a 10,688,398-byte JSON-RPC response, exceeding SDK 1.32.2's default 10,485,760-byte buffer. The actual SDK ReadBuffer throws its size error; transport closes and later tests cascade as Not connected. No deadline or buffer override is justified.

## Source choice: RR105-DEFAULT-STDIO-FRAME (vetoable)

The viewer still lazily exports with the exact public `toPptx` function. A private two-line static re-export makes that lazy module namespace export-only. The original parallel Promise.all is retained, with only its PPTX import specifier changed. Server-side full PPTX import/export APIs, source edits/history, shapes/diagrams, PNG/PDF/PPTX/OPF Export, cancellation, font policy and restrictive CSP stay intact. No executable compression, extra network/resource host, new dependency, CSS/charset change or buffer increase is introduced.

The actual maintained-options 455 diagnostic frame was 10,689,080 bytes. The private bridge candidate is 10,342,402 bytes with request id 1; its script loses 336,043 bytes and eleven output modules containing unreachable native import paths. The build guard uses the complete real resource shape and the largest safe numeric SDK request id: 10,342,417 bytes, 143,343 bytes below the fixed 10 MiB cap. Tests compare the sized result to an actual production stdio resource, so metadata/envelope drift cannot silently weaken the guard.

## Retained rejected hypotheses and setup

CSS minification plus UTF-8 output alone still exceeded the cap by 29,511 bytes on the original built page; those flags are not applied. Named dynamic-loader helpers at 40b84ed2 removed no output modules and added 94 bytes; they are not carried in the final source. Their original source/logs remain. Diagnostic loader shebang/escaping mistakes and a CRLF-only edit anchor refusal are retained as setup errors. After that anchor refused without changing product files, a shell-exit check omission ran an extra unchanged-455 baseline under a candidate name; it is explicitly not a candidate success. Subsequent commands check native exit status before a bundle launch.

## Qualification

Pinned offline setup and normal dependency build passed. The three actual frame controls passed: complete resource/default SDK, exact-limit acceptance versus one-byte overflow plus escaped-text rejection, and a real default stdio client reading the whole resource then another tool without disconnecting. The ordinary guarded build passes. The original required-check wrapper failed with ETIMEDOUT at 60 seconds because the generic diagnostic runner erroneously retained that cap. The already-owned maintained child continued: its complete 153.1-second summary is 9 PASS / 1 sparse-gallery RED, with typecheck PASS and all MCP tests 61 PASS / 0 FAIL / 1 SKIP. Its end was observed through one exact process-handle wait, but the attached ExitCode was null; no native exit or successful original wrapper is invented. The unchanged aggregate was not repeated. After correcting only the runner cap and observing all children ended, the full maintained local browser run actually exited 0 in 19.8 seconds: all 16 groups pass with 19 exact screenshots, including real PPTX/PDF/PNG Export, source formats, denials/errors and CSP. Coordinator will run the normal coherent whole-source gate after review/folding. No Office, hosted deployment, actual Claude host-save, registry or release acceptance is claimed.

## Durable replay and scope

The [lossless raw packet](raw.json.gz) contains 85 records / 4,727,555 raw bytes: exact module inventories, source/build identities, original failures, rejected hypotheses, setup refusals, continued checker evidence, SDK source and browser receipts. All [19 captures](screenshots) are byte-exact copies of the actual run. The baseline/current HTML artifacts are gzip evidence only; browser code is not compressed or dynamically evaluated. Both contain only public UI code and the existing renderer-pinned OFL Roboto fallback, with no owner deck, standalone/private/system font or secret.

The original 519 HTML at its earlier 0cbec404 hash was no longer present after the coordinator built 455. The capture guard refused it; no substitute is called 519. The archived baseline instead exactly matches the independently recorded clean-455 diagnostic SHA a35bc3e4, while the original 519 log and earlier byte observations remain literal.

Run with Node 24: `node docs/handoff/2026-11-10/rr105-mcp-resource-frame/verify.mjs`. It verifies both complete HTML artifacts, exact serialized-frame sizes, every raw record/image and unchanged protected source objects. It preserves wrapper failure/null child exit and does not promote local synthetic host acknowledgements into an actual Claude save, hosted adoption, native or release acceptance.

The separate metadata-only delta at `d6465fb8` ran with the corrected ordinary runner and actually exited 1: 6 PASS / 1 same sparse-gallery RED / typecheck SKIP, 27.8 seconds. Its nine lossless records are in `metadata-checks.json.gz` and included by the same verifier; no MCP test suite was repeated.
