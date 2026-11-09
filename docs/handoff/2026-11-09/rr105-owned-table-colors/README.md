# RR-105: owned table-color replacement

Source/tests only; no Office, font registration, native pass or release. This lane starts from freshly fetched main9545016583ccfa151077cda4d51043ac6505a140, normally fast-forwarded to integration1ef0e17a58198defa34cd515ad7078d56a7d97d0. The retired `packages/pptx/test/native-table-colors.ps1`, old table runner/comparator entrypoint, generic worker caps and all generation witnesses remain unchanged.

The original control requires the complete original six slides with one editable two-by-two table each: 24 cells observed in original, saved/reopened and edited/reopened phases (72 cell observations), every character's expected run color, actual `Native ` prefixes on cell(2,1) on all six slides, two SaveCopyAs derivatives, three read-only opens, three owned closes, 18 PNGs and exact original/reopened PNG identity. The unchanged maintained comparator imports original/saved/edited archives and does two further export/import cycles each: nine imports / 54 slide imports. Those reexports check current cell text, not formatting, geometry or raster equivalence.

Vetoable decisions:

- RR105-TABLE-V2-01: use a new externally SHA-pinned profile, wrapper and worker. Bind unchanged source/runtime/generator/legacy-worker identities separately from the new clean controller Git revision and exact code files. Never rewrite raw reports or generation metadata to make the old entrypoint accept new code.
- RR105-TABLE-V2-02: all native inputs open read-only; edits stay in the owned in-memory copy and SaveCopyAs writes only fresh derivatives. Default wrapper execution and `-ValidateOnly` perform pure validation only. COM requires explicit coordinator-authorized `-RunOffice` after source review and a fresh global-zero observation. All Office operations go through a failure latch; failure forbids subsequent Office cleanup calls.
- RR105-TABLE-V2-03: retain one unchanged bounded process supervisor, default 45 seconds and maximum 60 seconds. It may terminate only its exact owned PowerShell worker on timeout, never Office. No UI automation, Office process termination, attachment, cleanup retry or native retry is introduced.

New files are `table-profile.mjs`, `run-table-profile.ps1`, `compare-table-profile.mjs` under `scripts/native-acceptance/`, and `native-table-colors-v2.ps1`, its pure checker and discovered `.mjs` test under `packages/pptx/test/`. The adapter binds actual three-phase lifecycle, independent identities, owned paths and captures before calling unchanged `compareNativeTableColors`.

The source has no frozen revisions or workstation paths in executable logic. Freeze a clean controller before preparation; changing its HEAD, dirty state or recorded bytes invalidates the profile. Preserve that worktree while using the profile. The profile also binds exact Node24 executable bytes, installed runtime bytes, all original suite files, the source document, generation receipt and worker/process-helper snapshots. Prepared output must be a new sibling outside every source/runtime root.

Preparation (Office-free):

```sh
node scripts/native-acceptance/table-profile.mjs prepare --suite "<immutable suite>" --producer "<clean producer>" --legacy-worker "<clean legacy PPTX package repository>" --consumer "<sealed installed consumer>" --output "<fresh output>"
```

Retain the returned profile path and SHA externally. The PowerShell wrapper verifies that pin, Node bytes and the clean controller HEAD/files before loading the Node contract. Its default/`-ValidateOnly` path starts no worker or Office. Future coordinator-only execution adds `-RunOffice`; the resulting evidence still requires the separate Office-free comparison and actual visual/supervisor review.

```powershell
& ./scripts/native-acceptance/run-table-profile.ps1 -Envelope '<prepared profile>' -EnvelopeSha256 '<external SHA256>' -NodeExecutable '<pinned Node24>' -ValidateOnly
# RunOffice is deliberately not present above.
```

Development evidence is retained outside the source checkout at `C:/opf-work/n034-table-evidence-01`. The initial pure check failed because inherited PowerShell7 module paths prevented Windows PowerShell from finding Get-FileHash; the package test now uses the existing maintained child-environment helper. The next pure failure exposed a fake application constructor that did not inject the requested create-stage failure; the fake constructor was corrected without changing the production latch. Both RED logs remain literal. The expanded actual-source managed-object controls pass72 cases, including each Open/SaveCopyAs/capture/edit/Close/Quit failure, foreign presentations, wrong identity/read-only/count/text/color, stale outputs, ZIP/path bounds and no Office calls after each failure. Six Node test groups additionally cover canonical source/identity/path/pin mutations, separate controller bootstrap, all three native phases and deliberately modeled failures at every one of the nine imports. None is genuine Office output.

Required mapped qualification and final source identities will be recorded before publication. Physical table execution remains unrun and coordinator-owned. The four seven-slide chart cases and explicit-Arabic glyph blocker remain separate; no excluded case is silently dropped or made generically eligible.

A local PowerShell tracking-row edit selected a character instead of the single row and produced an invalid transient file; it was preserved outside source and restored from exact HEAD before applying the two intended tracking edits. The final burndown diff is one existing row extension plus one append-only progress line. This did not affect runtime or tests.

The original724 candidate and its full mapped run remain immutable in the first worktree. A separate fresh-main worktree normally aligned to724 carries two reviewed follow-ups: Windows case-aware output/source separation is now checked both before preparation writes and on every bind; descriptive PowerPoint version, executable path/version/hash and Windows build are restored through the same latch. Unavailable optional descriptive fields remain null with an explicit metadataUnavailable list. New getter-failure controls exposed PowerShell returning null for a throwing managed property getter; required version/path values are validated and unavailable RGB is rejected before null could convert to black. These are managed-control observations, not claims about a real Office failure. The expanded pure source controls pass79 cases; new metadata probes and discard setters are included in no-further-Office checks. The next mapped result is distinct from the original724 outcome. Physical execution is still unrun.
