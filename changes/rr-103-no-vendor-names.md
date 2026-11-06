---
type: changed
packages: [opf, pptx, gallery, mcp]
---

RR-103: no third-party API names in OPF. The chart-type records no longer carry a `mappings.renderers` entry naming a vendor API (the `renderers` field stays in the schema as opaque renderer metadata), the schema descriptions define the supported chart types as those OPF renders and exports natively, and the PPTX chart table drops its vendor field. Chart types, records and exports are unchanged.
