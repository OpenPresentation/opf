---
type: changed
packages: [editor]
---
The Design quick menu's bottom sheet (a phone): one section at a time behind a segmented switch (Theme, Colors, Fonts, Layout) that names each section's current choice, in one scroll container instead of three lists that each scrolled on their own, at about half the screen (55%, was up to 85%) so the slide above stays in view; a host can set its height with `--opf-design-menu-sheet-h`. New label `layoutTab` (default "Layout"). The popover on wider screens is unchanged.
