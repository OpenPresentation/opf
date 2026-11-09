# RR-105 Windows malformed-ZIP refusal control

Full CI run42642923443, Windows PPTX shard1/3, job129248453015 failed on exact integration
`1ef0e17a58198defa34cd515ad7078d56a7d97d0`. At15:22:29Z the actual PowerShell5.1
error correctly refused a malformed ZIP before output or Office. Host-width formatting split
`Central` and `Directory corrupt.` across CRLF, so the test's literal-space matcher failed.
The recorded error identity was `InvalidDataException,run-windows.ps1`. No exporter or ZIP
validation defect is established by that failure.

Original raw log: ci-job.log.gz, decoded91,134 bytes, SHA-256
`0f335bd079dc00bf348212d5c1f9b7b1e4d5673b83ca8b55cad6e23f9cb61015`.
The unchanged matcher also fails deterministically against the captured wrapped diagnostic.

Vetoable decision RR105-WINDOWS-ZIP-DIAGNOSTIC: accept whitespace between the exact message
words and independently require the typed InvalidDataException error identity. Keep nonzero
exit, no output before refusal, every malformed/oversized/count boundary and all30 existing
pure Windows controls. Do not alter console width, environment, production workers, limits,
timeouts or exception behavior. WrappedCRLF, unwrapped andLF diagnostics must pass;
wrong exception, wrong message, absent identity and empty output must fail.

Only one PPTX test changes. The source branch starts from fresh main and normally merges
exact1ef. Fragment[] is maintainer-only. Current producer2400, sealed59-case suite03, ce92,
all retired-helper guards and the six native exclusions are unchanged. Native/registry
acceptance and chart-reference implementation remain outside this test-only repair.

Focused actual PowerShell control and required mapped checks are pending at this source
checkpoint. Root alone owns PowerPoint and any CI observer/dispatch; this branch opens no
Office instance, registers no fonts, runs no UI, and publishes no release.
