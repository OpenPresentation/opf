---
type: changed
packages: [pptx]
---
SH-23: OPF's own SmartArt layout definitions carry a table for 1 to 12 entries (they stopped at 8), so a ninth to twelfth entry a PowerPoint user adds to an OPF design is drawn in that design at the same frame instead of not being drawn; more than 12 take the 12-entry table. A design whose larger tables do not hold keeps tables up to 8. The layout part of every live OPF design changes (four more branches and a new `uniqueId` digest); the slides draw the same.
