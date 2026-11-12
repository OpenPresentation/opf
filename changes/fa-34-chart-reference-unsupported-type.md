---
type: changed
packages: [opf, editor]
---

FA-34: a chart with a nonempty `referenceLines` on a type that cannot draw it (any type other than `column`, `bar`, `line`, `line-with-markers`, `area` and `combo`, the stacked and 100% stacked types included) is now the format error `opf/chart-reference-unsupported-type`, located at `.../chart/referenceLines` and naming the six supported types. The rule id for this mistake changed: it was a generic `opf/schema` enum error at `.../chart/type`, from a schema condition on `Chart.type` that is removed. In the editor, `switchDimension(editor, "charts", type)` to such a type refuses with `chart-reference-lines-unsupported` (`details.count`, `details.path`) instead of producing an invalid document, as does leaving `combo` with a `secondary` reference; the new option `removeReferenceLines: true` removes exactly those references in the same undoable step and names them in the result's `loss`, and the design controls' chart-type picker asks before removing them.
