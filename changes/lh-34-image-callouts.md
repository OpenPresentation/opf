---
type: added
packages: [opf, render, pptx]
---
LH-34: Image payloads accept fractional visible-frame `callouts`, drawn above picture effects as real SVG text and native editable PowerPoint panels/line boxes. Text grows from the body role without shrinking; overflow is reported. Native import keeps current words and fractional frames only with complete valid picture/panel provenance; damaged records retain ordinary native content. Images without callouts retain their drawing.
