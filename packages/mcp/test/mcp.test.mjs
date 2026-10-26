import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { DOC_SLUGS, defaultSources } from "../dist/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { BIN, CLI, connect, failure } from "./helpers/mcp-client.mjs";

// `opf-mcp`: the local MCP server over stdio, driven by the official SDK client. The tools return what the CLI commands return
// (validate, schema, catalog, convert); the resources and prompts teach the format; the process keeps no state and reads no file.
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const examples = path.join(root, "examples");
const cli = (args, input) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", input, timeout: 120000, maxBuffer: 256 * 1024 * 1024 });

const deckFiles = (directory) =>
	readdirSync(directory, { withFileTypes: true })
		.flatMap((entry) => (entry.isDirectory() ? deckFiles(path.join(directory, entry.name)) : /\.opf\.(json|md)$/.test(entry.name) ? [path.join(directory, entry.name)] : []))
		.sort();
const countsOf = (findings) => findings.reduce((counts, finding) => ({ ...counts, [finding.severity]: counts[finding.severity] + 1 }), { error: 0, warning: 0, info: 0 });
// `opf validate` also looks for the local images of a deck beside it; the server reads no file, so it has no cli/asset-* findings.
const withoutAssets = (findings) => findings.filter((finding) => !finding.ruleId.startsWith("cli/asset-"));

