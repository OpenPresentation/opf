---
type: fixed
packages: [opf, render, pptx]
---
RR-105: `portrait: "avatar"` on a team now draws the small circle over each name the schema describes, instead of the large picture of a top portrait: the team's text grows as a card row's does (up to a list's display size, filling at most 60% of each cell) and the circle scales with the name (`TEAM_AVATAR`: twice its line height, 56 px at least, half the card at most). Up to four people share one row and more a grid, in the preview and the PPTX export alike.
