# B07 automatic-number marker discriminator — proposal only

Status: SOURCE/PLAN ONLY. No new PPTX, derived worker, adapter output, native fixture or Office run exists. This new fresh-main branch is separate from every immutable producer and from c1159e90bc91c4a4e1985eb1f97b45147e8eab62 (NEVER MERGE native evidence). This lane must also NEVER MERGE into product/release source.

The completed direction diagnostic observed TextDirection2/1/1 and LanguageID1025 in every phase, yet the first English line remained reversed. Its real PNGs equal the fb370 baseline. Root's next proposed cause discriminator changes automatic numbering alone; omitting the visible numeric marker prevents product or B07 acceptance regardless of the result.

## Exact proposed mutation after coordinator approval

Input is original09 SHA2564b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2, read from the sealed suite a9c91a0bd1df36298bd920e3a578e39be5871ea39d9aaf856a036910d97ebf25. Read-only inspection found147ZIP parts, exactly one arabicPeriod automatic-number token and exactly one paragraph in each named body shape.

Target only ppt/slides/slide1.xml, named shape `OPF list slides.0.items line 0`, its sole a:p/a:pPr. Replace the one literal `<a:buAutoNum type="arabicPeriod"/>` with `<a:buNone/>`. Assert the token occurs exactly once in the complete original XML and lies in that exact paragraph. No parse/serialize of the source XML: preserve every other XML byte.

Retain buClr/buSzPts/buFont, marL394654/indent-394654/rtl0, all other paragraph properties and original a:t UTF16 including the trailing space. The text remains `Item 1: Customers told us onboarding took too long, so we rebuilt it `. Retain all rPr fields/languages/typefaces, three shape names/nonvisual IDs/transforms, relationships and content types. The continuation text remains `around the customer journey.`.

After creating a NEW external ZIP (never overwriting input), decompress it independently. Require the same147entry names/order with no duplicate/unsafe names; all146other part byte arrays must be identical. Target XML must equal the original after exactly that single literal substitution, including untouched context. Retain complete old/new per-part length/hash vectors and the exact textual diff. Container/compression bytes may differ; no other decompressed part may differ. Refuse any unexpected namespace, paragraph count, bullet-choice/order or text/context condition.

Parse both XML documents namespace-aware with DTD/entity resolution disabled, and verify the DrawingML paragraph bullet-choice/order and unchanged structural context. No local ECMA XSD set was found; these are bounded XML wellformedness/specific conformance checks, not a full ECMA schema-validation claim. No OPF exporter or font preparation is used.

## Separately bound worker and suite after pure preparation

The new deterministic fixture SHA must be computed from the actually prepared, independently verified bytes; no SHA is invented in this proposal. Derive a new worker-package from exact2b825aa72e16dfa6593a8171011f7fcb6138255b worker bytes (81652B, SHA51cb21003f058bd401669458e6f0afdd0acd899fdd54c4ee529595a32f5e65b9). Replace only the one64hex hash literal in `$allowed` with the mutant SHA. Admit only the mutant, not both inputs; every other worker byte remains exact, including existing guards/error strings. Do not change methods, property getters, setters, geometry/text/font/language expectations, action admission, lifecycle or caps.

Freeze this adapter/derived-worker source on a new immutable head before suite preparation. A new `proofing-bullet-none-original09` case binds the old input identity, exact one-token mutant proof, new input SHA, derived worker SHA, preparation head and unchanged ce92ccc65d8cb40cc6532b2d9082e12202d6c283 controller/supervisor. Keep f9b713ca preparation,2b825worker,fb370generation and all prior archives/worktrees immutable; do not retrofit any of them.

Limits stay one slide/three whole shapes/zero actions/default45seconds/hard60/original-edited-reopened/three real PNGs. CaptureTextFonts remains required, with the same9LanguageID1025, exact UTF16/geometry and9direction probes. No new COM methods/setters, registry changes, UI, Excel, attach/kill/retry or COM cleanup on failure.

## Ordered approval gates and interpretation

1. Coordinator reviews this concrete plan/source before any real PPTX mutation.
2. Explicitly approved pure fixture preparation derives/seals only the one-token ZIP and one-hash worker. Pure source/input/managed controls prove unchanged lifecycle and default denial. Retain every failed setup/output.
3. Coordinator reviews exact new heads/hashes/part proof before a separate ValidateOnly invocation.
4. Native execution requires a separate explicit coordinator GO with fresh outputs/preflight, unchanged ce92 supervisor and one bounded run. No elapsed time authorizes it.

If the English line becomes correct, automatic-number interaction is implicated for this fixture; neither a general mechanism nor a releasable fix is proved. If it remains reversed, buAutoNum alone is insufficient, while retained bullet styling/hanging indent or other causes remain open. Numbering is intentionally absent in both outcomes. glyphFix:false/currentRuntimeAcceptance:false/nativeAcceptance:false/registryAcceptance:false; B07 stays open. Preserve all three new real PNGs separately from managed synthetic harness output, and compare visible text order rather than demanding whole-image equality after marker removal.
