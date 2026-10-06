# FF-13: native PowerPoint font-embed attempt (2026-10-05)

[opf#323](https://github.com/OpenPresentation/opf/issues/323) section 4 asks for one supervised font-embed attempt from
merged main. It must run in a fresh directory and be audited pass or fail. If it passes, the OPC audit must show exactly
the chosen fonts embedded.

**Result: pass, on the corrected audit.** PowerPoint embedded exactly one family, Carlito, in its four styles, and
nothing else. The first audit (v1) reported FAIL because of a parser bug, explained below. Both audits are committed.

**Owner decision (2026-10-05).** Saving a copy is allowed for this item: one `SaveAs` of a copy into a fresh directory,
never over the source. The standing native rule is still read-only for everything else. The first attempt
([windows-native-font-embed-20260922](../windows-native-font-embed-20260922/README.md)) failed closed before `SaveAs`,
because PowerPoint listed `Aptos`. That was the FF-05 behaviour, fixed in opf-pptx 0.12.1 (opf-pptx#152).

## Host and method

- Windows 11 with desktop PowerPoint 365, `Application.Version` 16.0 build 20430.
- The supervisor session ran Office and the temporary font registration. An agent built the fixture and scripts without
  opening Office.
- **Fixture.** It was exported with the published `@openpresentation/opf-pptx` 0.12.3, whose npm `gitHead` `1188964` is
  opf-pptx main, with `@openpresentation/opf` 0.12.1 ([fixture-generation.json](fixture-generation.json)).
  - Every run and the theme `latin` and `ea` slots are Carlito.
  - Slide 1 uses regular, bold, italic and bold italic.
  - There is no Aptos and no embedded font.
  - Source sha256 `fa0db6d03fa2755c64f24040267911712fd47df764e967f757c93713bee18858`; it was unchanged after the attempt.
- **Font registration.** Carlito is not installed on this host. The four OFL faces from the npm package
  `@expo-google-fonts/carlito` 0.4.1 were registered in place, for the logon session only (no copy and no registry):
  - `AddFontResourceExW(path, 0)` plus `WM_FONTCHANGE` before the attempt;
  - `RemoveFontResourceExW` afterwards ([font-registration.json](font-registration.json)).

  GDI probes in [supervisor.json](supervisor.json) checked the registration. Carlito resolved to Arial before, to
  exactly the registered files during the attempt, and to Arial again after removal.
- **One attempt** in a fresh directory, in one child `powershell.exe` with a 90 s deadline and no retry. It exited 0.
  The worker ([stages.jsonl](stages.jsonl), [report.json](report.json)):
  1. opened the source read-only with `Presentations.Open(path, -1, 0, 0)`;
  2. checked that `Presentation.Fonts` lists only Carlito (embeddable);
  3. saved one copy with `SaveAs(<attempt>\copy.pptx, 24 /* ppSaveAsOpenXMLPresentation */, -1 /* EmbedTrueTypeFonts */)`;
  4. closed it;
  5. reopened the copy read-only for a diagnostic read.

  It never saved over the source, and never quit or killed PowerPoint.

## OPC audit of the copy

`ppt/presentation.xml` has `embedTrueTypeFonts="1"` and `saveSubsetFonts="1"`. Its embedded-font list has one entry:

```xml
<p:embeddedFont><p:font typeface="Carlito" panose="020F0502020204030204" pitchFamily="34" charset="0"/>
  <p:regular r:id="rId4"/><p:bold r:id="rId5"/><p:italic r:id="rId6"/><p:boldItalic r:id="rId7"/></p:embeddedFont>
```

| Part | Style | EOT weight | Bytes |
| --- | --- | --- | --- |
| `ppt/fonts/font1.fntdata` | regular | 400 | 46474 |
| `ppt/fonts/font2.fntdata` | bold | 700 | 51205 |
| `ppt/fonts/font3.fntdata` | italic | 400 | 46780 |
| `ppt/fonts/font4.fntdata` | bold italic | 700 | 46192 |

There are no other font parts, embedded-font relationships or typefaces. The parts are subset EOT data, because
PowerPoint keeps `saveSubsetFonts="1"`. That is about a twelfth of the full 580–745 KB faces.

## The two audits

- **[audit.json](audit.json) (v1): FAIL.** Each part was failed with `identifies as "Carlito\u0000", not Carlito`. The
  EOT `FamilyName` field written by Windows' embedding API ends with a null terminator, and v1 compared the raw string.
- **[audit-2.json](audit-2.json) (v2): PASS.** v2 changes only one thing: trailing NULs are stripped from the EOT family
  name before the comparison. It re-audits the same attempt directory offline. PowerPoint was not run again, and the
  attempt was not retried. The audit's 16 offline controls (8 OPC and 8 lifecycle cases) pass with v2.

**One warning in both audits.** On the diagnostic reopen, PowerPoint's `Font.Embedded` reads 0 for Carlito even
though the copy embeds it. The reopen happened while Carlito was still registered on the host, and the OPC audit is the
criterion. It is recorded, not gated.

## Files

- [supervisor.json](supervisor.json): the attempt lifecycle, the font probes before, during and after, and the child
  process record.
- [report.json](report.json), [stages.jsonl](stages.jsonl) and [request.json](request.json): the worker's read and its
  stages.
- [audit.json](audit.json) (v1, FAIL) and [audit-2.json](audit-2.json) (v2, PASS).
- [font-registration.json](font-registration.json): the four registered files (sha256, added, removed).
- [fixture-generation.json](fixture-generation.json): how the fixture was exported.

The source, the saved copy and the font files are not committed. Host paths are written as `<set>`.
