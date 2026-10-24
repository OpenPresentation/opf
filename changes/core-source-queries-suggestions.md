---
type: added
packages: [opf]
---
A finding for an unknown property (`opf/schema`, keyword `additionalProperties`) carries up to three `suggestions` of the nearest property names that the same object's schema declares (edit distance 2, or 1 for names of three characters or fewer, case-insensitive, nearest first): `slids` suggests `slides`, `tilte` suggests `title`. Each suggestion is `{ value, label, origin: "schema", definition }`; an enum finding still carries its allowed values, and `validation.params.allowedValues` still has all of them.
