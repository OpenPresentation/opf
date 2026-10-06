---
type: fixed
packages: []
---
The development workspace overrides sharp below 0.35.5 to 0.35.5 for GHSA-wq5f-xc86-pv6w (CVE-2026-96889, librsvg), so `pnpm audit` passes while the CLI's pinned renderer/PPTX devDependencies still name sharp 0.35.4. No published package changes.
