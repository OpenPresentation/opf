// The findings reporter shared by render, export and import. It extends the `opf validate` report: same fields
// (`valid`, `schemaValid`, `findings`, `counts`, `checks`, `sha256`, `opfVersion`), same finding shape
// (`ruleId`, `severity`, `category`, `path` as a JSON Pointer, `scope`, `message`, `help`), so one consumer reads all of them.
// Renderer, exporter and importer findings are appended with a `render/`, `pptx/`, `pdf/`, `fonts/` or `import/`
// rule prefix and the same word as their category. Exit status follows --fail-on: an error always fails, a warning
// fails under --fail-on warning.
import type { Finding, FindingSeverity, ValidationReport } from "../core.js";
import { pointerOf } from "./files.js";
import type { Diagnostic } from "./peers.js";

const rank: Record<FindingSeverity, number> = { error: 3, warning: 2, info: 1 };

/** True when any finding is at or above the level (the `--fail-on` rule). */
export const reaches = (findings: readonly { severity: FindingSeverity }[], level: FindingSeverity): boolean => findings.some((finding) => rank[finding.severity] >= rank[level]);

export type Source = "render" | "pptx" | "pdf" | "fonts" | "import" | "cli";

/** Codes that only note a harmless substitution or a note about what was embedded; everything else a library reports is a warning. */
const INFO = new Set([
	"font-glyph-fallback",
	"font-substituted",
	"pdf-font-embedded",
	"pdf-font-fallback",
	"export-lossy",
	"typeface-not-office-safe",
	"typeface-replaced",
	"svg-sanitized",
	"script-font-unavailable",
	"media-provenance-omitted",
	"picture-not-measured",
	"diagram-shapes-unavailable",
	"smartart-unavailable",
	"arrangement-adapted",
	"prepared-late",
]);

// The help shared by families of opf-pptx export and import findings, so every finding of that package says what the user can do (or that nothing is needed).
const INVALID_TAG = "What the PPTX shows was imported as it is; only the OPF structure recorded with it at export (the message names it) was not restored, because that record was edited, duplicated, damaged or no longer matches the slide. To get it back, import the file as exported, or change the OPF source and export again.";
const REFLOW = "The text was recovered in its order, and OPF lays the slide out again: native positions, and the formatting the message names, are not carried over. Review the imported slide; keeping the OPF source as the master copy avoids this.";
const EDITED = "The PPTX was changed after export, so OPF imported what it shows now and did not restore the authored value the message names. Nothing needs to change if the edit is wanted; to keep the authored value, change it in the OPF source and export again.";
const NATIVE_FRAGMENT = "Nothing needs to change in the deck: the line was exported as one measured text box, as the preview draws it, instead of the separate source-bound boxes OPF writes for proofing-sensitive lines.";
const REFERENCE_UNCERTAIN = "The chart's reference lines were not restored as referenceLines (the message says why); what the slide shows stays as ordinary content. Add or fix referenceLines in the OPF source and export again if they should follow the data.";
const TABLE_STYLE = "The table and its text were imported; the cell formatting the message names has no OPF form, so it was left out or replaced by the nearest one. Set it in the imported OPF if it matters.";

