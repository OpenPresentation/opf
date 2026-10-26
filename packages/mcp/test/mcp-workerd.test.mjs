import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createOpfServer } from "../dist/index.js";
import { bundleWorker, startWorker, workerd } from "./helpers/workerd.mjs";

// The hostable MCP server (`@openpresentation/mcp`), CE-style: no Node builtin anywhere in its graph (the bundle below fails when
// there is one, with or without the workerd binary), and in the real workerd runtime, where Cloudflare Workers refuse code generation
// from strings, it serves the same tools, resources and prompts through the SDK's web-standard Streamable HTTP transport, with the
// findings the Node server gives. OPF_REQUIRE_WORKERD=1 (set in CI) turns "no workerd binary for this platform" into a failure.
const here = path.dirname(fileURLToPath(import.meta.url));
const examples = path.resolve(here, "../../../examples");
const available = workerd() !== undefined;
if (!available && process.env.OPF_REQUIRE_WORKERD) throw new Error("OPF_REQUIRE_WORKERD is set, but the workerd package has no binary for this platform.");

let bundle;
before(async () => {
	bundle = await bundleWorker();
});

test("bundles for a Worker: esbuild, platform neutral, fails on a Node builtin anywhere in the graph", () => {
	assert.ok(bundle.bytes > 1_000_000, `${bundle.bytes} bytes`);
});

describe("the MCP server in workerd", { skip: !available && "the workerd package has no binary for this platform" }, () => {
	let worker;
	let rpc = 0;
	before(async () => {
		worker = await startWorker(bundle.text);
	});
	after(async () => worker?.stop());

	const call = async (method, params) => {
		const response = await fetch(worker.url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++rpc, method, params }) });
		const body = await response.text();
		assert.equal(response.status, 200, body.slice(0, 1500));
		const message = JSON.parse(body);
		assert.equal(message.error, undefined, JSON.stringify(message.error));
		return message.result;
	};

	// The same server in Node, with Ajv, over a linked in-memory pair: what the Worker must answer.
	let local;
	before(async () => {
		const [a, b] = InMemoryTransport.createLinkedPair();
		await createOpfServer({ version: "0.0.0-test" }).connect(b);
		local = new Client({ name: "local", version: "1" });
		await local.connect(a);
	});
	after(async () => local?.close());
	const wire = (value) => JSON.parse(JSON.stringify(value));

	test("initializes, and lists the tools, resources and prompts", async () => {
		const init = await call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
		assert.equal(init.serverInfo.name, "opf");
		assert.ok(init.capabilities.tools && init.capabilities.resources && init.capabilities.prompts);
		const tools = (await call("tools/list", {})).tools.map((tool) => tool.name).sort();
		assert.deepEqual(tools, ["convert", "get_catalog_record", "get_schema", "list_examples", "search_catalog", "search_docs", "start_here", "validate_deck"]);
		assert.deepEqual(wire(await call("tools/list", {})), wire(await local.listTools()));
		assert.ok((await call("resources/list", {})).resources.length > 100);
		assert.deepEqual((await call("prompts/list", {})).prompts.map((prompt) => prompt.name).sort(), ["author_deck", "choose_layout", "fix_validation_findings", "learn_opf"]);
	});

	test("validates decks with the precompiled validators, with the findings Node gives with Ajv", async () => {
		const files = ["technical/columns", "technical/full-feature-tour", "technical/rows-chart"].map((name) => path.join(examples, `${name}.opf.json`));
		const mutant = JSON.stringify({ name: "x", language: "en-US", slides: [{ title: "A", chart: { type: "column", data: 4 } }, { title: ["not", "text"] }] });
		for (const document of [...files.map((file) => readFileSync(file, "utf8")), mutant, '{ "slides": [ }']) {
			const got = await call("tools/call", { name: "validate_deck", arguments: { document } });
			const want = await local.callTool({ name: "validate_deck", arguments: { document } });
			assert.deepEqual(got.structuredContent, wire(want.structuredContent), document.slice(0, 80));
		}
		const bad = await call("tools/call", { name: "validate_deck", arguments: { document: mutant } });
		assert.equal(bad.structuredContent.ok, false);
		assert.ok(bad.structuredContent.findings.some((finding) => finding.severity === "error"));
	});

	test("converts, searches the catalog and the docs, and reads resources", async () => {
		const deck = readFileSync(path.join(examples, "technical/columns.opf.json"), "utf8");
		for (const to of ["yaml", "markdown"]) assert.deepEqual((await call("tools/call", { name: "convert", arguments: { document: deck, to } })).structuredContent, wire((await local.callTool({ name: "convert", arguments: { document: deck, to } })).structuredContent));
		const layouts = await call("tools/call", { name: "search_catalog", arguments: { kind: "layouts", query: "two columns" } });
		assert.equal(layouts.structuredContent.records[0].id, "two-column");
		const chart = await call("tools/call", { name: "get_schema", arguments: { name: "Chart" } });
		assert.equal(chart.structuredContent.schema.type, "object");
		const found = await call("tools/call", { name: "search_docs", arguments: { query: "chart highlight series", limit: 3 } });
		assert.equal(found.structuredContent.results[0].uri, "opf://docs/chart-options");
		for (const uri of ["opf://docs/format-card", "opf://schema/presentation#Chart", "opf://catalog/layouts/two-column", "opf://examples/columns", "opf://skills/opf-author"]) {
			const got = await call("resources/read", { uri });
			assert.deepEqual(wire(got), wire(await local.readResource({ uri })), uri);
		}
		for (const goal of [undefined, "a board update with a revenue chart"]) {
			const args = goal === undefined ? {} : { goal };
			assert.deepEqual((await call("tools/call", { name: "start_here", arguments: args })).structuredContent, wire((await local.callTool({ name: "start_here", arguments: args })).structuredContent));
		}
		assert.deepEqual(wire(await call("resources/read", { uri: "opf://docs/whats-new" })), wire(await local.readResource({ uri: "opf://docs/whats-new" })));
		const prompt = await call("prompts/get", { name: "choose_layout", arguments: { content: "three metrics" } });
		assert.match(prompt.messages[0].content.text, /three metrics/);
	});
});

