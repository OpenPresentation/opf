---
type: fixed
packages: [opf, editor]
---

An unknown key that is close to a declared one now says so in the finding itself, so `opf validate`, the MCP `validate_deck` tool and every other reader of `validate` get what the editor's Source pane already showed: `design.contentAligment` reports `Did you mean "contentAlignment"?` in `help`, next to the `suggestions` and the rename fix it already carried. The Source pane takes the order of core's suggestions for its message and its rename fixes, so `lang` on a text run offers `language` before `link`.
