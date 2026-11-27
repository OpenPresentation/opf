---
type: fixed
packages: [opf]
---
A font scheme record may carry `x-` keys again: 0.37.0 refused them ("must NOT have additional properties"), so every published record with an `x-gallery` block failed `validateCatalogRecord("fontSchemes", record)`. The old `languageFamily` key and every other unknown key are still refused.
