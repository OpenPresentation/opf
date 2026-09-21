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
| Recover the Windows Office test host | The owner confirmed recovery on September 21. Fresh [minimal native picture controls](../evidence/windows-native-picture-20260921/README.md) completed with exact owned closes on PowerPoint 16.0.20326.20158. Historical September 10 cleanup remains unconfirmed. | Continue one bounded worker at a time; after any block preserve evidence and inspect the host. No process killing or automatic Office retries. |
| Open, save and reopen exported pictures and furniture | Minimal pictures and [native picture/furniture edits](../evidence/windows-native-edits-20260921/README.md) now pass their finite lifecycles with reviewed slides. Crop import reports its limitation; Change Picture changes geometry and longer edited furniture text can clip. | Broader image/crop/reflow acceptance requires its own reviewed native controls. These results do not retrospectively pass the historical nine-image failures. |
| Preserve furniture provenance through native edits | [Nine semantic cases and the UI replacement control](../evidence/windows-native-edits-20260921/README.md) retain current text/images, explicit empty/false values and safe fallback for duplicate/missing/changed tags or metadata disagreement after actual Office edits/save/reopen. Deleted content is not resurrected. | This bounded current-content/provenance gate passes on the recorded host; general formatting, geometry and arbitrary round-trip fidelity remain separate. Native `p:hf` remains roadmap work. |
| Native tab positions and mixed-size table paragraphs | The [fresh plain native tab control](../evidence/windows-native-tabs-fonts-20260921/README.md) reproduces 0.022655487060546875pt target error and 0.022678375244140625pt tab/literal difference against 0.02pt. Save/reopen drift is zero. Mixed-size soft-wrap representation remains unresolved. | Resolve the shared/native representation, preserve literal source whitespace and editable rich runs, and pass the unchanged native tolerance. No offsets, silent hard breaks or relaxed gates. |
| Native font and glyph identity | One [four-face Carlito native edit control](../evidence/windows-native-tabs-fonts-20260921/README.md) passes exact text/style persistence, zero bounds drift and stable rasters; all owned registrations were removed. Family/style names and licensed input hashes do not identify every physical glyph font. Embedding was explicitly disabled. | Record actual substitutions and per-glyph physical identity where available; establish embedding separately. Browser shaping/paint remain separate. Restricted Aptos 4.40 remains excluded without compatible explicit permission. |
| Notes-master element order | [Production ordering opens/saves/reopens](../evidence/windows-native-edits-20260921/README.md). Both the original reordered diagnostic and an isolated XML reorder retaining production ZIP order are refused by PowerPoint with 0x80070570. Original failures and separate empty-host inspections are preserved. | Preserve production ordering. SDK validity does not justify switching to the refused order; any proposed correction needs new native evidence. |

For each completed item, retain the exact source/package identities, application
and OS versions, font hashes/licenses, original failures, native files and
reviewed images. Distinguish XML validity, semantic reimport, native editability
and pixel agreement in the result. Native findings do not invalidate separately
passing portable workflows, and portable results do not close native findings.

The [offline tab-coordinate analysis](../evidence/windows-native-tab-analysis-20260921/REPORT.md)
recomputes the nine retained plain-tab pairs from their exact JSON and saved
DrawingML. Saved coordinates and their COM projections retain finer positions
than the observed tabbed-character starts, which match a 0.05pt-compatible
pattern for these inputs. The tested base lies on that grid, so relative and
absolute snapping remain indistinguishable; no engine cause or compensation is
established. The 0.02pt native gate still fails, and the separate 0.1px browser
gate is unchanged and unevaluated by this analysis.

The broader [font roadmap](font-roadmap.md) and
[ecosystem objective](ecosystem-objective-2026-09-09.md) remain open. This split
does not change the default shaping backend or claim general Office parity.