const HELP: Record<string, string> = {
	"text-overflow": "Shorten the text, or split the slide: add --paginate (measured with the same fonts) or run opf paginate.",
	"small-cell": "Give the table more room or fewer columns, or run opf paginate.",
	"slide-continued": "To keep one slide, shorten or remove blocks or choose a layout with more room. opf paginate writes the split into the deck; --keep-slides (paginate: false) draws the slide as written, overlapping.",
	"unresolved-asset": "Embed the image as a data URI, or keep the file inside the deck folder (see --asset-dir). URLs are never fetched.",
	"picture-not-measured": "Check that the picture is a PNG, JPEG, GIF, WebP or SVG, and that the optional sharp peer is installed (npm install sharp). Until then the scrim under text on it is sized for any picture from black to white, which always reads.",
	"asset-blocked": "Move the file under the deck folder or pass --asset-dir <directory> that contains it.",
	"script-font-not-installed": "Install the Noto script package named in the message, at the version it names, where the CLI runs (the message gives the global, project and npx forms), then run the command again.",
	"font-glyph-fallback": "The chosen font lacks these characters; a bundled font draws them. Supply a font with --fonts to change that.",
	"unresolved-reference": "Use an id from opf catalog <kind>, define the record in catalogs.custom, or run opf embed to embed what the deck references.",
	"unresolved-content": "Check the content at this path; it could not be drawn.",
	"chart-data-adapted": "The chart data was reshaped to export a native chart; see the message.",
	"chart-data-unplottable": "Provide inline chart data with at least one numeric column.",
	"content-placeholder": "This content has no PowerPoint form; a placeholder frame stands in for it.",
	"font-substituted": "To draw the requested font itself, pass its font files with --fonts (fonts in the API). A PPTX keeps the requested font name, and PowerPoint uses that font where it is installed.",
	"unsupported-image-treatment": "Remove or change the image treatment at this path.",
	"date-needs-value": "Pass --date YYYY-MM-DD. The CLI never reads a clock, so output stays reproducible.",
	"font-unavailable": "Pass --fonts with the font files, or choose a font the bundled pack covers (opf catalog fontSchemes).",
	"missing-glyph": "Install the script font package named by script-font-not-installed, or supply a covering font with --fonts.",
	"export-lossy": "The PowerPoint file draws this with its nearest native form (see feature and the message). Change the content if the difference matters, or export with --as images for an exact picture.",
	"typeface-not-office-safe": "Export with --typefaces safe (typefaces: \"safe\") to write Office-safe families and lay the text out with them, or install the fonts on the machines that open the file.",
	"typeface-replaced": "Drop --typefaces safe to keep the selected families in the file.",
	"diagram-shapes-unavailable": "The diagram stays one picture in PowerPoint (see the message). It looks the same; to edit it, change its source in OPF and export again.",
	"smartart-unavailable": "The pyramid, matrix or cycle is exported as editable native shapes, which look the same; live SmartArt is written only where PowerPoint draws it exactly as the preview (docs/smartart.md). Shorten the entries named in the message, or give the region other proportions, to get live SmartArt. When the message names the fallback picture, install @openpresentation/opf-render: every live SmartArt carries OPF's picture of it for apps without SmartArt.",
	"prepared-late": "Nothing to change in the deck: the output is correct. OPF prepared this face only when the export measured it, which its font analysis should have foreseen; please report the deck so the analysis covers it.",
	"duplicate-font-face": "A --fonts face repeats a bundled family, weight and style; remove it or rename the family.",
	"shape-property-dropped": "OPF has no form for this property of a PowerPoint shape (3-D, preset shadows, autofit and the others in docs/shapes.md); it was dropped and the shape imported. Set it again in the PowerPoint file if it matters.",
	"shape-covers-content": "An overlay shape is always drawn over the content, and OPF has no layer behind it: give the content a card, or the slide a background, instead of a shape behind it.",
	"shape-not-imported": "A filled shape across the whole slide is a background, and an overlay shape is drawn over the content; set the slide's background in OPF instead.",
	// opf-pptx: export findings.
	"native-body-fallback": "Nothing needs to change: this text was exported as measured text boxes, one per line, which look like the preview but do not re-wrap when edited; the reason in the finding says why. A wrapped title falls back in either body-text mode (a tab, a citation marker, lines in two directions). Under --body-text native, a text, list or bullets region falls back when it is in a group, shares its region, has several columns, overflows, has right-to-left text, nested, described, picture-bulleted or restarted list entries, a hard break inside a list entry, step badges, citations or footnotes, tabs or unsupported run properties, or lines PowerPoint could wrap differently; the opf-pptx README (Choosing body text mode) lists the reasons.",
	"unsupported-pattern": "Only the background color was exported: this pattern has no DrawingML preset. Use one of DrawingML's presets (such as pct20, ltUpDiag or smGrid; see docs/shapes.md) for a native pattern, or accept the plain color.",
	"numbering-unsupported-core": "The installed @openpresentation/opf is too old to compose numbered lists, so the list was exported with bullets. Install the @openpresentation/opf of the same version as @openpresentation/opf-pptx (they are released together), then export again.",
	"chartex-fallback-picture-unavailable": "Nothing needs to change in the deck: apps without extended charts show the clustered column fallback instead of a picture of the preview chart. The reason says why no picture was drawn; when it names a missing @openpresentation/opf-render, install it to get the picture.",
	"chart-map-geodata": "PowerPoint fetches the region shapes of a map chart from its online map service, so the chart draws only when it is online. Use another chart type if the deck must open offline.",
	"chart-reference-overlay": "These reference lines and labels are editable shapes over the chart, not part of it: they do not follow the chart when it is moved or its data or axis is edited in PowerPoint. To change a reference line, change it in the OPF source and export again.",
	"chart-mapping-adapted": "The chart's data mapping was adapted to draw the chart (the message says how). Choose a chart type or mapping that fits the data if the result is not what you meant.",
	"chart-highlight-adapted": "The highlight names a column that is not plotted as a series, so it was adapted (the message says how). Name a plotted series or a category, or remove the entry.",
	"variable-example-used": "The template variable has no value, so its example was exported. Supply a value for it when exporting if the example should not ship.",
	"variable-builtin-missing": "The token's deck, speaker or organization field is not set, so it exports as a gap (or no logo). Set that field in the deck, or remove the token.",
	"furniture-date-fixed": "The date was exported as fixed text that PowerPoint will not update: its dateFormat is not one of PowerPoint's date field formats for the deck language (or en-US). Use one of those formats for a live date, or accept the fixed text.",
	"furniture-field-fixed": "The field was exported as fixed text that PowerPoint will not update, because it does not fit on one line of its footer or header text. Shorten the text around it so it sits on one line, or accept the fixed text.",
	"furniture-on-slide": "Nothing is lost: on the slides the message names, this part is a shape drawn over the slide content, as in the preview, instead of furniture on the slide master, which PowerPoint draws beneath the content. Move the content clear of it to keep it on the master.",
	"svg-render-failed": "The SVG's PNG fallback could not be drawn; the message gives the rasterizer's error. Check the SVG, or supply the picture as a PNG or JPEG.",
	"slide-render-failed": "A slide could not be drawn as a picture for --as images; the message gives the renderer's error. Fix what it names, or export without --as images.",
	"unsupported-background-image-orientation": "Rotate or mirror the image file itself, then use it as the background: PowerPoint cannot apply the EXIF orientation to a picture fill.",
	"language-export-unavailable": "The script fonts could not be resolved (the message gives the error), so the PPTX keeps the defaults the message names. Fix what the error names, then export again.",
	"language-unresolved": "Use a BCP-47 language tag whose script OPF knows (en-US, ar-SA, ja-JP), or accept the language the PPTX uses.",
	"script-font-notes-not-exported": "Nothing needs to change in the slides: a PPTX has one notes master, so this slide's notes use the presentation theme's East Asian and complex-script fonts, not the slide's own. Set those fonts for the whole deck if the notes must use them.",
	"native-fragment-unavailable": NATIVE_FRAGMENT,
	"native-scalar-fragment-unavailable": NATIVE_FRAGMENT,
	"native-latin-slot-unavailable": "Nothing needs to change in the deck: the shape was exported, but the Latin font chosen for the Latin characters of its Arabic text could not be bound to their run, so PowerPoint may not draw them in that font. Check the shape in PowerPoint if it matters.",
	"data-provenance-omitted": "Nothing needs to change for the values, which export and import as native data; only the dataset references, mapping and formats were not stored, because the record exceeds the tag limit. Make the data smaller to keep them, or keep the OPF source as the master copy.",
	"document-provenance-omitted": "The field the message names was not stored for import (the message says why), so a reimport keeps the values the PPTX shows instead. Keep the OPF source as the master copy if that field matters.",
	"media-provenance-omitted": "The OPF video value was not stored in the PPTX (the message says why), so a reimport keeps the current native link and caption instead. Keep the OPF source as the master copy if the video value matters.",
	"smartart-renderer-unavailable": "The SmartArt fallback picture needs the optional peer @openpresentation/opf-render; install it (npm install @openpresentation/opf-render) and export again.",

	// opf-pptx: import findings.
	"invalid-caption-provenance": INVALID_TAG,
	"invalid-footnote-provenance": INVALID_TAG,
	"invalid-card-provenance": INVALID_TAG,
	"invalid-code-provenance": INVALID_TAG,
	"invalid-data-provenance": INVALID_TAG,
	"invalid-diagram-provenance": INVALID_TAG,
	"invalid-document-provenance": INVALID_TAG,
	"invalid-furniture-provenance": INVALID_TAG,
	"invalid-heading-provenance": INVALID_TAG,
	"invalid-image-callout-provenance": INVALID_TAG,
	"invalid-image-provenance": INVALID_TAG,
	"invalid-layout-provenance": INVALID_TAG,
	"invalid-logo-provenance": INVALID_TAG,
	"invalid-metric-provenance": INVALID_TAG,
	"invalid-native-fragments": INVALID_TAG,
	"invalid-native-scalar-fragments": INVALID_TAG,
	"invalid-quote-provenance": INVALID_TAG,
	"invalid-smartart-provenance": INVALID_TAG,
	"invalid-text-provenance": INVALID_TAG,
	"invalid-timeline-provenance": INVALID_TAG,
	"invalid-watermark-provenance": INVALID_TAG,
	"invalid-media-provenance": "The video was not restored as a video (the message says why): its caption stays text, and a web URL stays a link. Add the video again in OPF, or import the file as exported.",
	"code-import-reflow": REFLOW,
	"furniture-import-reflow": REFLOW,
	"heading-import-reflow": REFLOW,
	"image-callout-import-reflow": REFLOW,
	"metric-import-reflow": REFLOW,
	"native-fragment-reflow": REFLOW,
	"native-scalar-fragment-reflow": REFLOW,
	"quote-import-reflow": REFLOW,
	"text-import-reflow": REFLOW,
	"timeline-import-reflow": REFLOW,
	"content-card-reflow": "The card's text was imported, but its frame (fill, outline and placement) was read as decoration and not rebuilt; OPF lays the content out again. Review the imported slide.",
	"scaled-shape-text-reflow": "The shape's words and emphasis were kept, but its text uses OPF's composed sizes, not the sizes PowerPoint's autofit shrank it to. Review the imported shape.",
	"grouped-text-reflow": "Review the grouped content: its text and pictures were kept, but the group's transforms and the members OPF cannot import were not.",
	"native-language-unowned": "Nothing needs to change: the shape's current proofing language is kept.",
	"native-language-reference-changed": "Nothing needs to change: the shape's current proofing language is kept. Set the language in OPF and export again to change it.",
	"unclassified-native-footer": "Nothing needs to change: the text stays slide content (the message says why it was not read as a footer). To make it a footer, date or slide number, set it in design.footer in OPF.",
	"caption-detached": "The caption stayed an ordinary text block because its picture or video shape is gone or was renamed. Restore the media shape, or keep the text block.",
	"reference-text-changed": EDITED,
	"chart-data-provenance-changed": EDITED,
	"table-data-provenance-changed": EDITED,
	"design-reference-changed": EDITED,
	"layout-reference-changed": EDITED,
	"list-line-break-changed": EDITED,
	"list-line-role-changed": EDITED,
	"list-scalar-reference-changed": EDITED,
	"entry-ids-not-restored": EDITED,
	"slide-reference-changed": EDITED,
	"content-structure-changed": EDITED,
	"metadata-reference-changed": EDITED,
	"color-reference-changed": EDITED,
	"media-source-changed": EDITED,
	"metric-value-type-changed": EDITED,
	"metric-data-dropped": EDITED,
	"metric-link-omitted": "The PPTX is written with partial or no provenance, so the metric's data link, direction and number format are not stored in it: reimport shows the numbers as drawn. To keep them, export with full provenance (the default).",
	"quote-footer-merged": EDITED,
	"chart-dataset-unavailable": "The chart's values were imported inline, without its dataset reference: the package's datasets record lacks that dataset or holds other data (as after pasting the slide from another deck). Point the chart at the dataset again in OPF if it should follow it.",
	"table-dataset-unavailable": "The table's cells were imported inline, without its dataset reference, because the package's datasets record lacks that dataset. Point the table at the dataset again in OPF if it should follow it.",
	"layout-changed": "Nothing needs to change: the slide now uses the layout PowerPoint shows. To keep the original layout, change it back in OPF and export again.",
	"layout-renamed": "Nothing needs to change: the file was written before OPF 0.35, and the slide now uses the layout that replaced the removed one, which draws it as before (see docs/migrations/0.35.md).",
	"media-asset-conflict": "Nothing needs to change: the video keeps its current URL and caption, but its stored assets were not restored because their ids conflict with another video's (as after duplicating a slide). Give each video its own asset ids in OPF if both must keep them.",
	"quote-photo-missing": "Restore the headshot picture in PowerPoint or in the OPF source, or accept the quote without a photo.",
	"duplicate-block-id": "Nothing needs to change: the first block keeps the id and the duplicate gets none. Give duplicated blocks their own ids in OPF if they must stay distinct.",
	"duplicate-slide-id": "Nothing needs to change: the first slide keeps the id and the duplicate gets none. Give duplicated slides their own ids in OPF if they must stay distinct.",
	"unresolved-asset-reference": "The field refers to a picture or asset the PPTX no longer holds, so it was not restored and the imported document keeps the value observed in the file. Put the picture back in the PPTX, or set the field again in OPF.",
	"legacy-chart-reference-overlay": "The old reference shapes stay visible as ordinary content. Delete them and add referenceLines to the chart in OPF if the line should follow the data.",
	"chart-reference-style-uncertain": "The reference line was restored with the stroke the PPTX shows now, because the stored stroke is not valid. Set its stroke in OPF if it should differ.",
	"chart-reference-ownership-uncertain": REFERENCE_UNCERTAIN,
	"chart-reference-overlay-uncertain": REFERENCE_UNCERTAIN,
	"chart-point-series-uncertain":
		"The series the export split off so that PowerPoint's legend names the chart's one series were moved, removed or edited, so the chart imports as the file holds it (separate series, or gaps where the points of a removed series were) and the highlight is not restored. Fix the chart data in OPF (merge the extra series back, or fill the gaps) and set its highlight again, or export the original OPF source again.",
	"chart-number-format-adapted": "The values were imported as numbers without their PowerPoint number format, which has no OPF equivalent. Set a format on that column of the chart data in OPF if the display matters.",
	"chart-option-adapted": "The chart option at this path was adapted (the message says how): on export to what the chart can draw, on import to what OPF can express. Change the option in OPF if the difference matters.",
	"chart-cache-repaired": "The chart's cached data declared fewer points than its highest point index needs (Keynote writes this for a series with a gap), so the points were read at their own indexes and the missing positions are gaps. Nothing is needed unless a value looks wrong: then fix that cell in the chart data.",
	"chart-categories-flattened": "The chart's category cache came in several levels (Keynote splits labels such as 'Month: place' at the colon), so each category was read as one label (the message says whether the cached whole label or the joined levels). Check the labels, and edit them in the chart data in OPF if a separator is wrong.",
	"chart-unreadable": "The chart's cached data could not be read, so the chart was imported as a text placeholder and the rest of the deck as usual (the message names the reason). Repair the chart's data in the source application and import again, or recreate the chart in OPF.",
	"chart-value-not-numeric": "Each value that is not a number is plotted as a gap, never guessed. In an OPF deck, write chart values as numbers and put currency, percent and units in the column format; in a PPTX, make the chart's cached values numbers (Edit Data in PowerPoint).",
	"unsupported-background-fill": "The slide's PowerPoint background was not imported (the message says why: an unresolved style or theme color, a pattern without a DrawingML preset and colors, or another fill). Set the background in the imported OPF as a color, gradient, pattern or image.",
	"unsupported-background-image": "Embed the background as a PNG, JPEG, GIF or WebP picture in the PPTX (not linked), or set it in OPF.",
	"approximate-background-image": "The background picture uses effects or a fill OPF has no exact form for (the message names them), so it was imported as the closest OPF image background. Review it.",
	"unsupported-background-gradient": "The background was not imported: the PowerPoint gradient's geometry or color transforms are outside what an OPF linear gradient expresses. Set the background in the imported OPF.",
	"unsupported-color-map": "design.variant was not imported: the slide master's color map is not a variant OPF can name. Set design.variant in the imported OPF if the deck should use one.",
	"unsupported-theme-colors": "The theme's color scheme, or the slots the message names, was not imported as design.colorScheme. Set a color scheme in the imported OPF if the deck should keep one.",
	"theme-unverified": "design.theme was not set: the PPTX theme has the name of an OPF catalog theme, but neither its colors nor its fonts match that theme. Set design.theme in the imported OPF if the deck should use it.",
	"unsupported-body-inherited-style": "Set the font, size and color on the text itself in PowerPoint, or in OPF, so they do not depend on the layout and master it inherits them from.",
	"unsupported-body-text-style": "The text was imported; the run formatting the message names (an effect, capitalization, spacing, an underline style or an unreadable value) has no OPF run property and was not kept. Reapply it in OPF if it matters.",
	"approximate-body-text-baseline": "The superscript or subscript was kept, but not its exact offset. Review the imported text.",
	"unsupported-body-font": "The run was imported with its Latin font: an OPF run has one font family, so the separate East Asian or complex-script face set on it was not kept. Set the deck's script fonts in OPF if they matter.",
	"unsupported-body-link": "The text was imported without its mouse-over action, which an OPF run link cannot express.",
	"unsupported-native-autofit": "PowerPoint's saved autofit was not applied because it is invalid or ambiguous, so the text imports at its unscaled sizes. Review the imported text sizes.",
	"unsupported-native-autofit-size": "PowerPoint's saved font scale was not applied because the run has no resolved size, and no size was invented. Review the imported text size.",
	"native-autofit-applied": "The text was imported at the sizes PowerPoint's autofit shrank it to, as fixed sizes (some may be below OPF's usual minimum); OPF does not refit it automatically. Review the imported sizes.",
	"native-autofit-line-spacing": "The line spacing PowerPoint's autofit reduced was not imported, because OPF body text has no line-spacing override. Review the imported text.",
	"unsupported-table-cell-fill": TABLE_STYLE,
	"unsupported-table-padding": TABLE_STYLE,
	"unsupported-table-alignment": TABLE_STYLE,
	"unsupported-table-border": TABLE_STYLE,
	"unsupported-table-cell-effect": TABLE_STYLE,
	"unsupported-table-cell-style": TABLE_STYLE,
	"unsupported-table-merge-border": TABLE_STYLE,
	"unsupported-table-style": "The table style the table refers to is missing from the PPTX, so the table imports with only its cells' direct formatting. Review the imported table.",
	"unsupported-table-direction": "The table's right-to-left layout was not imported; its cells keep their order in the file. Review the imported table.",
	"unsupported-table-merge": "The merged cells are malformed, so the table imports every cell without merges rather than hide text behind a guessed one. Merge the cells again in OPF if needed.",
	"table-header-in-body": "A merge crosses the first row, so the table imports without a repeated header row; the first row keeps its formatting as a body row.",
	"unsupported-image-orientation": "The picture was imported without its rotation or mirroring, which OPF cannot express; the original image bytes were kept. Rotate or mirror the image file itself if it matters.",
	"unsupported-image-fit": "Review the imported image: PowerPoint's tiling or offset stretch has no form on an OPF image block, so it fills its frame by an OPF fit instead. Set fit (cover, contain, stretch or auto) if the result differs.",
	"unsupported-image-crop": "The full image was imported without PowerPoint's crop, which OPF cannot express. Crop the image file itself if only part of it should show.",
	"invalid-svg-image": "The SVG could not be read (the message says why). Replace it with a valid SVG; on import, the picture's PNG fallback stands in for it where the file has one.",
	"svg-sanitized": "Nothing needs to change unless the SVG needs the removed parts (scripts, external references): redraw it without them.",
	"mixed-body-paragraphs": "Make every paragraph of the body bulleted, or none, to import it as a list or plain text; the text was kept as list entries.",
	"math-equation-flattened": "The equation's fallback text was imported as plain text, because OPF has no equation model. Retype it as text, or use a picture of it in an image block.",
	"numbering-mixed": "The list mixes numbered and other paragraphs, so it imports as bullets. Number every paragraph of the list in PowerPoint to import it as a numbered list.",
	"numbering-scheme-adapted": "Use an arabic, letter or roman numbering scheme in PowerPoint; the others import as arabic with a period.",
	"numbering-style-adapted": "Use one numbering scheme per list level in PowerPoint; the level imports in its first entry's style.",
	"mixed-run-languages": "Nothing needs to change: runs keep their own language. Set a slide's language in OPF if one language should lead it.",
	"rtl-language-mismatch": "Right-to-left paragraphs carry no language, or one that does not match the presentation language, so their direction was not imported. Set a right-to-left language on them in PowerPoint (Review, Language), or as the presentation or slide language in OPF.",
	"script-font-not-imported": "The theme's East Asian or complex-script font the message names was not imported. If it matters, use a font scheme in OPF whose eastAsian or complexScript fonts name it.",
	"smartart-unreadable": "The SmartArt, or its drawing, could not be read, so it was not imported as SmartArt (the message says what was kept). Check the file in PowerPoint, or redraw it in OPF as a diagram or list.",
	"smartart-limited": "The SmartArt is too large or too deeply nested for OPF's outline, so its drawing was imported, or without one its entries as a flat list (the message says whether entries were left out). Review the imported slide.",
	"smartart-connection-dropped": "Each entry was imported once, under its first parent; the extra connections were dropped. Review the imported structure.",
	"smartart-text-dropped": "This text was not imported (the message quotes it): it is on a connection, belongs to no entry, or is on an entry no connection reaches. Add it in the imported OPF if it matters.",
	"smartart-picture-dropped": "The entries' pictures were not imported; their text was. Add the pictures in the imported OPF if they matter.",
	"smartart-edited": "Nothing needs to change: the list was read from the SmartArt nodes as edited. To keep the original, change it in OPF and export again.",
	"smartart-adapted": "OPF has no exact form for this SmartArt layout, so it was imported as the nearest OPF form the message names (an OPF layout, a list, a diagram or shapes). Review the imported slide.",
	"smartart-formatting-dropped": "The hierarchy was imported as a diagram, whose labels carry no bold, italic, underline or strikethrough; the words were kept.",
};

