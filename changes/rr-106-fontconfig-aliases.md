---
type: added
packages: [render]
---
RR-106: `opf-preview-fonts <dir> --fontconfig <file>` also writes a fontconfig file that names the copied font directory and adds one alias per font-policy replacement (Aptos to Intos, Calibri to Carlito, Arial to Arimo, ...). On Linux one command gives LibreOffice, and every other app that resolves fonts through fontconfig, the faces OPF measures with, so exported text keeps its line breaks there. The same file is available as `fontconfigConf()` and `fontconfigAliases()` from `@openpresentation/opf-render/preview-fonts-node`. The LibreOffice qualification uses them for its documented font profile. docs/libreoffice.md documents the command, and documents `charts: "picture"` for the chartex types LibreOffice 26.8 cannot draw.
