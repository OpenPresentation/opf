---
type: added
---
FA-10: the canvas edits rich headline text like rich body text. A `TextRun[]` title, subtitle or tag and a `TextRun[]` quote text open the rich-text input (bold, italic, color, links through the toolbar; **Format text** now also appears on a plain title, subtitle, tag and quote text because the schema accepts runs there), the `cite`/`footnote` helpers take heading and quote run paths (`slides.0.title.1`, `slides.0.quote.text.1`), the outline, slide manager and template panel show a run heading by its plain text (an outline row for a run heading is not offered as a plain-text edit, so it is never flattened), and a rich quote's quotation marks no longer shift the caret. Needs core and renderer with FA-10.
