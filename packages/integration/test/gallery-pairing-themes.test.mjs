// Gallery pairing font schemes and the duotone and folio themes: each pairing names a display face and a different text face that
// opf-render bundles and that PowerPoint read back natively (font tracker, nativeVerification), and a deck on each new theme exports
// with the pairing in the PPTX theme's major and minor slots and the scheme's colors in its color scheme.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inflateRawSync } from "node:zlib";
import { gallery } from "@openpresentation/gallery";
import { convert } from "@openpresentation/opf";
import { BUNDLED_FONT_MANIFEST, loadFonts } from "@openpresentation/opf-render/fonts-node";

const PAIRINGS = ["anton-figtree", "archivo-narrow-lora", "bitter-source-sans-3", "playfair-display-lora", "roboto-mono-figtree"];
const THEMES = {};
const tracker = JSON.parse(readFileSync(new URL("../../../docs/programs/font-fidelity-everywhere/font-tracker.json", import.meta.url), "utf8"));
const faces = BUNDLED_FONT_MANIFEST.packages.flatMap((entry) => entry.faces);
const styles = (family) => new Set(faces.filter((face) => face.family === family).map((face) => `${face.weight}${face.italic ? "i" : ""}`));

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

for (const id of PAIRINGS) {
	test(`font scheme ${id} pairs two bundled, natively verified faces`, () => {
		const scheme = gallery.fontSchemes[id];
		assert.ok(scheme, `${id} is in the gallery`);
		assert.notEqual(scheme.major, scheme.minor, `${id}: a display face and a different text face`);
		for (const family of [scheme.major, scheme.minor, scheme.code].filter(Boolean)) {
			assert.ok(styles(family).has("400"), `${id}: ${family} is bundled by opf-render`);
			assert.equal(tracker.records.find((record) => record.family === family)?.nativeVerification?.status, "verified", `${id}: ${family} is native verified`);
		}
		for (const style of ["400", "700", "400i"]) assert.ok(styles(scheme.minor).has(style), `${id}: the text face ${scheme.minor} has ${style}`);
	});
}

for (const [theme, expected] of Object.entries(THEMES)) {
	test(`theme ${theme} exports its pairing and color scheme to the PPTX theme`, async () => {
		const record = gallery.themes[theme];
		assert.equal(record.colorScheme, expected.colorScheme);
		assert.equal(record.fontScheme, expected.fontScheme);
		const colors = gallery.colorSchemes[expected.colorScheme];
		const fontScheme = gallery.fontSchemes[expected.fontScheme];
		const presentation = { design: { theme }, slides: [{ title: "Pilot outcomes", items: ["Close the audit gaps", "Report every week"] }] };
		const fonts = await loadFonts({ pack: "office", substitutionPolicy: "visual", scripts: "auto", presentation });
		const native = await convert(presentation, { format: "pptx", fonts, catalogs: [gallery], date: "2026-11-23" });
		const parts = unzip(native.files[0].bytes);
		const xml = parts.get([...parts.keys()].find((name) => /^ppt\/theme\/theme\d+\.xml$/.test(name))).toString("utf8");
		assert.match(xml, new RegExp(`<a:majorFont><a:latin typeface="${fontScheme.major}"`));
		assert.match(xml, new RegExp(`<a:minorFont><a:latin typeface="${fontScheme.minor}"`));
		for (const slot of ["accent1", "accent2", "dk2", "lt2"]) {
			const key = { dk2: "dark2", lt2: "light2" }[slot] ?? slot;
			assert.match(xml, new RegExp(`<a:${slot}><a:srgbClr val="${colors[key].slice(1).toUpperCase()}"`, "i"), `${theme}: ${slot}`);
		}
	});
}
