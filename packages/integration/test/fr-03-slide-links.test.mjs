// FR-03: a deck with slide links goes through the public export step (`convert`, which continues overfull slides one slide at a time)
// to SVG, PDF and PPTX: no slide link is rejected as naming an unknown slide, the PDF has go-to-page links, the PPTX has slide jumps and
// the import returns `slide:<id>`.
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gallery } from "@openpresentation/gallery";
import { fromPptx } from "@openpresentation/opf-pptx";

const coreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "javascript");
const opf = await import(pathToFileURL(path.join(coreRoot, "dist", "index.js")).href);

const timeline = (index) => ({ timeline: { name: `Workstream ${index + 1} execution path`, description: `Major milestones for workstream ${index + 1}.`, events: [
	{ when: "May", what: "Baseline", description: "Confirm current state, owners, and constraints." },
	{ when: "Jun", what: "Pilot", description: "Run a narrow pilot with visible success criteria." },
	{ when: "Jul", what: "Scale", description: "Expand the approach after risk review." },
	{ when: "Aug", what: "Embed", description: "Move reporting and routines into steady-state operations." },
] } });
// Slide 2 is overfull and continues on a second slide, so the export checks each slide on its own: the links on slide 1 and 3 must still be known.
const deck = () => ({ name: "Linked plan", slides: [
	{ id: "intro", title: "Plan", blocks: [{ text: [{ text: "The paths", link: "slide:paths" }, " and the ", { text: "close", link: "slide:close" }] }] },
	{ id: "paths", layout: "process", title: "Eight execution paths", blocks: Array.from({ length: 8 }, (_, index) => timeline(index)) },
	{ id: "close", title: "Close", blocks: [{ text: [{ text: "Back to the start", link: "slide:intro" }] }] },
] });
const errorsOf = (findings) => findings.filter((finding) => finding.severity === "error");

test("a deck with slide links exports to SVG, PDF and PPTX, also when a slide continues", async () => {
	const svg = await opf.convert(deck(), { format: "svg" });
	assert.deepEqual(errorsOf(svg.findings), []);
	assert.equal(svg.files.length, 4, "the overfull slide continued on a second slide");
	assert.match(new TextDecoder().decode(svg.files[0].bytes), /<a data-opf-slide-link="paths" href="#slide:paths">/);

	const pdf = await opf.convert(deck(), { format: "pdf" });
	assert.deepEqual(errorsOf(pdf.findings), []);
	const pdfText = Buffer.from(pdf.files[0].bytes).toString("latin1");
	assert.equal((pdfText.match(/\/S\/GoTo/g) ?? []).length, 3, "three links, each to a page of the PDF");

	const pptx = await opf.convert(deck(), { format: "pptx" });
	assert.deepEqual(errorsOf(pptx.findings), []);
	const imported = await fromPptx(pptx.files[0].bytes, { catalogs: [gallery] });
	const links = JSON.stringify(imported.slides[0]);
	assert.ok(links.includes('"link":"slide:paths"') && links.includes('"link":"slide:close"'), links);
	// The jump to the close slide lands on it although the continuation made it the fourth slide of the file.
	assert.deepEqual(imported.slides.map((slide) => slide.id), ["intro", "paths", "paths--2", "close"]);
	assert.ok(JSON.stringify(imported.slides[3]).includes('"link":"slide:intro"'));
});
