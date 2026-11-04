// LH-145: the export engine (`convert`, `opf convert`) measures the picture backgrounds once (data URIs, asset references and local files) and
// gives the same sampler to the preview and the PPTX, so a dark photo under white text gets no scrim and a light one does, in both.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateRawSync } from "node:zlib";
import sharp from "sharp";

const coreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "javascript");
const opf = await import(pathToFileURL(path.join(coreRoot, "dist", "index.js")).href);

const photo = (rgb) => sharp({ create: { width: 320, height: 180, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).jpeg().toBuffer();
const dark = await photo([16, 22, 38]), light = await photo([232, 232, 222]);
const deck = (background, variant = "dark1", assets) => ({ name: "Cover", ...(assets ? { assets } : {}), slides: [{ id: "cover", title: "A cover over a photo", subtitle: "Subtitle", design: { variant, background: { type: "image", src: background } } }] });
const dataUri = (bytes) => `data:image/jpeg;base64,${bytes.toString("base64")}`;
const scrims = (result) => (new TextDecoder().decode(result.files[0].bytes).match(/<linearGradient\b/g) ?? []).length;

// The slide XML of a PPTX: its stored or deflated entries read from the central directory.
function entries(bytes) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), found = new Map();
	let end = bytes.length - 22;
	while (view.getUint32(end, true) !== 0x06054b50) end--;
	for (let at = view.getUint32(end + 16, true), count = view.getUint16(end + 10, true); count--;) {
		const method = view.getUint16(at + 10, true), size = view.getUint32(at + 20, true), nameLength = view.getUint16(at + 28, true), extra = view.getUint16(at + 30, true), comment = view.getUint16(at + 32, true), local = view.getUint32(at + 42, true);
		const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
		const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true), data = bytes.subarray(start, start + size);
		found.set(name, new TextDecoder().decode(method === 8 ? inflateRawSync(data) : data));
		at += 46 + nameLength + extra + comment;
	}
	return found;
}
const gradients = (pptx) => [...entries(pptx.files[0].bytes)].filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).reduce((sum, [, xml]) => sum + (xml.match(/<a:gradFill\b/g) ?? []).length, 0);

test("a dark photo under white text gets no scrim, a light one does, in the preview and the PPTX", async () => {
	for (const format of ["svg", "pptx"]) {
		const count = (result) => (format === "svg" ? scrims(result) : gradients(result));
		const worst = await opf.convert(deck(dataUri(dark)), { format, measurePictures: false });
		assert.ok(count(worst) > 0, `${format}: sized for any picture, a scrim is drawn`);
		const measured = await opf.convert(deck(dataUri(dark)), { format });
		assert.equal(count(measured), 0, `${format}: a dark photo under white text needs none`);
		const lighter = await opf.convert(deck(dataUri(light)), { format });
		assert.ok(count(lighter) > 0, `${format}: a light photo under white text keeps a scrim`);
		const darkText = await opf.convert(deck(dataUri(light), "light1"), { format });
		assert.equal(count(darkText), 0, `${format}: a light photo under dark text needs none`);
	}
});

test("asset references and local files are measured too, and a file that cannot be read is left at the worst case", async () => {
	const dir = await mkdtemp(path.join(tmpdir(), "opf-measure-"));
	await mkdir(path.join(dir, "img"));
	await writeFile(path.join(dir, "img", "night.jpg"), dark);
	const local = await opf.convert(deck("./img/night.jpg"), { format: "svg", assetDir: dir });
	assert.equal(scrims(local), 0, "a local file");
	const viaAsset = await opf.convert(deck("asset:night", "dark1", { night: { src: "./img/night.jpg", alt: "Night" } }), { format: "svg", assetDir: dir });
	assert.equal(scrims(viaAsset), 0, "an asset reference to a local file");
	const outside = await opf.convert(deck("./img/missing.jpg"), { format: "svg", assetDir: dir });
	assert.ok(!outside.findings.some((finding) => /picture-not-measured/.test(finding.ruleId)), "a missing file is the draw's finding, not a second one");
	assert.equal(scrims(outside), 0, "no picture, no scrim (the placeholder draws)");
});

test("a picture that cannot be decoded is noted once and keeps the worst-case scrim", async () => {
	const broken = await opf.convert(deck("data:image/jpeg;base64,/9j/AAAA"), { format: "svg" });
	assert.equal(broken.findings.filter((finding) => finding.ruleId === "render/picture-not-measured").length, 1);
	assert.equal(broken.findings.find((finding) => finding.ruleId === "render/picture-not-measured").severity, "info");
});
