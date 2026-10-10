---
type: changed
---
RR-59 (opf-editor#137): the README states that IME input is not certified. Real Japanese, Chinese and Korean input methods are not tested; only synthetic `CompositionEvent`s are, for the rich-text input and the canvas commit guard (`test/rich-input-browser.mjs`). It names the composition handling that exists in the canvas, the rich-text input, the data grid, the outline view and the design controls, and says the data grid, outline view and design controls have no composition test.
