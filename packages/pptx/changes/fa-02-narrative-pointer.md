---
type: changed
---
FA-02: the root `narrative` is a plain string (a catalog id, URL or `pkg:` reference) and a custom narrative is a record in `catalogs.narratives.records`. Export stores the string and the `slides[].beat` links, and import restores them; a custom record travels with the deck that references it (both provenance modes). No exporter code changed; `test/narrative-provenance.mjs` covers the round trip.
