// RR-105: the format-coverage decks of the release qualification corpus (scripts/native-acceptance/qualification/decks/coverage-*.opf.json)
// validate without errors and with only their deliberate warnings, compose and render every slide, and export to PPTX through the
// real opf-render and opf-pptx, so CI opens every schema location they cover on every run (scripts/check-format-coverage.mjs).
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const decksDir = path.resolve(here, "../../../scripts/native-acceptance/qualification/decks");
const opf = await import(pathToFileURL(path.resolve(here, "../../javascript/dist/index.js")).href);
const temp = await mkdtemp(path.join(tmpdir(), "opf-coverage-"));
after(() => rm(temp, { recursive: true, force: true }));

// The warnings each deck shows on purpose (a deliberate case, or a known finding recorded for the release); any other warning fails.
const EXPECTED_WARNINGS = {
	"coverage-images": ["opf/reading-order"],
	"coverage-languages": ["opf/language-tag"],
	"coverage-charts": ["opf/chart-mapping-adapted"],
	"coverage-template": ["opf/variable-unfilled"],
	"coverage-variables": ["opf/missing-alt-text"],
	"coverage-warnings": ["opf/shape-off-slide", "opf/shape-anchor-size-unit", "opf/timeline-period-short"],
};

const decks = readdirSync(decksDir)
	.filter((name) => /^coverage-.*\.opf\.json$/u.test(name) && name !== "coverage-known-issues.opf.json")
	.sort();

test("format coverage: the decks are there", () => {
	assert.ok(decks.length >= 30, `${decks.length} coverage decks`);
	const manifest = JSON.parse(readFileSync(path.resolve(decksDir, "../manifest.json"), "utf8"));
	const listed = new Set(manifest.decks.map((deck) => path.basename(deck.source)));
	for (const name of decks) assert.ok(listed.has(name), `${name} is in the qualification manifest`);
});

for (const name of decks) {
	const id = name.replace(/\.opf\.json$/u, "");
	test(`format coverage: ${id} validates, renders and exports`, async () => {
		const file = path.join(decksDir, name);
		const presentation = await opf.open(file);
		const report = await opf.validate(presentation);
		const errors = report.findings.filter((finding) => finding.severity === "error");
		assert.deepEqual(errors.map((finding) => `${finding.ruleId} ${finding.path}`), [], `${id}: no errors`);
		const unexpected = report.findings.filter((finding) => finding.severity === "warning" && !(EXPECTED_WARNINGS[id] ?? []).includes(finding.ruleId));
		assert.deepEqual(unexpected.map((finding) => `${finding.ruleId} ${finding.path}: ${finding.message}`), [], `${id}: only deliberate warnings`);
		const visible = presentation.slides.filter((slide) => !slide.hidden).length;
		const svg = await opf.convert(file, path.join(temp, id, "slide.svg"));
		assert.ok(svg.files.length >= visible, `${id}: ${svg.files.length} slides drawn for ${visible} visible`);
		for (const drawn of svg.files) assert.match(Buffer.from(drawn.bytes).toString("utf8", 0, 200), /<svg/u, `${id}: ${drawn.name} is SVG`);
		const pptx = await opf.convert(file, path.join(temp, `${id}.pptx`));
		const bytes = await readFile(pptx.files[0].path);
		assert.equal(bytes.subarray(0, 2).toString("latin1"), "PK", `${id}: the PPTX is a zip`);
	});
}
