---
type: changed
packages: [pptx]
---

Add bounded native-chart qualification for a literal series-name edit: strict prevalidation, exact current-name and duplicate guards, one native Name setter/readback, and original/edited/read-only-reopened verification through the owned SaveCopyAs lifecycle. This does not edit native values or activate a workbook; actual edit/import acceptance remains required.
