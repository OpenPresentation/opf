---
type: added
packages: []
---
LH-36: `pnpm check:palette` checks every gallery colour scheme against palette discipline: dark1 on light1 at 7:1, dark2 and light2 surfaces at 4.5:1 with their text slot, and accent1 and accent2 at least 0.08 apart in OKLCH lightness (these fail), plus report-only findings for close accents, pure black or white neutrals and red/green pairs. Three schemes (deep-purple, luxury, pastel-red) fail the accent spread today and are listed in `scripts/palette-known-failures.json`; no record changed.
