// `opf mcp`: a convenience for the MCP server of `@openpresentation/mcp`, which holds the server (and the MCP SDK, so the CLI stays
// lean and has no dependency on it). It runs the server when the package is installed, from the CLI's own location first and from the
// working directory second (as the optional peers are found); otherwise it says how to run the server and exits with 2.
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { type CommandSpec, parseArgs, printHelp } from "./args.js";
import { usage } from "./errors.js";
import type { Host } from "./runtime.js";

const PACKAGE = "@openpresentation/mcp";
export const HINT = `opf mcp needs ${PACKAGE}, which is not installed. Run the server directly: npx -y ${PACKAGE}`;

export const spec: CommandSpec = {
	name: "mcp",
	usage: ["opf mcp"],
	summary: `Run the OPF MCP server on stdio (needs ${PACKAGE}; or run npx -y ${PACKAGE}).`,
	positional: [0, 0],
	help: `A local Model Context Protocol server for agents and editors that speak MCP, so they need not shell out and parse text. It
reads the protocol on stdin and writes it on stdout (nothing else is written there), keeps no state and reads no file.

The server is the package ${PACKAGE}, not part of the CLI. opf mcp runs it when it is installed beside the CLI or in the working
directory. Without it, opf mcp prints how to run the server and exits with 2:
  npx -y ${PACKAGE}

Tools: start_here, validate_deck (the findings of opf validate), get_schema (opf schema), search_catalog and get_catalog_record
(opf catalog), convert (JSON, YAML and Markdown), search_docs and list_examples. Resources: opf://docs/<slug>, opf://schema/<name>,
opf://examples/<slug>, opf://catalog/<kind>/<id> and opf://skills/<name>. Prompts: learn_opf, author_deck, fix_validation_findings
and choose_layout. PDF, PPTX and image conversion stay in opf convert.

Setup for an MCP client: command npx, arguments -y ${PACKAGE}. Claude Code:
  claude mcp add opf -- npx -y ${PACKAGE}
See docs/mcp.md.`,
};

interface StdioModule {
	runStdio(host?: { version?: string; opfVersion?: string }): Promise<void>;
}

/** The installed server's stdio module, or undefined: this install's own copy, then the working directory's. */
async function load(): Promise<StdioModule | undefined> {
	const specifier = `${PACKAGE}/stdio`;
	const absent = (error: unknown) => (error as NodeJS.ErrnoException)?.code === "ERR_MODULE_NOT_FOUND" || (error as NodeJS.ErrnoException)?.code === "MODULE_NOT_FOUND";
	try {
		return (await import(specifier)) as StdioModule;
	} catch (error) {
		if (!absent(error)) throw error;
	}
	try {
		const file = createRequire(path.join(process.cwd(), "noop.js")).resolve(specifier);
		return (await import(pathToFileURL(file).href)) as StdioModule;
	} catch (error) {
		if (!absent(error)) throw error;
		return undefined;
	}
}

export async function run(args: string[], host: Host): Promise<void> {
	if (parseArgs(spec, args) === "help") return printHelp(spec);
	const server = await load();
	if (!server) throw usage(HINT, "mcp-not-installed", { package: PACKAGE, run: `npx -y ${PACKAGE}` });
	await server.runStdio({ opfVersion: host.opfVersion });
}
