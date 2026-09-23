# Windows native compatibility weekly handoff

Original checkpoint: September 21, 2026. The September 22 continuation below
records harness hardening without replacing the reviewed September 21 native
evidence. Verification uses Node **24.21.0** and core's declared pnpm
**10.33.2**. Historical Node20 instructions are superseded. Raw local attempts
remain preserved; public evidence is linked below.

## September 22 native mixed-edit checkpoint

The bounded mixed-size table edit/save/reopen proof now has an accepted native
result. Evidence is in
[windows-native-mixed-edit-20260922](evidence/windows-native-mixed-edit-20260922/README.md).
Both attempts used fresh output directories, Windows PowerShell 5.1,
PowerPoint 16.0.20326.20158, source SHA-256
`f92c5d5565afa1d03fc6df0cdc8d482771d5ebd5a5403f7a888f75e2ad020a51`, the four
canonical Carlito faces and registration flags `0`. Each ran once, completed its
owned Office and font lifecycle, and left PowerPoint with no open presentation or
dialog. Neither attempt was retried in place. Offline controls and both audits
ran under Node 24.21.0.

- **Attempt 01 failed its audit and is preserved as a failure** (harness from
  PPTX54 merge `86afe6c`). PowerShell coerced the `[string]` stage error parameter
  `$null` to `''`, so all 1,496 stages recorded `"error":""`. The harness's
  post-edit reassignment of `Font.Name/Size/Bold/Italic` also wrote explicit
  `i="0"`/`b="0"`, which made the whole-cell `Font.Italic` tri-state read `-2` in
  both the edited and reopened phases. Every run, every probe and the saved XML
  were non-italic.
- [PPTX55](https://github.com/OpenPresentation/opf-pptx/pull/55) (head
  `0f3a3da6402261610b49774cff5da37716575ece`) makes both stage writers emit JSON
  `null`, adds pure-regression assertions for that, and changes the edit to
  replace text only. Audit gates are unchanged. Linux and Windows CI passed and an
  independent review approved it. It merged as
  `60e33916ddd0cf5ecd88ff61d882eaebab4c988e`; the merged tree is identical to
  the reviewed head that attempt 02 ran.
- **Attempt 02 passed** the independent audit with 0 failures (worker 4.4 s,
  5.9 s preflight to supervisor). Content, five-run and seven-probe styles, and whole-cell Carlito/18/bold `-2`/italic `0` all held
  in the original, edited and reopened phases. Outer geometry was
  43.2/43.2/873.6/118.8 within float precision. Native lines were
  `[0,92) [92,194) [194,245)` in all three phases. The saved and reopened package
  hashes match, and the source was unchanged. The root reviewed the reopened
  full-slide PNG and found no clipping.

This accepts one finite native edit/save/reopen of this table. The estimated
preview's `[0,78) [78,172) [172,245)` still differs from native. Preview/native
parity, general mixed-table layout, font embedding and per-glyph font identity
remain unaccepted.

Font embedding is next. The Gate E fixture's slide runs and theme major/minor
fonts are `Aptos Display`/`Aptos`, so the pre-SaveAs allowlist would reject it
before any save. A Carlito-only fixture is being prepared offline. The embed
attempt runs only after that fixture's PR is reviewed and its CI passes.

## September 22 checkpoint

The continuation hardened native harnesses and their offline controls. No Office call or font API ran,
and the real mixed-table edit/save/reopen and font-embedding proofs remain
pending. PPTX51 merged as `842214346f49caf61b94eb842c19f6d78fc6d4d7`,
PPTX52 as `09baff8df42db5dfed7cf8a9450b8ee9f24dab1f`, and PPTX53 as
`2782479a913a272950db6addb7af5ea69ceb4051`. They add the portable picture
comparator, bounded font-embedding harness, and offline mixed-size
edit/save/reopen harness respectively.

