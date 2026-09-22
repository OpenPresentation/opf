# Mixed-size soft-wrapped table registry fixture

This one-slide, one-row, one-cell fixture was generated only from the pinned registry consumer with Node v24.21.0. The source has five exact Carlito rich runs at 18/30/18/30/18 points, one literal U+0009, and no CR, LF, hard break, manual offset, or tolerance adjustment. Current schema validation passes with no warnings.

The accepted renderer trace contains 3 natural soft lines. The current registered Carlito measurement API is available but rejects U+0009 as `missing-glyph` at `slides.0.table.rows.0.0.0`; the generator preserves the tab and uses the current unmeasured rich-table path rather than replacing it with spaces or inventing an offset. SVG paint embeds only the OFL Carlito 400/700 upright faces; PNG rasterization loads the four pinned package faces without installing them or reading system fonts.

DrawingML contains one table paragraph and zero `a:br` elements. Its five runs retain the exact source text and 18/30/18/30/18-point sizes. It contains 0 explicit `a:tab` stops; the literal U+0009 remains in run text. The uniform paragraph line spacing is 36.6 points, the row is 118.800000 points high, and the native frame is 873.600000 by 118.800000 points. These XML values do not establish PowerPoint's actual wrapped-line or tab bounds.

Current semantic reimport validates, retains the exact flattened authored text, and retains the five run texts, font families, sizes, bold flags, and italic flags. It represents the cell as a styled block cell and adds explicit colors, fill, padding, and borders, so its complete cell JSON is not byte-identical to the minimal source cell. Import diagnostics:

- None.

The next bounded native control should open this exact PPTX read-only, select the sole table cell without editing it, and record the cell shape name/type, table/row/cell counts, row and frame geometry, paragraph count, literal text, run font name/size/bold/italic, `TextRange2` bounds for the full paragraph and text immediately before/after U+0009, paragraph tab stops, and full-slide PNG. It should close only that owned read-only presentation. Comparing those native observations to this package record would test actual PowerPoint wrap/tab behavior; it must not convert soft wraps to hard paragraphs, change offsets or tolerance, save, install fonts, or infer physical glyph provenance.
