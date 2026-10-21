---
type: changed
---
RR-98: `createPresentButton` takes `variant: "quiet" | "primary"` (and the button has `setVariant`). The default is now `"quiet"`: a transparent icon button like the toolbar's undo and redo, with the icon in `--opf-ui-muted-fg` and a hover to `--opf-ui-fg` on `--opf-ui-muted`, the same control height and focus ring, so a lone icon next to a primary Export does not compete with it. `variant: "primary"` keeps the previous filled accent look of the Export trigger. The disabled state, `aria-label` and title are unchanged.
