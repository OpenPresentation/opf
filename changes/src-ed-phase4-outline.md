---
type: added
packages: [editor]
---
Source editor (phase 4): the symbol picker (Cmd/Ctrl+Shift+O) lists the slides, assets, datasets, variables, references, sections and embedded catalog records of a JSON, YAML or Markdown document, filtered as you type, from text that does not parse too; `pane.getOutline()`, and the opt-in `outline` option adds an Outline button and a panel that follows the caret; the keyboard shortcuts dialog (F1, Cmd/Ctrl+K Cmd/Ctrl+S, the `?` button) with `pane.getShortcuts()` and `pane.showShortcuts()` (`onShowShortcuts` for a host's own dialog).
