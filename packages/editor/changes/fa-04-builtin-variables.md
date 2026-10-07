---
type: added
---
FA-04: the header/footer controls and `ZONE_FIELDS` gain the `speaker` field (the first speaker's name and title) with a warning when the deck has no named speaker. The Fill template panel lists the document's built-in variables (`speaker.name`, `organization.logo`, `deck.name`, ...) read-only and offers them in the insert list; new `listBuiltins(document)` export in `@openpresentation/opf-editor/templates`, and `variableToken`/`insertVariableToken` accept built-in names without a declaration. Needs the core release with built-in variables.
