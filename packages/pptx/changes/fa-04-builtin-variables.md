---
type: added
---
FA-04: built-in variables (`{{speaker.name}}`, `var:organization.logo`, `{{deck.name}}`, ...) resolve before export, and the `speaker` header/footer field exports as static text ("Name, Title"). Furniture provenance records the speaker id and name length so import restores the `speaker` flag and the first speaker's name and title (like the organization field); stored speakers win where the line is unedited, an edited line is the new value, and disagreeing slides report a conflict. A manifest with a `speaker` part is rejected by importers that predate this change (they validate the part list strictly). A built-in with no source value is reported as `variable-builtin-missing`. Needs the core release with built-in variables.
