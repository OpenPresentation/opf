---
type: fixed
packages: [editor]
---
The layout editor's touch targets are 44px under a coarse pointer, at any width: the zoom buttons (were 40px), the validity button (38px), the inspector's Row and Column segments (42px), the remove button of a design hint (40px) and the Bleed checkbox (its label is now the 44px target) no longer sit a few pixels under the control height. The `--opf-lx-*` sizing yields the full control height under `(pointer: coarse)` (`--opf-lx-zoom-btn`, `--opf-lx-pill`, `--opf-lx-seg`, `--opf-lx-row`, `--opf-lx-chip`), so a host needs no override; a mouse keeps the compact sizes. `test/mobile-touch-browser.mjs` now audits the layout editor state by state and runs at an 820px touch tablet width.
