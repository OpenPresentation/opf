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

Pinned offline setup and normal dependency build passed. The three actual frame controls passed: complete resource/default SDK, exact-limit acceptance versus one-byte overflow plus escaped-text rejection, and a real default stdio client reading the whole resource then another tool without disconnecting. The ordinary guarded build passes. Required changed-check, unchanged full stdio/resources suite, full maintained sandbox/Export browser harness and durable evidence sealing are pending. No Office, hosted deployment, actual Claude host-save, registry or release acceptance is claimed.
