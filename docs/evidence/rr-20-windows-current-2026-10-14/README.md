# RR-20 Windows current-package native evidence — 2026-10-14

This is retained evidence from 17 selected native cases and four actual PowerPoint editing operations. The complete prepared suite has 58 cases; the index gives every case an executed or unexecuted disposition. **This is not global native acceptance, a registry qualification, or permission to publish or deploy.**

The owner explicitly authorized PowerPoint use for the remainder of the session, resumed after a physical Escape interruption, and authorized Git-based coordination with the release supervisor. Every native run used a fresh output directory and the maintained 45-second worker bound. Existing failures and their corrections are retained. No existing case was rerun to satisfy the later catalog-forwarding or picture-fit fixes.

## Exact qualification graph

The packed consumer is C:/opf-work/current-be40-gallery3-01/opf/artifacts/npm/consumer. Source heads:

| Package | Source revision | Installed manifest version |
| --- | --- | --- |
| core and CLI | be40eb5ab5c8df980c70d89fbdf42fa90e6cad82 | core 0.4.0-preview.11; CLI 0.1.0-preview.11 |
| renderer | d96c70ad86deeb69a6f4a18df78e659875b733a4 | 0.1.0-preview.11 |
| PPTX | 147346ce9174d48576963238852ff4e4c69ba48d | 0.1.0-preview.11 |
| editor | 7474315ee10d8ecce5d6bdb9cb4b5127f9cd38b1 | 0.1.0-preview.11 |
| Gallery | genuine registry package, committed lock integrity retained | 3.0.0 |

The preview manifest versions were produced by the maintained packed-consumer workflow. They are not renamed stable 0.20 packages. The CLI binary reports its compiled 0.19.0 version separately; the index retains the actual manifest/runtime hashes and original outputs. There is no registry-provenance claim for these preview artifacts.

Node is 24.21.0. PowerPoint executable build is 16.0.20430.20146, SHA-256 d402e97afb5dd21fc38e9e3c1afc90bb22eacae31078f41081f0b68ea00af3bb. Windows build is 26200.9457; the recorded registry ProductName is the legacy Windows 10 Home string. Worker processes use Windows PowerShell 5.1.26100.9444 with the inherited PSModulePath removed only from their child environment.

| Suite tooling | Sealed manifest SHA-256 | Cases / files |
| --- | --- | --- |
| b8364ac316fe09c168aa92c99581bcadc2e6cf0d | f16e73ad64a9ba2ab02e3241347c29e881fc6daa4956697ec4024f66fe12cf1b | 56 / 318 |
| 6eea890985ba918beba0f28776cebf8d15925912 | 4e1d82b2a7546ccab71913dcaab23fcae6b3f12e9c3afd249e5a6b19e32faf80 | 57 / 325 |
| 181bbf039a7f6324f1ebaf2af604b2a6f753b1f4 | 239443eccb435e228a854ece5ccbfbf03070240c1307450c293bc1e34ea68a8f | 58 / 336 |

Every sealed file length and SHA-256 was verified. Native worker source remains PPTX 147346ce9174d48576963238852ff4e4c69ba48d. Offline timeline/text comparisons use reviewed 59f055de81c947e6e032df2ec126f2fe57c16bcf, comparator SHA-256 b5f1828c98f8364abc7f06e39ee257844212f3f09f42c17991b54eff3a9077ee. Original runner/suite identities are retained rather than relabelled.

## Findings and corrections

