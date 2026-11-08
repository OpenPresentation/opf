# RR-105 native run direction — bounded candidate, 2026-11-08

This source lane follows exact integration `67dd9ec10b7019cb95807f59c75186482c800f10` through a normal merge from freshly fetched `origin/main`. It does not alter the frozen PR1208 source or any earlier witness.

The coordinator observed reversed native glyphs in two additional cases: explicit ar-SA Latin text with ASCII digits, and inherited Latin text with Arabic-Indic/Persian digits. The existing D3 inherited-language adapter intentionally excludes these cases. Serialization/import checks alone did not detect the visual defect.

Vetoable decision: qualify the native run property `a:rtl val="0"` independently of proofing language. The first candidate only changes owned OPF text/list shapes on RTL slides, with an explicitly LTR paragraph containing Latin and decimal digits and no strong RTL letters. Its language adapter is unchanged. Existing run-direction children are retained. No text, codepoint, proofing attribute, font, box, numbering or OPF API is changed.

The [Microsoft RightToLeft reference](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.righttoleft) distinguishes native run direction/complex-script formatting from language. The [SDK DrawingML schema](https://raw.githubusercontent.com/dotnet/Open-XML-SDK/main/data/schemas/schemas_openxmlformats_org_drawingml_2006_main.json) puts the optional run child after hyperlinks and before the extension list. Strong RTL text must not receive the off property. These sources establish the property and grammar; they do not establish PowerPoint fidelity for this candidate.

Seven focused source-level controls pass, including two digit scripts, NFD preservation, authored Arabic/French, mixed/strong RTL exclusions, an ordinary LTR deck, foreign shapes, child order and existing direction. Five substantive missing-markup controls failed on the exact baseline before implementation; raw first failures are preserved in the task evidence directory for publication. The complete candidate build, real exports/imports and required mapped checks remain pending at this checkpoint.

The coordinator alone must qualify fresh owned probes in PowerPoint original/save/reopen states and inspect readable glyphs, unchanged geometry and source import. No native pass, release, site acceptance, schema addition, Office action, golden update or archive-lock promotion is claimed.
