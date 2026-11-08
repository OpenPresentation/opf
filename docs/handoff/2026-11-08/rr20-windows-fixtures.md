# RR-20: Windows qualification fixture portability

This fresh-main PR fixes two confirmed test-environment gaps across the PPTX and
editor packages. It changes no production/native helper, renderer, export,
privilege, skip, CI job, assertion threshold or actual Office state.

Both aliases in `packages/pptx/test/keynote-registry-runtime.mjs` target
directories. Their explicit link type is now `junction` on Windows and `dir`
elsewhere. The existing `aliased` verifier rejection, `normal directory`
consumer rejection, unlink and restore cleanup remain. Added directory and
realpath identity assertions prove the intended substitution before testing
those original guards. Neither alias is a file-link substitute.

The editor launcher now uses the existing
`windowsPowerShellEnvironment(process.env)` helper. It removes inherited
PowerShell 7 module paths only in the PowerShell 5 child. The parent environment
and all seven original fake-Office case assertions remain unchanged; no actual
PowerPoint process or COM class is created by these controls.

Vetoable decision: keep this one Windows fixture PR limited to those two real
directory aliases and the child-only environment call. Other standalone helper
links are outside this confirmed failing path. Preserve their future checks
without broad speculative fixture changes.

Actual Node 24 before/after evidence is retained. The original first alias fails
with Windows `EPERM`; after correcting only that alias, the original second
alias independently fails `EPERM`. Both corrected aliases then pass the entire
existing registry/archive/graph/evidence/no-import fixture. The original editor
launcher fails `Get-FileHash` under the inherited PowerShell 7 module path; the
corrected launcher passes all seven fake-Office controls under the same parent
environment. Parent `PSModulePath` is exact before/after. Required mapped checks
and final receipts will be recorded before the push. Final Windows CI remains
required; these are offline guard controls, not native acceptance.