- The list description style edit preserves its words and applies 36 pt red. The apparent missing title/main entries were an image-display artifact: actual pixels outside the description were unchanged. Only 2,558 pixels changed, at inclusive x94–252/y195–236. The enlarged description is an intentional overflow stress test, not a visual-fit acceptance claim.
- Both no-edit controls preserved their exact native raster files through save/reopen. The exact-description control uses the same input SHA-256 as the edited case.
- Metrics passed text/geometry and opt-in whole-range font descriptors. These descriptors do not identify physical glyph files or baselines.
- Both timeline comparisons initially failed because empty native connector/marker frames were counted as text. The reviewed comparator correction rechecked the retained reports successfully at the unchanged 0.02 pt tolerance. The original exit1 failures remain recorded.
- Catalog timeline, quote, bleed/card, generic table and selected title/media/custom layouts passed their maintained text comparisons. The bleed image reaches the slide edges and the card keeps its text padded. Full saved imports of the table/title/media/custom originals preserve source content, including the intended title edit.
- The six-slide dedicated table passed 72 cell observations, 978 character-color observations and the additional import/export cycles. Its worker exited0 without timeout. **Its worker does not emit cleanupConfirmed; the index leaves it null.** Its maintained finally closes the owned presentation. Aptos12 in the input XML and cached face metadata do not prove native physical font selection.
- Moving the inherited furniture slide changes actual PowerPoint section membership. Slide258 moves into Alpha, while its visible Gamma header remains literal text. The importer reflects those two native facts correctly. The blank footer, edited picture alt, reorder and whitespace are retained.
- Furniture flags retain per-slide suppression overrides; unused deck-level furniture may be omitted on import as documented. The additional furniture-layouts witness preserves the full source exactly across Text(furniture1), Two columns and Two columns(furniture1), including shared master center and local image/label/footer. A decoded pixel audit proves the shared center is present on all three slides despite repeated-image display artifacts.

## Actual manual operations

| Operation | Native result | Import review |
| --- | --- | --- |
| Image beside → Hero | Real layout menu selection, save and reopen recorded | hero; exact picture and words; slides2–3 unchanged; actual saved transforms retained. Authored notes keep their prior allocation, so no redesign-fit claim. |
| New Slide → Named regions | Slide4 first-body witness survives save/reopen | Bare named resolves catalogs.custom first. Body idx300 and bindRegions first allocation verified; no explicit pin is needed. Original3slides unchanged and empty picture prompt omitted. The earlier literal custom:named/pin assertion was too strict and is superseded. |
| New Slide → Text | Exact title/body survive save/reopen | Direct registered-Gallery import restores text layout and words; original3slides unchanged. |
| Change Picture → This Device | Exact sealed preview bytes survive save/reopen; pic idx500 retained | PowerPoint itself clears old alt. **Remaining defect:** native zero-crop stretch of a16:9 replacement into a2:1 frame imports implicit cover. Explicit block fit:stretch recovery must be verified by offline replay. |

The known core Node/CLI catalog-forwarding defect is also pending its fixed matching pipeline replay. Original CLI warning-bearing imports remain separate from direct imports with the exact installed Gallery explicitly registered. No native case needs to be rerun for those forwarding/fit-only fixes.

## Evidence and scope

[index.json](index.json) carries literal package/runtime hashes, source/tooling identities, seals, phase/action receipts, original artifact hashes and all58 case dispositions. The sibling cases and manual folders retain synthetic inputs, actual saved PPTX files, native PNGs, comparisons, full imports and diagnostics. The index references original Windows paths for reproducibility; all copied artifact bytes are independently hashed. The manual UI log is filtered to relevant test controls and excludes unrelated application/account information.

Roboto-family installation was not changed in this run; the existing authentic owned seven-face journal remains untouched. The Aptos cache inventory and family/subfamily names are read-only metadata, with no download, installation, registration or embedding. No font files are included in this evidence bundle.

No claim covers full catalog fidelity, physical font selection, baseline parity, preview-pixel equivalence, raster-equivalent reexports, registry artifacts, publication or deployment. Release/native acceptance stays with the supervisor until the matching forwarding and stretch replay results are reviewed.

The historical manual/new-custom-validation-composition.json did not resolve the named layout context before composing. Preserve its validation observation, but do not cite its geometry as named-layout evidence. The separate [resolved-context receipt](manual/new-custom-resolved-context-composition.json) calls resolveSlideContext on slide index3 with the registered installed Gallery, then composeSlide with that context’s slide/options: document custom named provenance, first allocation, empty second-region collapse, and zero context/geometry diagnostics. It uses portable text estimates and proves no native pixel parity.
