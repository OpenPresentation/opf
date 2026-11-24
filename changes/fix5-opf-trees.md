---
type: fixed
packages: [opf]
---
HI1, H2 (output-changing for `org-chart` and `hierarchy`): PowerPoint's tree is scaled as a whole to its region, so a three-level org chart drew as a narrow tree in under half the body, and a hierarchy with a fourth level or a label of about twenty characters ("Delivery of the work") did not hold its labels and fell back to a small bullet list. Core now also lays out OPF's own tree (`opfTreeGeometry`): the same tidy positions, rows and connectors scaled across and down on their own, each node as wide as the region allows and up to 0.75 of its width tall, centered; a hierarchy keeps its rear and front cards. It is drawn where PowerPoint's covers under half of the region or does not hold the labels, and PowerPoint's stays where it covers half or more and holds the labels at least as large. Both are exported as native shapes, as before. A root with seven children is still a row as wide as the region allows (its labels set the size).
