---
type: added
packages: [cli]
---
FA-10: `title`, `subtitle`, `tag` and `quote.text` accept `string | TextRun[]` (the same `TextRun`, including `color`, links, `cite` and `footnote`), so one word of an action title can carry the accent color and a headline claim or a quote can carry a citation marker. A string is unchanged byte for byte. `composeSlide` fits a `TextRun[]` heading through the rich-text layouter (`RichTextFit` on the item), `layoutQuote` fits a rich body (`QuoteTextPart.runs`, `fit` may be a `RichTextFit`; `QuoteLayoutOptions.citationMarker`), and heading markers are numbered before the body (tag, title, subtitle, then regions, blocks and the root payload). `var:<id>` keeps a rich text variable's runs in a heading, `validate` checks contrast per heading and quote run, pagination slices a rich quote, and Markdown keeps inline formatting in `#`, `##` and quote text both ways (the `formatting-dropped` warning now covers only a quote's attribution and source).
