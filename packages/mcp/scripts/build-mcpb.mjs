#!/usr/bin/env node
// Build the OPF MCP server as an MCP Bundle for Claude Desktop: artifacts/opf-<version>.mcpb (a zip with mcpb/manifest.json, the
// icon and a node_modules that runs `opf-mcp`). Double-click it, or drag it into Claude Desktop's Settings, Extensions.
//
//   node scripts/build-mcpb.mjs                    every font the renderer draws with, the script faces (CJK, Arabic, ...) included
//   node scripts/build-mcpb.mjs --no-script-fonts  without the script faces: much smaller; a deck in those scripts draws with fallbacks
//   node scripts/build-mcpb.mjs --check            then unpack the bundle and drive its server as Claude Desktop starts it
//
// It needs the packages built (pnpm --filter "@openpresentation/mcp..." run build) and the npm registry: the bundle packs the
// workspace's own @openpresentation/opf, gallery, opf-render and mcp (this checkout, not the registry's), and npm installs their
// third-party dependencies and the renderer's font packages as it would for a user. The font packages ship every weight of their
// family; the bundle keeps only the files the renderer's manifests name (it checks each against its pinned SHA-256 when it loads).
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packages = path.dirname(here);
const args = new Set(process.argv.slice(2));
const scriptFonts = !args.has("--no-script-fonts");
const manifest = JSON.parse(readFileSync(path.join(here, "package.json"), "utf8"));
const version = manifest.version;
const artifacts = path.join(here, "artifacts");
const stage = path.join(artifacts, "mcpb-stage");
const tarballs = path.join(artifacts, "mcpb-tarballs");
const out = path.join(artifacts, `opf-${version}${scriptFonts ? "" : "-lite"}.mcpb`);
const mcpb = path.join(here, "node_modules", ".bin", process.platform === "win32" ? "mcpb.cmd" : "mcpb");

