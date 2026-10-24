---
type: added
packages: [editor]
---
Source editor phase 3 (problems in plain words): every problem of the source pane, in JSON, YAML and Markdown, is core's `describeFinding` sentence with a "Next:" line (the schema keywords with a did-you-mean, every `opf/*` rule, the YAML and Markdown readers), with a "Details" disclosure from `explain(ruleId)`. Quick fixes (Cmd/Ctrl+.) for YAML and Markdown syntax problems (Convert tabs to spaces, Insert closing quote, Insert ], Add a colon, Quote the value, Insert ---, Insert closing fence, Insert -->, Rename to layout, Insert column, Remove the slides key, Insert # Title, Add `numbering`, ...) and the new text fixes in all formats (Move into extensions, Convert to string, Wrap in a list, Add a slide), each one undo step and comment-preserving; a repair core ships as a patch is offered once, as the text edit. Warnings of the YAML and Markdown readers no longer stop the document from being applied.
