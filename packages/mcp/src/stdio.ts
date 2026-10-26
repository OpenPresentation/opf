// `opf-mcp`: the OPF MCP server over stdio. A thin wrapper: the server definition is ./server.ts; this adds the transport and, because
// it runs under Node, the measured layout check `opf validate` makes (the fonts of @openpresentation/opf-render when it is installed;
// otherwise core's estimate, and the report's hint says so). Stdout carries the protocol and nothing else; diagnostics go to stderr.
import { createRequire } from "node:module";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ValidateOptions, ValidationReport } from "@openpresentation/opf";
import { Reporter, measuringFonts, readDeckReport } from "@openpresentation/opf/internal/engine";
import { type DeckFormat, createOpfServer } from "./index.js";

declare const MCP_VERSION: string;

/** The versions the server reports: this package's, and the core it runs on. */
export interface StdioHost {
	version?: string;
	opfVersion?: string;
}

/** Deck text checked as `opf validate` checks it: layout measured with the fonts `opf convert` draws with when opf-render is installed. */
export async function checkDeckText(raw: string, format: DeckFormat, options: ValidateOptions): Promise<ValidationReport> {
	const measuring = await measuringFonts(readDeckReport(raw, { format, validate: false }).presentation, { reporter: new Reporter(), flags: true });
	try {
		const { presentation: _deck, format: _format, ...report } = readDeckReport(raw, { format, validate: measuring.fonts ? { ...options, fonts: measuring.fonts } : options });
		if (measuring.estimated && report.checks.layout === "estimated") {
			const named = (measuring.estimated.details as { package?: string } | undefined)?.package ?? "@openpresentation/opf-render";
			return { ...report, hint: `Layout was estimated: ${named} is not installed, so text was measured with core's portable estimate rather than the fonts opf convert draws with. To measure it, install it: npm install ${named}` } as ValidationReport;
		}
		return report;
	} finally {
		measuring.release();
	}
}

/** Serve MCP on stdin and stdout until the client closes stdin. */
export async function runStdio(host: StdioHost = {}): Promise<void> {
	const opfVersion = host.opfVersion ?? (createRequire(import.meta.url)("@openpresentation/opf/package.json") as { version: string }).version;
	const server = createOpfServer({ version: host.version ?? MCP_VERSION, opfVersion, checkText: checkDeckText });
	// The client closing stdin ends the session; with nothing left open the process exits on its own.
	process.stdin.once("close", () => void server.close());
	await server.connect(new StdioServerTransport());
}
