# Pinned template golden review: evidence only, never merge

All 112 changed template PNGs from successful workflow
[42498350968](https://github.com/OpenPresentation/opf/actions/runs/42498350968)
were individually viewed at original pixel detail, in `diff.changedSlides`
order. The generated commit is
`348fd323b31302b5a3cdd7af2db8bb8bf6fffa2a`. This review covers templates only;
the coordinator separately reviews the 62 changed example images.

The downloaded originals are 320 by 180 pixels at the pinned 0.25 golden scale.
Every original PNG hash and byte length matches its exact candidate key. All
119 template artifact files (112 individual PNGs, five sheets, candidate and
diff JSON) are inventoried and preserved. Contact sheets did not substitute for
individual viewing, including repeated identical-hash continuation pages.
This does not establish full-size glyph/font or native raster fidelity.

The review is **not accepted as a whole**. There is one confirmed release-blocking
class: 49 clean continuation panels keep seven labels on 78-character lines,
usually at 26 px, while visibly using only the upper/central part of a large
body. These have no text-overflow finding, so they cannot be dismissed as the
raw stress controls. The coordinator independently viewed 0053 and accepted
this blocker scope. Exact indices are 0053–0056, 0058–0070, 0072–0084,
0086–0098 and 0106–0111. They span inverted-pyramid (13), org-chart (13),
hierarchy (13) and Venn (10) continuation panels.

The representative 0053 case is `paginated inverted-pyramid 4 long page 1`.
Its source hash is
`cb6f7080d23e5f6548558bc36f62b89886e84bc2648e1fd333f91d5c059bfe07`;
its drawn-page hash is
`112292f4045b01217e08a2894261fa2e1db810cc4d76270f88f9d89cc46ffde9`.
The retained layout is still `inverted-pyramid`; its unpinned list is drawn as
a flat fallback, without an arrangement-adapted finding. The existing local
Venn-only no-design fallback branch therefore does not cover every continuation
route. A new engine fallback/list reading-measure fix must cover all four
families, retain or grow settled type, preserve all source labels/order/styles,
and report real overflow when whole-word wrapping cannot fit. The coordinator
authorized a separate derived PR; none is implemented on this evidence branch.

The other panels have separate, finite judgments rather than blanket approval:

- Five historical changed cases retain exact estimated body sizes versus the
  published 0.33 runtime: 28, 28, 28, 24 and 28 px. Their longest lines improve
  from 82 or 77 to 70 characters. Two Section cases retain original
  layout-unplaced findings; the dense 24 px Statement case is inherited capacity
  stress, not a new size reduction or endorsement of that density.
- Four short new shape specimens and three readable inverted-pyramid card
  adaptations retain complete labels, grow above nominal list type and show no
  clipping. Six short-measure Venn continuation card/circle panels are contained.
- Twelve raw long-block overflow images are explicitly refused; 0051 visibly
  overlaps at the center as well as extending below the canvas. Green workflow
  status does not accept these rasters as successful layouts.
- The remaining 33 panels are fallback, density or adaptation controls. Generic
  flat lists in the org/hierarchy generator do not qualify a valid single-root
  tree or any native diagram domain. Their measured sizes, diagnostics and
  complete authored content remain available without a false type-growth claim.

There are 107 new exact keys without a historical baseline key: 48 new raw
family panels and 59 new pagination panels. No historical PNG or Claude panel
was invented. The five old keys have source-only same-input estimated geometry
comparisons; no old raster was regenerated. The generic long fixture itself
uses `long.slice(0,70)` before adding an `Item N:` prefix, so its `th` suffix is
authored fixture data, not renderer word loss.

The [packet](../../../evidence/golden034-template-review/review.json) binds every
viewed image, judgment, exact source/drawn-slide hash, body size, line length,
diagnostic and historical-key status. Source-only `resolvePresentation` and
`paginate` measurements use the exact golden fixture; its aggregate hash matches
the artifact, and production source is identical to the golden commit. No SVG
or PNG was generated, no golden edited, no CI observer started, and no Office,
font registration, deploy or publication performed.

Next: the separate fallback/continuation repair, dedicated regression controls
and whole-case sheets; then the coordinator's next pinned golden batch and final
combined gate. Keep this complete original review immutable and never merge
this evidence-only branch.
