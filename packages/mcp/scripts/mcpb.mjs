// The MCP Bundle format, as much of it as the OPF bundle needs, so the build depends on no bundle CLI: a .mcpb is a zip archive
// with manifest.json at its root (https://github.com/modelcontextprotocol/mcpb, manifest_version 0.3). packDirectory zips a
// directory the way `mcpb pack` does (fflate, level 9, Unix permissions, the same files left out); unpackFile undoes it;
// manifestProblems checks the fields Claude Desktop reads, and that the entry point and the icon are in the bundle.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { unzipSync, zipSync } from "fflate";

/** What `mcpb pack` leaves out of a bundle (its EXCLUDE_PATTERNS that can occur here). */
const LEFT_OUT = [/(^|\/)\.DS_Store$/, /(^|\/)Thumbs\.db$/, /(^|\/)\.git(\/|$)/, /(^|\/)\.gitignore$/, /(^|\/)\.mcpbignore$/, /\.log$/, /(^|\/)\.env/, /(^|\/)\.npmrc$/, /^node_modules\/\.bin\//, /^node_modules\/\.cache\//, /\.map$/, /\.d\.ts$/, /\.tsbuildinfo$/, /(^|\/)package-lock\.json$/, /\.mcpb$/];

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The problems Claude Desktop would refuse a manifest for, as sentences; empty when it is fine. `directory`: also check the files. */
export function manifestProblems(manifest, directory) {
	const problems = [];
	const text = (key, value) => (typeof value === "string" && value.trim() ? true : (problems.push(`${key} must be a non-empty string.`), false));
	if (manifest.manifest_version !== "0.3") problems.push('manifest_version must be "0.3".');
	text("name", manifest.name);
	if (text("version", manifest.version) && !SEMVER.test(manifest.version)) problems.push(`version ${manifest.version} is not a semantic version.`);
	text("description", manifest.description);
	text("author.name", manifest.author?.name);
	const server = manifest.server ?? {};
	if (server.type !== "node") problems.push('server.type must be "node".');
	text("server.entry_point", server.entry_point);
	text("server.mcp_config.command", server.mcp_config?.command);
	if (!Array.isArray(server.mcp_config?.args) || !server.mcp_config.args.every((arg) => typeof arg === "string")) problems.push("server.mcp_config.args must be a list of strings.");
	else if (server.entry_point && !server.mcp_config.args.includes(`\${__dirname}/${server.entry_point}`)) problems.push("server.mcp_config.args must start the entry point (${__dirname}/<entry_point>).");
	if (manifest.tools !== undefined && !(Array.isArray(manifest.tools) && manifest.tools.every((tool) => typeof tool?.name === "string" && typeof tool?.description === "string"))) problems.push("tools must be a list of { name, description }.");
	if (manifest.icon !== undefined) text("icon", manifest.icon);
	if (directory) {
		if (server.entry_point && !existsSync(path.join(directory, server.entry_point))) problems.push(`The entry point ${server.entry_point} is not in the bundle.`);
		if (manifest.icon) {
			const icon = path.join(directory, manifest.icon);
			if (!existsSync(icon)) problems.push(`The icon ${manifest.icon} is not in the bundle.`);
			else if (!PNG.every((byte, at) => readFileSync(icon)[at] === byte)) problems.push(`The icon ${manifest.icon} is not a PNG.`);
		}
	}
	return problems;
}

/** Zip `directory` into `out` as `mcpb pack` does; returns the number of files. */
export function packDirectory(directory, out) {
	const files = {};
	const unix = process.platform !== "win32";
	const walk = (folder) => {
		for (const entry of readdirSync(folder, { withFileTypes: true })) {
			const file = path.join(folder, entry.name);
			const name = path.relative(directory, file).split(path.sep).join("/");
			if (LEFT_OUT.some((pattern) => pattern.test(name))) continue;
			if (entry.isDirectory()) walk(file);
			else if (entry.isFile()) {
				const data = readFileSync(file);
				files[name] = unix ? [data, { os: 3, attrs: (statSync(file).mode & 0o777) << 16 }] : data;
			}
		}
	};
	walk(directory);
	if (!files["manifest.json"]) throw new Error(`${directory} has no manifest.json.`);
	writeFileSync(out, zipSync(files, { level: 9, mtime: new Date() }));
	return Object.keys(files).length;
}

/** Unzip a bundle into `directory`, refusing any entry that would land outside it. */
export function unpackFile(file, directory) {
	const root = path.resolve(directory);
	for (const [name, data] of Object.entries(unzipSync(readFileSync(file)))) {
		const target = path.resolve(root, name);
		if (target !== root && !target.startsWith(root + path.sep)) throw new Error(`${name} would unpack outside ${directory}.`);
		if (name.endsWith("/")) continue;
		mkdirSync(path.dirname(target), { recursive: true });
		writeFileSync(target, data);
	}
}
