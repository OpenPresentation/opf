---
type: changed
packages: [editor]
---

The thumbnail strip's starter words (Title, Bullets, Blank, the add button's text, the content they add and the starter status lines) are now `labels` of `createThumbnailStrip`, reachable through `labels.thumbnailStrip` of `createOpfEditor`, and the hint shown while a slide title is edited with `titleEnterCommits` is `canvas: { labels: { titleEnterHint } }`; the defaults are the English text they had. Tests now cover `nameFromOpeningTitle`, the slide shapes the starters add, the strip's starters and actions button, and `titleEnterCommits`. The `textEntry` option of the canvas has its documentation back.
