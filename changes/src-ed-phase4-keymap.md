---
type: added
packages: [editor]
---
Source editor keyboard (phase 4): every key binding is declared in one table (`source-keymap.js`) that installs the keymap and produces `getShortcuts()`, so the list cannot drift from the keys; a fold gutter, VS Code's fold chords (Cmd/Ctrl+K then 0, J, 1 to 7, L, `[` and `]`) and Fold/Unfold on the range around the caret, in JSON, YAML and Markdown (Markdown folds each slide, fence and the front matter in one pass); Go to line on Ctrl+G, Replace on Cmd+Alt+F / Ctrl+H, Expand line selection on Cmd/Ctrl+L, Expand and Shrink selection, Insert line above; Cmd/Ctrl+click goes to the definition instead of adding a cursor (Alt+click adds one, as in VS Code).
