# PowerPoint compatibility follow-up

On September 15, 2026, the project owner requested that PowerPoint acceptance
gaps be split from the completed portable work and tracked on the roadmap.
This supersedes earlier draft wording that made native Office acceptance a
prerequisite for merging the shared header/footer implementation.

Core layout, browser preview, editing/undo and controlled XML export/reimport
can be accepted independently when their source, fresh-package, visual and CI
checks pass. This does not certify native PowerPoint behavior. Package release
and website adoption still require their own installed-registry verification.
Browser font-metrics failures remain separate engineering gates; moving Office
work here does not turn those failures into passing checks.

## Remaining acceptance work

| Work | Current evidence and limitation | Acceptance required |
| --- | --- | --- |
| Recover the Windows Office test host | The [latest native handoff](https://github.com/OpenPresentation/opf/pull/71#issuecomment-5673073461) requires user-reviewed recovery. Cleanup after the minimal picture control was not confirmed. | The Windows owner confirms recovery before further COM automation. No process killing or retries based on historical state. |
| Open, save and reopen exported pictures and furniture | Nine exported files refused to open; valid ZIP/XML and portable browser tests did not establish Office acceptance. The missing slide-master declaration fix is already published in PPTX 0.8.0. | Re-run minimal and complete picture/header/footer controls after recovery, save/reopen in Office and inspect visible content and package changes. |
| Preserve furniture provenance through native edits | Controlled XML tests cover current text/images, cleared fields, missing/duplicate/changed tags, slide reordering and metadata disagreement. Actual Office handling of `p:cSld/p:custDataLst` and `OPF_FURNITURE_V1` is unverified. | Native edit/save/reimport controls retain current content and generated intent without resurrecting old words. Review inheritance, empty/false definitions and damaged-tag fallback. Record formatting/geometry/crop reflow limits. |
| Native tab positions and mixed-size table paragraphs | Historical maximum tab drift is 0.0226745605469pt against a 0.02pt gate. Soft-wrapped mixed-size table runs can require conflicting 64px and 48px tab stops within one native paragraph. | Resolve the shared/native representation, preserve literal source whitespace and editable rich runs, and pass the unchanged native tolerance. No offsets, silent hard breaks or relaxed gates. |
| Native font and glyph identity | Family/style names do not prove which physical font supplied each glyph. Browser shaping and paint evidence is recorded separately. | Record permitted font bytes, actual substitutions, per-glyph physical identity where available, editable text and full-slide native comparisons on supported platforms. Restricted Aptos 4.40 remains excluded without compatible explicit permission. |
| Notes-master element order | The independent Open XML SDK rejects production ordering; diagnostic reordered copies pass, but upstream warns about PowerPoint behavior. | Compare both controlled outputs in recovered Office before changing production order. Preserve the existing output until native evidence supports a correction. |

For each completed item, retain the exact source/package identities, application
and OS versions, font hashes/licenses, original failures, native files and
reviewed images. Distinguish XML validity, semantic reimport, native editability
and pixel agreement in the result. Native findings do not invalidate separately
passing portable workflows, and portable results do not close native findings.

The broader [font roadmap](font-roadmap.md) and
[ecosystem objective](ecosystem-objective-2026-09-09.md) remain open. This split
does not change the default shaping backend or claim general Office parity.
