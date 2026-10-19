---
type: changed
---
RR-96: adopts `@openpresentation/gallery` 4.0.0 (`^4.0.0`, still a development dependency; hosts register the catalog): the default catalog has no `dark` theme (a dark deck is a theme with a dark `design.variant`, for example `{ "theme": "classic", "variant": "dark1" }`), and `minimal`, `classic` and `bold` carry `variants`. The editor's behavior is unchanged; its tests select `bold` or `minimal`, or `classic` with a dark variant, where they used the `dark` theme.
