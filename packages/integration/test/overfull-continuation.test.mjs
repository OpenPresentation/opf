// LH-90: the export (`convert`, `opf convert`) continues an overfull slide of sibling blocks of one kind on further slides before
// drawing, so the preview (SVG, PNG, PDF) and the PPTX draw the same readable pages; each continued slide is a `slide-continued`
// finding with the slides it became. `paginate: false` draws the slide as written; a strict composition still fails.
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
const deck = (extra = {}) => ({ name: "Execution plan", slides: [{ id: "intro", title: "Execution plan" }, { id: "paths", layout: "process", title: "Eight execution paths", blocks: Array.from({ length: 8 }, (_, index) => timeline(index)), ...extra }, { id: "close", title: "Next steps" }] });
const continuedOf = (findings, source) => findings.filter((finding) => finding.ruleId === `${source}/slide-continued`);
const overflowOf = (findings) => findings.filter((finding) => /\/text-overflow$/.test(finding.ruleId));

test("the preview and the PPTX draw an overfull slide of timelines as two readable slides, and say so", async () => {
	const svg = await opf.convert(deck(), { format: "svg" });
	assert.equal(svg.files.length, 4, "four slides drawn");
	const [preview] = continuedOf(svg.findings, "render");
	assert.ok(preview, JSON.stringify(svg.findings.map((finding) => finding.ruleId)));
	assert.equal(preview.path, "/slides/1");
	assert.deepEqual(preview.slides, [2, 3]);
	assert.deepEqual(preview.units, [4, 4]);
	assert.equal(preview.kind, "timeline");
	assert.match(preview.message, /drawn on 2 slides \(2, 3\)/);
	assert.deepEqual(overflowOf(svg.findings), [], "no slide is drawn overlapping");
	// Both pages repeat the title.
	assert.ok(svg.files.slice(1, 3).every((file) => new TextDecoder().decode(file.bytes).includes("Eight execution paths")));

	const pptx = await opf.convert(deck(), { format: "pptx" });
	const imported = await fromPptx(pptx.files[0].bytes, { catalogs: [gallery] });
	assert.deepEqual(imported.slides.map((slide) => slide.id), ["intro", "paths", "paths--2", "close"], "the PPTX has the same four slides");
	assert.deepEqual(continuedOf(pptx.findings, "pptx").map((finding) => finding.slides), [[2, 3]]);
	assert.deepEqual(overflowOf(pptx.findings), []);
	// Every timeline is in the file once.
	const text = JSON.stringify(imported.slides);
	for (let index = 0; index < 8; index++) assert.equal(text.split(`Workstream ${index + 1} execution path`).length - 1, 1, `timeline ${index + 1}`);
});

test("paginate: false draws the slide as written; a strict composition still fails", async () => {
	const kept = await opf.convert(deck(), { format: "svg", paginate: false });
	assert.equal(kept.files.length, 3);
	assert.deepEqual(continuedOf(kept.findings, "render"), []);
	assert.ok(overflowOf(kept.findings).length > 0, "the overlap is reported as before");
	await assert.rejects(opf.convert(deck(), { format: "svg", paginate: "pages" }), /paginate must be true, false or "blocks"/);
	await assert.rejects(opf.convert(deck({ composition: { overflow: "error" } }), { format: "svg" }), (error) => error.code === "export-failed");
});
