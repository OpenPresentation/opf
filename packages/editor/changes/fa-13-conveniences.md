---
type: added
---
FA-13: the slide-size picker lists the `1:1`, `4:5` and `9:16` presets (`SLIDE_SIZE_PRESETS`); the design controls have a Watermark text field and `setDesignOption('watermark', { text, opacity })` (text and image replace each other); the rich text toolbar has a Code button and a Language tag field, and `formatRichTextRange` accepts `code` and `lang`; the generic schema form keeps a `oneOf` of required-only branches (Watermark: `src` or `text`) as two labelled forms with the base's required fields. `code.highlight` is edited in the generic schema form.
