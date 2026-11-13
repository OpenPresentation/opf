---
type: added
packages: [opf]
---
LH-30: a template group (a block or region with `blocks`) whose content variables are all optional and all unfilled is left out when the deck is resolved, so a slide never draws a portrait or a card without the quote it framed. `resolveVariables` reports it as `variable-group-omitted`, validation reports the new info rule `opf/variable-group-omitted`, and unknown variables inside such a group are still reported.
