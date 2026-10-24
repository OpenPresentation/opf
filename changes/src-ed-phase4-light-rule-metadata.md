---
type: changed
packages: [opf]
---
`@openpresentation/opf/source` is smaller again (201,836 to 175,768 bytes gzipped in a browser bundle): `explain` and `describeFinding` read the rule list from a light metadata module instead of the validation rule implementations, so importing the source tools no longer pulls in the checker (composition, contrast, language tags). `validationRules`, `findValidationRule` and every rule field are unchanged, and `scripts/check-catalog-free.mjs` now fails when the source entry bundles a rule implementation.
