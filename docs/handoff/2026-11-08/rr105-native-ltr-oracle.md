# RR-105 one-call native LtrRun oracle — source review only

**Never merge or run Office from this branch without the coordinator's source review. No product fix, native pass or release is claimed.** Fresh-main worktree normally follows exact integration56981114388f2d23444270abac13b6568ee363f6 through base2bfb18264d95f0eaba94da118840fd65d6bcb111. Before modification, all five worker/harness/process/runner files were byte-exact to frozen ce92. That original worker and q473 runtime remain untouched.

Microsoft documents [TextRange.LtrRun](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.textrange.ltrrun) as setting LTR direction. The TextRange2 summary describes a returned subset while its [official PIA signature](https://learn.microsoft.com/en-us/dotnet/api/microsoft.office.core.textrange2.ltrrun) is void; this oracle selects only the unambiguous legacy TextFrame.TextRange method. It never selects/activates a view or window and never tries another API.

The sole closed action is:

```json
[{"op":"ltr-run-oracle","slideIndex":1,"shapeName":"OPF list slides.0.items line 0"}]
```

It is only for the immutable original09 input archive SHA-2564b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2. The reviewed suite binds that archive. The validator rejects other target names/slides, different spelling, extra fields and any combined action plan. ReadOnlySurvey still refuses every nonempty plan. Existing3slide/30shape/20action/60second caps and all process/ownership/cleanup functions remain unchanged.

The diagnostic attempts exactly one legacy LtrRun call through Invoke-FurnitureCom. It requires1..256 UTF16 code units, a positive uniform LanguageID and uniform reported font descriptors. Before/after primitive snapshots retain exact text/code units, proofing LanguageID, font name/size/bold/italic and shape geometry. Ordinal text, every recorded font/geometry value and LanguageID must remain exact. There is no text, language or font setter, Unicode marker, alternate method, fallback or retry. Every failure latches the existing stop guard; only the unchanged lifecycle can confirm cleanup. A failed attempt never earns a cleanup or retry claim.

The [LanguageID documentation](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.textrange.languageid) describes spelling/grammar tagging. API LanguageID equality alone does not prove unchanged saved XML primary language or readable glyphs. The coordinator must inspect edited and reopened images and diff all saved native text/rPr/pPr/lang/altLang, font and geometry properties. An apparent improvement that changes source codepoints/proofing, requires UI, does not persist, repairs the file or still displays corrupt glyphs is not a product fix.

37 AST-only object-mock controls pass: one-call positive, no retry, mutated words/bidi/NFC normalization/language/fonts/geometry, method throw, invalid target/range/language, getter failures and caps. No Office object is constructed. The unchanged existing harness, read-only-survey refusals and pure Windows runner qualifications also pass in a5test selection. Fifteen existing guard/cleanup/cap/font function bodies are byte-identical to ce92. First missing-oracle failure and all raw qualification logs are retained for publication; final frozen checks and coordinator review remain required.

Vetoable decision: use Office's documented formatter as an oracle before proposing another exporter property. The earlier a:rtl0, same-property fragmentation and font-slot contrasts produced no accepted workaround. No product guard, provenance/import or D3 digit eligibility edit is included. If the oracle cannot satisfy proofing/Unicode/fidelity invariants, native refusal/finding and a separate owned inherited-digit qualification remain design choices reserved for the coordinator.

## Frozen qualification handoff

The oracle worker is frozen at `d7ba4e11cc1a7369e63c20924593e5dbefba5357`; keep C:/opf-work/rr105-ltr-oracle clean at that head. This evidence branch is NEVERMERGE. The [receipt](rtl-ltr-run-oracle/receipt.json) and [lossless 491-file archive](rtl-ltr-run-oracle/qualified-source-and-suite.zip) retain source diff, actual executed worker bytes, first missing-oracle failure, 37 mock controls, existing guard/survey qualifications and pure maintained-runner preflight. Credential-signature scan passed; each extracted archive member matches its retained SHA-256.

The exact suite is C:/opf-work/ltr-run-oracle-suite-01, suite.json SHA-256 `a5955832565b687b1293ae028740da803dd37e53070427d5acc6b6133a17c75c`. Unchanged ce92 run-windows.ps1 with `-CaptureTextFonts -ValidateOnly` completed exit0 at C:/opf-work/qualification034-ltr-oracle-preflight-01. No Office was constructed or invoked by this lane. The mandatory mapped changed-check is still running at sealing time; its terminal result will be appended separately, with failures retained. No full-suite pass is claimed.

Next action is coordinator source review, followed only if accepted by one root-owned real native oracle using this exact suite/input/worker. Inspect original/edited/reopened raw glyphs and complete saved XML before selecting any product work. Native, registry and overall acceptance remain false. Earlier font-slot native output still awaits the coordinator's complete phase review; this oracle receipt does not amend it.

## Mapped terminal result

The mandatory local changed-check is terminal **exit1**, total838.1seconds. Build, Biome, changelog, font-hotlinks, gallery tracker, release report, skill commands, text policy and strict stability passed. Typecheck was correctly unselected because no TypeScript/tsconfig changed. The mapped PPTX run reached186/279, then failed `test/rr-105-native-body-wrap.mjs:54`: actual0, expected6. Ninety-three tests were not run; the browser check was not reached. New37oracle controls and the existing native harness/read-only controls passed in the mapped run, as did scalar12, inherited-language18 and the now-corrected notes-theme test. No failure was waived or rerun into a pass.

The [terminal receipt](rtl-ltr-run-oracle/mapped-terminal-receipt.json), [raw terminal archive](rtl-ltr-run-oracle/mapped-terminal.zip) and [per-file hashes](rtl-ltr-run-oracle/mapped-terminal.files.json) supersede the earlier RUNNING notation. The12-file archive is lossless, scanned and bound by SHA-256 `c519acbb7d2155cf34531a9c04629add8fd0eb84bb9cd5b9c4dd36c18aa964fd`. Source remains clean and frozen at d7ba4e11cc1a7369e63c20924593e5dbefba5357; no Office invocation occurred.

Read-only follow-up clue: this unchanged test still selects sampler indices40/21/19 under comments describing six step cards, a lead text block and a tight body. Current selected titles/layouts are respectively 'What the first four weeks show', 'Completion rose through the pilot' (chart), and 'Explain what the audience should notice' (image-beside). Fixture/test positional drift is a separate hypothesis, not a passing baseline result. No source, assertion or fixture was edited. The coordinator has the failure and owns any follow-up. This oracle lane stops after evidence publication; no native, product, D3, provenance/import or release action is authorized by this handoff.
