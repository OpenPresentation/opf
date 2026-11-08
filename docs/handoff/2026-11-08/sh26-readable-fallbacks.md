# SH-26: readable diagram fallback and continuation lists

The pinned template review found 49 clean continuation panels that left seven
labels on 78-character rows at small type in a large body. All 112 original
images and finite judgments are preserved on evidence-only branch `4af124c70`;
the coordinator accepted this reading-measure class as a release blocker.

The old Venn guard ran only inside `arrangedList` when no diagram design fit.
Global recomposition deliberately suppresses the template, so a continuation
could become a flat list without reaching that branch or its guard. The new
shared pass runs after arrangement/card decisions and before strict overflow.
It recognizes the requested diagram regions even during recomposition and uses
the exact existing list fitting options, marker style, direction and family.

Vetoable implementation decisions:

- Scope semantic org-chart, hierarchy, Venn and downward-pyramid regions;
  exclude actual diagram/step nodes and unrelated regions/lists. Catalog bytes,
  live SmartArt eligibility and measured native geometry do not change.
- Retain the settled size as the floor. Try the existing type scale upward,
  never beyond the effective cap, and one to three columns of whole list items.
  Keep source order, paths, numbering, rich text and original gap. Explicit
  column counts (payload first, then explicitly authored region rules) and pins constrain the fit; `fill:false` disables growth.
- Use bounded whole-word width trials and the existing column-break strategy.
  Once the first readable width overflows vertically, narrower widths cannot
  repair that same size/count. Never replace complete words with truncation.
- If no retained-size fit works, mark the fit and existing diagnostic as real
  overflow. Strict composition refuses it and the existing paginator may split
  between complete list entries; an irreducible word refuses all output.

All four exact representative cases fail the line-measure assertion on the
approved baseline and pass after the change. Their 26 px text remains 26 px,
with two whole-item columns, longest lines of 38 characters and a tallest text
column of 402.48 px inside 420.76 px (~95.7% fill). The six-label spare-space
control grows from the frozen 26 px to 34 px. All 49 previously captured pages
keep their settled 24/26/28 px size, all labels/order and no overflow, with lines
at most 70 characters.

Independent review reproduced an ignored authored region column limit. The
correction distinguishes explicit region counts from compiled default counts,
including nested regions, and preserves payload override precedence. Label and
description lines both follow the same reading measure. Splitting a multi-entry
list does not invent a heading for a singleton chunk; an originally single
described heading retains its heading role, scale and weight. Nested families
and numbering remain intact. All first-failure receipts are preserved.

Focused controls pass for actual four-family pagination, unchanged source,
headings/title rule/card frame/footer, caps, `fill:false`, pinned single-column
refusal, exact gap, RTL numbering, rich runs/families, unrelated regions and
irreducible words. Existing 140 measured Venn frames, circle text slots and
retained-type cases pass. One existing very-long Venn test had required a false
fit-overflow flag despite an already present 70-character overflow diagnostic.
Its strengthened assertion now requires the truthful flag and strict refusal,
with the same 26.6667 px, frame and complete source values. Before/after proof
is retained; no no-shrink or content check was removed.

Initial fixture setup failures are retained separately: the first core-only
build lacked Gallery dist; then a new pagination test used catalog authoring
records with `$schema`/`id` fields instead of maintained `gallery.layouts`.
Building the actual dependency and using the same normalized records as the
real golden fixture fixed those test setups without weakening schema checks.

Source is still under review. Next are shipped-CLI whole-case before/after
witnesses with the same font route, unaffected output invariance, the mandatory
changed check, and a coordinator-owned new pinned golden batch. No local golden
edits, public examples/count changes, Office or publication are claimed.
