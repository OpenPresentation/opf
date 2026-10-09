---
type: fixed
---
RR-20: `test:packed` keeps verifying registry signatures while core's `/node` names this package as an optional peer and its version is not on npm yet: the consumer pins the tarball with an override (and core at this package's range), so `npm audit signatures` no longer asks npm for the unpublished version (ETARGET).