describe("the server without the bundled data (@openpresentation/mcp/server)", () => {
	let lean;
	let leanWorker;
	before(async () => {
		lean = await bundleWorker("mcp-worker-lean.mjs");
		if (available) leanWorker = await startWorker(lean.text);
	});
	after(async () => leanWorker?.stop());

	test("leaves out the examples and the documentation, which are most of the bundle", () => {
		assert.ok(lean.bytes < bundle.bytes - 7_000_000, `${lean.bytes} bytes against ${bundle.bytes} with the data`);
		assert.ok(lean.bytes < 7_000_000, `${lean.bytes} bytes`);
	});

	test("serves the sources it is given", { skip: !available && "the workerd package has no binary for this platform" }, async () => {
		const post = async (method, params) => {
			const response = await fetch(leanWorker.url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
			const message = JSON.parse(await response.text());
			assert.equal(message.error, undefined, JSON.stringify(message.error));
			return message.result;
		};
		const docs = (await post("resources/list", {})).resources.filter((resource) => resource.uri.startsWith("opf://docs/"));
		assert.deepEqual(docs.map((resource) => resource.uri).sort(), ["opf://docs/format-card", "opf://docs/index"]);
		const validated = await post("tools/call", { name: "validate_deck", arguments: { document: { name: "x", slides: [{ title: "A" }] } } });
		assert.equal(validated.structuredContent.valid, true);
		const listed = await post("tools/call", { name: "list_examples", arguments: {} });
		assert.equal(listed.structuredContent.total, 0);
	});
});
