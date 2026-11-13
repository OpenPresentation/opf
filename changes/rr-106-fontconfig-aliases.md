---
type: added
packages: [render]
---
RR-106: `opf-preview-fonts <dir> --fontconfig <file>` also writes a fontconfig file with one alias per font replacement (Aptos to Intos, Calibri to Carlito, Arial to Arimo, ...), so LibreOffice and other fontconfig apps on Linux use the faces OPF measures with. The same file comes from `fontconfigConf()` and `fontconfigAliases()` in `@openpresentation/opf-render/preview-fonts-node`.
