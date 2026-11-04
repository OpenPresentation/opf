---
type: changed
packages: [pptx]
---
LH-96 (output-changing for decks that write template layouts): PowerPoint's own slide layouts for section, statement, quote and closing, the ones New Slide and Change Layout offer, carry the layout's variant (LH-01): its color map as the layout's `p:clrMapOvr` and a bg1 background, so a slide added in PowerPoint draws on the accent (section), the tone-relative surface (statement and quote) or the brand (closing) as an exported one does, with its text on the variant's text slot. A fixed deck background still beats the variant (LH-103) and leaves those layouts as they were. An exported slide on one of these layouts that draws on the master's map (its own variant or background) now states that map, so it does not inherit the layout's. Other layouts and the other slides do not change; a PowerPoint-made slide on these layouts imports on its layout without a spurious white background.
