---
type: changed
packages: [opf]
---
LH-189 (output-changing for display text): a title or subtitle, a slide's message text, a one-message quote's body and a growing lone metric's value set at twice the body size or more take, where their script has case or they are figures, a line pitch of 1.0 em instead of 1.22 em and -1.5% tracking (Arabic, Hebrew, CJK and other scripts without case keep both as before), and a metric label or quote attribution set in capitals takes the eyebrow's +8% tracking (`linePitch`, `displayFrom`, `DISPLAY_TRACKING`, `displayTracks`, `capitalsLabel`; `fitText` and `RichTextOptions` take `displayFrom`). Measurement, the preview and the PPTX export read the same fit and style, so the export writes each line one em apart and the tracking as `spc`; headings over a measured background picture keep the body pitch, since LH-158 places them on the picture by their height.