/** A finding of the shared format, with the library's details (font family, package, ...) alongside. */
export interface ReportFinding extends Finding {
	[detail: string]: unknown;
}

export class Reporter {
	readonly findings: ReportFinding[] = [];
	private readonly seen = new Set<string>();
	/** The identity key of each finding, by index ("" for the initial findings, which are not deduplicated). */
	private readonly keys: string[] = [];

	constructor(initial: readonly Finding[] = []) {
		for (const item of initial) {
			this.findings.push(item as ReportFinding);
			this.keys.push("");
		}
	}

	/** The point `withdrawErrors` looks back to: the number of findings so far. */
	mark(): number {
		return this.findings.length;
	}

	/**
	 * Withdraw the error findings added after `mark`: the failure of an attempt that is run again (RR-105). Its other findings stay; the
	 * next attempt repeats them and they are kept once.
	 */
	withdrawErrors(mark: number) {
		for (let index = this.findings.length - 1; index >= mark; index--) {
			if (this.findings[index]?.severity !== "error") continue;
			this.seen.delete(this.keys[index] ?? "");
			this.findings.splice(index, 1);
			this.keys.splice(index, 1);
		}
	}

	/** Add a library diagnostic (`code`, `path`, `message` and details). Identical entries are kept once. */
	add(source: Source, diagnostic: Diagnostic, severity?: FindingSeverity) {
		const { code, path: where, message, ...details } = diagnostic;
		const entry: ReportFinding = {
			ruleId: `${source}/${code}`,
			severity: severity ?? (INFO.has(code) ? "info" : "warning"),
			category: source,
			path: pointerOf(where ?? ""),
			scope: "document",
			message,
			help: HELP[code] ?? "",
			...Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined)),
		};
		// The details are part of the identity: opf-render's pdf-font-embedded has no path, and before 0.35 it had no message either,
		// only the face it embedded.
		const key = JSON.stringify([entry.ruleId, entry.path, entry.message, details]);
		if (this.seen.has(key)) return;
		this.seen.add(key);
		this.keys.push(key);
		this.findings.push(entry);
	}

	/** Add a finding as the library made it (the `findings` of a thrown OPFRenderError, OPFPptxError or core validation error). Identical entries are kept once. */
	addFinding(finding: Finding) {
		const key = JSON.stringify(finding);
		if (this.seen.has(key)) return;
		this.seen.add(key);
		this.keys.push(key);
		this.findings.push(finding as ReportFinding);
	}

	error(source: Source, code: string, message: string, where = "", details: Record<string, unknown> = {}) {
		this.add(source, { code, path: where, message, ...details }, "error");
	}

	get counts(): Record<FindingSeverity, number> {
		const counts = { error: 0, warning: 0, info: 0 };
		for (const item of this.findings) counts[item.severity] += 1;
		return counts;
	}

	get failed() {
		return this.counts.error > 0;
	}
}

