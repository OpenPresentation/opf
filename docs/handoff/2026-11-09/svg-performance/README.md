# SVG performance investigation — 16 versus 36 slides

Requested by the owner on November 9. The attached 16-slide iPhone concept deck is retained byte for byte; extended-36.opf.json adds exactly 20 cloned slides, cycling through the originals with unique slide/payload IDs and small title/notes changes. The first sixteen slide objects are unchanged. No imported document text is treated as instructions.

The source has no image/src assets; it is mostly text and decorative shapes, with one chart and one table. It prints deck.slideCount in every footer, so adding slides legitimately changes original-slide output. Do not mistake that required update for unnecessary invalidation.

## Measurement plan

- Use the same exact unreleased source baseline and one retained, pinned font handle for both sizes. Preserve the authored Aptos font scheme; record the actual font substitution policy. Separate font loading and cold module setup from steady-state generation.
- Compare batch standalone SVG; repeated selected-slide calls with their normal validation; selected-slide calls after one explicit validation; and shared-font/system-text SVG. Verify output hashes within equivalent modes and report fidelity/embedding differences explicitly.
- Record wall time, process CPU, peak RSS, heap before/after GC, retained output size, raw/gzip/Brotli bytes, embedded font bytes and SVG DOM node counts. Use independent child processes and repeated runs; do not take speed measurements while other heavy package checks run.
- Browser lane: first visible slide, slide navigation, all thumbnails, one local text edit and one chart-data edit; inspect DOM/layout/paint, long tasks and heap. Repeat under CPU throttling as a slower-device proxy, without claiming real mobile-device qualification.
- Update/storage lane: full JSON versus one-slide change/patch bytes, changed SVG hashes and re-rendered/cached slide counts. Include metadata and append-20 updates because their dependencies differ from a local edit.
- Profile the measured expensive phase before changing production code. Any optimization must retain output equivalence, correct invalidation and bounded cache behavior, with a meaningful regression test.

State: both inputs validate; the coordinated eight-case server baseline passed with exact standalone SVG equivalence. See RESULTS.md and the sealed raw archive. Browser/mobile-proxy and update measurements are being prepared. No release, deployment or production optimization performed.
