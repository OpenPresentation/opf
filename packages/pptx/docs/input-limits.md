# PPTX input limits

`fromPptx`, `inventoryTypefaces` and `checkTypefaces` bound local untrusted archives. No network or native application runs. These fixed safety limits are not caller options:

| Resource | Maximum |
| --- | --- |
| Compressed ZIP input (outer or nested) | 64 MiB |
| Expanded member | 64 MiB |
| Expanded XML or relationships part | 16 MiB |
| Members, shared across an operation and nested archives | 10,000 |
| Expanded bytes, shared across an operation and nested archives | 256 MiB |
| XML element nesting | 256 |
| Embedded archive nesting | 16 |

`OPFPptxError` code `pptx-limit-exceeded` carries `details.limit`, `details.maximum`, `details.actual` and, where available, `details.path`. Malformed archives, duplicate/noncanonical member names, unsupported compression, mismatched directory/member sizes and XML document entities report `invalid-pptx`. Normal ZIP data descriptors are supported. There is no compression-ratio cutoff.

The directory is inspected without inflating first. Streaming extraction counts actual output in bounded compressed chunks; it does not trust a declared expanded size. Embedded workbook reads and typeface inventory share the outer budget; revisiting one workbook uses its cached result. The expanded budget includes the nested archive's compressed bytes as an outer member and its expanded contents. Generated exporter-internal archive transformations remain separate from these untrusted-input readers.

These checks bound resource use and reject malformed input; they do not authenticate ZIP CRC, OPF provenance tags, publisher identity or native visual fidelity. Keep the original OPF as the canonical source and inspect import diagnostics for conversion loss.
