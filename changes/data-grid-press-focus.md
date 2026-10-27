---
type: fixed
packages: [editor]
---
The data grid takes the keyboard focus within the press itself when a cell or a row or column header is clicked while slide text is being edited on the canvas. The canvas saves the text on blur and focuses the target it saved, and the grid took the focus back only from a timer, so a key pressed straight after the click (an arrow, Enter, typing) could reach the slide instead of the grid. Since the incremental font analysis made that save fast, the key arrived before the timer, and the data grid browser suite failed.