describe("opf-mcp", () => {
	let client;
	before(async () => {
		client = await connect();
	});
	after(async () => client?.close());

	test("serves the server, its instructions and its tools with input and output schemas", async () => {
		const info = client.getServerVersion();
		assert.equal(info.name, "opf");
		assert.match(client.getInstructions(), /format-card/);
		const { tools } = await client.listTools();
		assert.deepEqual(tools.map((tool) => tool.name).sort(), ["convert", "get_catalog_record", "get_schema", "list_examples", "search_catalog", "search_docs", "start_here", "validate_deck"]);
		for (const tool of tools) {
			assert.equal(tool.inputSchema.type, "object", tool.name);
			assert.equal(tool.outputSchema?.type, "object", tool.name);
			assert.ok(tool.description.length > 40, tool.name);
			assert.equal(tool.annotations?.readOnlyHint, true, tool.name);
		}
		const validate = tools.find((tool) => tool.name === "validate_deck");
		assert.deepEqual(validate.inputSchema.required, ["document"]);
		assert.deepEqual(validate.inputSchema.properties.format.enum, ["json", "yaml", "markdown"]);
		assert.deepEqual(validate.inputSchema.properties.failOn.enum, ["error", "warning", "info"]);
	});

	describe("validate_deck", () => {
		test("gives the findings of opf validate for every deck in examples/", async () => {
			const files = deckFiles(examples);
			assert.ok(files.length >= 100, `${files.length} example decks`);
			const run = cli(["validate", examples, "--fail-on", "warning"]);
			const reports = JSON.parse(run.stdout).files;
			assert.equal(reports.length, files.length);
			for (const report of reports) {
				const file = report.file;
				const text = readFileSync(file, "utf8");
				const format = file.endsWith(".opf.md") ? "markdown" : "json";
				const result = await client.callTool({ name: "validate_deck", arguments: { document: text, format, failOn: "warning" } });
				assert.ok(!result.isError, `${file}: ${result.content[0].text}`);
				const got = result.structuredContent;
				const findings = withoutAssets(report.findings);
				assert.deepEqual(got.findings, findings, file);
				assert.deepEqual(got.counts, countsOf(findings), file);
				assert.equal(got.valid, report.valid, file);
				assert.equal(got.schemaValid, report.schemaValid, file);
				assert.deepEqual(got.checks, report.checks, file);
				assert.equal(got.format, format);
				assert.equal(got.ok, !findings.some((finding) => finding.severity !== "info"), file);
			}
		});

		test("takes a deck object, and fails on the severity asked for", async () => {
			const deck = { name: "Faint", language: "en-US", design: { background: { type: "solid", color: "#FFFFFF" } }, slides: [{ title: "Hello", text: [{ text: "faint", color: "#CCCCCC" }, " and normal"] }] };
			const lenient = (await client.callTool({ name: "validate_deck", arguments: { document: deck } })).structuredContent;
			assert.equal(lenient.ok, true);
			assert.equal(lenient.valid, true);
			assert.ok(lenient.findings.some((finding) => finding.ruleId === "opf/text-contrast" && finding.severity === "warning"));
			const finding = lenient.findings.find((item) => item.ruleId === "opf/text-contrast");
			for (const key of ["ruleId", "severity", "path", "message", "help"]) assert.ok(key in finding, key);
			const strict = (await client.callTool({ name: "validate_deck", arguments: { document: deck, failOn: "warning" } })).structuredContent;
			assert.equal(strict.ok, false);
			assert.equal(strict.valid, true, "a warning does not make a deck invalid");
		});

		test("reports syntax errors with a location, and invalid decks as not ok", async () => {
			const broken = (await client.callTool({ name: "validate_deck", arguments: { document: '{ "name": "x", "slides": [ }' } })).structuredContent;
			assert.equal(broken.ok, false);
			assert.equal(broken.valid, false);
			assert.equal(broken.schemaValid, null);
			assert.equal(broken.findings[0].ruleId, "opf/json-syntax");
			assert.ok(broken.findings[0].location.line >= 1);
			const wrong = (await client.callTool({ name: "validate_deck", arguments: { document: { name: "x", slides: [{ title: "A", chart: 4 }] } } })).structuredContent;
			assert.equal(wrong.ok, false);
			assert.ok(wrong.findings.some((item) => item.severity === "error"));
			const yaml = (await client.callTool({ name: "validate_deck", arguments: { document: "name: Y\nslides:\n  - title: [\n", format: "yaml" } })).structuredContent;
			assert.equal(yaml.ok, false);
			assert.match(yaml.findings[0].ruleId, /^yaml\//);
		});

		test("asks for the format of text that does not start with { or [", async () => {
			const result = await client.callTool({ name: "validate_deck", arguments: { document: "name: Y\nslides: []\n" } });
			assert.equal(result.isError, true);
			assert.equal(result.structuredContent, undefined, "an error carries no structured content, which a client would check against the output schema");
			assert.equal(failure(result).code, "unknown-input-format");
			const object = await client.callTool({ name: "validate_deck", arguments: { document: { name: "x", slides: [] }, format: "yaml" } });
			assert.equal(failure(object).code, "invalid-input");
		});
	});

	describe("get_schema", () => {
		test("returns a $defs name, as opf schema does with a pointer", async () => {
			const got = (await client.callTool({ name: "get_schema", arguments: { name: "Chart" } })).structuredContent;
			const expected = JSON.parse(cli(["schema", "presentation", "/$defs/Chart"]).stdout);
			assert.equal(got.name, "presentation");
			assert.equal(got.pointer, "/$defs/Chart");
			assert.deepEqual(got.schema, expected);
			assert.equal(got.schema.type, "object");
		});

		test("returns a schema by name and a part by pointer or $defs name", async () => {
			const whole = (await client.callTool({ name: "get_schema", arguments: {} })).structuredContent;
			assert.deepEqual(whole.schema, JSON.parse(cli(["schema"]).stdout));
			const slides = (await client.callTool({ name: "get_schema", arguments: { name: "presentation", pointer: "/properties/slides" } })).structuredContent;
			assert.deepEqual(slides.schema, JSON.parse(cli(["schema", "presentation", "/properties/slides"]).stdout));
			const byDef = (await client.callTool({ name: "get_schema", arguments: { name: "presentation", pointer: "Chart" } })).structuredContent;
			assert.equal(byDef.pointer, "/$defs/Chart");
			const layout = (await client.callTool({ name: "get_schema", arguments: { name: "layout" } })).structuredContent;
			assert.deepEqual(layout.schema, JSON.parse(cli(["schema", "layout"]).stdout));
		});

		test("says what it could not find and what is there", async () => {
			const unknown = failure(await client.callTool({ name: "get_schema", arguments: { name: "Charrt" } }));
			assert.equal(unknown.code, "unknown-schema");
			assert.match(unknown.error, /Did you mean Chart\?/);
			assert.ok(unknown.schemas.includes("presentation"));
			const pointer = failure(await client.callTool({ name: "get_schema", arguments: { pointer: "/properties/nope" } }));
			assert.equal(pointer.code, "unknown-schema-pointer");
		});
	});

	describe("catalog", () => {
		test("search_catalog finds layouts by words, like the records of opf catalog layouts", async () => {
			const all = JSON.parse(cli(["catalog", "layouts"]).stdout);
			const listed = (await client.callTool({ name: "search_catalog", arguments: { kind: "layouts", limit: 200 } })).structuredContent;
			assert.equal(listed.total, all.length);
			assert.deepEqual(listed.records.map((record) => record.id).sort(), all.map((record) => record.id).sort());
			const found = (await client.callTool({ name: "search_catalog", arguments: { kind: "layouts", query: "two columns" } })).structuredContent;
			assert.equal(found.records[0].id, "two-column");
			assert.ok(found.records[0].summary);
			assert.ok(found.records.every((record) => /two/i.test(JSON.stringify(record))));
			const limited = (await client.callTool({ name: "search_catalog", arguments: { kind: "layouts", limit: 3 } })).structuredContent;
			assert.equal(limited.returned, 3);
			assert.equal(limited.total, all.length);
			const hyphen = (await client.callTool({ name: "search_catalog", arguments: { kind: "color-schemes" } })).structuredContent;
			assert.equal(hyphen.kind, "color-schemes");
			assert.equal(hyphen.total, JSON.parse(cli(["catalog", "color-schemes"]).stdout).length);
		});

		test("get_catalog_record returns the record opf catalog prints", async () => {
			const got = (await client.callTool({ name: "get_catalog_record", arguments: { kind: "layouts", id: "two-column" } })).structuredContent;
			assert.deepEqual(got.record, JSON.parse(cli(["catalog", "layouts", "two-column"]).stdout));
			assert.equal(got.uri, "opf://catalog/layouts/two-column");
			const example = (await client.callTool({ name: "get_catalog_record", arguments: { kind: "examples", id: "full-feature-tour" } })).structuredContent;
			assert.deepEqual(example.record, JSON.parse(cli(["catalog", "examples", "full-feature-tour"]).stdout));
		});

		test("names a kind or id that does not exist, with a suggestion", async () => {
			const kind = failure(await client.callTool({ name: "search_catalog", arguments: { kind: "layout" } }));
			assert.equal(kind.code, "unknown-catalog");
			assert.match(kind.error, /Did you mean layouts\?/);
			const id = failure(await client.callTool({ name: "get_catalog_record", arguments: { kind: "layouts", id: "two-colum" } }));
			assert.equal(id.code, "unknown-id");
			assert.match(id.error, /Did you mean two-column\?/);
		});
	});

	describe("convert", () => {
		const sample = ["technical/columns", "markdown/quarterly-review", "technical/full-feature-tour"].map((name) => path.join(examples, `${name}.opf.${name.startsWith("markdown") ? "md" : "json"}`));
		const deckOf = (text, format) => JSON.parse(cli(["convert", "-", "-", "--from", format, "--to", "json"], text).stdout);

		test("converts between json, yaml and markdown as opf convert does, and every form reads back to the same deck", async () => {
			for (const file of sample) {
				const text = readFileSync(file, "utf8");
				const from = file.endsWith(".md") ? "markdown" : "json";
				const original = deckOf(text, from);
				for (const to of ["json", "yaml", "markdown"]) {
					const result = await client.callTool({ name: "convert", arguments: { document: text, from, to } });
					assert.ok(!result.isError, `${file} to ${to}: ${result.content[0].text}`);
					const got = result.structuredContent;
					assert.equal(got.ok, true);
					assert.equal(got.from, from);
					assert.equal(got.to, to);
					const cliText = cli(["convert", "-", "-", "--from", from, "--to", to], text);
					assert.equal(got.text, cliText.stdout, `${file} to ${to} is what opf convert writes`);
					// JSON and YAML read back to the same deck. Markdown reads back to what opf convert reads back (it normalizes a few defaults,
					// such as a list level of 0), which is what the tool must also give.
					const readBack = deckOf(got.text, to);
					if (to !== "markdown") assert.deepEqual(readBack, original, `${file} through ${to}`);
					else if (!file.endsWith("full-feature-tour.opf.json")) assert.deepEqual(readBack, original, `${file} through ${to}`);
					const back = (await client.callTool({ name: "convert", arguments: { document: got.text, from: to, to: "json" } })).structuredContent;
					assert.deepEqual(JSON.parse(back.text), readBack, `${file} through ${to} and back, through the tool`);
				}
			}
		});

		test("takes a deck object and reports what Markdown could not carry", async () => {
			const deck = JSON.parse(readFileSync(sample[2], "utf8"));
			const got = (await client.callTool({ name: "convert", arguments: { document: deck, to: "markdown" } })).structuredContent;
			assert.equal(got.from, "json");
			assert.equal(typeof got.markdown.lossless, "boolean");
			if (!got.markdown.native) assert.ok(got.findings.some((finding) => finding.ruleId === "markdown/embedded"));
		});

		test("refuses a deck that is not valid, with its findings, and text that does not parse", async () => {
			const invalid = failure(await client.callTool({ name: "convert", arguments: { document: { name: "x", slides: [{ chart: 4 }] }, to: "yaml" } }));
			assert.equal(invalid.code, "invalid-document");
			assert.ok(invalid.findings.some((finding) => finding.severity === "error"));
			assert.ok(invalid.counts.error > 0);
			const broken = failure(await client.callTool({ name: "convert", arguments: { document: '{ "slides": [', to: "yaml" } }));
			assert.equal(broken.code, "invalid-json");
			const yaml = failure(await client.callTool({ name: "convert", arguments: { document: "slides: [", from: "yaml", to: "json" } }));
			assert.equal(yaml.code, "invalid-yaml");
		});
	});

	describe("search_docs and list_examples", () => {
		test("search_docs ranks pages, with a snippet and a resource URI that reads", async () => {
			const found = (await client.callTool({ name: "search_docs", arguments: { query: "chart highlight series", limit: 5 } })).structuredContent;
			assert.ok(found.results.length === 5 && found.total >= 5);
			assert.equal(found.results[0].uri, "opf://docs/chart-options");
			for (const hit of found.results) {
				assert.ok(hit.snippet.length > 20 && hit.score > 0);
				const read = await client.readResource({ uri: hit.uri });
				assert.ok(read.contents[0].text.length > 100, hit.uri);
			}
			assert.deepEqual(found.results.map((hit) => hit.score), found.results.map((hit) => hit.score).sort((a, b) => b - a));
			const rules = (await client.callTool({ name: "search_docs", arguments: { query: "opf/text-contrast" } })).structuredContent;
			assert.equal(rules.results[0].uri, "opf://docs/validate");
			const none = (await client.callTool({ name: "search_docs", arguments: { query: "zzzxqj" } })).structuredContent;
			assert.deepEqual(none, { query: "zzzxqj", total: 0, results: [] });
			const skill = (await client.callTool({ name: "search_docs", arguments: { query: "json patch undo editor" } })).structuredContent;
			assert.ok(skill.results.some((hit) => hit.kind === "skill"));
		});

		test("list_examples lists the bundled decks and filters them", async () => {
			const all = (await client.callTool({ name: "list_examples", arguments: {} })).structuredContent;
			assert.equal(all.total, JSON.parse(cli(["catalog", "examples"]).stdout).length);
			assert.ok(all.categories.includes("technical"));
			for (const example of all.examples.slice(0, 5)) assert.equal(example.uri, `opf://examples/${example.slug}`);
			const technical = (await client.callTool({ name: "list_examples", arguments: { category: "technical", query: "chart" } })).structuredContent;
			assert.ok(technical.total > 0 && technical.examples.every((example) => example.category === "technical"));
			const bad = failure(await client.callTool({ name: "list_examples", arguments: { category: "technicl" } }));
			assert.equal(bad.code, "unknown-category");
		});
	});

	describe("resources", () => {
		test("lists docs, schemas, examples, catalog records and skills, and reads every one", async () => {
			const { resources } = await client.listResources();
			const uris = resources.map((resource) => resource.uri);
			assert.equal(new Set(uris).size, uris.length, "no duplicate URIs");
			for (const prefix of ["opf://docs/", "opf://schema/", "opf://examples/", "opf://catalog/", "opf://skills/"]) assert.ok(uris.some((uri) => uri.startsWith(prefix)), prefix);
			for (const uri of ["opf://docs/index", "opf://docs/format-card", "opf://schema/presentation", "opf://catalog/layouts/two-column", "opf://skills/opf-author", "opf://skills/opf-inspect"]) assert.ok(uris.includes(uri), uri);
			assert.equal(uris.filter((uri) => /^opf:\/\/skills\/opf-[a-z]+$/.test(uri)).length, 6);
			assert.equal(uris.filter((uri) => uri.startsWith("opf://examples/")).length, JSON.parse(cli(["catalog", "examples"]).stdout).length);
			for (const resource of resources) {
				const read = await client.readResource({ uri: resource.uri });
				const [content] = read.contents;
				assert.equal(content.uri, resource.uri);
				assert.equal(content.mimeType, resource.mimeType, resource.uri);
				assert.ok(content.text.length > 0, resource.uri);
				if (content.mimeType.includes("json")) JSON.parse(content.text);
			}
		});

		test("serves only the documentation meant for users", async () => {
			const { resources } = await client.listResources();
			const docs = resources.filter((resource) => resource.uri.startsWith("opf://docs/")).map((resource) => resource.uri.slice("opf://docs/".length));
			assert.ok(docs.length >= 30);
			for (const slug of ["format-card", "how-opf-works", "validate", "schema-reference", "cli", "mcp"]) assert.ok(docs.includes(slug), slug);
			assert.deepEqual(docs.filter((slug) => /handoff|evidence|status|backlog|security|pr-backlog|next-agent|\d{4}-\d{2}-\d{2}/i.test(slug)), []);
			assert.ok(!docs.includes("release-process") && !docs.includes("ecosystem-development"));
		});

		test("has resource templates for every kind, and reads a URI that no list names", async () => {
			const { resourceTemplates } = await client.listResourceTemplates();
			assert.deepEqual(resourceTemplates.map((template) => template.uriTemplate).sort(), ["opf://catalog/{kind}/{id}", "opf://docs/{slug}", "opf://examples/{slug}", "opf://schema/{+name}", "opf://skills/{+path}"]);
			const slides = await client.readResource({ uri: "opf://schema/presentation#/properties/slides" });
			assert.deepEqual(JSON.parse(slides.contents[0].text), JSON.parse(cli(["schema", "presentation", "/properties/slides"]).stdout));
			const chart = await client.readResource({ uri: "opf://schema/presentation#Chart" });
			assert.deepEqual(JSON.parse(chart.contents[0].text), JSON.parse(cli(["schema", "presentation", "/$defs/Chart"]).stdout));
			assert.deepEqual(JSON.parse((await client.readResource({ uri: "opf://schema/Chart" })).contents[0].text), JSON.parse(chart.contents[0].text));
			const whole = await client.readResource({ uri: "opf://schema/layout" });
			assert.deepEqual(JSON.parse(whole.contents[0].text), JSON.parse(cli(["schema", "layout"]).stdout), "a whole schema carries the release it came from in its $comment, as opf schema prints it");
			assert.match(JSON.parse(whole.contents[0].text).$comment, /This copy is from @openpresentation\/opf \d+\.\d+\.\d+\.$/);
			const record = await client.readResource({ uri: "opf://catalog/color-schemes/burnt-orange" });
			assert.equal(JSON.parse(record.contents[0].text).id, "burnt-orange");
			const camel = await client.readResource({ uri: "opf://catalog/colorSchemes/burnt-orange" });
			assert.equal(camel.contents[0].text, record.contents[0].text);
			const reference = await client.readResource({ uri: "opf://skills/opf-author/references/content.md" });
			assert.match(reference.contents[0].text, /\S/);
		});

		test("names what it could not find", async () => {
			for (const uri of ["opf://docs/nope", "opf://schema/Nope", "opf://examples/nope", "opf://catalog/layouts/nope", "opf://catalog/nope/x", "opf://skills/nope", "opf://skills/opf-author/nope.md", "opf://elsewhere/x"]) {
				await assert.rejects(client.readResource({ uri }), /./, uri);
			}
			await assert.rejects(client.readResource({ uri: "opf://docs/handoff" }), /Unknown documentation page handoff/);
		});

		test("serves the bundled skills as the six entrypoints, without their scripts", async () => {
			const { resources } = await client.listResources();
			const skills = resources.filter((resource) => resource.uri.startsWith("opf://skills/"));
			assert.ok(skills.some((resource) => resource.uri === "opf://skills/opf-author/references/content.md"));
			assert.ok(!skills.some((resource) => /scripts|agents/.test(resource.uri)));
			const author = (await client.readResource({ uri: "opf://skills/opf-author" })).contents[0].text;
			assert.equal(author, readFileSync(path.join(root, "skills/opf-author/SKILL.md"), "utf8").replaceAll("\r\n", "\n"));
		});
	});

	describe("start_here", () => {
		const start = async (goal) => (await client.callTool({ name: "start_here", arguments: goal === undefined ? {} : { goal } })).structuredContent;

		test("with no goal, gives the general learning path", async () => {
			const path = await start();
			assert.equal(path.goal, null);
			assert.deepEqual(path.docs.map((doc) => doc.uri), ["opf://docs/format-card", "opf://docs/how-opf-works"]);
			assert.deepEqual(path.skills.map((skill) => skill.name), ["opf-author"]);
			assert.ok(path.examples.length >= 2 && path.examples.every((example) => example.uri.startsWith("opf://examples/")));
			assert.ok(path.layouts.length >= 2 && path.themes.length >= 1);
			assert.deepEqual(path.validate.arguments.failOn, "warning");
			assert.equal(path.validate.tool, "validate_deck");
			assert.deepEqual(path.steps.map((step) => step.step), path.steps.map((_, at) => at + 1));
			assert.equal(path.steps[0].uri, "opf://docs/format-card");
			assert.ok(path.steps.some((step) => step.tool === "validate_deck" && step.arguments.failOn === "warning"));
		});

		test("for a goal, names the skill, the pages, examples, layouts and themes that fit it", async () => {
			const chart = await start("a quarterly board update with a revenue chart and a timeline");
			assert.equal(chart.goal, "a quarterly board update with a revenue chart and a timeline");
			assert.deepEqual(chart.skills.map((skill) => skill.name), ["opf-author"]);
			assert.equal(chart.docs[0].uri, "opf://docs/format-card");
			assert.ok(chart.docs.some((doc) => /chart/.test(doc.uri)), JSON.stringify(chart.docs));
			assert.ok(chart.examples.some((example) => /chart|timeline|quarter|board/.test(`${example.slug} ${example.name}`)), JSON.stringify(chart.examples));
			assert.ok(chart.layouts.some((layout) => /chart|timeline/.test(JSON.stringify(layout))), JSON.stringify(chart.layouts));
			for (const layout of chart.layouts) assert.match(layout.uri, /^opf:\/\/catalog\/layouts\//);
			for (const theme of chart.themes) assert.match(theme.uri, /^opf:\/\/catalog\/themes\//);
			assert.deepEqual(chart.validate.arguments.failOn, "warning");
			for (const uri of [...chart.docs, ...chart.skills, ...chart.examples, ...chart.layouts, ...chart.themes].map((item) => item.uri)) assert.ok((await client.readResource({ uri })).contents[0].text.length > 0, uri);

			const fix = await start("fix the validation errors in my deck");
			assert.equal(fix.skills[0].name, "opf-inspect");
			const theme = await start("change the theme and fonts to match our brand");
			assert.equal(theme.skills[0].name, "opf-presets");
			const patch = await start("undo a change and patch an existing deck");
			assert.equal(patch.skills[0].name, "opf-edit");
			const exportPath = await start("export to PowerPoint and PDF");
			assert.equal(exportPath.skills[0].name, "opf-export");
			const overflow = await start("text overflows, paginate it");
			assert.equal(overflow.skills[0].name, "opf-layout");
		});

		test("still returns a path for a goal that matches nothing", async () => {
			const odd = await start("zzzxqj");
			assert.deepEqual(odd.skills.map((skill) => skill.name), ["opf-author"]);
			assert.ok(odd.examples.length >= 2 && odd.layouts.length >= 2);
			assert.ok(odd.steps.length >= 6);
		});
	});

	describe("whats-new and the docs index", () => {
		test("opf://docs/whats-new carries the last releases of the changelog, newest first", async () => {
			const { resources } = await client.listResources();
			assert.ok(resources.some((resource) => resource.uri === "opf://docs/whats-new"));
			const text = (await client.readResource({ uri: "opf://docs/whats-new" })).contents[0].text;
			const changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
			const versions = [...changelog.matchAll(/^## (\d+\.\d+\.\d+)/gm)].map((match) => match[1]);
			const shown = [...text.matchAll(/^## (\d+\.\d+\.\d+)/gm)].map((match) => match[1]);
			assert.deepEqual(shown, versions.slice(0, 5));
			assert.match(text, /^# What's new in OPF/);
			assert.ok(text.includes(changelog.split(/^## /m).find((section) => section.startsWith(versions[0])).split("\n")[2].slice(0, 60)), "the newest section's first entry");
			assert.ok(text.length > 2000 && text.length < 200_000, `${text.length} characters`);
		});

		test("opf://docs/index lists it, and carries the one neutral pointer to pptx.dev", async () => {
			const index = (await client.readResource({ uri: "opf://docs/index" })).contents[0].text;
			assert.match(index, /opf:\/\/docs\/whats-new/);
			assert.match(index, /Rendering, PPTX export, AI generation and hosting are available from services such as pptx\.dev\./);
			assert.equal(index.split("pptx.dev").length - 1, 1);
			// Nowhere else: not in the tool descriptions, the instructions, the prompts or the other resources the server writes itself.
			const { tools } = await client.listTools();
			assert.ok(!client.getInstructions().includes("pptx.dev"));
			assert.ok(!tools.some((tool) => JSON.stringify(tool).includes("pptx.dev")));
			const { prompts } = await client.listPrompts();
			for (const prompt of prompts) {
				const got = await client.getPrompt({ name: prompt.name, arguments: { brief: "x", document: "{}", content: "x" } });
				assert.ok(!JSON.stringify(got.messages.filter((message) => message.content.type === "text")).includes("pptx.dev"), prompt.name);
			}
		});
	});

	describe("prompts", () => {
		test("lists learn_opf, author_deck, fix_validation_findings and choose_layout, and fills them in", async () => {
			const { prompts } = await client.listPrompts();
			assert.deepEqual(prompts.map((prompt) => prompt.name).sort(), ["author_deck", "choose_layout", "fix_validation_findings", "learn_opf"]);
			const author = await client.getPrompt({ name: "author_deck", arguments: { brief: "Q3 results for the board", audience: "board", slides: "6" } });
			const text = author.messages.map((message) => (message.content.type === "text" ? message.content.text : message.content.resource.uri)).join("\n");
			assert.match(text, /Q3 results for the board/);
			assert.match(text, /validate_deck/);
			assert.ok(author.messages.some((message) => message.content.type === "resource" && message.content.resource.uri === "opf://docs/format-card"));
			assert.ok(author.messages.some((message) => message.content.type === "resource" && message.content.resource.uri === "opf://skills/opf-author"));
			const fix = await client.getPrompt({ name: "fix_validation_findings", arguments: { document: '{"slides":[]}' } });
			assert.match(fix.messages[0].content.text, /\{"slides":\[\]\}/);
			const layout = await client.getPrompt({ name: "choose_layout", arguments: { content: "three metrics and a chart" } });
			assert.match(layout.messages[0].content.text, /three metrics and a chart/);
			assert.ok((await client.getPrompt({ name: "learn_opf" })).messages.length >= 2);
			await assert.rejects(client.getPrompt({ name: "author_deck", arguments: {} }), /./, "the brief is required");
		});
	});
});

describe("the bundled sources", () => {
	test("every listed doc page exists, none is a maintainer note, and the skills carry no scripts", () => {
		const sources = defaultSources();
		assert.deepEqual(sources.docs.map((doc) => doc.slug), DOC_SLUGS, "every slug in DOC_SLUGS is a page of docs/ (docs/mcp.md and docs/format-card.md included)");
		assert.equal(new Set(DOC_SLUGS).size, DOC_SLUGS.length);
		assert.deepEqual(DOC_SLUGS.filter((slug) => /handoff|evidence|status|backlog|security|next-agent|native-|\d{4}-\d{2}-\d{2}/i.test(slug)), []);
		assert.deepEqual(Object.keys(sources.skills).sort(), ["opf-author", "opf-edit", "opf-export", "opf-inspect", "opf-layout", "opf-presets"]);
		for (const [name, files] of Object.entries(sources.skills)) {
			assert.ok(files["SKILL.md"], name);
			assert.deepEqual(Object.keys(files).filter((file) => /^(scripts|agents)\//.test(file)), [], name);
		}
		assert.ok(sources.examples.length >= 100);
		const bytes = sources.docs.reduce((total, doc) => total + Buffer.byteLength(doc.markdown), 0);
		assert.ok(bytes < 1_000_000, `${bytes} bytes of documentation`);
	});
});

describe("opf-mcp as a process", () => {
	test("has a help that names the setup and a version, and refuses arguments", () => {
		const run = (args) => spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", timeout: 30000 });
		const help = run(["--help"]);
		assert.equal(help.status, 0);
		assert.match(help.stdout, /npx -y @openpresentation\/mcp/);
		assert.match(help.stdout, /opf:\/\/docs\//);
		assert.equal(run(["--version"]).stdout.trim(), JSON.parse(readFileSync(path.join(here, "../package.json"), "utf8")).version);
		assert.equal(run(["serve"]).status, 2);
	});

	test("exits when the client closes stdin, and writes only protocol on stdout", async () => {
		const child = spawn(process.execPath, [BIN], { stdio: ["pipe", "pipe", "pipe"] });
		let out = "";
		child.stdout.on("data", (chunk) => (out += chunk));
		const exited = new Promise((resolve) => child.once("exit", (code) => resolve(code)));
		child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "raw", version: "1" } } })}\n`);
		await new Promise((resolve) => setTimeout(resolve, 1500));
		child.stdin.end();
		assert.equal(await exited, 0);
		const lines = out.split("\n").filter(Boolean);
		assert.equal(lines.length, 1);
		assert.equal(JSON.parse(lines[0]).result.serverInfo.name, "opf");
	});

	test("opf mcp of the CLI runs it when the package is installed (here: the working directory is this package)", async () => {
		const transport = new StdioClientTransport({ command: process.execPath, args: [CLI, "mcp"], cwd: path.resolve(here, ".."), stderr: "pipe" });
		const client = new Client({ name: "via-cli", version: "1.0.0" });
		await client.connect(transport);
		try {
			assert.equal(client.getServerVersion().name, "opf");
			const found = await client.callTool({ name: "get_schema", arguments: { name: "Chart" } });
			assert.equal(found.structuredContent.pointer, "/$defs/Chart");
		} finally {
			await client.close();
		}
	});

	test("the entries that run on an edge import no Node builtin and no file API at their top level", () => {
		const dist = path.resolve(here, "../dist");
		for (const entry of ["index.js", "server.js"]) {
			const seen = new Set();
			const walk = (file) => {
				if (seen.has(file)) return;
				seen.add(file);
				for (const match of readFileSync(path.join(dist, file), "utf8").matchAll(/^(?:import|export)\b[^;]*?from\s*["']\.\/([^"']+)["']/gm)) walk(match[1]);
			};
			walk(entry);
			for (const file of seen) assert.doesNotMatch(readFileSync(path.join(dist, file), "utf8").split("\n").filter((line) => /^(?:import|export)\b/.test(line)).join("\n"), /["'](?:node:|\.\/stdio)/, `${entry} reaches ${file}, which imports a Node builtin or the stdio wrapper`);
		}
	});
});
