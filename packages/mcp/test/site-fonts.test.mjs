import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, test } from "node:test";
import { siteFontFiles } from "../dist/server.js";

// siteFontFiles: the deck view's fonts from a site that serves the OPF preview fonts (the openpresentation.org layout, contract
// openpresentation-site-fonts/v1). Every face the view may ask for must come back with the bytes the renderer pins.
//   OPF_SITE_FONTS_ORIGIN=https://www.openpresentation.org node --test test/site-fonts.test.mjs   also checks a deployed site
const require = createRequire(import.meta.url);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const viewFonts = JSON.parse(readFileSync(new URL("../app-dist/deck-fonts.json", import.meta.url), "utf8"));
const fontsNode = await import("@openpresentation/opf-render/fonts-node");
const office = await fontsNode.loadFonts({ pack: "office" });
const renderRoot = path.dirname(require.resolve("@openpresentation/opf-render/package.json"));
const renderRequire = createRequire(path.join(renderRoot, "package.json"));
const intos = office.registry.lazyFonts.find((face) => face.family === "Intos");
const japanese = fontsNode.scriptFontPackages("all").find((pkg) => pkg.name.endsWith("/noto-sans-jp"));

/** The site's files, laid out as the site's prepare-opf-fonts.mjs lays them out, from the installed renderer and font packages. */
function fakeSite() {
	const lazy = new Set(office.registry.lazyFonts.map((face) => face.file));
	const files = new Map();
	const base = [];
	for (const pkg of office.manifest.packages) {
		const directory = pkg.vendored ? pkg.vendored.replace(/^fonts\//, "") : pkg.name.split("/").pop();
		const source = pkg.vendored ? path.join(renderRoot, pkg.vendored) : path.dirname(renderRequire.resolve(`${pkg.name}/package.json`));
		const isLazy = pkg.faces.length > 0 && pkg.faces.every((face) => lazy.has(`${pkg.vendored}/${face.file}`));
		const kind = pkg.pack === "scripts" ? "scripts" : isLazy ? "lazy" : "base";
		const target = kind === "lazy" ? `lazy/${pkg.vendored}` : `${kind}/${directory}`;
		for (const face of pkg.faces) {
			files.set(`/opf-fonts/${target}/${face.file}`, path.join(source, face.file));
			if (kind === "base") base.push({ family: face.family, weight: face.weight, italic: Boolean(face.italic), file: `${target}/${face.file}`, sha256: face.sha256 });
		}
	}
	const manifest = JSON.stringify({ contract: "openpresentation-site-fonts/v1", base });
	const fetched = [];
	const fetch = async (sitePath) => {
		fetched.push(sitePath);
		if (sitePath === "/opf-fonts/manifest.json") return new Response(manifest, { headers: { "content-type": "application/json" } });
		const file = files.get(sitePath);
		return file ? new Response(readFileSync(file)) : new Response("Not found", { status: 404 });
	};
	return { fetch, fetched };
}

async function checkSite(read) {
	for (const face of viewFonts.extra) {
		const bytes = await read(face.file);
		assert.ok(bytes, `${face.file} is served`);
		assert.equal(sha256(bytes), face.sha256, face.file);
	}
	assert.equal(sha256(await read(intos.file)), intos.sha256, intos.file);
	const face = japanese.faces[0];
	assert.equal(sha256(await read(`script-fonts/noto-sans-jp/${face.file}`)), face.sha256, face.file);
}

describe("siteFontFiles", () => {
	test("serves every face the view asks for from the site's layout, with the bytes the renderer pins", async () => {
		const site = fakeSite();
		await checkSite(siteFontFiles({ fetch: site.fetch }));
		assert.ok(site.fetched.includes(`/opf-fonts/lazy/${intos.file}`));
		assert.equal(site.fetched.filter((item) => item.endsWith("manifest.json")).length, 1, "the manifest is read once");
	});

	test("reads nothing outside the font folders and nothing the manifest does not name", async () => {
		const site = fakeSite();
		const read = siteFontFiles({ fetch: site.fetch });
		for (const file of ["../package.json", "fonts/../../package.json", "fonts/.hidden.ttf", "fonts/intos/Intos-Regular.txt", "script-fonts/noto-sans-jp/../x.ttf", "script-fonts/x.ttf", "embedded/Comic-Sans-400-normal.ttf", "lazy/fonts/intos/Intos-Regular.ttf", "/etc/passwd"]) {
			assert.equal(await read(file), undefined, file);
		}
		assert.ok(site.fetched.every((item) => item.startsWith("/opf-fonts/") && !item.includes("..")), site.fetched.join(", "));
	});

	test("takes another base, and a failed manifest read is retried", async () => {
		let failures = 1;
		const site = fakeSite();
		const read = siteFontFiles({
			base: "/static/fonts",
			fetch: async (sitePath) => {
				if (sitePath.endsWith("manifest.json") && failures-- > 0) return new Response("unavailable", { status: 503 });
				return site.fetch(sitePath.replace("/static/fonts/", "/opf-fonts/"));
			},
		});
		const [face] = viewFonts.extra;
		await assert.rejects(read(face.file), /manifest\.json: HTTP 503/);
		assert.equal(sha256(await read(face.file)), face.sha256);
	});

	const origin = process.env.OPF_SITE_FONTS_ORIGIN;
	test("serves the view's fonts from a deployed site (OPF_SITE_FONTS_ORIGIN)", { skip: !origin && "set OPF_SITE_FONTS_ORIGIN to check a deployed site" }, async () => {
		await checkSite(siteFontFiles({ fetch: (sitePath) => fetch(new URL(sitePath, origin), { signal: AbortSignal.timeout(60_000) }) }));
	});
});
