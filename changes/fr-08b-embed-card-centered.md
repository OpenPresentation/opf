---
type: changed
packages: [opf, render, pptx]
---
FR-08b: the generated card of an embed without a preview picture is centered and grows with the card. The badge, the title and the site name sit as one block in the middle of the panel, every line centered; the title's size is a tenth of the card's shorter side, between today's 28 pixels and a ceiling of 40 (at deck scale 1), and the badge, the gaps and the site name scale with it. The small forms are unchanged (a small frame keeps the badge and the title, a smaller one only the badge, both centered now). `embedCardLayout` decides everything for both engines and its text parts now carry `align` and `lineWidths`; the preview and the PowerPoint export only draw them. An embed with a preview picture, the links, the live frame and `OPF_EMBED_V1` are unchanged.