[PPTX54](https://github.com/OpenPresentation/opf-pptx/pull/54) hardens the two
new native audits. Its branch is
`codex/windows-native-harness-hardening-20260922`; reviewed head
`d84ac917d13db56941e299537848ac861c26adfa` contains implementation commit
`ce074879` and documentation commit `d84ac917`. Independent review approved
the change. Local validation passes 26 mixed controls, 15 font controls, 27
independent rejection cases, both Windows PowerShell 5.1 pure regressions,
typecheck, validation, the ordinary suite and the packed suite. CI run
[35757268642](https://github.com/OpenPresentation/opf-pptx/actions/runs/35757268642)
passed on both Linux and Windows. The PR merged as
`86afe6c51f8238c3db0450c90443e91378531dc8`. Its post-merge run
[35758319118](https://github.com/OpenPresentation/opf-pptx/actions/runs/35758319118)
was still running when this checkpoint was written. See the merged
[mixed-edit instructions](https://github.com/OpenPresentation/opf-pptx/blob/86afe6c51f8238c3db0450c90443e91378531dc8/docs/native-mixed-edit.md)
and [font-embed instructions](https://github.com/OpenPresentation/opf-pptx/blob/86afe6c51f8238c3db0450c90443e91378531dc8/docs/native-font-embed.md)
for commands, audit boundaries and immutable output requirements.

Core111 merged as `3c5048522714365a41d9b5b9ba81620affae718b`; post-merge runs
35662159658 and 35662159864 passed. Renderer30 merged as
`c8d7d5ca1f67a7b39f70c7c4bd14577a865b175b`; post-merge run 35661504472 passed.
Repository mains before this documentation update are core `d96c791004a4ec71a7f2af6e06f65c4f13571b9a`,
PPTX `86afe6c51f8238c3db0450c90443e91378531dc8`, renderer
`c8d7d5ca1f67a7b39f70c7c4bd14577a865b175b`, and editor
`5620230086437165bcf2242cbfe2d781bb38ac87`.

| Work | Repository / branch | State at checkpoint |
| --- | --- | --- |
| [PPTX54](https://github.com/OpenPresentation/opf-pptx/pull/54) | `opf-pptx` / `codex/windows-native-harness-hardening-20260922` | Merged as `86afe6c51f8238c3db0450c90443e91378531dc8`; reviewed head passed Linux and Windows CI |
| This handoff | `opf` / `codex/windows-native-handoff-20260922` | Publication branch for this documentation-only update, based on main `d96c791004a4ec71a7f2af6e06f65c4f13571b9a` |
| [core94](https://github.com/OpenPresentation/opf/pull/94) | `opf` / `cursor/placeholder-geometry-9f55` | Draft, conflicting, deferred geometry work |
| [PPTX42](https://github.com/OpenPresentation/opf-pptx/pull/42) | `opf-pptx` / `cursor/placeholder-geometry-9f55` | Draft, conflicting, deferred geometry work |
| [renderer27](https://github.com/OpenPresentation/opf-render/pull/27) | `opf-render` / `cursor/placeholder-geometry-9f55` | Draft, conflicting, deferred geometry work |
| [editor25](https://github.com/OpenPresentation/opf-editor/pull/25) | `opf-editor` / `cursor/placeholder-geometry-9f55` | Draft, conflicting, deferred geometry work |
| Native HF | No current open PR | Deferred scope item; no active implementation assigned here |

At the September 22 inventory, there are no other open PRs across the four repositories. Old `codex/windows-*`
evidence branches are merged and must not be used as restart bases; squash
merges mean their source tips may differ from main. The old editor branch has
zero unique commits. Two untracked `font-gate-preflight` files in the old local
resume workspace are historical scratch only.

## Merged resumed work

All ten PRs below are merged and passed their required CI at the recorded heads.

| PR | Change | Merge commit |
| --- | --- | --- |
| [PPTX46](https://github.com/OpenPresentation/opf-pptx/pull/46) | Bounded minimal picture worker | `647159ac886a3e472c4d5f028aa19aaea3257b60` |
| [core103](https://github.com/OpenPresentation/opf/pull/103) | Minimal native picture evidence | `009ba028e74c512a80eadd9b4c623d01cd43402c` |
| [PPTX47](https://github.com/OpenPresentation/opf-pptx/pull/47) | Picture/furniture editing controls | `8c7908e7eb02cb4dda52d2fac951c919c60841a5` |
| [core105](https://github.com/OpenPresentation/opf/pull/105) | Picture/furniture edits and notes ordering | `84e914710520a7b0e777fce30e5758ee64a64924` |
| [PPTX48](https://github.com/OpenPresentation/opf-pptx/pull/48) | Plain native tab and notes controls | `897b89624b57def84b903a5d64061c4f670640bd` |
| [PPTX49](https://github.com/OpenPresentation/opf-pptx/pull/49) | Bounded Carlito edits and registry fixture | `9e8a38198519b4d4a18d163928833f2509550687` |
| [core106](https://github.com/OpenPresentation/opf/pull/106) | Native tab/font evidence | `3847f712ccb2379952bcc8ab7c9fdbaedfd0a4ce` |
| [core108](https://github.com/OpenPresentation/opf/pull/108) | Finite native tab-coordinate analysis | `9b277e140863389ae06c681a529fac32df8c912c` |
| [core109](https://github.com/OpenPresentation/opf/pull/109) | Read-only native mixed-table evidence | `b2711549eba48a52f036afd02ee52b761fa0a5f9` |
| [core110](https://github.com/OpenPresentation/opf/pull/110) | Preserve rich tabs as layout controls | `4f7a4bd494f1a873319eff897423d301d1cfc9d6` |

## Final wrapup deliveries

[Renderer30](https://github.com/OpenPresentation/opf-render/pull/30), merged as
`c8d7d5ca1f67a7b39f70c7c4bd14577a865b175b`, preserves core tab advances and exact
source spans while keeping ordinary unmeasured rich runs in naturally shaped
chunks. Root and independent review, typecheck, validation, the full renderer
suite (805 golden slides / 126 decks), and focused measured/estimated browser
checks pass on Node24.21.0 and Edge153. The CI core checkout is pinned to merged
core110. Its [first CI run](https://github.com/OpenPresentation/opf-render/actions/runs/35660404111)
passed rendering/browser checks but failed later because the older PPTX checkout
lacked `test/color-ref-export.mjs`. The final CI-only commit aligns PPTX/editor
with core110's passing coordinated checkpoints, respectively
`fcc006a6887c549a96a3bc8bbdb957cc54fe67dd` and
`476191e28e6f5f5ec32146aeb416f5286b4d0570`, without skipping checks or changing
rendering code. The release owner received the exact coordination changes, and
post-merge run 35661504472 passed. The initial failed run remains preserved.

The [native font inventory bundle](evidence/windows-native-font-inventory-20260921/README.md)
and this handoff are published through [core111](https://github.com/OpenPresentation/opf/pull/111),
merged as `3c5048522714365a41d9b5b9ba81620affae718b`; both post-merge
runs passed.
They preserve the last observation and remaining work. Its 37 files
pass the offline verifier; manifest SHA-256 is
`18ca9125a22bb65c79bc1c7a788a3bf5a2ab2ff41248c81d158b1833a1f8085d`.
The native font allowlist remains failed. The original parent failure is intact,
and the corrected lifecycle interpretation is labeled as an offline audit.

These concluded the September 21 native work for the owner-requested weekly
pause. The September 22 continuation above records subsequent harness work;
the next Office proofs remain pending. Merging source changes does not publish
an npm train or deploy a site.

The renderer's first full-suite invocation could not spawn a child process
under the sandbox (`EPERM` at 0ms). The same suite passed with process creation
permitted; no test budget or golden changed. Chromium's DOM preserves the tab,
while Selection serializes it as a space. Browser checks retain the separate
0.1 reference-pixel gate. The reviewed full-slide PNG contains all three lines
without visible clipping; this is not native parity.

## Frozen results and finite limits

- [Plain native tabs](evidence/windows-native-tabs-fonts-20260921/README.md)
  retain content and save/reopen positions, but the unchanged **0.02pt** gate
  fails: target error `0.022655487060546875pt` and tab/literal difference
  `0.022678375244140625pt`. Do not add offsets or relax the tolerance.
- [Picture/furniture controls](evidence/windows-native-edits-20260921/README.md)
  pass finite edits, current-content provenance and cleanup. Crop import reports
  its limitation; Change Picture changes geometry; longer edited furniture
  clips. These results do not establish general reflow or native `p:hf` support.
- Production notes ordering opens/saves/reopens. Reordered diagnostics are
  refused at open (`0x80070570`); preserve production ordering.
- The [mixed-table observation](evidence/windows-native-mixed-table-20260921/README.md)
  retains all 245 characters, the literal tab and five rich runs. Native
  soft-line boundaries are 92/194 versus the old estimated preview's 78/172,
  and native default tab spacing is 72pt. This is not edit/save/reopen or
  browser/native fidelity acceptance.
- The four-face Carlito native edit control passes text/style persistence,
  bounds and raster stability. The later read-only inventory reports **Carlito
  plus Aptos**, so the permitted-font allowlist fails. No embedding, physical
  face identification or per-glyph identity claim follows.
- A local offline reimport diagnosis finds that the plain-shape importer drops
  rich styling before heading inference. Exact text is retained. No production
  importer repair or new native-edit claim was made from that diagnosis.

The last owned Office attempt confirms one presentation close and four font
removals. The subsequent host inspection showed an empty workspace. No owned
presentation, helper or temporary font registration is outstanding. This dated
observation does not prove the host is ready for a future session.

## Evidence and release boundaries

Source-linked integration was tested with core head
`fc3c36e929492d22b5f5af944a6ca3a12a9784d9` (merged as core110) and the renderer
companion in PR30. Its tests do not rewrite or revalidate the frozen registry
consumer: core0.11.0, CLI/renderer0.9.0, PPTX0.9.1 and editor0.8.0, with lock SHA
`4868f13254e3e681566164da8427d3716ceaa025435e4606e5e15fc8a87bc305`.
Keep source, packed-candidate and registry claims separate. No new package
version was published by this native task.

The future inventory worker02 is preserved in the bundle at SHA
`fd279c971ba9447770931c8972cc5a4d2b21df9d77c40d90135e571db7ce85ed`.
Its executed checks cover JSON-array parsing and negative controls only; it has
never run Office. The raw parent parser failure remains available alongside
the offline correction. The v2 audit only changes duration serialization from
1.3689453 to 1.368945 seconds; it does not change a result or gate. Superseded
generator/report hashes are recorded in `generation-corrected.json`; their
original bytes remain preserved locally outside the compact bundle.

Release management, package publication, sites and public-app issue88 belong
to the separate main task. Geometry/HF drafts core92/94, renderer27, editor25,
PPTX41/42 and site40 were not changed. Archived shaping stays archived. The
overall compatibility goal remains incomplete.

## Next-week restart prompt

Resume Windows native compatibility from fresh `origin/main` worktrees. Do not
resume an old evidence branch, and do not treat squash-source differences or
the two historical `font-gate-preflight` scratch files as pending work. Refresh
repository and PR state first. Confirm PPTX54's final CI and merge receipt, then
run its offline controls from the reviewed merged source before any native use.
Use Node24, Windows PowerShell 5.1 and each repository's declared package
manager. Preserve dirty work, original failures and the separate registry
consumer.

The bounded mixed-table edit/save/reopen proof passed on September 22 (see the
native mixed-edit checkpoint above). The next native proof is the bounded
font-embedding gate, and only with a reviewed Carlito-only fixture: the Gate E
fixture uses Aptos in its slide runs and theme fonts and would be rejected
before `SaveAs`. Use fresh output directories and the reviewed mixed source SHA-256
`f92c5d5565afa1d03fc6df0cdc8d482771d5ebd5a5403f7a888f75e2ad020a51`.
Both harnesses require the four canonical Carlito face hashes and numeric
registration flags `0`. Mixed-edit uses `SaveAs(..., 24, 0)` and requires content,
style, outer geometry within 0.02pt, and matching edited/reopened native line
intervals. The known preview mismatch is not a failure. Font-embed requests
`SaveAs(..., 24, -1)` on its owned presentation only.

The embedding worker must check its permitted-font inventory before
`SaveAs`; unexpected Aptos blocks `SaveAs` and must be reported as the failed
gate. This is a runtime harness rule, not a new preflight approval requirement.
Do not infer preview/native parity, general export below 0.02pt, embedded-font
success, or physical/per-glyph font identity from preparation or font-family
properties.

Inspect the current host before any Office call. Root alone owns Office and
temporary font registrations, one reviewed bounded worker at a time, with a
45-second default and 60-second maximum. A timeout may terminate only the owned
helper. Never kill Office, call `Application.Quit`, close unrelated
presentations, change Office security, or retry automatically. Keep the 0.02pt
native and 0.1px browser gates unchanged. Leave `p:hf`, the deferred geometry
drafts and Native HF untouched.

The published train remains core0.11.0, CLI/renderer0.9.0, PPTX0.9.1 and
editor0.8.0. Do not publish packages or deploy sites from this continuation.
Coordinate any later release work with its owner; public-app acceptance remains
separate from the Windows native task.
