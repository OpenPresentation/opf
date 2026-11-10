# RR-105: native Latin font-slot consistency

Source worktree: C:/opf-work/latin-cs-slots, branch codex/rr-105-native-latin-slots, fresh origin/main normally aligned to 863b83b902eaad7a2c614b353c0379f269146441. Source review, the required coherent gate and actual current native qualification are still pending. No Office, deployment or release was performed.

The exact original05 source public export reproduced Latin Aptos with CS Arabic Typesetting before the repair. The source-selected ASCII span now repeats the final chosen Latin typeface in CS. The separately completed one-slot native experiment supports a digit-size component only: word order remains wrong. This branch does not claim a bidirectional or physical-font-selection fix.

Vetoable decisions:

- Extract the existing pure renderer itemizer into core composition, preserving its API/algorithm and re-exporting the same function from renderer. PPTX needs no optional renderer, registry or font-pack load to classify source text.
- Select ASCII Latin ranges from original source runs before wrapping/native adapters; preserve genuine Arabic-context digits, other scripts, non-ASCII characters, symbol encodings and emoji faces. Copy only the final post-safe Latin typeface, preserving every other native property.
- Extend the existing OPF_NATIVE_LANGUAGE_V1 structural record with bounded original-source span groups. Bind the current ordered paragraph XML and group identity/boundaries; coalesce only unchanged members of the same source run in an import read view. Never replay source text or merge separate authored identical runs. Edited/foreign/tampered/reordered groups keep current native content. Hashes are change detection, not authentication. The original ZIP parts and full provenance fingerprints remain authoritative and unmodified by the read view.

Qualification retained under C:/opf-work/latin-cs-slots-qualification01: original public RED, the earlier exact-document mixed-boundary RED before the span extension, all setup/fixture/type failures, final 11 focused groups PASS, strict core types PASS, and 1,248 original-renderer differential cases / 95 scalar classifications PASS. A no-renderer/font-pack-denial child records zero optional import attempts. The differential uses exact Git 863 renderer bytes with only its relative symbol-font module URL rebound to the same installed dependency graph. A build that reused old core dist was explicitly identified and followed by a fresh normal build token. More required checks and source-bound durable receipts will be appended after critical review; these statements do not qualify a release.

## Review corrections authored during resource-cleanup hold

The immutable first checkpoint is d7d033a243afedcef9a0b79db0ff643feee40e99. Its fresh normal build and exact committed 11 focused groups passed; its required 20-row plan was inspected, but no mapper started. A genuine one-member rPr attribute-order false refusal was captured before correcting the raw member comparison.

The normal descendant now authors a full canonical ordered rPr comparison excluding only the direct CS node, a total 1,000 generated ownership spans per shape with matching import refusal (optional metadata only), and equal-current-style subgroups that avoid introducing an extra CS-only whitespace run into existing inherited proofing chunks. In the exact text-only inherited rich fixture, old export/import already yields three string chunks; the repair must retain those three, without normalizing proofing or claiming to repair pre-existing source-form canonicalization. Explicit Arabic rich runs still require exact source-boundary restoration. An ambiguous native font retains its exact current run.

The native-body control now explicitly requests bodyText: native, requires an actual native body and two hard-line paragraphs, and retains exact rich-source assertions. Attribute-order, metadata-budget boundary and inherited-chunk controls are authored but UNEXECUTED while the coordinator's resource-cleanup hold is active. No build, test, mapper, browser or Office process was started during that hold. Source review and real Save qualification remain owed; current paragraph fingerprints do not broadly waive Office-added default properties.
## Final marker correction before qualification

No qualification child was launched for 731: its preflight refused a stale index stat-size entry after raw LF restoration; working, index and HEAD blobs were identical. Re-adding that verified identical blob refreshed stat metadata without changing the staged tree. The preserved additional assertion is combined into the next successor.

Core citation fragments have a legitimate zero-width source range at the source run's end. Range validation now admits exactly that marker form before excluding marker text from Latin selection and source-span grouping; final concatenated native text still must match. Marker style, proofing, text, size and baseline remain unchanged. The cited Latin/Arabic-neighbor and combined explicit-rich safe-family controls are included in the same focused file. No bidi/runtime formatting controls or speculative native mutations are added.
## Separate automatic native-body font-preparation defect (OPEN for v0.34)

Exact 621553ddf1f4983b03bbbdc8113c9e469fce0229 focused execution ended with 14 PASS / 1 RED; head, index and source guards remained exact. All font-slot, marker, canonical-attribute, inherited-chunk, ownership and budget controls passed. The strict core type step did not start after this focused failure. Raw log: C:/opf-work/latin-cs-slots-qualification01/review621-focused.log.

Minimal reproducer (normal public API):

```js
const source = {slides:[{title:'Title',text:[
  {text:'Bonjour 1\nWelcome 2 ',lang:'ar-SA',fontFamily:'Georgia'},
  {text:'Hello 2',lang:'ar-SA',fontFamily:'Times New Roman'}
]}]};
const fonts = await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:source});
await toPptx(source,{fonts,bodyText:'native'});
```

The actual error is font-unavailable for Aptos400 at slides.0.text: prepared (font-demand.js577) → textMeasurement.measure → nativeWrapBox (native-body.js188). Every visible rich run overrides the base Aptos role. nativeWrapWidths uses those authored faces, but nativeWrapBox additionally measures the base alphabet width for heuristic wrap slack; native-body defaults also retain Aptos for future blank/appended paragraphs. The new demand API documents preparation for actual drawn faces through ToSvg options. The exporter currently forwards chosen-family mode but not this extra native planning dependency. Root owns its separate runtime repair; it remains OPEN and is not qualified by this fixture.

The capture test now supplies exactly one additional manifest-pinned Intos Regular400 face through the public CallerFontFace API, with its actual family Intos and verified existing font/OFL/notice hashes. No relabeling, whole-pack preload, shared-resource mutation, native box/heuristic change or strictness relaxation is used. It still requests bodyText: native, requires an actual native body and two hard-line paragraphs, and checks exact rich-source recovery. The next focused/type result will bind the coherent successor; it must not be described as a passing automatic native-font preparation test.