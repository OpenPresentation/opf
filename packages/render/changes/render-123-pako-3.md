---
type: changed
---
render#123: the vector PDF writer moves to `pako` 3.0.2 (from 1.0.11), whose exports are named only (`import { deflate } from "pako"`). Output is byte-identical: `flate` passes `legacyHash: true`, so pako 3 keeps writing canonical zlib streams as pako 1 did (its new default, the hash of Chromium zlib, writes about 1% larger streams with the same inflated content and would change every PDF's bytes and `/ID`). The `/export-browser` bundle tree-shakes pako's inflate side away: 20 KB smaller minified (6 KB gzipped).
