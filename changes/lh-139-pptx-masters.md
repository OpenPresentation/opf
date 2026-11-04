---
type: fixed
packages: [pptx]
---
LH-139, LH-140, LH-146: three PowerPoint fixes to the PPTX export, each proven by adding slides in PowerPoint through COM.

- A deck with a fixed hex, gradient, pattern or picture background (`design.background`, or its theme's) now writes that background on the slide master, and its layouts inherit it, so a slide added in PowerPoint (New Slide, Change Layout) draws on the deck's background instead of the master's bg1 (black or white) with the deck's text color on it. The master's default text color follows the background, as for a theme-slot background. A picture background reuses the media the slides embed and is related to the master with the same fit, focus, opacity and recolor. A layout variant (LH-01, LH-96) keeps its own bg1 background per layout, and slides keep writing their own background.
- The subtitle placeholders of the template layouts, and the body or content placeholders whose region does not lead with a list (the Text layout's body, the closing details), say `<a:buNone/>` with no hanging indent in their list style, so text typed into a slide added in PowerPoint shows no stray master bullet. A region that leads with a list (List, Agenda, FAQ) keeps the master's bullets, and the automatic grid's body is as it was.
- The step-badge numeral of a right-to-left deck is an en-US run (`lang="en-US"`), so PowerPoint draws it in the bold body face as the preview does, not in the smaller, lighter complex-script face it uses for the digits of an `ar-SA` run (runs name no `cs` face, FF-05). Left-to-right decks keep their bytes.

Decks with no fixed background, no template layouts and no right-to-left step badges keep their bytes: the rr-54 byte locks do not move.
