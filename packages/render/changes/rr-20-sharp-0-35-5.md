---
type: fixed
---
RR-20 (security): Sharp is pinned to 0.35.5 (libvips 1.3.4), which fixes GHSA-wq5f-xc86-pv6w (CVE-2026-96889, a librsvg vulnerability in Sharp before 0.35.5; `npm audit` reports it as high for installs that resolve Sharp 0.35.4). Rendered output is unchanged: the raster golden corpus (805 slides in 126 decks) is byte-identical.