const run = (command, commandArgs, options = {}) => {
	const result = spawnSync(command, commandArgs, { stdio: "inherit", shell: process.platform === "win32", ...options });
	if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(" ")} failed (exit ${result.status}).`);
};
const mib = (bytes) => `${(bytes / 1048576).toFixed(1)} MiB`;

if (!existsSync(path.join(here, "dist", "bin.js"))) throw new Error('Build the server first: pnpm --filter "@openpresentation/mcp..." run build');

// 1. This checkout's packages, packed as npm would publish them (pnpm rewrites workspace: ranges to the shared version).
rmSync(stage, { recursive: true, force: true });
rmSync(tarballs, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
mkdirSync(tarballs, { recursive: true });
const own = { "@openpresentation/opf": "javascript", "@openpresentation/gallery": "gallery", "@openpresentation/opf-render": "render", "@openpresentation/mcp": "mcp" };
const dependencies = {};
for (const [name, directory] of Object.entries(own)) {
	const before = new Set(readdirSync(tarballs));
	// The packages are built already; ignore-scripts skips their prepack, which would build every dependency again.
	run("pnpm", ["pack", "--pack-destination", tarballs, "--config.ignore-scripts=true"], { cwd: path.join(packages, directory), stdio: ["ignore", "ignore", "inherit"] });
	const file = readdirSync(tarballs).find((entry) => !before.has(entry));
	if (!file) throw new Error(`pnpm pack wrote no tarball for ${name}.`);
	dependencies[name] = `file:${path.join(tarballs, file)}`;
}

// 2. The renderer's font packages (its optional peers, at the versions it pins), without its PNG and PDF peers: the server draws no
// raster. Without script fonts, only the packages the Office pack reads.
const render = JSON.parse(readFileSync(path.join(packages, "render", "package.json"), "utf8"));
const renderFonts = await import("@openpresentation/opf-render/fonts-node");
const officePackages = new Set((await renderFonts.loadFonts({ pack: "office" })).fontFiles.map((file) => /@expo-google-fonts[\\/][^\\/]+/.exec(file)?.[0].replace("\\", "/")).filter(Boolean));
for (const [name, range] of Object.entries(render.peerDependencies ?? {})) {
	if (!name.startsWith("@expo-google-fonts/")) continue;
	if (scriptFonts || officePackages.has(name)) dependencies[name] = range;
}
writeFileSync(path.join(stage, "package.json"), `${JSON.stringify({ name: "opf-mcpb", version, private: true, description: "The OPF MCP server, bundled for Claude Desktop.", license: "MIT", type: "module", dependencies }, null, 2)}\n`);
run("npm", ["install", "--omit=dev", "--omit=optional", "--no-audit", "--no-fund", "--no-package-lock", "--loglevel=error"], { cwd: stage });

// 3. Keep only the font files the renderer names, then drop what a running server never reads (source maps, type declarations).
const prune = spawnSync(
	process.execPath,
	[
		"--input-type=module",
		"-e",
		`
		import { createRequire } from "node:module";
		import path from "node:path";
		const require = createRequire(path.join(process.cwd(), "package.json"));
		const fonts = await import(require.resolve("@openpresentation/opf-render/fonts-node"));
		const keep = new Set((await fonts.loadFonts({ pack: "office" })).fontFiles.map((file) => path.resolve(file)));
		const renderRequire = createRequire(require.resolve("@openpresentation/opf-render/package.json"));
		for (const pkg of fonts.scriptFontPackages("all")) {
			let directory;
			try { directory = path.dirname(renderRequire.resolve(pkg.name + "/package.json")); } catch { continue; }
			for (const face of pkg.faces) keep.add(path.resolve(directory, face.file));
		}
		process.stdout.write(JSON.stringify([...keep]));
		`,
	],
	{ cwd: stage, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
if (prune.status !== 0) throw new Error(`Could not list the renderer's font files:\n${prune.stderr}`);
const keep = new Set(JSON.parse(prune.stdout));
let removed = 0;
const walk = (directory, visit) => {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const file = path.join(directory, entry.name);
		if (entry.isDirectory()) walk(file, visit);
		else visit(file);
	}
};
walk(path.join(stage, "node_modules", "@expo-google-fonts"), (file) => {
	// The packages' preview images and the weights the renderer does not name.
	if (/\.png$/i.test(file) || (/\.(ttf|otf)$/i.test(file) && !keep.has(path.resolve(file)))) {
		removed += statSync(file).size;
		unlinkSync(file);
	}
});
walk(path.join(stage, "node_modules"), (file) => {
	if (/\.(map|d\.ts|d\.mts|d\.cts)$/.test(file)) {
		removed += statSync(file).size;
		unlinkSync(file);
	}
});

// 4. The manifest (with this version), the icon and the license, then the bundle.
const bundleManifest = JSON.parse(readFileSync(path.join(here, "mcpb", "manifest.json"), "utf8"));
bundleManifest.version = version;
if (!scriptFonts) bundleManifest.display_name += " (lite)";
writeFileSync(path.join(stage, "manifest.json"), `${JSON.stringify(bundleManifest, null, 2)}\n`);
cpSync(path.join(here, "mcpb", "icon.png"), path.join(stage, "icon.png"));
cpSync(path.join(here, "LICENSE"), path.join(stage, "LICENSE"));
run(mcpb, ["validate", path.join(stage, "manifest.json")]);
rmSync(out, { force: true });
run(mcpb, ["pack", stage, out]);
console.log(`build-mcpb: ${path.relative(process.cwd(), out)} ${mib(statSync(out).size)} (${scriptFonts ? "with" : "without"} script fonts; ${mib(removed)} of unused fonts, maps and declarations left out)`);

// 5. --check: unpack the bundle and drive its server the way Claude Desktop starts it (node, the manifest's entry point).
if (args.has("--check")) {
	const unpacked = path.join(artifacts, "mcpb-check");
	rmSync(unpacked, { recursive: true, force: true });
	run(mcpb, ["unpack", out, unpacked]);
	const entry = JSON.parse(readFileSync(path.join(unpacked, "manifest.json"), "utf8")).server.mcp_config.args[0].replace("${__dirname}", unpacked);
	const check = execFileSync(process.execPath, [path.join(here, "scripts", "check-mcpb.mjs"), entry, path.join(unpacked, "manifest.json"), scriptFonts ? "script-fonts" : "no-script-fonts"], { cwd: here, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
	process.stdout.write(check);
}
