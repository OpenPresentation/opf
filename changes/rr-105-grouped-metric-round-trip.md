---
type: fixed
packages: [pptx]
---
RR-105: a metric whose numeric value or delta is drawn with grouped thousands ("1,500", "150 000", "150.000", "١٥٠٬٠٠٠"; LH-141) imports back as that metric instead of plain text blocks with `invalid-metric-provenance`. The OPF_METRIC_V1 record names the drawn text, and the import accepts it only when it spells the record's number (digits of one script, group separators, one decimal separator, a minus); a record without it, as v0.33.0 wrote it, is read from the slide's own text when that spells the number. A grouped number edited in PowerPoint imports as the new number, read with its export's separators; a record whose text or ranges do not match is still refused.
