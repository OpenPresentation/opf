// A client for `opf-mcp`: the official MCP SDK client over stdio, as an agent host uses it. Not a test.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = path.dirname(fileURLToPath(import.meta.url));
/** The server binary (opf-mcp) and the `opf` command, which the parity tests compare it with. */
export const BIN = path.resolve(here, "../../dist/bin.js");
export const CLI = path.resolve(here, "../../../cli/dist/index.js");

/** Connect to a new `opf-mcp` process. `client.close()` ends it. */
export async function connect() {
	const transport = new StdioClientTransport({ command: process.execPath, args: [BIN], stderr: "pipe" });
	const client = new Client({ name: "opf-test", version: "1.0.0" });
	await client.connect(transport);
	return client;
}

/** The result of a tool call that failed: the report, parsed from the text (an error carries no structured content). */
export const failure = (result) => JSON.parse(result.content[0].text);
