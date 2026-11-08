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
