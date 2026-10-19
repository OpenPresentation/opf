---
type: changed
---
RR-96: adopts `@openpresentation/gallery` 4.0.0 (`^4.0.0`, a dependency): the default catalog has no `dark` theme (a dark deck is a theme with a dark `design.variant`, for example `{ "theme": "classic", "variant": "dark1" }`), and `minimal`, `classic` and `bold` carry `variants`. The exporter's output is unchanged; its tests use `classic` with a dark variant where they used the `dark` theme.
