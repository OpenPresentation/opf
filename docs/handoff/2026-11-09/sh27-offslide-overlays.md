# SH-27: intentional slide-edge bleed

The owner manually set the first decorative ellipse's y to -0.1. Its JSON was syntactically valid, but OverlayShape's authoritative schema restricted x/y to 0–1. The editor therefore showed the last valid slides and disabled normal updates/downloads. -0.1 means the top of the shape is 10% of slide height above the slide, preserving the remaining visible glow.

Source inspection also found composition discarding signed origins, editor frame/detach clamping, and PPTX import clamping. This isolated branch starts from fresh origin/main. All four paths are changed together; automatic layout and image focal-point fractions are outside scope.

Vetoable decision: accept finite signed x/y fractions, preserve the authored coordinate without clamping, and keep existing width/height limits. RTL keeps its existing mirroring convention. The slide viewport crops the visual output; the native shape retains its whole geometry for later editing.

State: implementation and meaningful schema/core, editor undo/detach/resize, SVG and native PPTX transform/current-position import controls authored. Required mapped checks, representative rendered inspection and review are still owed. No release or deployment performed.
