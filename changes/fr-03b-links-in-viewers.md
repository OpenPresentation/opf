---
type: added
packages: [render, editor, mcp]
---
FR-03: links work where a slide is read, not edited. In the editor's `viewer` layout and any read-only editor the slide is no longer inert: a click or Enter on a `slide:<id>` link shows that slide (a hidden one too) and puts the focus on the slide, and a web, mail or phone link goes to the new `onOpenLink(href, event)` option, else opens a new tab with `noopener` and `noreferrer`; other addresses are ignored (`isOpenableLink` in `@openpresentation/opf-render/svg`). The canvas has `readOnly`, `setReadOnly`, `onLink` and `focusSlide`; an editable slide keeps a plain click for editing and follows a link on Ctrl or Cmd with the click. The editor emits a `link` event. The MCP viewer opens links through its host (`ui/open-link`) and shows the address in the footer where the host refuses. A slide draws as before.
