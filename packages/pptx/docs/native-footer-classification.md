# RR-86: bounded current-native literal footer classification

**Bounded importer implementation; source review and qualification remain separate gates.** This refines `keynote-footer-followup-proposal.md` using the actual maintained A/B control outputs. It concerns semantic import classification only. The separately proposed `footerText` export choice, native footer visibility/paint order, notes-page field loss, typography and native Header/Footer controls remain separate work.

## Evidence and exact identity

The maintained control inputs differ only by removal of the sixteen selected slide-local literal `ftr` binding tokens. The other 244 uncompressed parts remain exact. Root's lifecycle report attributes K08's A occlusion/B visibility after native save/export/reopens to that one-variable control, within this fixture only. This design performed no native actions and does not upgrade the attempt result templates or claim general native acceptance.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| A input `opf-keynote-footer-controls-61-01/variants/native-footer.pptx` | 172283 | `c51e690ca7a895ebd25a41585a2a51e532fcbb5ef86c79e3447b58a269ed47fe` |
| B input `opf-keynote-footer-controls-61-01/variants/ordinary-footer.pptx` | 172212 | `810be51e93c04b701c5c939354ecac7324cecdaadf76eb3f4089031bb4936a6e` |
| Actual fresh A `opf-keynote-native-footer-attempt-61-01/native-export.pptx` | 110634 | `ee772959fc02b118beac5643b89ae8c61215a674a424d0901e718b067d881d44` |
| Actual B `opf-keynote-ordinary-footer-attempt-61-01/native-export.pptx` | 110585 | `b92df5efc5290e919f750f092a78e330037ffcca788f849ec5d3ef4435c17be8` |

Paths above are under `/private/tmp/`. The earlier retained A no-op fixture with hash `1203d4f8…5919f` is a different archive; do not substitute it for the fresh A identity. The relevant attributed lifecycle evidence is `/private/tmp/opf-keynote-footer-lifecycle-review-61-01/report.json`.

Both actual outputs have slide size `W=12192000`, `H=6858000` EMU. Every one of their sixteen literal objects has own geometry `x=859987, y=6380603, cx=1419127, cy=172816`, one current literal paragraph and no surviving `ftr` binding. Every matching number has an actual `sldNum` placeholder and live `slidenum` field; its own `y=6380603` and `cy=172816` equal the literal exactly. Names retain the same generated group and distinct part indexes. A moves the literal before content; B retains its foreground source order. Classification must not depend on either paint order or cached number text.

## Supported subset

Run a fallback only after valid tagged furniture and actual native `dt`/`ftr`/`sldNum` handling. It may classify an otherwise unclaimed current literal shape only when **all** guards pass:

1. **Identity and ownership.** The candidate is a top-level standalone `p:sp` text shape with no current placeholder role, no group/alternate-content ambiguity and no existing claimed/reserved role. Its exact name is `OPF furniture <group> part <part> line 0`, with canonical nonnegative safe integer decimal group/part indexes. That complete name is unique across the slide's current drawing objects, including nested objects. A group index is an identity, not the current slide number: reordering a slide must not invalidate a genuine pair. Never recognize familiar words or position alone.
2. **Current literal content.** Exactly one authored `a:p`, one `a:r` and one `a:t`, with a non-whitespace current string. Preserve that string verbatim; trim only to test emptiness. No live fields, breaks/tabs, math, hyperlink/action or unsupported rich/multiline composition. The current paragraph must be effectively unbulleted, including applicable own/default paragraph membership; an unresolved or contradictory membership stays content. Do not borrow Body master bullets for an ordinary text box. One uniform current run is sufficient; native formatting/positioning is still subject to the existing furniture reflow limitation.
3. **Own geometry and transform.** Exactly one own `a:xfrm` with safe integer EMU `x,y,cx,cy`; `cx,cy>0`. No inherited frame, rotation, reflection, group transform, vertical text, hidden object, negative text inset or unsupported text effect. Both the literal and its anchor must independently meet the exact envelope below. Do not expand an existing geometry/parity tolerance.
4. **Live same-group anchor.** Exactly one current top-level `sldNum` placeholder has an exact, unique generated name with the **same group**, a different part and `line 0`. It has one live `a:fld type="slidenum"` in one paragraph, without additional literal words or another field. An empty field display cache is valid; a static numeral is insufficient. Require its own valid frame, exact `literal.y === anchor.y` and exact `literal.cy === anchor.cy`. Neither same name, same row nor a live number alone is sufficient. A native anchor already accepted by the higher-priority furniture path may supply evidence; it must not be consumed twice or rewritten.
5. **Uniqueness and merge.** Initially support one eligible literal for that generated group, and at most one recovered literal per physical zone on the slide. Multiple otherwise eligible literal candidates, duplicate names/anchors, differing groups or a collision with tagged/native furniture in the same zone/field refuse the fallback for the ambiguous candidates. Do not pick the first object, concatenate competing values or overwrite higher-priority furniture.

### Exact classification envelope

For current positive safe integer slide dimensions `W,H`, require for **both** frames:

- `x >= 0`, `y >= 0`, `x + cx <= W`, `y + cy <= H`;
- `10*y >= 9*H`: the whole frame begins in the bottom tenth;
- `20*cy <= H`: a frame no taller than one twentieth of the slide;
- `3*cx <= W`: a frame no wider than one third of the slide.

