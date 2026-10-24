---
type: fixed
packages: [opf]
---
MR-44: the runtime dependency `fast-uri` (reached through `ajv`) moves to 3.1.9, which fixes four advisories in 3.0.0 through 3.1.8 (URI scheme spoofing through percent-encoded scheme decoding, host confusion through unchecked WHATWG host canonicalization, improper path equivalence in relative reference normalization, and scheme injection through an unescaped first-segment colon). `pnpm audit` is clean again.
