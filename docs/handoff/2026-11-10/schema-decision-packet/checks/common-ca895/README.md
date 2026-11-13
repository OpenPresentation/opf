# Common ca895 build and forward checks

Clean source `ca895444a710a963fced1983237310abb5d38ab1` normally includes the independently reviewed table-marker repair `284de14a4` and renderer/editor test corrections `a2309b4b3`. The maintained workspace build passes. Its actual serialized MCP resource is **10,425,631 bytes** under the unchanged **10,485,760-byte** limit, leaving **60,129 bytes**. Raw HTML is 10,055,840 bytes; gzip level 9 is 2,770,479 bytes. Raw HTML, compression and serialized protocol frames are distinct measurements; no runtime-performance claim is inferred.

`runtime-and-build.json` retains 430 built JS/JSON/HTML file sizes and SHA256 values plus source, lock and clean-diff identity. The separate font-agent replay also seals 605 distribution files before and after its run.

The twelve focused PPTX files pass in 11.144 summed subprocess seconds. Coverage includes native-marker provenance controls; typed legacy/current tags; the genuine registry 0.33 archive and current native language/cache edits; exact metadata boundaries; the six existing reference types; absent, partial and `none` strokes; all 43 existing reference cases; and unchanged genuine PowerPoint-saved reference/overlay controls. The new Line file passes ten tests containing 30 positive authoring scenarios, 16 malformed-style scenarios and two actual native paint/overlay edit scenarios. Per-file receipts retain source/test/diff hashes, arguments, exit status, PID and timing.

All 38 previously failing PPTX files were replayed sequentially using the immutable ed51 results and maintained discovery/`nodeArgs`. The frozen result is **33 PASS / 5 RED in 97.496 seconds**. No file in that selection remains unrun, although failed files can leave later internal assertions unrun. The failures are two original whole-model fingerprint assertions, two later public-region/footer assertions, and RR54's first current archive lock. This result remains unchanged in the evidence.

Root reviewed a closed 14-path inverse against both original fingerprints. The same immutable `native-17.pptx` (119,365 bytes; SHA256 `362b8e291b1355d9d9fe7d1723e931668eaeabea42a8f2c467bc5806193b5c11`) imports with current whole-model hash `5efa327…` and first-16-slide hash `6d79b490…`. Reversing only the footer `start`/`end` keys and twelve known cell alignments at slides 11/12 reproduces the original hashes exactly:

- Whole model: `7bcfc43c75b926dc193f451c984c773fed3e0eb54ec55845356c8c509b8e9f3f`.
- First 16 slides: `def677b9a0b67f384b63b6897510a6ed4a16f6e36fdc604f3a30a237ffe140be`.

The comparison helper guards exact keys, table dimensions, input values, change count and absence of mutation. Tests retain those original hash literals and reread the archive SHA256. Physical borders/padding, strings, native body/default/cascade/edit assertions and diagnostics remain exact. No replacement fingerprint or generic normalization is introduced.

After the font-agent replay released the same runtime, the four approved test-only corrections pass **4/4 in 10.833 seconds**, with no rebuild. They exercise the complete body/style, unknown-kind/depth/region and furniture tails. Region tests read current `regions.start`, preserving the invalid `sideways:up`, kind and depth controls. The original unknown-region mutation had read missing `regions.left`; JSON omitted its undefined value, accidentally removing the intended mutation. Its invalid key text is unchanged. The remaining footer expectation now uses `start`.

RR54's current archive lock remains RED in this packet; the coordinator owns its separate byte audit and reviewed promotion. Renderer golden/template gates and final CI/native/release qualification remain separate. These are composed focused checks, not a newly green package aggregate, fresh native application run or publication claim. Every original failure remains available.
