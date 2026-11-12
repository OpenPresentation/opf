// The deck view's MCP Apps features in Chromium, behind a stand-in host that behaves as Claude's MCP Apps documentation says the
// host does: it reads the view's `tools` capability from ui/initialize and asks the view for `tools/list`, calls the view's tools
// with `tools/call` (in one group only after the user's next message, as Claude does for a view that just opened), can frame
// several views at once (each tool call mounts its own), honors `ui/request-display-mode` only right after a press in the view (user
// activation), answers `ui/download-file` and `ui/message` with each outcome the docs name, and can cancel a tool or tear a view
// down. The view is framed cross-origin under the restrictive default CSP, as in deck-app-browser.mjs; its server is the real one
// (createOpfServer) over an in-memory MCP client. Run it after `pnpm run build`:
//   node test/deck-app-tools-browser.mjs
// OPF_DECK_APP_SCREENSHOTS=<directory> saves screenshots of the editor's start state, the layouts, a superseded view and the status
// lines.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { chromium } from "playwright";
import { createOpfServer } from "../dist/index.js";
import { installedFontFiles } from "../dist/stdio.js";

const VIEW_CSP = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'self'";

const client = new Client({ name: "deck-app-tools-browser", version: "1.0.0" });
{
	const server = createOpfServer({ version: "0.0.0-test", deckApp: { readFontFile: installedFontFiles() } });
	const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
	await server.connect(serverSide);
	await client.connect(clientSide);
}
const resource = (await client.readResource({ uri: "ui://opf/deck" })).contents[0];
assert.deepEqual(resource._meta, { ui: { prefersBorder: false, preferredDisplayMode: "fullscreen" } }, "the content item asks for the side panel");

// The host page: frames views by name and answers each. window.hosts[name] records what that view asked for.
const HOST_PAGE = `<!doctype html><meta charset="utf-8"><title>host</title><style>body{margin:0}iframe{border:0;width:960px;height:640px;display:block;position:absolute;top:0;left:0;background:#fff}</style>
<script>
window.hosts = {};
const frames = {};
let nextId = 1;
const send = (name, message) => frames[name].contentWindow.postMessage({ jsonrpc: "2.0", ...message }, "*");
window.startView = (name, setup) => {
  const frame = frames[name] ?? document.body.appendChild(Object.assign(document.createElement("iframe"), { name }));
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
  frames[name] = frame;
  // Every view on screen (a host keeps them in the page; an off-screen frame would not lay out), the newest on top.
  front(name);
  hosts[name] = { setup, requests: [], context: [], messages: [], downloads: [], displayModes: [], toolCalls: [], tools: undefined, pending: {}, held: [], mode: "inline", nextMessage: !setup.gated };
  frame.style.width = (setup.width ?? 960) + "px";
  frame.style.height = (setup.height ?? 640) + "px";
  frame.src = setup.viewUrl + "?" + name;
};
// A request from the host to the view (tools/list, tools/call, ui/resource-teardown); resolves with the view's response.
window.callView = (name, method, params) => new Promise((resolve) => { const id = "host-" + nextId++; hosts[name].pending[id] = resolve; send(name, { id, method, params }); });
// Claude calling one of the view's tools: a view that just opened has its tools only from the user's next message on.
window.callTool = (name, params) => hosts[name].nextMessage ? callView(name, "tools/call", params) : Promise.resolve({ error: { code: -32000, message: "not-yet: the view's tools reach Claude with the user's next message" } });
window.userMessage = async (name) => { hosts[name].nextMessage = true; hosts[name].tools = await callView(name, "tools/list", {}); };
window.notifyView = (name, method, params) => send(name, { method, params });
window.front = (name) => { frames[name].style.zIndex = String(++nextId); };
window.release = (name, result) => { for (const reply of hosts[name].held.splice(0)) reply(result); };
window.addEventListener("message", async (event) => {
  const name = Object.keys(frames).find((key) => frames[key].contentWindow === event.source);
  if (!name) return;
  const host = hosts[name];
  const setup = host.setup;
  const message = event.data;
  if (!message || message.jsonrpc !== "2.0") return;
  if (message.method === undefined && host.pending[message.id]) { const resolve = host.pending[message.id]; delete host.pending[message.id]; return resolve(message); }
  host.requests.push(message.method);
  const reply = (result) => send(name, { id: message.id, result });
  const error = (text, code = -32000) => send(name, { id: message.id, error: { code, message: text } });
  switch (message.method) {
    case "ui/initialize":
      host.appCapabilities = message.params.appCapabilities;
      return reply({
        protocolVersion: "2026-01-26",
        hostInfo: { name: setup.hostName ?? "test-host", version: "1.0.0" },
        hostCapabilities: { ...(setup.noServerTools ? {} : { serverTools: {} }), serverResources: {}, updateModelContext: { text: {}, structuredContent: {} }, message: { text: {} }, ...(setup.download ? { downloadFile: {} } : {}) },
        hostContext: { theme: "light", displayMode: "inline", availableDisplayModes: ["inline", "fullscreen"], containerDimensions: { width: setup.width ?? 960, maxHeight: setup.height ?? 640 }, platform: "web", toolInfo: { id: setup.toolId, tool: { name: setup.tool, inputSchema: { type: "object" } } }, ...(setup.insets ? { safeAreaInsets: setup.insets } : {}) },
      });
    case "ui/notifications/initialized":
      // The host lists the view's tools once it has started, before Claude can call one.
      if (host.appCapabilities?.tools) host.tools = await callView(name, "tools/list", {});
      if (!setup.holdInput) {
        send(name, { method: "ui/notifications/tool-input", params: { arguments: setup.arguments } });
        send(name, { method: "ui/notifications/tool-result", params: setup.result });
      }
      return;
    case "ui/notifications/size-changed":
      return;
    case "tools/call":
      host.toolCalls.push(message.params.name);
      if (setup.noServerTools) return error("Method not found: tools/call", -32601);
      try { return reply(await window.callServer(message.params)); } catch (failure) { return error(String(failure)); }
    case "ui/update-model-context":
      host.context.push(message.params);
      return reply({});
    case "ui/download-file":
      host.downloads.push(message.params);
      if (setup.download === "hold") return host.held.push(reply);
      if (setup.download === "rpc-error") return error("Request timed out");
      if (setup.download === "method-not-found") return error("Method not found: ui/download-file", -32601);
      return reply(setup.download === "denied" ? { isError: true } : { isError: false });
    case "ui/message":
      host.messages.push(message.params);
      if (setup.message === "rpc-error") return error("Request timed out");
      return reply(setup.message === "denied" ? { isError: true } : {});
    case "ui/request-display-mode": {
      host.displayModes.push(message.params.mode);
      // Claude opens the side panel only right after a press in the view; otherwise the view stays where it is.
      const granted = !setup.refuseDisplay && navigator.userActivation.isActive;
      if (!granted) return reply({ mode: host.mode });
      host.mode = message.params.mode;
      reply({ mode: host.mode });
      return send(name, { method: "ui/notifications/host-context-changed", params: { displayMode: host.mode, ...(setup.noDimensions ? {} : { containerDimensions: host.mode === "fullscreen" ? { width: 640, height: 900 } : { width: setup.width ?? 960, maxHeight: setup.height ?? 640 } }) } });
    }
    case "ping":
      return reply({});
    default:
      if (message.id !== undefined && message.method) send(name, { id: message.id, error: { code: -32601, message: "Method not found: " + message.method } });
  }
});
</script>`;

