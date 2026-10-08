---
type: fixed
---
FA-30: the canvas works with the renderer's accessibility attributes. The renderer now labels the slide root a "slide" group and hides decorative drawing and pictures or charts with an empty `alt` (`aria-hidden`); the canvas keeps its "Editable slide" name without a second "slide" description, and an editing target is never hidden or inside a hidden group (it stays a focusable button), and a chart's `alt` group above targets is a plain named group instead of an image, so the targets inside it are reachable.
