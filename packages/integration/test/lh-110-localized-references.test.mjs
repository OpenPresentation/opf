// LH-110: seven explicit localized reference labels through real SVG/PPTX conversion and public import.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { inflateRawSync } from "node:zlib";
import { convert, resolveSlideContext, validate } from "@openpresentation/opf";
import { composeSlide } from "@openpresentation/opf/composition";
import { loadFonts } from "@openpresentation/opf-render/fonts-node";
import { fromPptx } from "@openpresentation/opf-pptx";
const document = JSON.parse(
	fs.readFileSync(
		new URL(
			"../../../examples/technical/localized-chart-references.opf.json",
			import.meta.url,
		),
		"utf8",
	),
);
const attrs = (text) =>
	Object.fromEntries(
		[...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
	);
const xmlEscape = (text) =>
	text.replace(
		/[&<>"']/g,
		(c) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&apos;",
			})[c],
	);
function unzip(bytes) {
	const b = Buffer.from(bytes),
		parts = new Map();
	let end = b.length - 22;
	while (end >= 0 && b.readUInt32LE(end) !== 0x06054b50) end--;
	assert(end >= 0, "PPTX central directory exists");
	let offset = b.readUInt32LE(end + 16);
	for (let i = 0; i < b.readUInt16LE(end + 10); i++) {
		assert.equal(b.readUInt32LE(offset), 0x02014b50);
		const method = b.readUInt16LE(offset + 10),
			size = b.readUInt32LE(offset + 20),
			length = b.readUInt16LE(offset + 28),
			extra = b.readUInt16LE(offset + 30),
			comment = b.readUInt16LE(offset + 32),
			local = b.readUInt32LE(offset + 42),
			name = b.toString("utf8", offset + 46, offset + 46 + length);
		assert(!parts.has(name));
		assert.equal(b.readUInt32LE(local), 0x04034b50);
		const start =
				local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28),
			packed = b.subarray(start, start + size);
		assert([0, 8].includes(method));
		parts.set(name, method === 0 ? packed : inflateRawSync(packed));
		offset += 46 + length + extra + comment;
	}
	return parts;
}
function nativeChart(parts, index) {
	const slide = parts.get(`ppt/slides/slide${index + 1}.xml`).toString("utf8"),
		charts = [...slide.matchAll(/<c:chart\b([^>]*)\/?\s*>/g)];
	assert.equal(
		charts.length,
		1,
		"Exactly one native chart, no duplicate chart shape",
	);
	const id = attrs(charts[0][1])["r:id"],
		rels = parts
			.get(`ppt/slides/_rels/slide${index + 1}.xml.rels`)
			.toString("utf8"),
		match = [...rels.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)]
			.map((m) => attrs(m[1]))
			.filter((r) => r.Id === id);
	assert.equal(match.length, 1);
	assert.match(match[0].Type, /\/chart$/);
	const target = path.posix.normalize(
		path.posix.join("ppt/slides", match[0].Target),
	);
	assert(target.startsWith("ppt/charts/"));
	return { xml: parts.get(target).toString("utf8"), slide };
}
const chartItem = (deck, index, fonts) => {
	const context = resolveSlideContext(deck, index, { fonts, catalogs: [] });
	return composeSlide(context.slide, context.options).items.find(
		(item) => item.field === "chart",
	);
};
const fmt = (value) => Number(value.toFixed(3));
const assertSvgLine = (svg, line) => {
	const lines = [...svg.matchAll(/<line\b([^>]*)>/g)].map((m) => attrs(m[1]));
	const matching = lines.filter((a) =>
		["x1", "y1", "x2", "y2"].every((k) => Number(a[k]) === fmt(line[k])),
	);
	assert.equal(
		matching.length,
		1,
		"Exactly one SVG line at the composed explicit reference coordinates",
	);
	assert.equal(Number(matching[0]["stroke-width"]), fmt(line.strokeWidth));
	assert.equal(
		matching[0]["stroke-dasharray"],
		[4, 3].map((n) => fmt(n * line.strokeWidth)).join(" "),
	);
	return matching[0];
};
test("LH-110: all seven authored labels keep explicit geometry, native helper paint and exact public-import data", async () => {
	assert.equal(document.slides.length, 7);
	assert.equal(new Set(document.slides.map((s) => s.language)).size, 7);
	const validation = validate(document, { catalogs: [] });
	assert.equal(validation.schemaValid, true);
	assert.ok(
		!validation.findings.some((f) => f.code === "unresolved-reference"),
		"standalone catalog records are complete",
	);
	const fonts = await loadFonts({
		pack: "office",
		substitutionPolicy: "visual",
		scripts: "auto",
		presentation: document,
	});
	const svg = await convert(document, {
			format: "svg",
			fonts,
			catalogs: [],
			date: "2026-11-08",
		}),
		native = await convert(document, {
			format: "pptx",
			fonts,
			catalogs: [],
			date: "2026-11-08",
		});
	assert.equal(svg.files.length, 7);
	assert.equal(native.files.length, 1);
	const parts = unzip(native.files[0].bytes),
		imported = await fromPptx(native.files[0].bytes, {
			signals: true,
			catalogs: [],
		});
	assert.equal(imported.presentation.slides.length, 7);
	for (const [index, source] of document.slides.entries()) {
		const authored = source.chart.referenceLines;
		assert.equal(authored.length, 1);
		assert.equal(authored[0].value, 0.92);
		assert.equal(authored[0].stroke.dash, "dash");
		assert.ok(authored[0].label.endsWith("92%"));
		const item = chartItem(document, index, fonts),
			chart = item.chart,
			refs = chart.layer.references;
		assert.equal(refs.lines.length, 1, source.language);
		assert.equal(
			Object.hasOwn(refs, "bands"),
			false,
			"Explicit references have no inferred highlight bands",
		);
		const line = refs.lines[0];
		assert.equal(line.value, authored[0].value);
		assert.equal(line.label, authored[0].label);
		assert.equal(line.axis, "value");
		assert.equal(line.labelPosition, "end");
		assert.equal(line.stroke.dash, authored[0].stroke.dash);
		assert.equal(line.native, true);
		assert.equal(line.endpoint, source.chart.data.rows.length - 1);
		assert.equal(line.y1, line.y2);
		assert(line.x1 < line.x2);
		assert(
			line.labelBox && Object.values(line.labelBox).every(Number.isFinite),
		);
		const text = new TextDecoder().decode(svg.files[index].bytes);
		assert.ok(
			text.includes(xmlEscape(authored[0].label)),
			source.language + ": SVG retains the complete authored label",
		);
		const svgLine = assertSvgLine(text, line);
		const { xml, slide } = nativeChart(parts, index),
			series = [...xml.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)].map((m) => m[0]),
			helpers = series.filter((s) => s.includes("<opf:reference "));
		assert.equal(
			series.length,
			2,
			"One ordinary series plus one explicitly owned helper",
		);
		assert.equal(helpers.length, 1);
		const helper = helpers[0],
			paint = /<a:solidFill>([\s\S]*?)<\/a:solidFill>/.exec(helper);
		assert(paint);
		assert.match(
			paint[1],
			/<a:(?:srgbClr|schemeClr)\b/,
			"Native reference has explicit RGB or theme paint",
		);
		assert.match(xml, /urn:openpresentation:chart-references:v1/);
		assert.match(helper, /<c:symbol val="none"/);
		assert.ok(
			helper.includes(`<a:ln w="${Math.round(line.strokeWidth * 9525)}"`),
		);
		assert.match(helper, /<a:prstDash val="dash"/);
		assert.equal((helper.match(/<c:dLbl>/g) ?? []).length, 1);
		assert.ok(helper.includes(`<c:dLbl><c:idx val="${line.endpoint}"/>`));
		assert.ok(helper.includes(`<a:t>${xmlEscape(authored[0].label)}</a:t>`));
		const values = /<c:val>([\s\S]*?)<\/c:val>/.exec(helper);
		assert(values);
		const points = [
			...values[1].matchAll(/<c:pt idx="\d+"><c:v>([^<]+)<\/c:v><\/c:pt>/g),
		].map((m) => Number(m[1]));
		assert.deepEqual(
			points,
			source.chart.data.rows.map(() => authored[0].value),
			"Every helper cache value is the explicit target, without replacing original data",
		);
		const frame = /<p:graphicFrame>([\s\S]*?)<\/p:graphicFrame>/.exec(slide);
		assert(frame);
		const off = attrs(/<a:off\b([^>]*)\//.exec(frame[1])[1]),
			extent = attrs(/<a:ext\b([^>]*)\//.exec(frame[1])[1]);
		for (const [actual, expected] of [
			[off.x, item.box.x],
			[off.y, item.box.y],
			[extent.cx, item.box.width],
			[extent.cy, item.box.height],
		])
			assert.ok(
				Math.abs(Number(actual) / 9525 - expected) < 0.0002,
				"Native chart frame keeps the existing exact-EMU projection bound",
			);
		const plot = chart.layer.plot,
			manual =
				/<c:plotArea>\s*<c:layout><c:manualLayout>([\s\S]*?)<\/c:manualLayout>/.exec(
					xml,
				);
		assert(plot && manual);
		assert.match(manual[1], /<c:layoutTarget val="inner"/);
		const fraction = (v) => Number(Math.min(1, Math.max(0, v)).toFixed(4));
		for (const [field, expected] of Object.entries({
			x: plot.left / item.box.width,
			y: plot.top / item.box.height,
			w: (item.box.width - plot.left - plot.right) / item.box.width,
			h: (item.box.height - plot.top - plot.bottom) / item.box.height,
		})) {
			const actual = new RegExp("<c:" + field + ' val="([^"]+)"').exec(
				manual[1],
			);
			assert(actual);
			assert.equal(
				Number(actual[1]),
				fraction(expected),
				"Native plot uses its existing four-decimal source-geometry projection",
			);
		}
		const axes = [...xml.matchAll(/<c:valAx>([\s\S]*?)<\/c:valAx>/g)].map(
			(m) => m[1],
		);
		assert.equal(axes.length, 1, "Helper shares the ordinary value axis");
		assert.equal(
			Number(/<c:min val="([^"]+)"/.exec(axes[0])[1]),
			chart.valueAxis.min,
		);
		assert.equal(
			Number(/<c:max val="([^"]+)"/.exec(axes[0])[1]),
			chart.valueAxis.max,
		);
		const legend = /<c:legend>([\s\S]*?)<\/c:legend>/.exec(xml);
		if (legend) {
			const id = /<c:idx val="(\d+)"/.exec(helper)[1];
			assert.ok(
				legend[1].includes(
					`<c:legendEntry><c:idx val="${id}"/><c:delete val="1"/>`,
				),
				"Owned helper cannot become an ordinary legend series",
			);
		}
		const result = imported.presentation.slides[index],
			reference = result.chart.referenceLines;
		assert.equal(result.chart.type, source.chart.type);
		assert.deepEqual(
			result.chart.data,
			source.chart.data,
			"All original values and columns survive without a helper column",
		);
		assert.equal(reference.length, 1, "Owned helper restores exactly once");
		assert.equal(reference[0].value, authored[0].value);
		assert.equal(reference[0].label, authored[0].label);
		assert.equal(reference[0].axis, "value");
		assert.equal(reference[0].labelPosition, "end");
		assert.equal(reference[0].stroke.dash, "dash");
		assert.equal(reference[0].stroke.width, 4 / 3);
		assert.equal(
			reference[0].stroke.color.toUpperCase(),
			svgLine.stroke.toUpperCase(),
			"Current native XML paint imports to the same resolved SVG stroke color",
		);
		assert.equal(
			result.shapes?.length ?? 0,
			0,
			"Native helper adds no duplicate ordinary overlay shapes",
		);
		const changed = structuredClone(document);
		changed.slides[index].title = "Since 1888, results below 1%";
		changed.slides[index].subtitle = "After 2023: target 37%, current 19%";
		const explicit = chartItem(changed, index, fonts).chart.layer.references;
		assert.deepEqual(
			explicit.lines.map(({ value, axis, label, labelPosition, stroke }) => ({
				value,
				axis,
				label,
				labelPosition,
				stroke,
			})),
			refs.lines.map(({ value, axis, label, labelPosition, stroke }) => ({
				value,
				axis,
				label,
				labelPosition,
				stroke,
			})),
			"Title/subtitle numbers do not change authored reference semantics",
		);
		delete changed.slides[index].chart.referenceLines;
		assert.equal(
			chartItem(changed, index, fonts).chart.layer.references?.lines.length ??
				0,
			0,
			"Numeric prose creates no inferred reference",
		);
	}
});
