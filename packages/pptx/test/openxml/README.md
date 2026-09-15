# Independent Open XML package audit

This optional maintainer probe uses Microsoft's `OpenXmlValidator` from
DocumentFormat.OpenXml **3.5.1**, with a locked dependency graph and .NET 8. It
opens generated PPTX files read-only and returns nonzero for any reported schema
error or package exception. It checks Office 2007, Office 2019 and Microsoft 365
targets independently. .NET and the SDK are test tools, never OPF runtime or npm
dependencies. No Office application or COM automation is used.

Use Node 24 and the coordinated source graph, then:

```sh
node test/openxml/generate.mjs artifacts/openxml-new
dotnet restore test/openxml/Validator.csproj --locked-mode
dotnet build test/openxml/Validator.csproj --no-restore
dotnet run --project test/openxml/Validator.csproj --no-build -- artifacts/openxml-new/original artifacts/openxml-new/original-sdk.json
# The original files currently fail: preserve the nonzero result and report.
dotnet run --project test/openxml/Validator.csproj --no-build -- artifacts/openxml-new/reordered artifacts/openxml-new/reordered-sdk.json
node test/openxml/inspect-opc.mjs artifacts/openxml-new/original artifacts/openxml-new/original-opc.json
node test/openxml/inspect-opc.mjs artifacts/openxml-new/reordered artifacts/openxml-new/reordered-opc.json
```

Run the commands separately so that the expected original failure does not mask
another failure. Generation requires a new output directory and preserves source,
original/reordered PPTX pairs, hashes, exact changed-part lists and equal semantic
reimports. The 21 cases include sixteen furniture combinations, simple text and
image controls, empty/disabled furniture, and a two-slide speaker-notes control.
The relationship probe checks only target existence, unique IDs and content-type
override targets; it is not a complete OPC validator.

Pass the fresh installed consumer directory as the generator's third argument
to exercise installed package exports. `pnpm pack:ecosystem` only makes tarballs;
run `pnpm test:packed-ecosystem` from core to create the fresh consumer before
using it. Compare fixture and semantic-import hashes against the source run.

The initial two-slide control also exposed an override for the nonexistent
`slideMaster2.xml`. The candidate exporter now omits only declarations for
nonexistent generated slide masters; the regular smoke and 126-deck corpus tests
require every override to name an actual part. This does not resolve the
separate notes-master ordering discrepancy below.

The original package has `p:notesMasterIdLst` after `p:sldIdLst`; the SDK requires
notes masters earlier in the presentation child sequence. The isolated reordered
variants change only these two elements in `ppt/presentation.xml`. All other
uncompressed package parts remain byte-identical, including slide XML, speaker
notes, media, metadata, provenance and relationships.

**Do not apply this transformation to production based on a passing schema
check.** The pinned upstream PptxGenJS 4.0.1 source contains explicit warnings
about PowerPoint behavior when these elements are reordered. The evidence is a
native-comparison candidate, not an accepted export fix. Native Office recovery
and user review remain prerequisites before the Windows owner can test it.
Do not discard notes or alter their relationships to bypass this discrepancy.

References: [Microsoft validator API](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.validation.openxmlvalidator?view=openxml-3.0.1),
[Presentation child elements](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.presentation?view=openxml-3.0.1),
and the pinned local `vendor/pptxgenjs/pptxgen.es.js` function `makeXmlPresentation`.
The shipped vendor file is unchanged and its recorded hash remains authoritative.
