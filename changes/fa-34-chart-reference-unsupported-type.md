---
type: changed
packages: [opf, editor]
---
FA-34: a nonempty `referenceLines` on a chart type that cannot draw it (anything but `column`, `bar`, `line`, `line-with-markers`, `area` and `combo`, stacked types included) is the format error `opf/chart-reference-unsupported-type` at `.../chart/referenceLines`, replacing the generic `opf/schema` enum error at `.../chart/type`. In the editor, `switchDimension(editor, "charts", type)` to such a type (or leaving `combo` with a `secondary` reference) refuses with `chart-reference-lines-unsupported`; the new option `removeReferenceLines: true` removes them in the same undoable step and names them in `loss`, and the chart-type picker asks first.
