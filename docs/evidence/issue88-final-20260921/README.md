# Public workflow acceptance — 21 September 2026

The current public documentation is accepted. The full app acceptance and
broader developer-ready goal remain open. This ledger separates merged source,
platform CI, published packages, canonical browser results and native gates.

The published train remains core **0.11.0**, CLI/renderer **0.9.0**, PPTX
**0.9.1** and editor **0.8.0**, on Node 24. These follow-ups publish no npm
packages and change no schema, catalog, example corpus, renderer golden or font
asset. Registry checks and controlled import/export do not certify native Office.

## Accepted source and current gates

| Surface | Source and acceptance |
| --- | --- |
| Core current guides | PR93/97/98 accepted through `b1ff81db6f8714b0db1a98bde482ed8a64d0ccc9`; OPF, macOS/Windows CLI and coordinated installed-package/browser CI pass. |
| Inspector/Author app45 | Accepted `e37e0da19671178da482bbe52cfd642419b670b5`; Linux/Windows pre/post-merge CI pass. Exact canonical READY deployment verified, but full browser run passed **14/18**. See retained failure report below. |
| Explicit paste formatting app46 | Accepted `c558dcc3a2e362bc238eb433a2db97fa682dfcc8`, identical to reviewed tree `21a27c9fa459f04db24dc2759acc1bb6d9ed93b8`; fresh local build/typecheck/622 unit/19 browser checks and Linux/Windows pre/post-merge CI pass, including an old-build control. Exact READY canonical deployment verified; fresh production browser run is **11/19**, with readiness failures. Full acceptance remains open. |
| Public documentation site | PR43/44 accepted through `a85bcc77d899ce9ba1df659548be564142c16120`; site CI and exact canonical READY deployment pass. **321 checks, 11 pages, 18 raw resources**, plus agent clipboard/skill bytes and real OPF/SVG/PPTX downloads pass. |
| Gallery | PR35/36 accepted through `f17e9ae5869669d5fbac3720f285652d0c37551c`; current ColorRef guidance and canonical docs-to-editor checks pass. |

[Canonical site evidence](site-production/README.md) binds current guide content,
complete manifest/source mappings, raw evidence bytes and reviewed visuals to
the accepted source and deployment. The full guide is 1,214,339 bytes with all
75 Markdown guides, six skills and 61 evidence links represented. Protected
preview browser acceptance is not claimed; the canonical deployment was checked.

## Independent installed-package evidence

[Current-entrypoint checks](current-entrypoints/README.md) resolve documented
public ESM exports inside the fresh registry consumer, and the CLI executable
from its published manifest. They record exact package versions, consumer lock,
resolved files and verifier hashes. Block insertion/duplication/removal,
preservation, history, stale guards, table contrast, CLI create/validate, and
six-skill installation/status/idempotence pass. The superseded direct-dist probe
is retained as preliminary evidence; it is not the public-export proof.

The [audit scope](current-entrypoints/audit-scope.md) distinguishes current
onboarding from historical introduction versions, dated evidence and actual
unsupported behavior. Repository prose updates do not alter CLI 0.9.0's
immutable bundled skill snapshot.

## App failures and follow-up boundaries

The [first complete canonical app report](app45-production/REPORT.md) retains
all four failures from the 14/18 run. Two reveal implicit paste formatting that
rewrote authored whitespace. The focused app46 fix disables that shared editor
option while retaining explicit Format Document and exact undo. The control
changes 302 bytes to 443 on the old build and retains all 302 on the fix; worker
observations distinguish real formatting from validation only.

The quote test stopped during font loading because its new helper applied a
five-second assertion before the existing twenty-second readiness check. App46
propagates that existing budget; footer/geometry/export assertions are unchanged.

The CRLF Author test applied built-in and document-local choices with exact
undo/redo, then failed to open its third suggestion popup. The original trace
shows the expected cursor, focused editor and hidden quick-input/suggestion
widgets. A single instrumented diagnostic passed but did not explain the
failure. **Author reliability remains unresolved**; the pass does not replace
failed acceptance. Raw code-buffer paste preservation also does not certify
byte-identical Author canvas edits or JSON-file downloads, which still serialize.

A separate [completion adapter review](author-completion-review/review.md)
proves that the current adapter passes general source diffs to a Monaco API
requiring a single-line completion range: 28 of 32 layout choices in the captured
fixture are rejected. A proposed split mapping reconstructs the intended source
in 256 design cases, but has not been implemented or accepted in a browser.
The requested loaded option is valid at the original position, so this concrete
range defect does not explain the separate missing-popup failure. The report
records the next source, undo and stale-edit regressions required.

The [app46 canonical report](app46-production/REPORT.md) retains the next
single run at the exact new deployment: **11/19**. Four failures stop at initial
schema diagnostics, two at initial canvas readiness, the LF Author popup remains
Loading, and explicit formatter readiness does not complete before its assertion.
No source mismatch is reported, but the focused warm-paste and narrow workflows
never reach acceptance. Slow/pending JS assets are observed in retained traces;
their cause and appropriate readiness contract are not established. Do not
blindly raise timeouts or label these unexecuted assertions as passed. The long
quote's restored original budget now passes its wide/portrait/export checks.

Earlier platform failures remain documented separately:

- Windows clipboard transport converts LF to CRLF. The observer checks the
  untouched string submitted to the real API and independently verifies transport.
- [Windows platform diagnosis](windows-platform-REPORT.md) records Monaco's
  intentional `listitem` role on Windows, versus `option` elsewhere. Exact labels,
  normal clicks and source assertions remain.
- [Linux preview diagnosis](preview-readiness-REPORT.md) records starter slides
  present before deferred preview replacement. Tests wait for exactly one SVG
  with the expected authored title; no sleep or forced action was added.

Final app45 Linux and Windows CI passed after those test corrections. That fact
is separate from the canonical 14/18 and 11/19 results and unresolved production gates.

## Remaining ecosystem goal

Native PowerPoint issue87 remains open, including host recovery, picture
open/edit/save/reopen, current-content provenance, tabs, notes-master ordering
and physical font identity/embedding. Do not retry Windows COM or kill processes
before owner-confirmed host recovery. Native `p:hf` remains roadmap work.
Renderer issue24 retains the unchanged **0.1px** gate. Font/script/IME/bidi
coverage, general deterministic repair and broader visual editor work remain.

Leave the five geometry drafts together and unmerged: core94, render27,
editor25, PPTX42 and site40. Native HF drafts core92/PPTX41 stay roadmap. The
three obsolete changelog drafts are closed with branches retained. The ColorRef
fixture move/golden expansion, optional schemeClr/theme writing and canvas
named-color fidelity remain later work. Issue88 remains open; completing it
would not complete the overall developer-ready or ecosystem goal.
