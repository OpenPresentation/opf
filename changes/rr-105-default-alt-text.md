---
type: changed
packages: [pptx]
---
RR-105 (#1290): charts, tables, organization logos and quote photos without an authored `alt` get a generated description (for example "Column chart: Sales and Cost by Quarter, 3 categories", "Table: Team, People and Open roles; 3 rows", "Acme logo", "Photo of Ada Lovelace"), so PowerPoint's Accessibility Checker no longer reports missing alternative text on them; an authored `alt` still wins, `""` stays decorative, and import leaves a description equal to the generated one out of the document. For charts and tables import also leaves out any description in the generated form, so a description that went stale when a series or a column was renamed in PowerPoint does not come back as an authored `alt`.
