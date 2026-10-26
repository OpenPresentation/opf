---
type: changed
packages: [gallery]
drawing: ["layouts:pillars", "layouts:team", "layouts:faq"]
---
WI-6: the pillars, team and FAQ layouts set `design.listBullet: "none"`, so a label with its description draws without a bullet; the team layout also accepts a `list` block. The previews of pillars, process, team and FAQ show each label and description as one list entry (`items: [{ text, description }]`), and process numbers its steps with `numbering` instead of typed "1." prefixes.
