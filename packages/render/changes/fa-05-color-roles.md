---
type: fixed
---
FA-05 (output-changing for decks that set color-scheme roles or contain links on a readable hyperlink color): the preview resolves the `background`, `surface`, `text` and `textSecondary` role overrides and the `accent` role exactly as the PPTX export does, through core `resolveColorRoles`; a `text` override applies on light slides only, and the `background` role or ColorRef means the slide's resolved background. A link run with no color of its own is drawn underlined in the scheme `hyperlink` color, as PowerPoint draws it (the slide text color where that has under 4.5:1 contrast against the slide). The dark-background decision is core's `isDarkColor`. The core examples `technical/design-backgrounds` slides 1-5 change because that deck sets `text`.
