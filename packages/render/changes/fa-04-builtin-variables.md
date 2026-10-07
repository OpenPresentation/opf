---
type: added
---
FA-04: built-in variables (`{{speaker.name}}`, `var:organization.logo`, `{{deck.name}}`, ...) resolve before composition, and the `speaker` header/footer field draws the first speaker's name and title. A built-in with no source value is reported as `variable-builtin-missing` through `onDiagnostic`; a template preview keeps it visible. The script-font scan counts the root `speaker` only when a design draws the `speaker` field. Needs the core release with built-in variables.
