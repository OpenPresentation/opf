---
type: fixed
packages: [editor]
---
The other occurrences of a selected word in the code editor and the source pane keep their text readable. The match tint drops from 25% to 16% of the `warning` token, and a `warning` underline marks the matches instead. A key under a match in the dark scheme was 4.2:1 and is now 5.3:1, and every code color stays at 4.5:1 or more in both schemes. `test/selection-contrast-browser.mjs` now measures word matches, for a word in a string and for a key, in JSON, YAML, Markdown and the JSON editor.
