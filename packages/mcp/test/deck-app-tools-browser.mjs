// The deck view's MCP Apps features in Chromium, behind a stand-in host that behaves as Claude's MCP Apps documentation says the
// host does: it reads the view's `tools` capability from ui/initialize and asks the view for `tools/list`, calls the view's tools
// with `tools/call`, can frame several views at once (each tool call mounts its own), honors `ui/request-display-mode` only right
// after a press in the view (user activation), answers `ui/download-file` and `ui/message` with each outcome the docs name, and
// can tear a view down. The view is framed cross-origin under the restrictive default CSP, as in deck-app-browser.mjs; its server
// is the real one (createOpfServer) over an in-memory MCP client. Run it after `pnpm run build`:
//   node test/deck-app-tools-browser.mjs
// OPF_DECK_APP_SCREENSHOTS=<directory> saves screenshots of the studio, the layouts, a superseded view and the status lines.
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
  hosts[name] = { setup, requests: [], context: [], messages: [], downloads: [], displayModes: [], toolCalls: [], tools: undefined, pending: {}, held: [], mode: "inline" };
  frame.style.width = (setup.width ?? 960) + "px";
  frame.style.height = (setup.height ?? 640) + "px";
  frame.src = setup.viewUrl + "?" + name;
};
// A request from the host to the view (tools/list, tools/call, ui/resource-teardown); resolves with the view's response.
window.callView = (name, method, params) => new Promise((resolve) => { const id = "host-" + nextId++; hosts[name].pending[id] = resolve; send(name, { id, method, params }); });
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
  const error = (text) => send(name, { id: message.id, error: { code: -32000, message: text } });
  switch (message.method) {
    case "ui/initialize":
      host.appCapabilities = message.params.appCapabilities;
      return reply({
        protocolVersion: "2026-01-26",
        hostInfo: { name: setup.hostName ?? "test-host", version: "1.0.0" },
        hostCapabilities: { serverTools: {}, serverResources: {}, updateModelContext: { text: {}, structuredContent: {} }, message: { text: {} }, ...(setup.download ? { downloadFile: {} } : {}) },
        hostContext: { theme: "light", displayMode: "inline", availableDisplayModes: ["inline", "fullscreen"], containerDimensions: { width: setup.width ?? 960, maxHeight: setup.height ?? 640 }, platform: "web", toolInfo: { id: setup.toolId, tool: { name: setup.tool, inputSchema: { type: "object" } } }, ...(setup.insets ? { safeAreaInsets: setup.insets } : {}) },
      });
    case "ui/notifications/initialized":
      // The host lists the view's tools once it has started, before Claude can call one (they reach Claude with the next message).
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
      try { return reply(await window.callServer(message.params)); } catch (failure) { return error(String(failure)); }
    case "ui/update-model-context":
      host.context.push(message.params);
      return reply({});
    case "ui/download-file":
      host.downloads.push(message.params);
      if (setup.download === "hold") return host.held.push(reply);
      if (setup.download === "rpc-error") return error("Request timed out");
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
      return send(name, { method: "ui/notifications/host-context-changed", params: { displayMode: host.mode, containerDimensions: host.mode === "fullscreen" ? { width: 640, height: 900 } : { width: setup.width ?? 960, maxHeight: setup.height ?? 640 } } });
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
	const call = async (name, tool, args = {}) => {
		const response = await page.evaluate(([key, params]) => window.callView(key, "tools/call", params), [name, { name: tool, arguments: args }]);
		assert.equal(response.error, undefined, `${tool}: ${JSON.stringify(response.error)}`);
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

	const deck = {
		name: "Quarterly update",
		language: "en-US",
		design: { fontScheme: "roboto" },
		slides: [
			{ id: "intro", title: "Revenue grew 18% in Q3", blocks: [{ text: "Driven by the enterprise plan and lower churn." }] },
			{ id: "next", title: "What we do next", blocks: [{ items: ["Hire two account executives", "Ship the usage dashboard"] }] },
		],
	};
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
		assert.match(first.session, /^[0-9a-f-]{36}$/);
		assert.match(first.text, /^The deck open in this viewer, at revision sha256:/);
		// The person renames the deck in the viewer.
		const title = view("a").locator("#deck-title input");
		await title.fill("Q3 board update");
		await title.press("Enter");
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
		// A tool edit is not the person's: Send stays as their own edit left it.
		assert.equal(await view("a").locator("#deck-send").isDisabled(), false);
	});

	await run("edit_deck refuses a whole-deck replace, an edit that breaks a valid deck, and a bad path, changing nothing", async () => {
		const { revision } = await call("a", "read_deck");
		const root = await call("a", "edit_deck", { expectedRevision: revision, operations: [{ op: "replace", path: "", value: { name: "x", slides: [] } }] });
		assert.equal(root.code, "whole-deck");
		const invalid = await call("a", "edit_deck", { expectedRevision: revision, operations: [{ op: "replace", path: "/slides/0/title", value: 42 }] });
		assert.equal(invalid.code, "invalid-result", invalid.text);
		assert.ok(invalid.issues.length > 0);
		const missing = await call("a", "edit_deck", { expectedRevision: revision, operations: [{ op: "replace", path: "/slides/9/title", value: "No slide" }] });
		assert.equal(missing.ok, false);
		assert.match(missing.text, /Nothing was applied/);
		assert.equal((await call("a", "read_deck")).revision, revision);
		const bad = await call("a", "select_slide", {});
		assert.equal(bad.code, "invalid-input");
	});

	await run("read_deck pages a long source within the result limit", async () => {
		// The bulk is in speaker notes, which the slides do not draw, so the deck opens quickly and its text is long.
		const long = { name: "Long", language: "en-US", design: { fontScheme: "roboto" }, slides: Array.from({ length: 40 }, (_, index) => ({ id: `s${index}`, title: `Slide ${index}`, notes: "word ".repeat(700).trim() })) };
		await open("long", "show_deck", { document: long });
		const first = await call("long", "read_deck", { source: "yaml" });
		assert.ok(first.text.length <= 100000, `${first.text.length} characters`);
		assert.equal(first.source.truncated, true);
		assert.match(first.text, new RegExp(`call read_deck again with source "yaml" and offset ${first.source.next}`));
		let text = first.source.text;
		let next = first.source.next;
		while (next !== undefined) {
			const piece = await call("long", "read_deck", { source: "yaml", offset: next });
			assert.ok(piece.text.length <= 100000);
			text += piece.source.text;
			next = piece.source.next;
		}
		assert.equal(text.length, first.source.total);
		assert.match(text, /title: Slide 39/);
		await page.evaluate(() => document.querySelector('iframe[name="long"]').remove());
	});

	await run("the tools refuse while loading, and an edit reaches only its own view", async () => {
		await open("b", "show_deck", { document: deck }, { holdInput: true });
		await page.waitForFunction(() => window.hosts.b.tools !== undefined, null, { timeout: 30000 });
		const loading = await call("b", "edit_deck", { expectedRevision: "sha256:0", operations: [{ op: "replace", path: "/name", value: "x" }] });
		assert.equal(loading.code, "loading");
		assert.equal((await call("b", "read_deck")).code, "loading");
		const state = await host("b");
		await page.evaluate((setup) => { window.notifyView("b", "ui/notifications/tool-input", { arguments: setup.arguments }); window.notifyView("b", "ui/notifications/tool-result", setup.result); }, state.setup);
		await view("b").locator("#deck-canvas svg").first().waitFor({ timeout: 60000 });
		const a = await call("a", "read_deck");
		const b = await call("b", "read_deck");
		assert.notEqual(a.session, b.session, "two show_deck calls without a session key are two sessions");
		const edit = await call("b", "edit_deck", { expectedRevision: b.revision, operations: [{ op: "replace", path: "/name", value: "Only in B" }] });
		assert.equal(edit.ok, true);
		assert.equal((await call("a", "read_deck")).revision, a.revision, "view a is untouched");
		assert.equal((await call("b", "read_deck")).name, "Only in B");
		assert.equal(await view("a").locator("#deck-note").isVisible(), false, "independent decks do not supersede each other");
	});

	await run("a newer view of the same session supersedes the older one: greyed out, read-only, silent, its tools refuse", async () => {
		const { session } = await call("a", "read_deck");
		const contextBefore = (await host("a")).context.length;
		await open("a2", "show_deck", { document: deck, session });
		assert.equal((await call("a2", "read_deck")).session, session);
		await view("a").locator("#deck-note").waitFor({ timeout: 15000 });
		assert.match(await view("a").locator("#deck-note").innerText(), /newer viewer of this deck is open/);
		assert.equal(await frameOf("a").evaluate(() => getComputedStyle(document.querySelector(".deck-bar")).opacity), "0.5");
		assert.equal(await view("a").locator("#deck-send").isDisabled(), true);
		const refused = await call("a", "edit_deck", { expectedRevision: "sha256:x", operations: [{ op: "replace", path: "/name", value: "x" }] });
		assert.equal(refused.code, "superseded");
		assert.equal((await call("a", "read_deck")).code, "superseded");
		// It publishes nothing more: an edit there (the editor is read-only, and the host gets no context or message from it).
		assert.equal(await frameOf("a").evaluate(() => document.querySelector("#deck-title input")?.readOnly || document.querySelector("#deck-title input")?.disabled || !document.querySelector("#deck-title input")), true);
		await page.waitForTimeout(1500);
		const after = await host("a");
		assert.equal(after.context.length, contextBefore, "no model context after supersession");
		assert.equal(after.messages.length, 0);
		// The other session (b) did not hear it, and the newest view works.
		assert.equal(await view("b").locator("#deck-note").isVisible(), false);
		assert.equal((await call("a2", "read_deck")).ok, true);
		await shoot("superseded", "a");
	});

	await run("after teardown the tools refuse and nothing is published", async () => {
		const response = await page.evaluate(() => window.callView("b", "ui/resource-teardown", {}));
		assert.deepEqual(response.result, {});
		assert.equal((await call("b", "read_deck")).code, "closed");
		assert.equal((await call("b", "edit_deck", { expectedRevision: "sha256:x", operations: [{ op: "remove", path: "/name" }] })).code, "closed");
		for (const name of ["a", "a2", "b"]) await page.evaluate((key) => document.querySelector(`iframe[name="${key}"]`).remove(), name);
	});

	await run("open_studio with {} opens a starter deck to edit, a bundled example and a way to paste a deck", async () => {
		const result = await open("studio", "open_studio", {}, { width: 1280, height: 800, hostName: "Claude" });
		assert.equal(result.structuredContent.studio, true);
		const state = await call("studio", "read_deck");
		assert.equal(state.name, "Untitled deck");
		assert.equal(state.slideCount, 2);
		assert.equal(state.checks.error, 0, JSON.stringify(state.checks));
		await view("studio").locator("#deck-start").waitFor();
		assert.equal(await view("studio").locator("#deck-paste").isVisible(), true);
		const options = await view("studio").locator("#deck-example option").count();
		assert.ok(options > 5, `${options} examples offered`);
		await shoot("studio-start", "studio");
		await view("studio").locator("#deck-example").selectOption("columns");
		await page.waitForFunction(() => window.hosts.studio.toolCalls.includes("get_catalog_record"), null, { timeout: 15000 });
		await view("studio").locator("#deck-status", { hasText: "Opened the example columns" }).waitFor({ timeout: 30000 });
		assert.notEqual((await call("studio", "read_deck")).name, "Untitled deck");
		await view("studio").locator("#deck-undo").click();
		assert.equal((await call("studio", "read_deck")).name, "Untitled deck", "Undo goes back to the starter deck");
		await view("studio").locator("#deck-paste").click();
		await view("studio").locator("#deck-source .cm-editor").waitFor();
		assert.match(await view("studio").locator("#deck-status").innerText(), /paste a deck/i);
	});

	await run("the expand control asks straight from the click, says the truth when refused, and offers the way back", async () => {
		const expand = view("studio").locator("#deck-expand");
		assert.equal(await expand.getAttribute("aria-label"), "Expand");
		// A click the page makes up (no user activation): the host refuses, and the label does not change.
		// (An evaluate counts as a gesture, so the click is made later, from a timer, after the transient activation of about 5 s lapsed.)
		await frameOf("studio").evaluate(() => { setTimeout(() => document.getElementById("deck-expand").click(), 7000); });
		await page.waitForFunction(() => window.hosts.studio.displayModes.length === 1, null, { timeout: 20000 });
		await page.waitForTimeout(500);
		assert.equal(await view("studio").locator("#deck-status").innerText(), "Claude kept the viewer in the conversation.", `host mode ${(await host("studio")).mode}`);
		assert.equal(await expand.getAttribute("aria-label"), "Expand");
		// The person's click: granted; the container is now fixed-height, so the view fills it; and the way back is offered.
		await expand.click();
		await view("studio").locator('#deck-expand[aria-label="Back to the conversation"]').waitFor();
		assert.equal(await frameOf("studio").evaluate(() => document.documentElement.dataset.fill), "true");
		await expand.click();
		await view("studio").locator('#deck-expand[aria-label="Expand"]').waitFor();
		assert.deepEqual((await host("studio")).displayModes, ["fullscreen", "fullscreen", "inline"]);
	});

	await run("lays out by the container's size at 320, 600 and 1280px with the host's safe-area insets, nothing scrolls sideways", async () => {
		const insets = { top: 12, right: 0, bottom: 16, left: 24 };
		for (const width of [320, 600, 1280]) {
			await page.evaluate(([px, value]) => {
				document.querySelector('iframe[name="studio"]').style.width = `${px}px`;
				document.querySelector('iframe[name="studio"]').style.height = "760px";
				window.notifyView("studio", "ui/notifications/host-context-changed", { displayMode: "fullscreen", containerDimensions: { width: px, height: 760 }, safeAreaInsets: value });
			}, [width, insets]);
			await page.waitForTimeout(300);
			const fit = await frameOf("studio").evaluate(() => {
				const shell = getComputedStyle(document.getElementById("opf-deck"));
				const right = Math.max(...[...document.querySelectorAll(".deck-bar > *, .deck-foot > *, .deck-start > *")].filter((item) => item.offsetParent).map((item) => item.getBoundingClientRect().right));
				return { scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, size: document.documentElement.dataset.size, padding: [shell.paddingTop, shell.paddingRight, shell.paddingBottom, shell.paddingLeft], right, send: document.getElementById("deck-send").getBoundingClientRect().right };
			});
			assert.ok(fit.scroll <= fit.client, `${width}px: the page is ${fit.scroll}px wide in ${fit.client}px`);
			assert.ok(fit.right <= fit.client + 0.5, `${width}px: every control ends inside the frame (${fit.right})`);
			assert.ok(fit.send <= fit.client, `${width}px: Send ends at ${fit.send}`);
			assert.deepEqual(fit.padding, ["12px", "0px", "16px", "24px"], `${width}px: the insets pad the view`);
			assert.equal(fit.size, width < 400 ? "compact narrow tiny" : width < 640 ? "compact narrow" : "wide");
			await shoot(`studio-${width}`, "studio");
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
		for (const [mode, words] of [["denied", "The download didn't finish."], ["rpc-error", "The download couldn't be confirmed."]]) {
			await open(`dl-${mode}`, "show_deck", { document: plain, view: "source" }, { download: mode });
			await view(`dl-${mode}`).getByRole("button", { name: "Download source", exact: true }).click();
			await view(`dl-${mode}`).locator("#deck-status", { hasText: words }).waitFor({ timeout: 15000 });
			assert.doesNotMatch(await view(`dl-${mode}`).locator("#deck-status").innerText(), /nothing was saved/i);
			await shoot(`download-${mode}`, `dl-${mode}`);
		}
	});

	await run("messages: sent for approval, refused or unconfirmed, and Send stays usable to try again", async () => {
		for (const [mode, sync, status] of [["accepted", "Sent to Claude for your approval", ""], ["denied", "Claude didn't take the message", "You can send it again"], ["rpc-error", "The message couldn't be confirmed", "You can send it again"]]) {
			const name = `msg-${mode}`;
			await open(name, "show_deck", { document: deck }, { message: mode, hostName: "Claude" });
			const title = view(name).locator("#deck-title input");
			await title.fill(`Edited for ${mode}`);
			await title.press("Enter");
			const send = view(name).locator("#deck-send");
			await send.click();
			await view(name).locator("#deck-sync", { hasText: sync }).waitFor({ timeout: 15000 });
			if (status) assert.match(await view(name).locator("#deck-status").innerText(), new RegExp(status));
			const sent = (await host(name)).messages;
			assert.equal(sent.length, 1);
			assert.ok(sent[0].content[0].text.length < 8000 && !/\n{4}| {65}/.test(sent[0].content[0].text), "within the message limits, pointing at the deck");
			assert.doesNotMatch(sent[0].content[0].text, /"slides"/, "the deck goes as context, not in the message");
			assert.equal(await send.isDisabled(), false, "Send stays usable for a retry");
			assert.equal(await send.getAttribute("data-unsent"), String(mode !== "accepted"));
			await shoot(`message-${mode}`, name);
		}
	});

	await run("the tool definitions never change while the views are used", async () => {
		const name = "msg-accepted";
		const again = await page.evaluate((key) => window.callView(key, "tools/list", {}), name);
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
