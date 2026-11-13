---
type: changed
packages: [pptx]
---
RR-105 (#1290): File > Info shows the deck's `tags` as Tags (`cp:keywords`, joined with "; ") and an authored `language` (`dc:language`), and `docProps/app.xml` names "OPF" as the application instead of PowerPoint; import reads keywords back as `tags` (tags edited in PowerPoint win over the stored ones); the language keeps coming from the runs. Company is the deck's primary organization name, and no longer the fixed "OpenPresentation" when the deck has none.
