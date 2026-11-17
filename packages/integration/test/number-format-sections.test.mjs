// Number format sections ("+0%;-0%"): the preview draws +12% and -5%, and the PPTX chart part carries real Excel sections.
import assert from "node:assert/strict";
import { test } from "node:test";
import { inflateRawSync } from "node:zlib";
import { convert, validate } from "@openpresentation/opf";
import { loadFonts } from "@openpresentation/opf-render/fonts-node";
import { fromPptx } from "@openpresentation/opf-pptx";

const FORMAT = "+0%;-0%";
const deck = {
	slides: [
		{
			title: "Rides against last year",
			blocks: [
				{
					chart: {
						type: "column",
						data: {
							columns: ["Month", { name: "Change", format: FORMAT }],
							rows: [["Apr", 0.12], ["May", -0.05], ["Jun", 0.3]],
						},
					},
				},
			],
		},
	],
};

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

test("a sectioned column format shows +12% and -5% in the SVG and as Excel sections in the PPTX", async () => {
	assert.equal(validate(deck, { catalogs: [] }).findings.filter((f) => f.severity === "error").length, 0);
	const fonts = await loadFonts({ pack: "office", substitutionPolicy: "visual", scripts: "auto", presentation: deck });
	const svg = await convert(deck, { format: "svg", fonts, catalogs: [], date: "2026-11-16" });
	const text = new TextDecoder().decode(svg.files[0].bytes);
	for (const shown of ["+12%", "-5%", "+30%"]) assert.ok(text.includes(shown), `${shown} is drawn`);
	assert.ok(!text.includes(";-0%"), "no section is printed as text");

	const native = await convert(deck, { format: "pptx", fonts, catalogs: [], date: "2026-11-16" });
	const parts = unzip(native.files[0].bytes);
	const chartName = [...parts.keys()].find((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name));
	const xml = parts.get(chartName).toString("utf8");
	const codes = [...xml.matchAll(/<c:numFmt formatCode="([^"]*)"/g)].map((m) => m[1]);
	assert.ok(codes.includes(FORMAT), `formatCode carries the sections: ${JSON.stringify(codes)}`);
	assert.ok(!codes.some((code) => code.includes('";')), "no section is quoted as literal text");

	const imported = await fromPptx(native.files[0].bytes, { signals: true, catalogs: [] });
	const column = imported.presentation.slides[0].blocks?.[0]?.chart?.data?.columns?.[1];
	assert.equal(column?.format, FORMAT, "the sections import back as the NumberFormat");
});

test("a waterfall with sectioned format shows its own signs in the SVG and writes the sections as the native label format", async () => {
	const waterfall = {
		slides: [{
			title: "Operating profit bridge",
			blocks: [{ chart: { type: "waterfall", data: { columns: ["Step", { name: "Profit ($M)", format: "+0.0;(0.0)" }], rows: [["2024", 10], ["Price", 4.5], ["Volume", -2.5], ["Costs", -1.5], ["2025", 10.5]] } } }],
		}],
	};
	const fonts = await loadFonts({ pack: "office", substitutionPolicy: "visual", scripts: "auto", presentation: waterfall });
	const svg = await convert(waterfall, { format: "svg", fonts, catalogs: [], date: "2026-11-16" });
	const text = new TextDecoder().decode(svg.files[0].bytes);
	for (const shown of ["+4.5", "(2.5)", "(1.5)", "+10.0"]) assert.ok(text.includes(shown), `${shown} is drawn`);
	assert.ok(![...text.matchAll(/>([^<]*)</g)].some((m) => m[1].length < 12 && /\+\+|[−-]\+|\+\(/.test(m[1])), "no doubled sign in any label");
	const native = await convert(waterfall, { format: "pptx", fonts, catalogs: [], date: "2026-11-16" });
	const parts = unzip(native.files[0].bytes);
	const xml = parts.get([...parts.keys()].find((name) => /^ppt\/charts\/chartEx\d+\.xml$/.test(name))).toString("utf8");
	const codes = [...xml.matchAll(/formatCode="([^"]*)"/g)].map((m) => m[1]);
	assert.ok(codes.length > 0 && codes.every((code) => code === "+0.0;(0.0)"), JSON.stringify(codes));
});
