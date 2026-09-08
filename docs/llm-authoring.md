# Authoring OPF with an LLM

Write a complete JSON document with `name` and `slides`. Put visible words in slide fields, not presentation metadata. Use `*.opf.json` filenames and stable, unique slide `id` values when a deck will be revised repeatedly.

```json
{
  "name": "Launch decision",
  "slides": [{
    "id": "recommendation",
    "title": "Launch to the pilot group first",
    "composition": { "mode": "row", "weights": [2, 1] },
    "blocks": [
      { "items": ["Validate onboarding", "Measure activation", "Fix the largest drop-off"] },
      { "metric": { "value": 200, "label": "Pilot customers" } }
    ],
    "notes": "Confirm the rollout owner and checkpoint date."
  }]
}
```

Choose one content structure per slide:

- Root payloads for a simple slide: `text`, `items`, `image`, `chart`, `table`, `code`, `metric`, `quote`, or `timeline`.
- `blocks` for a sequence that should reflow. Set `composition` only when an arrangement matters. Omit it to let the engine choose.
- Promoted regions such as `left`, `center+right`, `top`, and `bottom` for spatially meaningful content. Regions must not overlap. Do not mix regions with root payloads or blocks.

Use catalog IDs from the installed package or supply inline records in `catalogs`. A gallery route is a stable identifier, but an extended gallery layout may need the inline record included in the copied document. Do not invent an unresolvable layout or assume a network lookup will happen.

Tables use `{ "columns": ["Category", "Value"], "rows": [["A", 10]] }`. Charts put a `type` and the same tabular structure inside `chart.data`. Images use a source string or `{ "src": "...", "alt": "..." }`; use the top-level `assets` registry and `asset:<id>` references for reuse. The local renderer does not fetch remote sources.

## Revision loop

1. Validate with `validatePresentation`. Fix errors at their returned JSON paths. Check warnings for unknown catalog IDs.
2. Render with `onDiagnostic` and inspect `text-overflow` / `small-cell` paths. Shorten text, reduce the number of blocks, change composition, or explicitly split the slide. Revalidate after edits.
3. Use `composition.overflow: "error"` for a strict text-layout gate. It does not certify chart readability, font availability, or exact PowerPoint rendering.
4. Inspect the actual preview and exported PPTX. Geometry is shared; font substitution and specialized objects can still differ.
5. Apply focused JSON Patch edits through the editor session and retain undo history. Resolve stable slide IDs to current array indices before constructing patches; indices can change when slides are inserted or moved.

Preserve factual content, sources, notes, and asset descriptions during layout repair. A fit diagnostic is a request to revise the slide; it is not permission to silently drop the end of a paragraph.

See [dynamic composition](dynamic-composition.md), [content payloads](content-payloads.md), and [design precedence](design-resolution.md).

Use nested `blocks` to keep related content together. Put `composition` on the group to arrange its children, for example a column of evidence inside a row of sections. Read `composeSlide().groups` for group bounds and `items[].path` for precise leaf edits. Groups inherit readability constraints; splitting content into more levels does not make text smaller.

Use `paginatePresentation(deck)` when a draft exceeds readable space. Review the returned ordinary OPF slides and source mappings before export. Pagination preserves source text exactly; it does not summarize or rewrite it. An atomic item that cannot fit produces a diagnostic for a targeted edit.
