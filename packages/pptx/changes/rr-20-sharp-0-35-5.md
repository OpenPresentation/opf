---
type: fixed
---
RR-20 (security): Sharp is pinned to 0.35.5 (libvips 1.3.4), which fixes GHSA-wq5f-xc86-pv6w (CVE-2026-96889, a librsvg vulnerability in Sharp before 0.35.5; `npm audit` reports it as high for installs that resolve Sharp 0.35.4). Exported bytes are unchanged: the determinism grid and the packed-consumer checks pass with the new Sharp.
