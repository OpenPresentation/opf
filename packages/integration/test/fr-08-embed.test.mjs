// FR-08: a deck with embeds goes through the public export step (`convert`) to SVG, PDF, PNG and PPTX: the static form is drawn and linked in
// each, nothing is loaded, no embed is rejected on the way, and the PowerPoint file imports the embeds back.
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gallery } from "@openpresentation/gallery";
import { fromPptx } from "@openpresentation/opf-pptx";

const coreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "javascript");
const opf = await import(pathToFileURL(path.join(coreRoot, "dist", "index.js")).href);

const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const deck = () => ({
	name: "Embeds", language: "en-US", assets: { shot: pixel },
	slides: [
		{ id: "live", title: "Revenue, live", embed: { src: "https://app.example.com/dashboards/revenue", title: "Revenue dashboard", aspectRatio: 1.6, preview: "asset:shot" } },
		{ id: "beside", title: "Try the prototype", layout: "image-beside", blocks: [{ text: "The checkout flow we tested with twelve customers." }, { embed: "https://prototype.example.com/checkout", caption: "Prototype, version 3" }] },
	],
});
const errorsOf = (findings) => findings.filter((finding) => finding.severity === "error");

test("a deck with embeds exports to SVG, PDF, PNG and PPTX, and the PPTX imports them back", async () => {
	const svg = await opf.convert(deck(), { format: "svg" });
	assert.deepEqual(errorsOf(svg.findings), []);
	assert.equal(svg.files.length, 2);
	const first = new TextDecoder().decode(svg.files[0].bytes), second = new TextDecoder().decode(svg.files[1].bytes);
	assert.match(first, /data-opf-embed-src="https:\/\/app\.example\.com\/dashboards\/revenue"/);
	assert.match(first, /<image [^>]*preserveAspectRatio="xMidYMid meet"/);
	assert.match(second, /<g data-opf-embed-text="title">/, "the card, in the media region of image-beside, which accepts video");

	const pdf = await opf.convert(deck(), { format: "pdf" });
	assert.deepEqual(errorsOf(pdf.findings), []);
	const text = Buffer.from(pdf.files[0].bytes).toString("latin1");
	assert.ok((text.match(/\/S\/URI\/URI\(https:\/\/app\.example\.com\/dashboards\/revenue\)/g) ?? []).length >= 1);
	assert.ok((text.match(/\/S\/URI\/URI\(https:\/\/prototype\.example\.com\/checkout\)/g) ?? []).length >= 1);

	const png = await opf.convert(deck(), { format: "png" });
	assert.deepEqual(errorsOf(png.findings), []);
	assert.equal(png.files.length, 2);

	const pptx = await opf.convert(deck(), { format: "pptx" });
	assert.deepEqual(errorsOf(pptx.findings), []);
	const imported = await fromPptx(pptx.files[0].bytes, { catalogs: [gallery] });
	assert.equal(imported.slides[0].embed.src, "https://app.example.com/dashboards/revenue");
	assert.equal(imported.slides[0].embed.title, "Revenue dashboard");
	assert.equal(imported.slides[0].embed.aspectRatio, 1.6);
	assert.ok(JSON.stringify(imported.slides[1]).includes('"embed":"https://prototype.example.com/checkout"'), JSON.stringify(imported.slides[1]));
	assert.equal(imported.slides[1].blocks.at(-1).caption, "Prototype, version 3");
});
