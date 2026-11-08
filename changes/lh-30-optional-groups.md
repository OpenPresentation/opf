---
type: added
packages: [opf]
---
LH-30: a template group (a block or promoted region with `blocks`) whose content variables are all optional and all unfilled is now omitted whole when the deck is resolved, its pictures, cards and other text with it, so a slide never draws a portrait or a card without the quote it framed. A group that uses no content variable, or any required or filled one, is kept; color variables and built-ins do not count. `resolveVariables` reports each omitted group as `variable-group-omitted` (info). Validation fills every variable with a sample and so cannot see the omission: the new info rule `opf/variable-group-omitted` reports the group instead, with `describeFinding` text and an `explain` example.
