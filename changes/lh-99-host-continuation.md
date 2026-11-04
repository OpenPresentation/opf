---
type: added
packages: [opf, render, editor]
---
LH-99: hosts that draw slide by slide show the export's continuation of an overfull slide (LH-90) without shifting a source slide index.
    - Core: `continuationPages(result, slideCount)` maps a `continueOverfull` result back to the source slides (`pages[i]` lists the output indices that draw source slide `i`).
    - opf-render: the player, the speaker view, `<opf-deck>` and its thumbnails show a continued slide's pages as steps after it, each the export's own page (the same `toSvg` call on the export's deck). Slide numbers, `goto(n)`, the `slide` attribute, number-then-Enter and `slidechange`'s `slide` and `index` keep addressing source slides; the new `page` and `pages` (on the element, the session, `currentSlide` and `slidechange`), the `startPage` option and the counter (`2 / 3 · 2/2`) name the page. Next and previous step through the pages. `toHtml` draws each page as its own figure. `continuation="off"` and `continuation: false` draw every slide as written. Decks without an overfull slide draw exactly as before.
    - opf-editor: the slide is edited as written; the thumbnail strip and the slide list draw a continued slide as a stack with its page count, the canvas shows "Exports as 2 slides" with a read-only preview of each page (`canvas.pages`, `canvas.previewPage`, `onPages`), and the presenter shows the pages as steps (`getPage`, `onPageChange`). `continuation: false` on `createOpfEditor`, the canvas, the strip and the presenter turns it off.