const listen = (handler) => new Promise((resolve) => { const http = createServer(handler); http.listen(0, "127.0.0.1", () => resolve(http)); });
const hostHttp = await listen((_request, response) => response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(HOST_PAGE));
const viewHttp = await listen((_request, response) => response.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-security-policy": VIEW_CSP }).end(resource.text));
const hostUrl = `http://127.0.0.1:${hostHttp.address().port}/`;
const viewUrl = `http://localhost:${viewHttp.address().port}/view`;

const browser = await chromium.launch(process.env.OPF_BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.OPF_BROWSER_EXECUTABLE_PATH } : {});
const failures = [];
try {
	const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
	// A view in a frame named "nobc-..." runs where the browser has no BroadcastChannel.
	await page.addInitScript(() => {
		if (window.name.startsWith("nobc")) delete window.BroadcastChannel;
	});
	const problems = [];
	page.on("console", (message) => {
		if (message.type() === "error" || /Content Security Policy|Refused to/.test(message.text())) problems.push(message.text());
	});
	page.on("pageerror", (error) => problems.push(String(error)));
	await page.exposeFunction("callServer", (params) => client.callTool(params));
	await page.goto(hostUrl);
	const shots = process.env.OPF_DECK_APP_SCREENSHOTS;
	if (shots) mkdirSync(shots, { recursive: true });
	const shoot = async (name, frame) => {
		await page.evaluate((key) => window.front(key), frame);
		if (shots) await page.locator(`iframe[name="${frame}"]`).screenshot({ path: path.join(shots, `${name}.png`) });
	};
	const host = (name) => page.evaluate((key) => { const { pending, held, ...rest } = window.hosts[key]; return rest; }, name);
	const frameOf = (name) => page.frame({ name });
	const view = (name) => page.frameLocator(`iframe[name="${name}"]`);
	const remove = (...names) => page.evaluate((keys) => { for (const key of keys) document.querySelector(`iframe[name="${key}"]`)?.remove(); }, names);
	/** Claude calls one of the view's tools; a tools/call the view answers with an error (a validation failure) fails the test. */
	const call = async (name, tool, args = {}) => {
		const response = await page.evaluate(([key, params]) => window.callTool(key, params), [name, { name: tool, arguments: args }]);
		assert.equal(response.error, undefined, `${tool}: ${JSON.stringify(response.error)}`);
		assert.equal(response.result.isError, undefined, `${tool}: an error result instead of a normal one: ${JSON.stringify(response.result)}`);
		const text = response.result.content.map((part) => part.text).join("");
		return { ...response.result.structuredContent, text };
	};
	let toolIds = 0;
	/** Calls a server tool as Claude would, then mounts its view: the arguments and the result go to the view. */
	const open = async (name, tool, args, setup = {}) => {
		const result = await client.callTool({ name: tool, arguments: args });
		await page.evaluate(([key, value]) => window.startView(key, value), [name, { viewUrl, tool, arguments: args, result, toolId: `toolu_${++toolIds}`, ...setup }]);
		if (!setup.holdInput) {
			await view(name).locator('#opf-deck[data-ready="true"]').waitFor({ state: "attached", timeout: 120000 });
			await page.waitForFunction((key) => window.hosts[key].context.length > 0, name, { timeout: 60000 });
		}
		return result;
	};
	const run = async (name, body) => {
		try {
			await body();
			console.log(`ok - ${name}`);
		} catch (error) {
			failures.push(name);
			console.log(`not ok - ${name}\n  ${String(error?.stack ?? error).split("\n").join("\n  ")}`);
		}
	};
	const rename = async (name, text) => {
		const title = view(name).locator("#deck-title input");
		await title.click();
		await title.fill(text);
		await title.press("Enter");
	};

	const deckNamed = (name) => ({
		name,
		language: "en-US",
		design: { fontScheme: "roboto" },
		slides: [
			{ id: "intro", title: "Revenue grew 18% in Q3", blocks: [{ text: "Driven by the enterprise plan and lower churn." }] },
			{ id: "next", title: "What we do next", blocks: [{ items: ["Hire two account executives", "Ship the usage dashboard"] }] },
		],
	});
	const deck = deckNamed("Quarterly update");
	let listed;

	await run("the view declares its tools before connecting, and the host lists them before any call", async () => {
		await open("a", "show_deck", { document: deck });
		const state = await host("a");
		assert.deepEqual(state.appCapabilities.tools, {}, "a constant tool list: no listChanged");
		assert.deepEqual(state.appCapabilities.availableDisplayModes, ["inline", "fullscreen"]);
		listed = state.tools.result.tools;
		assert.deepEqual(listed.map((tool) => tool.name), ["read_deck", "select_slide", "edit_deck"]);
		for (const tool of listed) {
			assert.equal(tool.inputSchema.type, "object", `${tool.name}: an object schema`);
			assert.ok(tool.title && !/claude|anthropic/i.test(tool.title), tool.name);
			const first = tool.description.split("\n")[0];
			assert.ok(first.length <= 200 && /OPF viewer/.test(first), `${tool.name}: the first line says what it does (${first.length})`);
		}
		assert.deepEqual(listed.find((tool) => tool.name === "edit_deck").inputSchema.required.sort(), ["expectedRevision", "operations"]);
		assert.match(listed.find((tool) => tool.name === "edit_deck").description, /YAML comments are dropped/, "the description says what happens to YAML and Markdown source text");
		assert.equal(state.toolCalls.filter((name) => name === "read_deck").length, 0);
		await shoot("viewer-960", "a");
	});

	await run("read_deck, a manual edit, then edit_deck: the manual edit stays, one undo step per call, stale revisions are refused", async () => {
		const first = await call("a", "read_deck");
		assert.equal(first.ok, true);
		assert.match(first.revision, /^sha256:[0-9a-f]{64}$/);
		assert.equal(first.slideCount, 2);
		assert.deepEqual(first.selected, { index: 0, id: "intro" });
		assert.deepEqual(first.outline.map((slide) => slide.id), ["intro", "next"]);
		assert.match(first.session, /^deck-[0-9a-f]{32}$/);
		assert.match(first.text, /^The deck open in this viewer, at revision sha256:/);
		// The person renames the deck in the viewer.
		await rename("a", "Q3 board update");
		await page.waitForFunction(() => window.hosts.a.context.some((update) => update.structuredContent?.edited), null, { timeout: 15000 });
		// Claude's edit against the revision it read before that is refused, and nothing changes.
		const stale = await call("a", "edit_deck", { expectedRevision: first.revision, operations: [{ op: "replace", path: "/slides/1/title", value: "Next quarter" }] });
		assert.equal(stale.code, "stale-revision");
		assert.match(stale.text, /nothing was applied.*read_deck/i);
		const now = await call("a", "read_deck");
		assert.equal(now.name, "Q3 board update");
		assert.equal(stale.revision, now.revision);
		// Against the current revision it applies, by id, and the person's rename survives.
		const edit = await call("a", "edit_deck", { expectedRevision: now.revision, operations: [{ op: "replace", path: "/slides/@next/title", value: "Next quarter" }] });
		assert.equal(edit.ok, true, edit.text);
		assert.deepEqual(edit.changed, [{ op: "replace", path: "/slides/@next/title" }], "what changed, as addressed");
		assert.equal(edit.previousRevision, now.revision);
		assert.notEqual(edit.revision, now.revision);
		const after = await call("a", "read_deck", { source: "json" });
		assert.equal(after.revision, edit.revision);
		assert.equal(after.name, "Q3 board update", "the manual edit is kept");
		assert.equal(after.outline[1].title, "Next quarter");
		assert.equal(JSON.parse(after.source.text).slides[1].title, "Next quarter");
		// The preview, the source pane and the model's context all follow.
		await view("a").locator("#tab-both").click();
		await view("a").locator("#deck-source .cm-content", { hasText: "Next quarter" }).waitFor({ timeout: 15000 });
		await call("a", "select_slide", { id: "next" });
		await view("a").locator("#deck-canvas", { hasText: "Next quarter" }).waitFor({ timeout: 15000 });
		await page.waitForFunction(() => window.hosts.a.context.at(-1)?.structuredContent?.document?.slides?.[1]?.title === "Next quarter", null, { timeout: 15000 });
		assert.match(await view("a").locator("#deck-status").innerText(), /changed the deck \(1 change\)\. Undo takes it back\./);
		await shoot("viewer-after-edit", "a");
		// Undo takes back exactly the tool's edit; Redo puts it back.
		await view("a").locator("#deck-undo").click();
		const undone = await call("a", "read_deck");
		assert.equal(undone.outline[1].title, "What we do next");
		assert.equal(undone.name, "Q3 board update");
		assert.equal(undone.revision, now.revision);
		await view("a").locator("#deck-redo").click();
		assert.equal((await call("a", "read_deck")).revision, edit.revision);
	});

	await run("edit_deck refuses a whole-deck or whole-slides operation, an edit that breaks a valid deck, a bad path and loose inputs, changing nothing", async () => {
		const { revision } = await call("a", "read_deck");
		const refusals = [
			[[{ op: "replace", path: "", value: { name: "x", slides: [] } }], "whole-deck"],
			[[{ op: "copy", from: "", path: "/x" }], "whole-deck"],
			[[{ op: "replace", path: "/slides", value: [] }], "whole-slides"],
			[[{ op: "remove", path: "/slides" }], "whole-slides"],
			[[{ op: "add", path: "/slides", value: [] }], "whole-slides"],
			[[{ op: "move", from: "/slides", path: "/old" }], "whole-slides"],
			[[{ op: "copy", from: "/slides", path: "/copy" }], "whole-slides"],
			[[{ op: "replace", path: "/slides/0/title", value: 42 }], "invalid-result"],
			[[{ op: "repalce", path: "/name", value: "x" }], "invalid-input"],
			[[], "invalid-input"],
			[Array.from({ length: 101 }, () => ({ op: "test", path: "/name", value: "Q3 board update" })), "invalid-input"],
			[[{ op: "replace", path: "/name", value: "x".repeat(210_000) }], "too-large"],
		];
		for (const [operations, code] of refusals) {
			const result = await call("a", "edit_deck", { expectedRevision: revision, operations });
			assert.equal(result.code, code, `${JSON.stringify(operations).slice(0, 80)}: ${result.text.slice(0, 200)}`);
		}
		assert.equal((await call("a", "edit_deck", { expectedRevision: "", operations: [{ op: "remove", path: "/name" }] })).code, "invalid-input");
		const missing = await call("a", "edit_deck", { expectedRevision: revision, operations: [{ op: "replace", path: "/slides/9/title", value: "No slide" }] });
		assert.equal(missing.ok, false);
		assert.match(missing.text, /Nothing was applied/);
		// One failing operation in a full patch of 100: none of them applies.
		const hundred = [...Array.from({ length: 99 }, (_, index) => ({ op: "replace", path: "/slides/0/title", value: `Title ${index}` })), { op: "replace", path: "/slides/7/title", value: "No slide" }];
		const partial = await call("a", "edit_deck", { expectedRevision: revision, operations: hundred });
		assert.equal(partial.ok, false, partial.text);
		// Prototype paths change no object's prototype and come back as normal results.
		for (const path of ["/__proto__/polluted", "/constructor/prototype/polluted"]) {
			const result = await call("a", "edit_deck", { expectedRevision: revision, operations: [{ op: "add", path, value: "yes" }] });
			assert.equal(typeof result.ok, "boolean", path);
			assert.equal(await frameOf("a").evaluate(() => ({}).polluted), undefined, `${path}: no prototype was changed`);
		}
		const state = await call("a", "read_deck");
		assert.equal(state.revision, revision, "nothing above changed the deck");
		assert.equal(state.outline[0].title, "Revenue grew 18% in Q3");
		assert.equal((await call("a", "select_slide", {})).code, "invalid-input");
		assert.equal((await call("a", "select_slide", { index: 0, id: "intro" })).code, "invalid-input");
		assert.equal((await call("a", "select_slide", { index: -1 })).code, "invalid-input");
		assert.equal((await call("a", "select_slide", { index: 1.5 })).code, "invalid-input");
		assert.equal((await call("a", "read_deck", { source: "json", offset: -3 })).code, "invalid-input");
	});

	await run("an invalid deck: a JSON deck that fails the format does not open (the tools say so); invalid YAML stays a draft, and /slides is still refused", async () => {
		const broken = { ...deckNamed("Broken deck"), slides: [{ id: "one", title: 42 }, { id: "two", title: "Two" }] };
		await open("bad", "show_deck", { document: broken }, { holdInput: true });
		await page.waitForFunction(() => window.hosts.bad.tools !== undefined, null, { timeout: 30000 });
		await page.evaluate((setup) => { window.notifyView("bad", "ui/notifications/tool-input", { arguments: setup.arguments }); window.notifyView("bad", "ui/notifications/tool-result", setup.result); }, (await host("bad")).setup);
		await view("bad").locator('#deck-wait[data-failed="true"]').waitFor({ timeout: 60000 });
		assert.equal((await call("bad", "read_deck")).code, "not-open");
		await remove("bad");
		// YAML text that is not a valid deck opens as a draft in Source; the deck behind it stays valid and untouched.
		await open("badyaml", "show_deck", { document: "name: Broken YAML\nslides: 42\n", format: "yaml", view: "source" }, { holdInput: true });
		await page.waitForFunction(() => window.hosts.badyaml.tools !== undefined, null, { timeout: 30000 });
		await page.evaluate((setup) => { window.notifyView("badyaml", "ui/notifications/tool-input", { arguments: setup.arguments }); window.notifyView("badyaml", "ui/notifications/tool-result", setup.result); }, (await host("badyaml")).setup);
		await view("badyaml").locator('#opf-deck[data-ready="true"]').waitFor({ state: "attached", timeout: 60000 });
		const { revision, sourceDraft } = await call("badyaml", "read_deck");
		assert.equal(sourceDraft, true);
		assert.equal((await call("badyaml", "edit_deck", { expectedRevision: revision, operations: [{ op: "replace", path: "/slides", value: [{ title: "Fixed" }] }] })).code, "whole-slides");
		assert.equal((await call("badyaml", "edit_deck", { expectedRevision: revision, operations: [{ op: "replace", path: "/name", value: "Fixed" }] })).code, "source-draft");
		const read = await call("badyaml", "read_deck", { source: "yaml" });
		assert.equal(read.source.draft, true);
		assert.equal(read.source.text, "name: Broken YAML\nslides: 42\n", "the draft comes back as the user sees it");
		await remove("badyaml");
	});

	await run("edit_deck never commits the user's open edit: it waits while they type, and a source draft is left alone", async () => {
		const fresh = deckNamed("Typing deck");
		await open("type", "show_deck", { document: fresh, view: "both" });
		const { revision } = await call("type", "read_deck");
		// Text open for editing on the slide.
		await view("type").locator("#deck-canvas text", { hasText: "What we do" }).or(view("type").locator("#deck-canvas text").first()).first().dblclick();
		const typing = await call("type", "edit_deck", { expectedRevision: revision, operations: [{ op: "replace", path: "/name", value: "x" }] });
		assert.equal(typing.code, "busy", typing.text);
		assert.match(typing.text, /typing.*Try again after the user's next message/);
		await view("type").locator("body").press("Escape");
		// A rename in progress counts as typing too.
		await view("type").locator("#deck-title input").click();
		await view("type").locator(".opf-title[data-editing]").waitFor();
		assert.equal((await call("type", "edit_deck", { expectedRevision: revision, operations: [{ op: "replace", path: "/name", value: "x" }] })).code, "busy", "a rename is open");
		await view("type").locator("#deck-title input").press("Escape");
		await view("type").locator(".opf-title[data-editing]").waitFor({ state: "detached" });
		// Typing in the source pane that it has not applied yet.
		const source = view("type").locator("#deck-source .cm-content");
		await source.click();
		await page.keyboard.press("End");
		await page.keyboard.type(" ");
		const pending = await call("type", "edit_deck", { expectedRevision: revision, operations: [{ op: "replace", path: "/name", value: "x" }] });
		assert.equal(pending.code, "busy", pending.text);
		// A source draft that is not a valid deck.
		await page.keyboard.press("ControlOrMeta+A");
		await page.keyboard.insertText('{ "name": "Typing deck", "slides": [ ');
		await page.waitForTimeout(1500);
		const draft = await call("type", "edit_deck", { expectedRevision: (await call("type", "read_deck")).revision, operations: [{ op: "replace", path: "/name", value: "x" }] });
		assert.equal(draft.code, "source-draft", draft.text);
		// read_deck reads the draft without applying it, and marks each page with the text it came from.
		const read = await call("type", "read_deck", { source: "json" });
		assert.equal(read.source.draft, true);
		assert.match(read.source.textHash, /^[0-9a-f]{8}$/);
		await page.keyboard.insertText('{ "title": "More" } ');
		await page.waitForTimeout(300);
		assert.notEqual((await call("type", "read_deck", { source: "json" })).source.textHash, read.source.textHash, "the draft changed, so its pages say so");
		await remove("type");
	});

	await run("a tool edit is not the user's: in a view nobody edited, Send stays disabled after it", async () => {
		await open("tool-only", "show_deck", { document: deckNamed("Tool only") });
		const { revision } = await call("tool-only", "read_deck");
		assert.equal(await view("tool-only").locator("#deck-send").isDisabled(), true);
		assert.equal((await call("tool-only", "edit_deck", { expectedRevision: revision, operations: [{ op: "replace", path: "/slides/0/title", value: "Edited by the model" }] })).ok, true);
		await page.waitForFunction(() => window.hosts["tool-only"].context.some((update) => update.structuredContent?.edited), null, { timeout: 15000 });
		assert.equal(await view("tool-only").locator("#deck-send").isDisabled(), true, "nothing for the user to send");
		assert.match((await host("tool-only")).context.at(-1).content[0].text, /has your edit_deck changes/);
		await remove("tool-only");
	});

	await run("read_deck is bounded for 500 slides with long titles, and pages advance without splitting a surrogate pair", async () => {
		const long = {
			name: "Long ".repeat(80),
			language: "en-US",
			design: { fontScheme: "roboto" },
			slides: Array.from({ length: 500 }, (_, index) => ({ id: `s${index}`, title: `Slide ${index} ${"with a very long title ".repeat(15)}`, notes: "😀a".repeat(120) })),
		};
		await open("long", "show_deck", { document: long });
		const state = await call("long", "read_deck");
		assert.ok(state.text.length <= 100000, `the plain read is ${state.text.length} characters`);
		assert.ok(state.name.length <= 200 && state.outline.every((slide) => slide.title.length <= 200), "names and titles are clipped to 200 characters");
		assert.deepEqual(state.outlineTruncated, { listed: state.outline.length, of: 500 });
		let next = 0;
		let text = "";
		let hash;
		let pages = 0;
		do {
			const page_ = await call("long", "read_deck", { source: "yaml", offset: next });
			pages += 1;
			assert.ok(page_.text.length <= 100000, `page ${pages}: ${page_.text.length} characters`);
			if (next > 0) assert.equal(page_.outline, undefined, "pages after the first leave the outline out");
			assert.ok(page_.source.end > page_.source.offset, "every page moves on");
			assert.doesNotMatch(page_.source.text, /^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/, `page ${pages} starts and ends between characters`);
			hash ??= page_.source.textHash;
			assert.equal(page_.source.textHash, hash);
			text += page_.source.text;
			next = page_.source.next;
		} while (next !== undefined && pages < 50);
		assert.ok(pages > 1, "the source took several pages");
		assert.ok(!text.includes("�") && /Slide 499/.test(text));
		assert.equal(text.length, (await call("long", "read_deck", { source: "yaml" })).source.total, "the pages put back together are the whole text");
		// An offset in the middle of a pair starts the page before it.
		const pair = text.indexOf("😀") + 1;
		const inside = await call("long", "read_deck", { source: "yaml", offset: pair });
		assert.equal(inside.source.offset, pair - 1);
		await remove("long");
	});

	await run("the tools refuse while loading, and an edit reaches only its own view", async () => {
		await open("b", "show_deck", { document: deckNamed("Deck B") }, { holdInput: true });
		await page.waitForFunction(() => window.hosts.b.tools !== undefined, null, { timeout: 30000 });
		const loading = await call("b", "edit_deck", { expectedRevision: "sha256:0", operations: [{ op: "replace", path: "/name", value: "x" }] });
		assert.equal(loading.code, "loading");
		assert.equal((await call("b", "read_deck")).code, "loading");
		const state = await host("b");
		await page.evaluate((setup) => { window.notifyView("b", "ui/notifications/tool-input", { arguments: setup.arguments }); window.notifyView("b", "ui/notifications/tool-result", setup.result); }, state.setup);
		await view("b").locator('#opf-deck[data-ready="true"]').waitFor({ state: "attached", timeout: 60000 });
		const a = await call("a", "read_deck");
		const b = await call("b", "read_deck");
		assert.notEqual(a.session, b.session, "decks with different names are different sessions");
		const edit = await call("b", "edit_deck", { expectedRevision: b.revision, operations: [{ op: "replace", path: "/slides/0/title", value: "Only in B" }] });
		assert.equal(edit.ok, true);
		assert.equal((await call("a", "read_deck")).revision, a.revision, "view a is untouched");
		assert.equal((await call("b", "read_deck")).outline[0].title, "Only in B");
		assert.equal(await view("a").locator("#deck-note").isVisible(), false, "independent decks do not supersede each other");
	});

	await run("a newer show_deck of the same deck supersedes the older view with no session passed back: greyed out, read-only, silent", async () => {
		await page.evaluate(() => window.front("a"));
		await view("a").locator("#deck-title input").click();
		const contextBefore = (await host("a")).context.length;
		// The model shows the deck again (the name it sent is the same: Quarterly update) and passes no session.
		await open("a2", "show_deck", { document: deck });
		assert.equal((await call("a2", "read_deck")).session, (await host("a2")).setup.result.structuredContent.viewer.session);
		await view("a").locator("#deck-note").waitFor({ timeout: 15000 });
		assert.match(await view("a").locator("#deck-note").innerText(), /newer viewer of this deck is open/);
		const greyed = await frameOf("a").evaluate(() => ({ opacity: getComputedStyle(document.querySelector(".deck-bar")).opacity, selection: String(getSelection()), sync: document.getElementById("deck-sync").textContent, focus: document.activeElement === document.body }));
		assert.deepEqual(greyed, { opacity: "0.5", selection: "", sync: "", focus: true }, "greyed, with nothing selected or shared");
		assert.equal(await view("a").locator("#deck-send").isDisabled(), true);
		// A rename is not possible there: the name is read-only and the row takes no clicks.
		assert.equal(await frameOf("a").evaluate(() => { const input = document.querySelector("#deck-title input"); return !input || input.readOnly || input.disabled || input.getAttribute("aria-disabled") === "true"; }), true, "the name cannot be edited");
		assert.equal(await frameOf("a").evaluate(() => getComputedStyle(document.querySelector(".deck-bar")).pointerEvents), "none");
		assert.equal((await call("a", "edit_deck", { expectedRevision: "sha256:x", operations: [{ op: "replace", path: "/name", value: "x" }] })).code, "superseded");
		assert.equal((await call("a", "read_deck")).code, "superseded");
		assert.equal((await call("a", "select_slide", { index: 0 })).code, "superseded");
		await page.waitForTimeout(1500);
		const after = await host("a");
		assert.equal(after.context.length, contextBefore, "no model context after supersession");
		assert.equal(after.messages.length, 0);
		// The other deck (b) did not hear it, and the newest view works.
		assert.equal(await view("b").locator("#deck-note").isVisible(), false);
		assert.equal((await call("a2", "read_deck")).ok, true);
		await shoot("superseded", "a");
	});

	await run("without BroadcastChannel a view stays on its own and keeps working", async () => {
		await open("nobc-1", "show_deck", { document: deck });
		assert.equal(await frameOf("nobc-1").evaluate(() => typeof window.BroadcastChannel), "undefined");
		assert.equal((await call("nobc-1", "read_deck")).ok, true);
		assert.equal(await view("a2").locator("#deck-note").isVisible(), false, "it supersedes nothing");
		await remove("nobc-1");
	});

	await run("after teardown the tools refuse and nothing is published", async () => {
		const response = await page.evaluate(() => window.callView("b", "ui/resource-teardown", {}));
		assert.deepEqual(response.result, {});
		assert.equal((await call("b", "read_deck")).code, "closed");
		assert.equal((await call("b", "edit_deck", { expectedRevision: "sha256:x", operations: [{ op: "remove", path: "/name" }] })).code, "closed");
		await remove("a", "a2", "b");
	});

	await run("a cancelled tool call: the view says so and its tools refuse", async () => {
		await open("cancel", "show_deck", { document: deckNamed("Cancelled") }, { holdInput: true });
		await page.waitForFunction(() => window.hosts.cancel.tools !== undefined, null, { timeout: 30000 });
		await page.evaluate(() => window.notifyView("cancel", "ui/notifications/tool-cancelled", {}));
		await view("cancel").locator('#deck-wait[data-failed="true"]').waitFor({ timeout: 15000 });
		assert.match(await view("cancel").locator("#deck-wait-text").innerText(), /stopped before the deck was ready/);
		assert.equal((await call("cancel", "read_deck")).code, "not-open");
		await remove("cancel");
	});

	await run("the view's tools reach the model only from the user's next message", async () => {
		await open("gated", "show_deck", { document: deckNamed("Gated") }, { gated: true });
		const early = await page.evaluate(() => window.callTool("gated", { name: "read_deck", arguments: {} }));
		assert.match(early.error.message, /^not-yet/);
		await page.evaluate(() => window.userMessage("gated"));
		assert.equal((await call("gated", "read_deck")).name, "Gated");
		await remove("gated");
	});

	await run("open_editor with {} opens a starter deck to edit, a bundled example and a way to paste a deck", async () => {
		const result = await open("start", "open_editor", {}, { width: 1280, height: 800, hostName: "Claude" });
		assert.equal(result.structuredContent.editor, true);
		const state = await call("start", "read_deck");
		assert.equal(state.name, "Untitled deck");
		assert.equal(state.slideCount, 2);
		assert.equal(state.checks.error, 0, JSON.stringify(state.checks));
		// The model's first context says what opened, and carries the deck (no deck of the model's was sent).
		const first = (await host("start")).context[0];
		assert.match(first.content[0].text, /^The OPF viewer's editor opened a starter deck "Untitled deck" \(2 slides/);
		assert.equal(first.structuredContent.document.name, "Untitled deck");
		assert.match(first.content[0].text, /"name": "Untitled deck"/);
		await view("start").locator("#deck-start").waitFor();
		assert.equal(await view("start").locator("#deck-start-label").isVisible(), true);
		assert.equal(await view("start").locator("#deck-paste").isVisible(), true);
		const options = await view("start").locator("#deck-example option").count();
		assert.ok(options > 5, `${options} examples offered`);
		const row = await frameOf("start").evaluate(() => [...document.querySelectorAll(".deck-start > :not([hidden])")].map((item) => { const box = item.getBoundingClientRect(); return Math.round((box.top + box.bottom) / 8); }));
		assert.equal(new Set(row).size, 1, "label, picker and Paste share one row");
		assert.ok(await frameOf("start").evaluate(() => document.getElementById("deck-example").getBoundingClientRect().width <= 280));
		await shoot("editor-start-1280", "start");
		await view("start").locator("#deck-example").selectOption("columns");
		await page.waitForFunction(() => window.hosts.start.toolCalls.includes("get_catalog_record"), null, { timeout: 15000 });
		await view("start").locator("#deck-status", { hasText: "Opened the example columns" }).waitFor({ timeout: 30000 });
		assert.equal(await view("start").locator("#deck-start-label").isVisible(), false, "no longer a starter deck");
		assert.notEqual((await call("start", "read_deck")).name, "Untitled deck");
		await view("start").locator("#deck-undo").click();
		assert.equal((await call("start", "read_deck")).name, "Untitled deck", "Undo goes back to the starter deck");
		// Paste selects the whole source and focuses it (the clipboard is not readable here), and says so without naming keys.
		await view("start").locator("#deck-paste").click();
		await view("start").locator("#deck-source .cm-editor").waitFor();
		const pasted = await frameOf("start").evaluate(() => ({ focused: Boolean(document.activeElement?.closest(".cm-editor")), selected: getSelection().toString().length }));
		assert.equal(pasted.focused, true);
		assert.ok(pasted.selected > 50, `the source text is selected (${pasted.selected})`);
		const said = await view("start").locator("#deck-status").innerText();
		assert.match(said, /Paste a deck in JSON, YAML or OPF Markdown: it replaces the selected text\./);
		assert.doesNotMatch(said, /Ctrl|Cmd/);
		await page.keyboard.insertText(JSON.stringify(deckNamed("Pasted deck")));
		await page.waitForFunction(() => window.hosts.start.context.at(-1)?.structuredContent?.document?.name === "Pasted deck", null, { timeout: 15000 });
		await view("start").locator("#tab-preview").click();
	});

	await run("open_editor where the host offers no server tools: the example picker is hidden, the starter deck and Paste remain", async () => {
		await open("noserver", "open_editor", { title: "No server tools" }, { noServerTools: true });
		await view("noserver").locator("#deck-start").waitFor();
		assert.equal(await view("noserver").locator("#deck-example").isVisible(), false);
		assert.equal(await view("noserver").locator("#deck-paste").isVisible(), true);
		assert.equal((await call("noserver", "read_deck")).name, "No server tools");
		await remove("noserver");
	});

	await run("the expand control asks straight from the click, says the truth when refused, and offers the way back", async () => {
		const expand = view("start").locator("#deck-expand");
		assert.equal(await expand.getAttribute("aria-label"), "Expand");
		// A click the page makes up (no user activation): the host refuses, and the label does not change.
		// (An evaluate counts as a gesture, so the click is made later, from a timer, after the transient activation of about 5 s lapsed.)
		await frameOf("start").evaluate(() => { setTimeout(() => document.getElementById("deck-expand").click(), 7000); });
		await page.waitForFunction(() => window.hosts.start.displayModes.length === 1, null, { timeout: 20000 });
		await page.waitForTimeout(500);
		assert.equal(await view("start").locator("#deck-status").innerText(), "Claude kept the viewer in the conversation.", `host mode ${(await host("start")).mode}`);
		assert.equal(await expand.getAttribute("aria-label"), "Expand");
		// The person's click: granted; the container is now fixed-height, so the view fills it; and the way back is offered.
		await expand.click();
		await view("start").locator('#deck-expand[aria-label="Back to the conversation"]').waitFor();
		assert.equal(await frameOf("start").evaluate(() => document.documentElement.dataset.fill), "true");
		await expand.click();
		await view("start").locator('#deck-expand[aria-label="Expand"]').waitFor();
		assert.deepEqual((await host("start")).displayModes, ["fullscreen", "fullscreen", "inline"]);
	});

	await run("full screen without container dimensions still fills the frame, borderless", async () => {
		await open("nodims", "show_deck", { document: deckNamed("No dimensions") }, { noDimensions: true });
		await view("nodims").locator("#deck-expand").click();
		await view("nodims").locator('#deck-expand[aria-label="Back to the conversation"]').waitFor();
		const filled = await frameOf("nodims").evaluate(() => ({ fill: document.documentElement.dataset.fill, border: getComputedStyle(document.getElementById("opf-deck")).borderTopWidth, height: Math.round(document.getElementById("opf-deck").getBoundingClientRect().height), frame: innerHeight }));
		assert.deepEqual(filled, { fill: "true", border: "0px", height: filled.frame, frame: filled.frame });
		await remove("nodims");
	});

	await run("lays out by the container's size at 320, 600 and 1280px with the host's safe-area insets: no sideways scroll, 44px controls at 320", async () => {
		const insets = { top: 12, right: 0, bottom: 16, left: 24 };
		for (const width of [320, 600, 1280]) {
			await page.evaluate(([px, value]) => {
				document.querySelector('iframe[name="start"]').style.width = `${px}px`;
				document.querySelector('iframe[name="start"]').style.height = "760px";
				window.notifyView("start", "ui/notifications/host-context-changed", { displayMode: "fullscreen", containerDimensions: { width: px, height: 760 }, safeAreaInsets: value });
			}, [width, insets]);
			await page.waitForTimeout(300);
			const fit = await frameOf("start").evaluate(() => {
				const shell = getComputedStyle(document.getElementById("opf-deck"));
				const visible = (item) => item.offsetParent && item.getBoundingClientRect().width > 0;
				const controls = [...document.querySelectorAll(".deck-bar button, .deck-bar select, .deck-bar [role=tab], .deck-start button, .deck-start select, .deck-foot button")].filter(visible);
				const right = Math.max(...[...document.querySelectorAll(".deck-bar > *, .deck-foot > *, .deck-start > *")].filter((item) => item.offsetParent).map((item) => item.getBoundingClientRect().right));
				const send = document.getElementById("deck-send").getBoundingClientRect();
				const sendRow = [...document.querySelectorAll(".deck-bar > *")].filter((item) => visible(item) && item !== document.getElementById("deck-send") && Math.abs(item.getBoundingClientRect().top - send.top) < 4);
				return { scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, size: document.documentElement.dataset.size, padding: [shell.paddingTop, shell.paddingRight, shell.paddingBottom, shell.paddingLeft], right, send: send.right, small: controls.filter((item) => { const box = item.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).map((item) => `${item.id || item.className || item.textContent} ${Math.round(item.getBoundingClientRect().width)}x${Math.round(item.getBoundingClientRect().height)}`), sendRow: sendRow.length };
			});
			assert.ok(fit.scroll <= fit.client, `${width}px: the page is ${fit.scroll}px wide in ${fit.client}px`);
			assert.ok(fit.right <= fit.client + 0.5, `${width}px: every control ends inside the frame (${fit.right})`);
			assert.ok(fit.send <= fit.client, `${width}px: Send ends at ${fit.send}`);
			assert.deepEqual(fit.padding, ["12px", "0px", "16px", "24px"], `${width}px: the insets pad the view`);
			assert.equal(fit.size, width < 400 ? "compact narrow tiny" : width < 640 ? "compact narrow" : "wide");
			if (width === 320) {
				assert.deepEqual(fit.small, [], "every control is at least 44 by 44 CSS pixels");
				assert.equal(fit.sendRow, 0, "Send has its own row, not beside a lone icon");
				// A long status message wraps instead of being cut short.
				const { revision } = await call("start", "read_deck");
				const edited = await call("start", "edit_deck", { expectedRevision: revision, operations: [{ op: "replace", path: "/slides/1/title", value: "A longer title" }] });
				assert.equal(edited.ok, true, edited.text);
				const status = await frameOf("start").evaluate(() => { const box = document.getElementById("deck-status"); return { scroll: box.scrollWidth, client: box.clientWidth }; });
				assert.ok(status.scroll <= status.client + 1, `the status line is not truncated (${status.scroll} in ${status.client})`);
			}
			if (width === 600) {
				const row = await frameOf("start").evaluate(() => [...document.querySelectorAll(".deck-start > :not([hidden])")].map((item) => { const box = item.getBoundingClientRect(); return Math.round((box.top + box.bottom) / 8); }));
				assert.equal(new Set(row).size, 1, "600px: the start row is one row");
			}
			await shoot(`editor-${width}`, "start");
		}
	});

	await run("downloads: the file name the host shows, one request at a time, and each outcome's words", async () => {
		const plain = { name: "Download names", language: "en-US", design: { fontScheme: "roboto" }, slides: [{ id: "one", title: "One" }] };
		await open("dl", "show_deck", { document: plain, view: "source" }, { download: "hold", hostName: "Claude" });
		await view("dl").getByRole("button", { name: "Rename deck", exact: true }).click();
		const filename = view("dl").getByRole("textbox", { name: "File name", exact: true });
		await filename.fill("Café Q3#1 100%: plan?");
		await filename.press("Enter");
		const button = view("dl").getByRole("button", { name: "Download source", exact: true });
		await button.click();
		await page.waitForFunction(() => window.hosts.dl.downloads.length === 1);
		// No percent-encoding (a host does not decode it), and the characters a host would replace are replaced here.
		assert.equal((await host("dl")).downloads[0].contents[0].resource.uri, "file:///Café-Q3_1-100__-plan_.opf.json");
		await button.click();
		await view("dl").locator("#deck-status", { hasText: "A download is already waiting" }).waitFor();
		assert.equal((await host("dl")).downloads.length, 1, "a click while one is pending sends nothing");
		await page.evaluate(() => window.release("dl", { isError: false }));
		await view("dl").locator("#deck-status", { hasText: "Download started." }).waitFor();
		await shoot("download-started", "dl");
		for (const [mode, words] of [["denied", "The download didn't finish."], ["rpc-error", "The download couldn't be confirmed."], ["method-not-found", "This host does not offer downloads here. Select the source text to copy it."]]) {
			await open(`dl-${mode}`, "show_deck", { document: plain, view: "source" }, { download: mode });
			await view(`dl-${mode}`).getByRole("button", { name: "Download source", exact: true }).click();
			await view(`dl-${mode}`).locator("#deck-status", { hasText: words }).waitFor({ timeout: 15000 });
			assert.doesNotMatch(await view(`dl-${mode}`).locator("#deck-status").innerText(), /nothing was saved/i);
			if (mode === "method-not-found") {
				assert.equal(await view(`dl-${mode}`).locator(".opf-source-action-download").isVisible(), false, "Download is no longer offered");
				assert.equal(await view(`dl-${mode}`).locator("#deck-export").isVisible(), false);
			}
			await shoot(`download-${mode}`, `dl-${mode}`);
		}
		await remove("dl", "dl-denied", "dl-rpc-error", "dl-method-not-found");
	});

	await run("messages: sent for approval in Claude, refused or unconfirmed, and Send stays usable to try again", async () => {
		for (const [mode, hostName, sync, status] of [["accepted", "Claude", "Sent to Claude for your approval", ""], ["other-host", "Other host", "Sent to the assistant", ""], ["denied", "Claude", "Claude didn't take the message", "You can send it again"], ["rpc-error", "Claude", "The message couldn't be confirmed", "You can send it again"]]) {
			const name = `msg-${mode}`;
			await open(name, "show_deck", { document: deckNamed(`Message ${mode}`) }, { message: mode === "other-host" ? "accepted" : mode, hostName });
			await rename(name, `Edited for ${mode}`);
			const send = view(name).locator("#deck-send");
			await send.click();
			await view(name).locator("#deck-sync", { hasText: sync }).waitFor({ timeout: 15000 });
			if (status) assert.match(await view(name).locator("#deck-status").innerText(), new RegExp(status));
			const sent = (await host(name)).messages;
			assert.equal(sent.length, 1);
			assert.ok(sent[0].content[0].text.length < 8000 && !/\n{4}| {65}/.test(sent[0].content[0].text), "within the message limits, pointing at the deck");
			assert.doesNotMatch(sent[0].content[0].text, /"slides"/, "the deck goes as context, not in the message");
			assert.equal(await send.isDisabled(), false, "Send stays usable for a retry");
			assert.equal(await send.getAttribute("data-unsent"), String(!["accepted", "other-host"].includes(mode)));
			await shoot(`message-${mode}`, name);
		}
	});

	await run("a status message clears itself after a few seconds", async () => {
		const name = "msg-rpc-error";
		assert.notEqual(await view(name).locator("#deck-status").innerText(), "");
		await page.waitForTimeout(9000);
		assert.equal(await view(name).locator("#deck-status").innerText(), "");
	});

	await run("the tool definitions never change while the views are used", async () => {
		const again = await page.evaluate((key) => window.callView(key, "tools/list", {}), "msg-accepted");
		assert.equal(JSON.stringify(again.result.tools), JSON.stringify(listed), "byte-identical tools/list after edits, supersession and messages");
	});

	await run("runs without a CSP violation or a page error", async () => {
		assert.deepEqual(problems, []);
	});
} finally {
	await browser.close();
	hostHttp.close();
	viewHttp.close();
	await client.close();
}
if (failures.length) {
	console.error(`${failures.length} failed: ${failures.join("; ")}`);
	process.exit(1);
}
