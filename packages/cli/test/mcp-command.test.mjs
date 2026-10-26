import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

// `opf mcp` is a convenience: the MCP server is @openpresentation/mcp (which holds the MCP SDK), and the CLI has no dependency on it.
// Without the package, opf mcp says how to run the server and exits non-zero; with it (tested in packages/mcp) it runs the server.
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");
const CLI = path.join(dist, "index.js");
const empty = mkdtempSync(path.join(tmpdir(), "opf-mcp-absent-"));
after(() => rmSync(empty, { recursive: true, force: true }));
const run = (args, cwd = empty) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", input: "", timeout: 30000 });

describe("opf mcp", () => {
	test("without @openpresentation/mcp it prints how to run the server and exits non-zero", () => {
		const result = run(["mcp"]);
		assert.equal(result.status, 2, result.stdout + result.stderr);
		assert.equal(result.stdout, "", "nothing on stdout, which an MCP client reads");
		const report = JSON.parse(result.stderr);
		assert.equal(report.command, "mcp");
		assert.equal(report.ok, false);
		assert.equal(report.code, "mcp-not-installed");
		assert.equal(report.error, "opf mcp needs @openpresentation/mcp, which is not installed. Run the server directly: npx -y @openpresentation/mcp");
		assert.equal(report.run, "npx -y @openpresentation/mcp");
	});

	test("is listed in opf --help, and its help names the package and the setup", () => {
		assert.match(run(["--help"]).stdout, /\n {2}mcp {7}Run the OPF MCP server on stdio/);
		const help = run(["mcp", "--help"]);
		assert.equal(help.status, 0);
		assert.match(help.stdout, /npx -y @openpresentation\/mcp/);
		assert.match(help.stdout, /claude mcp add opf -- npx -y @openpresentation\/mcp/);
		assert.equal(run(["mcp", "serve"]).status, 2);
	});

	test("the CLI carries no MCP SDK and no dependency on the server package", () => {
		const manifest = JSON.parse(readFileSync(path.resolve(here, "../package.json"), "utf8"));
		for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
			assert.deepEqual(Object.keys(manifest[field] ?? {}).filter((name) => /modelcontextprotocol|^zod$|@openpresentation\/mcp/.test(name)), [], field);
		}
		for (const file of readdirSync(dist).filter((name) => name.endsWith(".js"))) assert.doesNotMatch(readFileSync(path.join(dist, file), "utf8"), /@modelcontextprotocol|from\s*["']zod/, file);
	});
});
