---
type: fixed
packages: []
---
RR-20: preserve reviewed site-bump history with normal merges and a fast-forward push. Refuse closed heads and concurrent branch updates instead of rewriting an existing bump branch; a rerun whose regenerated files conflict with the existing branch publishes to a fresh `bot/opf-vX.Y.Z-2` branch instead (RR-107 release review).
