---
type: changed
---
FA-17 (output-changing for decks whose layout sets alignment, content box or image fill and whose deck and slide do not): the export takes `titleAlignment`, `contentAlignment`, `contentBox` and `imageFill` from core's effective `design` (`SlideComposition.design`: slide design, then deck design, then the slide's layout record `design`, then the engine default) instead of reading the deck and slide itself, so a layout value nobody overrides is drawn as the preview draws it. The export no longer copies or derives alignment itself; every text paragraph's `algn` is the composed item's `alignment`. Stacks on FA-01; needs the FA-17 core.
