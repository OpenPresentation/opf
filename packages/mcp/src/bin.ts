#!/usr/bin/env node
// `opf-mcp` (and `npx -y @openpresentation/mcp`): the OPF MCP server on stdio. See docs/mcp.md.
import { runStdio } from "./stdio.js";

declare const MCP_VERSION: string;

const arg = process.argv[2];
if (arg === "--help" || arg === "-h") {
	process.stdout.write(`opf-mcp ${MCP_VERSION}: the OPF MCP server on stdio.

Usage:
  npx -y @openpresentation/mcp       run the server (an MCP client starts it: command npx, args -y @openpresentation/mcp)
  opf-mcp --version

Tools: start_here, validate_deck, get_schema, search_catalog, get_catalog_record, convert, search_docs, list_examples.
Resources: opf://docs/<slug> (opf://docs/index lists them, opf://docs/whats-new), opf://schema/<name>[#<pointer or $defs name>],
opf://examples/<slug>, opf://catalog/<kind>/<id>, opf://skills/<name>. Prompts: learn_opf, author_deck, fix_validation_findings,
choose_layout. It keeps no state and reads no file. Claude Code: claude mcp add opf -- npx -y @openpresentation/mcp
`);
} else if (arg === "--version" || arg === "-v") {
	process.stdout.write(`${MCP_VERSION}\n`);
} else if (arg !== undefined) {
	process.stderr.write(`opf-mcp takes no arguments (got ${arg}). Run opf-mcp --help.\n`);
	process.exitCode = 2;
} else {
	runStdio().catch((error: unknown) => {
		process.stderr.write(`opf-mcp: ${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
