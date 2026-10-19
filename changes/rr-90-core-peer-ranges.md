---
type: fixed
packages: [cli]
---
RR-90: the optional peers `@openpresentation/opf-render` and `@openpresentation/opf-pptx` of core and the CLI are `^0.22.0` (and `PEER_RANGES`, the install hints, agree). Core 0.22.0 still named `^0.20.0`, so npm refused a tree with core 0.22 and renderer 0.22.1 (ERESOLVE). Peers stay caret ranges in lockstep with the train, as the gates and release tooling expect.