Use exact integer/rational comparisons (or BigInt products) rather than floating margins. These are a deliberately bounded classification region, **not** a render tolerance or a promise that text fits. The actual A/B frames satisfy every bound. A frame outside it remains current content, even if its name/text resembles a known footer.

Reuse the existing physical `zoneOf` rule: center `< 1/3` is left, center `> 2/3` is right, otherwise center. Its exact boundary equivalent is left when `3*(2*x+cx) < 2*W`, right when that value is `> 4*W`, otherwise center. Do not infer a logical reading-direction swap, zone from a part index or the source's remembered alignment.

## Output, refusal and deletion authority

An accepted candidate contributes only its current literal string, encoded through the existing `\\{{` literal-token escaping convention, to `footer.<physical-zone>.text`. Displayed `{{slide.number}}`, `{{slide.section}}`, `{{deck.slideCount}}` and other brace tokens must remain literal; existing displayed backslashes must also survive. They must not become live fields or resolved metadata on composition/re-export. Mark only that shape consumed as furniture; preserve the existing live-number representation and all unrelated current objects. Reuse existing furniture reflow reporting: classification does not reconstruct the native font, geometry, paint order or visibility. Keep the actual native object inventory in the inspection report for independent review.

The existing furniture claim set is not a complete ownership registry for other OPF roles. Refuse candidates or anchors with surviving other-role tags (including HEADING, TEXT and CODE), or use complete ownership reservations before consuming them. The first implementation may conservatively require a slide with no current customer-tag bindings anywhere, preventing cross-object OPF reservations from being bypassed. An anchor rejected by the existing higher-priority collision/claim path is not a witness. Only an accepted current native number may witness classification, without a second consumption.

A recognized generated candidate that fails or is ambiguous remains current content, with a path-specific `unclassified-native-footer` diagnostic explaining the guard (for example `slides.7.shapes.0`). An arbitrary renamed object has no recognized identity and should follow ordinary import without a positional guess or a fabricated claim that it used to be a footer. Empty/cleared candidates and deleted shapes produce no recovered literal and no old words. Do not recreate them from another slide, a source baseline, OPF tags Keynote removed, a layout prompt or an object name.

The existing native-footer majority lifting may continue only if current per-slide absence/overrides remain exact. OPF's slide-level footer object replaces the deck footer as a whole. A slide whose literal was cleared but whose number survives therefore needs its current number-only footer override when other slides lift a literal to deck design; a slide with no current furniture must suppress the inherited footer. Test actual resolved/composed furniture after lifting, not just the stored imported JSON. No new schema keys are needed.

## Integration seams and review gates

Pass the current slide height alongside width in `src/index.js`'s furniture context. A small separate classifier adjacent to `readNativePlaceholders` can examine raw current shape/field/name/frame evidence and return candidate indexes/zone/value plus refusals. Merge its results in `src/furniture-provenance.js` only after existing tagged/native fields and collision checks. Keep the current claim sets authoritative. Avoid touching Body typography, heading inference, general low-on-slide text handling or exporter output.

The fallback runs automatically within the existing native-furniture pipeline, constrained by all guards above and with explicit reflow/refusal diagnostics. It adds no option name or public API. Generic tag-stripped footers, standalone literals without a live-number sibling, headers, shared-master literals, renamed objects, multiple parts/lines and arbitrary application exports remain unsupported.

The exact actual A/B archives are retained as project-authored MIT regression inputs in `test/fixtures/keynote-footer-classification/`, with their hash/size manifest and source/control/native lineage. The full clean-main import snapshots are test-only evidence: the runtime never reads them. Do not regenerate the original 16-case baseline, change its seals, or promote a scratch inspection to acceptance.

## Required discovered regression controls

- On both exact actual outputs, recover all sixteen current left literals once and retain all sixteen live right numbers. Remove the corresponding literal-as-body findings only through genuine classification. Keep the sixteen notes-page field-removal findings and all other gaps explicit. Assert current title/body/notes words, charts/tables/media, numbering, all non-footer payloads and unrelated diagnostics remain exact.
- Change the current literal words, including leading/trailing spaces: recover exactly the edited current string. Clear/delete it on one slide and then all slides: no old string in current content or resolved footer, including after majority lifting, reimport and composition. Never restore source words.
- Current literal brace tokens and their already escaped forms must compose/re-export as the same displayed words/backslashes, with no new live fields. A qualifying current name/frame/number pair carrying a surviving HEADING/TEXT/CODE tag must stay in its higher-priority path. A refused/colliding number anchor must never witness recovery.
- Rename a literal or anchor; move either out of band; remove/change the live-number field; use a static number; alter group/part/line identity; add a second literal/anchor or duplicate name; add a tagged/native collision; wrap/group/rotate/flip the shape; add a bullet, second paragraph, break, rich run, hyperlink or unsupported effect. Current text remains content and no false footer is created. Test all three export provenance modes (full, references-only and false) and the actual tag-stripped inputs.
- Exercise band containment, frame size and physical zone boundaries at exact equality and one EMU outside; require a one-EMU row `y` or `cy` mismatch to refuse. Missing/invalid dimensions or frames refuse. No tolerance changes.
- Prove fully unrelated ordinary body text, even at the bottom of a slide or with the same words, stays body content. Preserve actual placeholders/tagged furniture precedence and the higher-priority live number. Keep original default export bytes exact; no exporter behavior change belongs in this importer change.

After source/model review and affected checks, any new source requires ordinary packed-candidate adoption and root-owned native qualification. This importer change is not a release, physical-font result or general Keynote acceptance claim.
