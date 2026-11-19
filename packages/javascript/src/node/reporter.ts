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
const INVALID_TAG = "Nothing is lost from the slide: the tag that records the authored OPF structure was edited, duplicated or damaged in PowerPoint, so the shapes were imported as they look now. To get the authored structure back, import the file as exported, or change the OPF source and export again.";
const REFLOW = "The words and their order were recovered, but PowerPoint's formatting and positions are laid out again by OPF. Review the imported slide, and keep the OPF source as the master copy so the PPTX is only an output.";
const EDITED = "An edit made in PowerPoint after the export wins: OPF imported what the file shows now. To keep the authored value, change it in the OPF source and export again instead of editing the PPTX.";
const APPROXIMATED = "PowerPoint has no exact equivalent, so the closest OPF form was used. Review the imported content; nothing else needs to change.";
const CHART_OVERLAY = "Keep the chart, its reference lines and their labels together: moving or editing only one of them in PowerPoint leaves the others behind. To change a reference line, change it in the OPF source and export again.";
const FIXED_TEXT = "The text is exported as fixed text instead of a live PowerPoint field. To get a field that updates, use a format PowerPoint offers for it, or accept the fixed text.";
const SMARTART_IMPORT = "Review the imported list; the SmartArt text is kept. To keep the full diagram in OPF, redraw it as a diagram or one of OPF's list layouts.";

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
	"native-body-fallback": "Nothing needs to change: the text was exported as measured text boxes, which look exactly like the preview but edit line by line. For one editable native text box, give the slide one plain text, list or bullets block in a single region (no groups, hard line breaks, annotations or mixed fonts), or drop --body-text native to stop this note.",
	"unsupported-pattern": "Use a pattern PowerPoint has a preset for (see docs/shapes.md), or accept the background color alone, which is what was exported.",
	"numbering-unsupported-core": "Update @openpresentation/opf to a release that composes numbered lists (it must match the CLI's version), then export again.",
	"chartex-fallback-picture-unavailable": "Nothing needs to change in the deck. Apps without extended charts show the clustered column fallback; to give them a picture of the preview chart, install @openpresentation/opf-render.",
	"chart-map-geodata": "PowerPoint fetches the region shapes of a map chart from its online map service, so the chart draws only when it is online. Use another chart type if the deck must open offline.",
	"chart-reference-overlay": CHART_OVERLAY,
	"furniture-date-fixed": FIXED_TEXT,
	"furniture-field-fixed": FIXED_TEXT,
	"furniture-on-slide": "Move the slide content away from the footer, date or slide number, or hide that furniture on the slide; PowerPoint draws master furniture beneath the slide content.",
	"svg-render-failed": "Install @openpresentation/opf-render (it provides the rasterizer) or supply a PNG fallback; the slide's SVG is exported without a PNG picture until then.",
	"slide-render-failed": "Install @openpresentation/opf-render so --as images can draw the slides, then export again.",
	"unsupported-background-image-orientation": "Rotate or mirror the image file itself, then use it as the background: PowerPoint cannot apply the EXIF orientation to a picture fill.",
	"unsupported-background-fill": "Set the slide background in OPF as a color, gradient or image; the PowerPoint background could not be resolved from the archive.",
	"unsupported-background-image": "Embed the background as a PNG, JPEG, GIF or WebP picture in the PPTX (not linked), or set it in OPF.",
	"approximate-background-image": APPROXIMATED,
	"unsupported-background-gradient": "Use a linear gradient in OPF, or set the background there; the PowerPoint gradient's geometry or color transforms are outside what OPF can express.",
	"chart-number-format-adapted": "Nothing needs to change unless the format matters: choose a number format OPF has for that column in the chart's data, or accept the default.",
	"chart-option-adapted": "The chart option was adapted to what PowerPoint draws; see the message and the option at the path. Change the option in OPF if the difference matters.",
	"chart-value-not-numeric": "Fix the cached values in the chart's data (Edit Data in PowerPoint) so every plotted cell is a number, or accept the gaps.",
	"language-export-unavailable": "Install the Noto script package the message names where the CLI runs, or set a presentation language OPF can resolve, then export again.",
	"language-unresolved": "Use a BCP-47 language tag whose script OPF knows (en-US, ar-SA, ja-JP), or accept the language the PPTX uses.",
	"script-font-notes-not-exported": "Nothing needs to change in the slides. PowerPoint has one notes master per file, so notes use the presentation theme's East Asian and complex-script fonts; give the notes the deck's script fonts if they must differ.",

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
	"invalid-media-provenance": INVALID_TAG,
	"invalid-metric-provenance": INVALID_TAG,
	"invalid-native-fragments": INVALID_TAG,
	"invalid-native-scalar-fragments": INVALID_TAG,
	"invalid-quote-provenance": INVALID_TAG,
	"invalid-smartart-provenance": INVALID_TAG,
	"invalid-text-provenance": INVALID_TAG,
	"invalid-timeline-provenance": INVALID_TAG,
	"invalid-watermark-provenance": INVALID_TAG,
	"code-import-reflow": REFLOW,
	"content-card-reflow": REFLOW,
	"furniture-import-reflow": REFLOW,
	"heading-import-reflow": REFLOW,
	"image-callout-import-reflow": REFLOW,
	"metric-import-reflow": REFLOW,
	"native-fragment-reflow": REFLOW,
	"native-scalar-fragment-reflow": REFLOW,
	"quote-import-reflow": REFLOW,
	"scaled-shape-text-reflow": REFLOW,
	"text-import-reflow": REFLOW,
	"timeline-import-reflow": REFLOW,
	"grouped-text-reflow": "Review the grouped content: its text and pictures were kept, but group transforms and unsupported members are not. Ungroup the shapes in PowerPoint before importing for a closer result.",
	"native-fragment-unavailable": "The text no longer matches the measured lines recorded at export, so the original line is kept. Edit the OPF source and export again instead of editing the PPTX text.",
	"native-scalar-fragment-unavailable": "The text no longer matches the measured lines recorded at export, so the original line is kept. Edit the OPF source and export again instead of editing the PPTX text.",
	"native-latin-slot-unavailable": "Nothing needs to change: the shape keeps its native fonts. Set the font in OPF and export again if the Latin font must follow the deck.",
	"native-language-unowned": "Nothing needs to change: the shape's current proofing language is kept.",
	"native-language-reference-changed": "Nothing needs to change: the shape's current proofing language is kept. Set the language in OPF and export again to change it.",
	"unclassified-native-footer": "Nothing needs to change: the text stays slide content. To make it a footer, date or slide number, set it in the deck's footer design in OPF.",
	"caption-detached": "The caption stayed as an ordinary text block because its picture or video was deleted or renamed. Restore the media shape, or keep the text block.",
	"reference-text-changed": EDITED,
	"chart-data-provenance-changed": EDITED,
	"chart-dataset-unavailable": "Keep the dataset record with the slide: copy the whole deck, or add the dataset to the deck's datasets in OPF. The chart imported its values inline.",
	"table-data-provenance-changed": EDITED,
	"table-dataset-unavailable": "Keep the dataset record with the slide: copy the whole deck, or add the dataset to the deck's datasets in OPF. The table imported its cells inline.",
	"data-provenance-omitted": "Nothing needs to change for the values, which export and import as native data. To keep dataset references, mapping and formats, reduce the data (or keep it in a file the deck references) so the record fits the tag limit.",
	"document-provenance-omitted": "Nothing needs to change: reimport keeps the values observed in the PPTX. To store the field, shorten it or reference an asset instead of an inline value.",
	"design-reference-changed": EDITED,
	"layout-reference-changed": EDITED,
	"layout-changed": "Nothing needs to change: the slide now uses the layout PowerPoint shows. To keep the original layout, change it back in OPF and export again.",
	"list-line-break-changed": EDITED,
	"list-line-role-changed": EDITED,
	"list-scalar-reference-changed": EDITED,
	"slide-reference-changed": EDITED,
	"content-structure-changed": EDITED,
	"metadata-reference-changed": EDITED,
	"color-reference-changed": EDITED,
	"media-source-changed": EDITED,
	"media-provenance-omitted": "Nothing needs to change in the deck: the file imports with its current native content. To keep the video record in the PPTX, use a shorter source or caption.",
	"media-asset-conflict": "Nothing needs to change: the video keeps its current URL and caption. Do not duplicate video slides in PowerPoint if their assets must stay distinct.",
	"metric-value-type-changed": EDITED,
	"quote-footer-merged": EDITED,
	"quote-photo-missing": "Restore the headshot picture in PowerPoint or in the OPF source, or accept the quote without a photo.",
	"duplicate-block-id": "Nothing needs to change: the first block keeps the id and the duplicate gets none. Give duplicated blocks their own ids in OPF if they must stay distinct.",
	"duplicate-slide-id": "Nothing needs to change: the first slide keeps the id and the duplicate gets none. Give duplicated slides their own ids in OPF if they must stay distinct.",
	"unresolved-asset-reference": "Put the picture back in the PPTX, or set the field again in OPF; the imported document keeps the value observed in the file.",
	"legacy-chart-reference-overlay": "The old reference shapes stay visible as ordinary content. Delete them and add a reference line in the chart's OPF options if it should follow the data.",
	"chart-reference-style-uncertain": CHART_OVERLAY,
	"chart-reference-ownership-uncertain": CHART_OVERLAY,
	"chart-reference-overlay-uncertain": CHART_OVERLAY,
	"unsupported-body-inherited-style": "Set the font, size and color on the text itself in PowerPoint, or in OPF, so they do not depend on the layout and master it inherits them from.",
	"unsupported-image-orientation": "Rotate or mirror the image file itself, then insert it again; the original bytes were kept.",
	"unsupported-image-fit": "Use a stretch or crop fit that OPF names on the image block, then review the imported image.",
	"unsupported-image-crop": "Crop the image file itself or set the crop in OPF; the full image was kept.",
	"invalid-svg-image": "Replace the picture's SVG with a valid one, or keep the PNG fallback that was imported.",
	"svg-sanitized": "Nothing needs to change unless the SVG needs the removed parts (scripts, external references): redraw it without them.",
	"unsupported-color-map": "Set the slide's color variant in OPF; the PowerPoint color map is not one OPF can name.",
	"mixed-body-paragraphs": "Make every paragraph of the body bulleted, or none, to import it as a list or plain text; the text was kept as list entries.",
	"math-equation-flattened": "OPF has no equation model: retype the equation as text, or use a picture of it in an image block.",
	"numbering-mixed": "Number every paragraph of the list, or none, so it imports as a numbered list.",
	"numbering-scheme-adapted": "Use an arabic, letter or roman numbering scheme in PowerPoint; the others import as arabic with a period.",
	"numbering-style-adapted": "Use one numbering scheme per list level in PowerPoint.",
	"mixed-run-languages": "Nothing needs to change: runs keep their own language. Set a slide's language in OPF if one language should lead it.",
	"rtl-language-mismatch": "Set a language on the right-to-left runs in PowerPoint (Review, Language), or set the presentation language in OPF.",
	"script-font-not-imported": "Nothing needs to change unless the theme's script font matters: choose a font scheme in OPF that names it.",
	"smartart-unreadable": "Open and save the file in PowerPoint to regenerate the SmartArt drawing, or redraw it as an OPF diagram or list.",
	"smartart-renderer-unavailable": "Install @openpresentation/opf-render (npm install @openpresentation/opf-render) to import SmartArt drawings.",
	"smartart-limited": SMARTART_IMPORT,
	"smartart-connection-dropped": SMARTART_IMPORT,
	"smartart-text-dropped": SMARTART_IMPORT,
	"smartart-picture-dropped": SMARTART_IMPORT,
	"smartart-edited": "Nothing needs to change: the list was read from the SmartArt nodes as edited. To keep the original, change it in OPF and export again.",
	"smartart-adapted": APPROXIMATED,
	"smartart-formatting-dropped": SMARTART_IMPORT,
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
		// The details are part of the identity: opf-render's pdf-font-embedded has no path and no message, only the face it embedded.
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
