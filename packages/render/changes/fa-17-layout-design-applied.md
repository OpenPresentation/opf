---
type: changed
---
FA-17 (output-changing for decks whose layout sets alignment, content box or image fill and whose deck and slide do not): the preview takes text alignment from the composed item and `imageFill` from core's effective `design` (`SlideComposition.design`: slide design, then deck design, then the slide's layout record `design`, then the engine default). It no longer passes the deck's alignment and content box to composition or falls back to the deck's `titleAlignment`/`contentAlignment`/`imageFill` when composing text and images, so a layout value nobody overrides is drawn, as the PPTX export draws it. Stacks on FA-01; needs the FA-17 core.
