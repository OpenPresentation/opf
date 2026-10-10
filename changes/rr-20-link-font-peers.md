---
type: fixed
packages: []
---
RR-20: `scripts/link-ecosystem.mjs` now installs the linked renderer's exact script and emoji font pins (its `@expo-google-fonts/*` optional peers) in the opf-pptx and opf-editor checkouts, replacing only packages they already have, from `npm pack` tarballs and without re-running npm install. A renderer font bump on main (render#210) no longer makes the linked sibling load files the renderer's integrity check rejects, which had blocked the ecosystem lock roll for the 0.18.x patches.
