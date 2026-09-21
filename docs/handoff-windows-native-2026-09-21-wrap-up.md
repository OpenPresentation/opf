# Windows native compatibility weekly handoff

Checkpoint: September 21, 2026. This records the reviewed Windows native work
for the owner-requested weekly pause. New verification used Node **24.21.0**
and core's declared pnpm **10.33.2**. Historical Node20 instructions are
superseded. Raw local attempts remain preserved; public evidence is linked below.

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

[Renderer30](https://github.com/OpenPresentation/opf-render/pull/30), head
`a73d739c6902f3c28d9e879749321b583fe9767d`, preserves core tab advances and exact
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
rendering code. The release owner received the exact coordination changes.
Fresh CI on this corrected head and the PR merge receipt are authoritative
for final acceptance; the initial failed run remains preserved.

The [native font inventory bundle](evidence/windows-native-font-inventory-20260921/README.md)
and this handoff are published through [core111](https://github.com/OpenPresentation/opf/pull/111).
They preserve the last observation and remaining work. Its 37 files
pass the offline verifier; manifest SHA-256 is
`18ca9125a22bb65c79bc1c7a788a3bf5a2ab2ff41248c81d158b1833a1f8085d`.
The native font allowlist remains failed. The original parent failure is intact,
and the corrected lifecycle interpretation is labeled as an offline audit.

These conclude this native task's weekly scope. The owner requested a pause
after delivery; no new Office run or investigation is scheduled. Merging source
changes does not publish an npm train or deploy a site.

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

Resume Windows native compatibility from this handoff and linked evidence.
Refresh repository/PR status and release metadata before using historical
commands. Use Node24 and the declared package manager. Preserve dirty work,
original failures and the separate registry consumer. Confirm the wrapup PR
receipts and coordinate any later release work with its owner.

Choose one bounded follow-up from the remaining native tab tolerance,
mixed-table representation or font-identity/allowlist gaps. Preserve the 0.02pt
native tab and 0.1px browser gates. Unexpected Aptos remains unresolved and
embedding stays blocked. Any plain-shape rich-text importer repair needs its
own scoped review.

Inspect the current host before any Office call. Root alone owns Office and
temporary font registrations, one reviewed bounded worker at a time. Never
kill Office, quit the application, close unrelated presentations or retry a
blocked operation automatically. Future worker02 is preparation, not native
evidence. Coordinate shared CI/release changes; npm publication, sites and
public-app acceptance remain separate from this native task.
