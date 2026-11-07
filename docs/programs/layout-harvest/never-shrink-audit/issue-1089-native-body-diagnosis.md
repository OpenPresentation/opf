Diagnosis for opf#1089, from the never-shrink audit. The cause is native mode's box, not autofit or the composed size.

`addNativeBody` (`packages/pptx/src/native-body.js:141-143`) writes the body as one text box at exactly core's item box: `w: box.width`, zero insets (`textBoxOptions` margin 0), `wrap: true`, `noAutofit`. There is no slack. PowerPoint breaks the lines itself, so a one-line card text that core measured to fill nearly the whole width breaks in PowerPoint: PowerPoint's advance widths and kerning differ from core's measurement by a fraction of a percent. The second line then runs past the card's bottom. Measured mode is unaffected, because it writes each line as its own `wrap="none"` box at core's line geometry.

Fix options:
1. **Right-side slack.** Widen each native body box by about one average character at its size (or a fixed share of the font size), clamped to the card's or region's inner edge so it never draws over the card's border. Left and center alignment keep their anchor (center widens both sides by half).
2. **Measured-lines fallback.** In `planOne`, reject the native body (`reject('tight-line')`) when any of core's lines comes within about 2% of the box width, and keep measured shapes for that block.

Option 1 keeps the body editable as one box. Option 2 is the safer guarantee. Both can ship together: slack first, the fallback for whatever slack can't cover.

Check needed: export layout-sampler slide 41 and the rest of the sampler with `--body-text native`, open them read-only in PowerPoint over COM, and compare each native body's `TextFrame2.TextRange.Lines().Count` with core's line count. Every body must match, including the one-line card texts. Tell the qualification session before using PowerPoint.

Target 0.34 (agreed with the supervisor): native mode is opt-in, and the bug predates the 0.33 batch.
