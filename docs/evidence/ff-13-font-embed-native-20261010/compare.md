# FF-13 native audit (0.18)

Generated 2026-10-10T21:50:11.217Z by `compare.mjs` from the native read-outs of `native/attempt-1`. Packages: `@openpresentation/opf` 0.18.1, `@openpresentation/opf-render` 0.18.0, `@openpresentation/opf-pptx` 0.18.0, `@openpresentation/opf-editor` 0.18.0, `fontkit` 2.0.4. PowerPoint 16.0 build 20430, Microsoft Windows NT 10.0.26200.0, culture en-US.

## FF-13

Criterion: One supervised SaveAs of a copy with EmbedTrueTypeFonts into a fresh directory; the OPC audit shows exactly the chosen fonts (Carlito) embedded, and the source is unchanged.

**PASS** (attempt attempt-20261010T214806Z).

Embedded typefaces: Carlito; parts: ppt/fonts/font1.fntdata (regular, Carlito, 44828 bytes); ppt/fonts/font2.fntdata (bold, Carlito, 49568 bytes); ppt/fonts/font3.fntdata (italic, Carlito, 44867 bytes); ppt/fonts/font4.fntdata (boldItalic, Carlito, 44157 bytes).

- warning: harness: worker exit code not captured (ff13-supervise.ps1 before the handle fix); success taken from status completed and report.json
- warning: harness: the System.Drawing probe never resolved Carlito, also during registration (GDI+ caches its font list at first use in the supervisor process, so a probe after AddFontResourceExW does not see it); AddFontResourceExW returned 1 for every face, and the saved copy is the evidence
- warning: diagnostic reopen: PowerPoint does not report Carlito as embedded ([{"index":1,"name":"Carlito","embedded":0,"embeddable":-1}]); the OPC audit is the criterion