/**
 * Convert a thrown library error into the report. An error that carries `findings` (the error findings of the format check,
 * on OPFRenderError, OPFPptxError and core's OPFValidationError) is reported as those findings; any other error becomes one
 * diagnostic that keeps its code and the path it names.
 */
export function reportThrown(reporter: Reporter, source: Source, error: unknown) {
	const failure = error as { code?: unknown; message?: string; details?: Record<string, unknown>; path?: unknown; findings?: unknown };
	const thrown = Array.isArray(failure.findings) ? (failure.findings as Finding[]).filter((item) => typeof item?.ruleId === "string" && typeof item.message === "string") : [];
	if (thrown.some((item) => item.severity === "error")) {
		for (const item of thrown) reporter.addFinding(item);
		return;
	}
	const code = typeof failure.code === "string" ? failure.code : "failed";
	const details = failure.details ?? {};
	const where = typeof details.path === "string" ? details.path : typeof failure.path === "string" ? failure.path : "";
	const extra: Record<string, unknown> = {};
	for (const key of ["fontFamily", "character", "family", "package", "script"]) if (details[key] !== undefined) extra[key] = details[key];
	reporter.error(source, code, failure.message ?? String(error), where, extra);
}

export function finishReport(
	base: Pick<ValidationReport, "valid" | "schemaValid" | "checks">,
	reporter: Reporter,
	failOn: FindingSeverity,
) {
	const counts = reporter.counts;
	const ok = base.valid && counts.error === 0 && !reaches(reporter.findings, failOn);
	return { ok, valid: base.valid && counts.error === 0, schemaValid: base.schemaValid, findings: reporter.findings, counts, checks: base.checks };
}
