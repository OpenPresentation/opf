---
type: fixed
packages: [opf]
---

The `data-story-academy-corporate-programs` example no longer draws a hand-drawn ring and arrow in the background pictures of slides 3 and 4 to point at a chart value. PowerPoint lays a native chart's plot out itself, so those strokes landed beside the bar and label in PowerPoint; the highlighted bar now carries the emphasis in both engines. A core test checks that no example's background artwork draws a stroke inside a native chart's frame. Found by the v0.33 PowerPoint qualification (RR-105).
