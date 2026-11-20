# RR-105 Unicode scalar fragments: proposed V2 ownership transaction

Approved SOURCE-ONLY design record, written before implementation. The [current implementation draft](rr105-unicode-interval-planner.md#v2-source-implementation-checkpoint-unexecuted) is now separately ready for source review; it remains uncommitted and entirely UNEXECUTED. No Office action or native correctness claim. The earlier unconnected planner focus03 passed2/2 groups/zeroSKIP; original focus01 and02 failures remain immutable. Nativebody is a positive, independent two-paragraph path and is excluded.

## Scope and source authority

Use a generic body-scalar predicate, not fixture IDs: original authored value is a string, effective measured profile is Arab, actual paragraph is LTR/physically left, and the Unicode planner admits a Latin prefix / Arabic-script decimal interval / Latin suffix at exact core/SVG advances. Keep all original source code points, including U+0661/U+06F1 and hanging U+0020. No controls, proofing substitution, font substitution, tracking/caps/tab/marker layout, arbitrary glyph boxes or source-derived direction API.

The genuine first cohort contains exactly these four source fields:

| Field | Original UTF16 |
| --- | ---: |
| `slides.0.blocks.0.text` | 27 |
| `slides.0.blocks.1.text` | 22 |
| `slides.0.blocks.2.items.0` | 27 |
| `slides.0.blocks.2.items.1` | 22 |

They contribute98 body units over7 measured lines; the unchanged19-unit heading gives117 total. The original519-byte source SHA256 remains `69ad66eae58f2d7d7a075a78d8cc64d70b8900032f31e97d9e87748ecf85ecbb`. Capture original scalar source offsets independently of each derived measured run's local start/end/runIndex. A colon label can be automatically bold (`runInHeading`); its derived run identity is not an authored run boundary.

One transaction owns one COMPLETE scalar field, including every untouched continuation. A text field migrates its entire existing `OPF_TEXT_V1` group. A scalar list item gets an independent V2 group covering that entry's complete measured lines; the list's other entries remain independent transactions. Do not admit rich authored arrays, descriptions, nested/arranged lists, headings, code, quotes, furniture, cards, metric/code owners, media, tables or native-body candidates. The first implementation admits only the currently qualified scalar topology; source language remains inherited where inherited.

## Distinct tags and closed payload

Use **`OPF_TEXT_V2`** for plain body scalar groups and **`OPF_NATIVE_FRAGMENTS_V2`** for scalar list-item groups. These are incompatible new payloads; leave both V1 readers, writers and existing fragment semantics intact. Each physical member has exactly ONE primary content tag. A raw V1/V2 conflict, unknown OPF owner, shared/foreign tag part or ambiguous semantic ownership refuses the entire group.

Each member tag is uppercase-hex JSON via existing `encodeTextTag`/`decodeTextTag`. Proposed closed schema (no additional keys):

```text
Record = {
 v: 2,
 header: Header,
 member: integer,
 proof: {body: hash14, frame: hash14, relationships: hash14, context: hash14},
 sig: hash14                      // existing attachTextTags signed signature
}
Header = {
 group: sourcePath,               // original scalar field, including list item index
 kind: 'text' | 'list-item',
 source: {kind:'scalar', length:integer, hash:hash14},
 lines: [Line],
 members: [Member]
}
Line = {
 index: integer,
 from: integer, to: integer, next: integer,
 boundary: 'soft' | 'hard' | 'end', separator: string,
 original: {name:string, id:integer},
 members: [integer]
}
Member = {
 index: integer, line: integer, part: integer,
 name: string, id: integer,
 from: integer, to: integer,
 role: 'carrier' | 'script' | 'continuation',
 slices: [Slice]
}
Slice = {
 from: integer, to: integer, derivedRun: integer,
 script: string, role: 'latin' | 'complexScript',
 rpr: hash14
}
```

Use existing `nativeTextHash` for these provenance fingerprints (14 lower-case hex); archived source/package/PPTX qualification continues using its separate SHA256 machinery. A hash is drift evidence, not permission to trust malformed tags. `headerHash = nativeTextHash(canonical(Header))`; each complete property proof binds `{v:2,headerHash,member,identity}`. The repeated header must match exactly on every member. No original source words or old run-style values are stored: `source.hash` permits comparing CURRENT reconstructed text with original text; it cannot supply old text. RPr bytes are export-local writer input, not an import replay payload.

Validation retains existing bounds rather than enlarging them: source length1..1,000,000; physical members1..64; lines1..10,000 with count<=member count; slices/source boundaries<=10,000; path/name<=4096; native-language subproof bounds unchanged. Apply the existing256KiB field bound to each encoded V2 JSON payload and existing16MiB tag bound across V2 values; reject before decoding larger input. No application/profile/probe cap is increased. All integers are safe, nonnegative and in range. Source ranges are half-open UTF16 and cannot split surrogate pairs. Every line and member index is unique and contiguous; line/member source partitions cover the complete scalar exactly, with only validated original hard-break separators between lines. Soft/end separators are empty; hard separators are exact supported CR/LF spellings. Original and current IDs/names must be unique slide-wide; no reused or foreign references. Original line order, carrier roles and source partitions are semantic, never inferred from current text lengths.

## Complete current-property evidence

Reuse the existing ordered XML property tree/text mask contract: mask ONLY direct editable `a:r/a:t` text, normalize attribute ordering and harmless `xml:space='preserve'`, and retain all ordered RPr/default/body/paragraph/endParaRPr/extension properties. Do NOT remove CS for V2 equivalence. Every final native CS/Latin/EA/symbol face, size, proofing language, effect, link and new RPr boundary remains significant. Preserve the exact original supported terminal paragraph metadata on carrier and children; unknown trailing paragraph children refuse the writer transaction.

`proof.body` is the complete text-body property fingerprint bound to this header/member. `proof.frame` includes complete ordered current shape properties/transforms and supported nonvisual text/frame metadata, excluding only the customer-data link that attaches this record. `proof.relationships` fingerprints every referenced run/frame relationship's type/target/mode, so an unchanged r:id cannot hide a changed hyperlink or image target. `proof.context` fingerprints the current layout/master/theme/default-style cascade used by nativeBodyReader, including relevant font and color resolution. Missing/ambiguous/external unsupported dependencies refuse scalar restoration; current native content remains readable. These hashes are computed from FINAL emitted native properties, never from pre-W03 source styles.

Property proof is separate from current text equality. A member with changed text can retain its property proof; it still cannot recover a scalar merely because its old RPr is intact. A new RPr boundary, font/proofing/CS/end property, relationship or theme change disables scalar restoration even when the characters are unchanged.

## Writer intercept and atomic commit

1. **Capture only authorized original scalar contexts.** `index.js` body text dispatch around2831 and2870 can pass a private scalar-owner descriptor to `addMeasuredPayloadText` or `addRichFitLines` ONLY for an original scalar body text. The latter's shared quote/heading/card callers remain unchanged. Collect every line, not just numeric lines. `addMeasuredList` around3135 captures a scalar entry, its textPath/index/marker and all its rich lines; descriptions/arrangements/rich values are excluded. Capture raw original scalar and derived-run source mapping in export-local memory, not in public API or reusable tags.
2. **Keep the existing early attachments.** `normalizePptxZip` around5585 already attaches `OPF_TEXT_V1`. Removing an entry from `plainTextTags` late does not migrate its actual tag. Leave ordinary noncandidate V1 output byte-identical.
3. **Intercept late after safe/font/script rewriting.** Keep current late order `nativeLatinSlots.write` then existing V1 `nativeTextFragments.write` around5868. Stage V2 against that resulting XML before final tag/provenance attachment. Validate original scalar group closure and exact source text, all line IDs/names/frames, current ordered RPr slices and the existing primary tags/relationships. Existing V1 fragmentation or any other owner on a proposed member refuses V2 rather than creating double ownership. Its pretransaction output is retained.
4. **Stage the complete scalar group in private copies.** Snapshot affected slide XML, slide relationships, original tag parts, content types and ownership-map entries. Build carrier/children for numeric lines while retaining all untouched continuation shapes. Keep the original carrier frame, native numbering/paragraph intent and first nonnumeric source prefix. Children use exact planner origins/full advances and exact current RPr/CS slices; their known generated paragraph/body changes are recorded in their own final property proofs, not normalized against the carrier. Preserve full source order and every trailing U+0020. No hidden fit or geometry replacement.
5. **Migrate text V1 without an empty/shared-part hazard.** For each original plain-text shape, require exactly its expected `OPF_TEXT_V1` record and one valid internal tag relationship. In staging, use existing `attachTextTags` to append the new V2 tag to that valid part, then remove ONLY the prevalidated V1 tag. This keeps the tag part nonempty. Never remove the whole custDataLst or unrelated tags. Reject shared tag parts, duplicate owner tags or foreign records before modification. Children drop only the copied relationship to the parent's tag part and receive their own V2 record. List items have no text V1 to migrate.
6. **Allocate unique parts deterministically.** `attachTextTags` resets its counter per call. Use collision-checked group-specific prefixes `opfTextV2G<headerHash>` / `opfNativeFragmentV2G<headerHash>` for staged calls; refuse existing part/relationship collisions rather than overwriting. Reuse its one-p:tags-reference/content-type logic and signed signatures. Check all new tag/relationship/content-type bytes before commit.
7. **Transfer W03/language ownership only on success.** A committed V2 owner now owns the exact post-W03 source slices. Delete old whole-line slotGroups only for its complete original member set; do not delete another group's proof. Add a narrow optional excluded-name set to `attachNativeLanguageTags` so it does not synthesize obsolete V1 semantic tags for committed V2 names; defaults remain unchanged for every V1/noncandidate path. V2's own exact source/property proof owns original generated language/CS boundaries; no blanket CS stripping or proofing-language substitution is allowed. Existing semantic receipts must be validated and transferred or the whole transaction refuses.
8. **Publish together or not at all.** Only after tag validation, final property receipts, member closure and all original-line conversions succeed, replace affected entry bytes and ownership-map entries. On any failure discard all staged XML/tags/relationships/types/IDs/maps for this scalar group and report a specific unavailable finding; its complete original post-W03/V1 output stays byte-identical. `finalizeFontsUsed` then sees committed shapes; attach remaining V1 native-language and V1 fragment tags, seal references and finally document provenance as before.

The smallest implementation is a new internal `native-scalar-fragments.js` for V2 staging/validation/adoption, reusing the pure planner, tag codecs/attachment, property masking and nativeBodyReader. Add its build copy to `packages/pptx/scripts/build.mjs`. Index hooks and one optional V1 semantic exclusion argument are the explicit shared-helper deltas. Do not silently repurpose the V1 payload or globally alter attachment order.

## Import transaction and current edit authority

`fromPptx` builds `nativeLanguageReadView` around558 before `collectSlideItems` builds its reader. Therefore V2 checks MUST validate RAW archive parts and use a raw nativeBodyReader; the existing V1 normalized view cannot supply its complete property proof. V2-tagged shapes must not acquire old whole-line W03/proofing normalization. Any optional V2 semantic read view for language observation is separately validated against complete unchanged source/property evidence; otherwise language votes remain current native values. No ZIP bytes are changed on import.

At `collectSlideItems` around1225, scan/validate V2 group closure first, but do not consume shapes or modify any V1 importer sets. Build temporary candidates from CURRENT complete native paragraphs. One paragraph per owned member, with expected carrier-only bullet/number roles; new bullets, fields, breaks, unsupported extra paragraphs, foreign/duplicate/missing members or incompatible ownership cause whole-group refusal. Preserve original sourcesOf membership for signals and bounds. V1 readers continue unchanged and cannot see a committed V2 owner as a V1 primary. Conflicting primary tags must fail both content-owner adoptions on the conflicting physical shapes, not authorize an unrelated member named only by an untrusted header.

For every structurally complete group:

* **Exact scalar restoration:** CURRENT joined member text plus validated source separators must match source.length/hash; ALL current body/frame/relationship/context proofs must match; all original-source/current-native mappings must be complete. Return that CURRENT joined string, never stored words. This preserves the original scalar and its implicit auto-label styling only when both text and full current style evidence are unchanged. The unchanged branch can use the existing current paragraph/text parser plus complete property proofs; do not force a lossy full-style projection and generate spurious unsupported-CS warnings for an exactly proven original scalar. Full raw style reading is required for the changed/refused branch.
* **Changed current text or property:** do not restore a scalar in the first V2 implementation. Read full CURRENT native rich styles with raw nativeBodyReader and return explicit rich text plus reflow. Keep arbitrary edited text lengths; never slice them using original offsets. Preserve interior current RPr boundaries, full font/size/color/bold/language/link styles and their diagnostics. Do not recompute colon-label emphasis from old source or drop current bold after a colon edit. Do not merge all equal-style interior runs. A later semantic-equivalence shortcut would require independent proof and review; it is not part of this proposal.
* **Unrepresentable native style:** refuse old source/style restoration and retain current parsed content with existing specific native-style/font diagnostics. Script-specific CS edits cannot be erased or presented as full OPF fidelity; no font-family coercion or unsupported-field replay.

Use the existing `adoptNativeFragmentGroups` pattern: convert **every** group candidate through the ordinary carrier converter (plain payload or list paragraph), validate the complete resulting current payload against the current schema, then atomically add the candidate item(s) and mark all group shapes consumed. A false/throw from any carrier conversion leaves ALL group shapes available to ordinary import; no pre-consumption like text V1's current implementation. Invalid V2 primary ownership also prevents a second partial V1 owner from consuming a subset.

One necessary ordinary-fallback wiring is explicit: index.js1343 currently enables rich ordinary native reading for `fragments.tagged` (V1) but excludes most other primary-tagged text. Add the actually V2-tagged shape set alongside it, with its raw nativeBodyReader callback. That flag authorizes only reading CURRENT native styles, never source restoration or consumption. Otherwise a rejected V2 tag could accidentally suppress rich fallback. Missing/foreign references do not grant consumption or let arbitrary header claims quarantine unrelated valid owners.

Keep V2 edit disposition private in nativeContext/items (`exactScalar` vs `currentRich` vs `refused`). This must explicitly protect currentRich fields from downstream base-style/scalar cleanup: `mergeOpfListShapes` around1807–1853 currently removes inherited list look, and `slideListRecord`/`restoreDocumentProvenance`/`rebuildContent` can restore scalar intent/topology later. For a successful V2 currentRich candidate, skip V1 scalar/default-look restoration at that precise field; retain V2 current RPr interiors through list concatenation (existing seam-only join). Content topology can restore structure/IDs, but cannot turn its protected current rich field back into a scalar or replay old styles. Carry these dispositions internally through nativeContext; never serialize them into OPF/extensions or let untrusted tag JSON directly request a bypass. Unchanged V2 groups continue strict original scalar round trips.

The list merger needs an explicit private **already-joined V2 entry** disposition, not a claim that old V1 line counts still apply. A V2 scalar entry collapses all its old measured lines to one current paragraph; original names may consequently have noncontiguous line numbers. Keep grouping/order by the existing list path and native first-line identity, but bypass legacy continuation/break/role reconstruction inside that V2 entry and never apply old scalar/base-style cleanup to its currentRich paragraph. Ordinary entries in a mixed V1/V2 list keep their existing per-entry handling. Validate both final current list payload and complete source membership before consuming the V2 members. Tests must cover one refused/ordinary neighbor beside a valid V2 entry and preserve every current paragraph without duplicate or partial consumption. These narrow list-merger/topology guard deltas are required in addition to the writer/module changes; they are not hidden protocol assumptions.

## Required implementation controls before native qualification

1. Genuine unchanged original10: all four scalar fields, all seven body lines/117 total units, exact U+0661/U+06F1 and original source SHA; exact strict public import. Actual emitted shape counts/IDs and source ranges must be measured after hooks, not forecast as acceptance. All core/SVG full origins/advances and native endParaRPr/font/proofing/numbering/frame obligations remain strict.
2. Entire-group ownership: all plain continuations migrate V1→V2 atomically; exactly one primary owner per original/new shape; list entries use separate V2 groups; old V1 archives and every noncandidate/nativebody output remain byte-identical. A second group's part allocation cannot overwrite the first.
3. Current edits: arbitrary shorter/longer numeric/suffix/carrier/continuation text, colon removal/movement, old bold label text changed to a nonlabel, current font/CS/proofing/size/color/link/bold edits and new RPr boundaries. Assert current explicit rich styles and reflow, no old source, no stale scalar restoration, no cleanup by later document/list provenance.
4. Refusal/rollback: fail the last original continuation/tag/member, missing/duplicate/reused ID/name/index, wrong/unknown version/key/path/header, stale properties/context/link target, surrogate cuts, multiple/native paragraph children, shared/foreign/external tag relationships, part collisions, added bullets/new paragraph roles, conversion false/throw and schema refusal. Assert byte-identical export pretransaction state and zero partial consumed members; ordinary import retains all current content.
5. Narrow scope: headings/code/arrangements/quotes/cards/nativebody, rich authored runs, non-Arab profiles, tracking/caps/tabs/markers, nonselected Unicode/scripts and unsupported/hanging-space gaps refuse or remain byte-identical as specified. Positive nativebody two-paragraph reflow stays unchanged.

After source review: one coherent build/focused implementation gate, then maintained affected package/delta gate under coordinator lease, preserving every prior RED. Only afterwards prepare a fresh genuine installed-consumer archive/profile with actual shape IDs/source/consumer pins and source-bound probes, under unchanged native caps and separate root authorization. Actual case10 PowerPoint paint, reopened imports, saved properties and native-body/case05 residuals remain required; the successful pure planner proves none of those physical outcomes.
