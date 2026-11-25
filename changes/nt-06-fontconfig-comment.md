---
type: fixed
packages: [render]
---
NT-06: the file `opf-preview-fonts --fontconfig` writes is well-formed XML again. Its header comment contained a double hyphen, which XML forbids, so fontconfig refused the whole file and LibreOffice used stock fonts instead of OPF's.
