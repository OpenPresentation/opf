---
type: added
packages: [opf]
---
RR-105: the layout diagnostic and validation rule `mark-crowded` (`opf/mark-crowded`, warning) report a mark drawn without room to read clearly that no size or arrangement changes: a timeline period shorter than its marker (its `duration` proportions are the author's) or a chart reference label that collides with a data line or another label. Neither is text overflow any more, so a strict composition (`overflow: "error"`) reports them and does not refuse the slide; a reference label past its chart stays `text-overflow`, and every reference diagnostic names the authored `referenceLines.<n>` entry.
