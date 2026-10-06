---
type: fixed
---
Release 0.12.1 replaces 0.12.0, which was prepared but never published: its release commit failed `npm audit` on GHSA-wq5f-xc86-pv6w (sharp below 0.35.5) through the development renderer and PPTX packages. The `@openpresentation/opf-render` peer range and the development dependencies now name opf-render 0.13.1 and opf-pptx 0.13.2, which ship sharp 0.35.5. The 0.12.0 notes (RR-54 data grid) apply unchanged.
