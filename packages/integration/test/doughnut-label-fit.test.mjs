// A doughnut's explicit data labels sit inside their slices. A label that does not fit its ring is never drawn spilling out of it:
// both engines draw the reduced labels (core chartDoughnut `labels`) and say so.
import assert from "node:assert/strict";
import { test } from "node:test";
import { inflateRawSync } from "node:zlib";
import { convert } from "@openpresentation/opf";
import { loadFonts } from "@openpresentation/opf-render/fonts-node";

const deck = (content) => ({
	slides: [
		{
			title: "Battery faults caused almost half of all bike downtime",
			blocks: [
				{
					chart: {
						type: "doughnut",
						data: { columns: ["Cause", "Share"], rows: [["Battery faults", 48], ["Brakes", 22], ["Tires", 18], ["Other", 12]] },
						dataLabels: { content },
					},
				},
			],
		},
	],
});

function unzip(bytes) {
	const b = Buffer.from(bytes),
		parts = new Map();
	let end = b.length - 22;
	while (end >= 0 && b.readUInt32LE(end) !== 0x06054b50) end--;
	let offset = b.readUInt32LE(end + 16);
	for (let i = 0; i < b.readUInt16LE(end + 10); i++) {
		const method = b.readUInt16LE(offset + 10),
			size = b.readUInt32LE(offset + 20),
			length = b.readUInt16LE(offset + 28),
			extra = b.readUInt16LE(offset + 30),
			comment = b.readUInt16LE(offset + 32),
			local = b.readUInt32LE(offset + 42),
			name = b.toString("utf8", offset + 46, offset + 46 + length),
			start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28),
			packed = b.subarray(start, start + size);
		parts.set(name, method === 0 ? packed : inflateRawSync(packed));
		offset += 46 + length + extra + comment;
	}
	return parts;
}

const render = async (presentation, format) => {
	const fonts = await loadFonts({ pack: "office", substitutionPolicy: "visual", scripts: "auto", presentation });
	return convert(presentation, { format, fonts, catalogs: [], date: "2026-11-16" });
};

test("labels wider than the ring drop their category in the SVG and the PPTX, and the finding says so", async () => {
	const presentation = deck(["category", "percent"]);
	const svg = await render(presentation, "svg");
	const text = new TextDecoder().decode(svg.files[0].bytes);
	assert.ok(!text.includes("Battery faults, 48%"), "the long label is not drawn");
	assert.ok(text.includes("48%") && text.includes("12%"), "the percent labels are drawn");
	const finding = svg.findings.find((entry) => entry.ruleId === "render/chart-option-adapted");
	assert.match(finding?.message ?? "", /does not fit the ring.*show 'percent' instead/);

	const native = await render(presentation, "pptx");
	const parts = unzip(native.files[0].bytes);
	const xml = parts.get([...parts.keys()].find((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name))).toString("utf8");
	assert.ok(!/<c:showCatName val="1"\/>/.test(xml), "no label shows the category in the chart part");
	assert.ok(/<c:showPercent val="1"\/>/.test(xml));
	assert.ok(native.findings.some((entry) => entry.ruleId === "pptx/chart-option-adapted" || /does not fit the ring/.test(entry.message)));
});

test("labels that fit are left as authored", async () => {
	const svg = await render(deck(["percent"]), "svg");
	assert.ok(!svg.findings.some((entry) => /does not fit the ring/.test(entry.message)));
});
