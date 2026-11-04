---
type: changed
packages: [opf]
---
LH wave 5 integration (output-changing where two wave 5 features meet): LH-39's figure rule (`metric-figure`) runs on top of the rules the size guard keeps, and LH-50's eyebrows, LH-08's automatic ruled rows and LH-07's step badges are guarded rules of the same one guard in `composeSlide`. A list in a `sequence` region keeps its step badges and is not given automatic ruled rows (a badge list drew rows instead of badges otherwise). A cover's or section's tag keeps LH-32's 22 px eyebrow size when LH-129 grows the title and subtitle (`HEADING_DISPLAY_SIZES.tag` is 22). LH-07's whole-slide check compares the slide settled with and without badges, LH-129's growth included, and the automatic scrim of a picture background (LH-02) is computed over the slide that is kept. A slide that composes no metric is no longer composed a second time for the figure rule (the same output, faster).
