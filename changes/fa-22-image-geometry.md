---
type: added
packages: [opf]
---
FA-22: composition geometry for the 0.15 images. `SlideComposition.backgroundImage` is the effective picture background (the slide's, the deck's, then the new `ComposeSlideOptions.themeBackground`, which `resolveSlideContext` passes) with its canvas frame, fit, focus, opacity, recolor and overlay box. Every image item carries `ComposedItem.image`: region, frame, fit, focus, mask (`ImageShape`: the DrawingML preset and the SVG outline), border, opacity, recolor, overlay (`ComposedOverlay`) and placement (`ComposedPlacement`), computed with the treatment code 0.14 used for the slide image, so the gallery treatments keep their frames. `fitImage(frame, fit, aspect, focus)` is the shared fit and focus math (a cover crop keeps the focus point in view), `imageBackground(value)` reads either background form, and `imageShape` replaces `slideImageShape`. `SlideComposition.slideImage` is gone.
