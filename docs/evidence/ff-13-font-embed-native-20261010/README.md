# FF-13: native PowerPoint font-embed attempt on the 0.18 packages (2026-10-10)

This re-runs [opf#323](https://github.com/OpenPresentation/opf/issues/323) section 4 on a fixture exported with the published 0.18
packages. FF-13 passed on 0.12 in [ff-13-font-embed-native-20261005](../ff-13-font-embed-native-20261005/README.md).

**Result: PASS.** PowerPoint embedded exactly one family, Carlito, in its four styles, and nothing else. The source is unchanged.

**Owner decision (2026-10-05, unchanged).** Saving a copy is allowed for this item: one `SaveAs` of a copy into a fresh directory,
never over the source. Every other native read stays read-only.

## Host and method

- **Host:** Windows 11 (`Microsoft Windows NT 10.0.26200.0`), PowerPoint 365 16.0 build 20430. The supervisor session ran Office;
  an agent built the fixture and scripts.
- **Fixture.** `ff13-carlito-embed-source.pptx` was exported with the published `@openpresentation/opf` 0.18.1 and
  `@openpresentation/opf-pptx` 0.18.0 ([fixture.json](fixture.json)).
  - Every run and the theme `latin` and `ea` slots are Carlito.
  - Slide 1 uses regular, bold, italic and bold italic.
  - Source sha256 `70bd9c1e…4b5f5f`, unchanged after the attempt ([report.json](report.json)).
- **Font registration.** Carlito is not installed on this host.
  - The four OFL faces of the npm package `@expo-google-fonts/carlito` 0.4.1 were registered in place, for the session only:
    `AddFontResourceExW(path, 0)`, which returned 1 for each face, plus a `WM_FONTCHANGE` broadcast.
  - They were removed afterwards with `RemoveFontResourceExW`, which returned true for each face.
  - Nothing was copied and no registry entry was made ([font-registration.json](font-registration.json)).
- **One attempt** in the fresh directory `ff13/attempt-20261010T214806Z`, in one child `powershell.exe` with a 90 s deadline, with
  no retry ([supervisor.json](supervisor.json), [stages.jsonl](stages.jsonl)). The worker:
  1. opened the source read-only with `Presentations.Open(path, -1, 0, 0)`;
  2. checked that `Presentation.Fonts` lists only Carlito (embeddable);
  3. saved one copy with `SaveAs(<attempt>\copy.pptx, 24 /* ppSaveAsOpenXMLPresentation */, -1 /* EmbedTrueTypeFonts */)`;
  4. closed it;
  5. reopened the copy read-only for a diagnostic read.

  It never saved over the source, and never quit or killed PowerPoint.

## OPC audit of the copy ([compare.json](compare.json))

`ppt/presentation.xml` has `embedTrueTypeFonts="1"` and `saveSubsetFonts="1"`. Its embedded-font list has one entry, Carlito,
with four styles:

| Part | Style | EOT family | Bytes |
| --- | --- | --- | --- |
| `ppt/fonts/font1.fntdata` | regular | Carlito | 44828 |
| `ppt/fonts/font2.fntdata` | bold | Carlito | 49568 |
| `ppt/fonts/font3.fntdata` | italic | Carlito | 44867 |
| `ppt/fonts/font4.fntdata` | bold italic | Carlito | 44157 |

There are no other font parts, embedded-font relationships or typefaces. The EOT family name is compared with its trailing NULs
stripped, as audit v2 of 2026-10-05 does.

## Harness notes (not gated)

- **Exit code.** `supervisor.json` records the worker's `exitCode: null`. `ff13-supervise.ps1` did not cache the child's process
  handle, which is the same harness bug as the read-only runs. The worker reached `stage: done` with no error and saved the copy, and
  the audit is the criterion. The supervisor script now caches the handle.
- **GDI+ probe.** The System.Drawing probe in `supervisor.json` resolved "Carlito" to Microsoft Sans Serif even while the faces were
  registered. GDI+ builds its font list once, at the first probe before registration, so later probes in the same process cannot see
  session fonts. That makes the probe uninformative, not a failed registration: `AddFontResourceExW` succeeded, and PowerPoint
  embedded Carlito.
- **Diagnostic reopen.** PowerPoint's `Font.Embedded` reads 0 for Carlito on the reopened copy, as it did on 2026-10-05. The OPC audit
  is the criterion.

## Files

- [compare.md](compare.md) and [compare.json](compare.json): the audit (OPC parts, EOT identities, native fonts, warnings).
- [report.json](report.json), [stages.jsonl](stages.jsonl) and [supervisor.json](supervisor.json): the worker's read, its stages and
  the attempt lifecycle.
- [font-registration.json](font-registration.json): the four registered files (sha256, added, removed).
- [fixture.json](fixture.json): the fixture's sha256, expected fonts and theme slots.

The source, the saved copy and the font files are not committed. Host paths are written as `<set>`.
