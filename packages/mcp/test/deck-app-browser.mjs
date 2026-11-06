// The deck view (show_deck's MCP App, ui://opf/deck) in Chromium, the way an MCP Apps host runs it: a host page on one origin
// frames the view on another, in an iframe with the sandbox flags SEP-1865 requires (allow-scripts allow-same-origin) and the
// restrictive default CSP a host must apply to a resource that declares no `ui.csp` (no network, no font-src, no eval, no
// WASM). The host speaks the protocol by hand (ui/initialize, tool-input, tool-result) and relays the view's tools/call to the
// real server (createOpfServer with the stdio font reader) over an in-memory MCP client. Run it after `pnpm run build`:
//   node test/deck-app-browser.mjs
// OPF_DECK_APP_SCREENSHOTS=<directory> also saves a screenshot of each view (Preview, Source, Both; light and dark) there.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { chromium } from "playwright";
import { createOpfServer } from "../dist/index.js";
import { installedFontFiles } from "../dist/stdio.js";

// SEP-1865, "Restrictive Default": what a host must use when the resource declares no ui.csp (the view declares none).
const VIEW_CSP = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'self'";

const server = createOpfServer({ version: "0.0.0-test", deckApp: { readFontFile: installedFontFiles() } });
const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
await server.connect(serverSide);
const client = new Client({ name: "deck-app-browser", version: "1.0.0" });
await client.connect(clientSide);

const resource = (await client.readResource({ uri: "ui://opf/deck" })).contents[0];
assert.equal(resource.mimeType, "text/html;profile=mcp-app");
assert.equal(resource._meta?.ui?.csp, undefined, "the view declares no CSP domains: it needs none");

// The host page: frames the view and answers it. Everything the view asks for is recorded on window.host for the test to read.
const HOST_PAGE = `<!doctype html><meta charset="utf-8"><title>host</title><style>body{margin:0}iframe{border:0;width:960px;height:640px}</style>
<iframe id="view" sandbox="allow-scripts allow-same-origin"></iframe>
<script>
window.host = { requests: [], context: [], messages: [], toolCalls: [], displayModes: [] };
const frame = document.getElementById("view");
const send = (message) => frame.contentWindow.postMessage({ jsonrpc: "2.0", ...message }, "*");
let initialized = false;
window.startView = (setup) => {
  window.setup = setup;
  initialized = false;
  frame.src = setup.viewUrl;
};
window.addEventListener("message", async (event) => {
  if (event.source !== frame.contentWindow) return;
  const message = event.data;
  if (!message || message.jsonrpc !== "2.0") return;
  host.requests.push(message.method ?? "response");
  const reply = (result) => send({ id: message.id, result });
  switch (message.method) {
    case "ui/initialize":
      return reply({
        protocolVersion: "2026-01-26",
        hostInfo: { name: "test-host", version: "1.0.0" },
        hostCapabilities: { serverTools: {}, serverResources: {}, logging: {}, openLinks: {}, updateModelContext: { text: {}, structuredContent: {} }, message: { text: {} } },
        hostContext: { theme: setup.theme, displayMode: "inline", availableDisplayModes: ["inline", "fullscreen"], containerDimensions: { width: 960, maxHeight: 640 }, platform: "web" },
      });
    case "ui/notifications/initialized":
      initialized = true;
      send({ method: "ui/notifications/tool-input", params: { arguments: setup.arguments } });
      send({ method: "ui/notifications/tool-result", params: setup.result });
      return;
    case "tools/call": {
      host.toolCalls.push(message.params.name);
      try {
        return reply(await window.callServer(message.params));
      } catch (error) {
        return send({ id: message.id, error: { code: -32603, message: String(error) } });
      }
    }
    case "ui/update-model-context":
      host.context.push(message.params);
      return reply({});
    case "ui/message":
      host.messages.push(message.params);
      return reply({});
    case "ui/request-display-mode":
      host.displayModes.push(message.params.mode);
      reply({ mode: message.params.mode });
      return send({ method: "ui/notifications/host-context-changed", params: { displayMode: message.params.mode } });
    case "ping":
      return reply({});
    default:
      if (message.id !== undefined && message.method) send({ id: message.id, error: { code: -32601, message: "Method not found: " + message.method } });
  }
});
</script>`;

const listen = (handler) =>
	new Promise((resolve) => {
		const http = createServer(handler);
		http.listen(0, "127.0.0.1", () => resolve(http));
	});
const hostHttp = await listen((_request, response) => response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(HOST_PAGE));
// The view is served from another origin (localhost, not 127.0.0.1), with the CSP header, as a host's sandbox domain serves it.
const viewHttp = await listen((_request, response) => response.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-security-policy": VIEW_CSP }).end(resource.text));
const hostUrl = `http://127.0.0.1:${hostHttp.address().port}/`;
const viewUrl = `http://localhost:${viewHttp.address().port}/view`;

const browser = await chromium.launch(process.env.OPF_BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.OPF_BROWSER_EXECUTABLE_PATH } : {});
const failures = [];
try {
	const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
	const problems = [];
	page.on("console", (message) => {
		if (message.type() === "error" || /Content Security Policy|Refused to/.test(message.text())) problems.push(message.text());
	});
	page.on("pageerror", (error) => problems.push(String(error)));
	await page.exposeFunction("callServer", (params) => client.callTool(params));
	await page.goto(hostUrl);
	const view = () => page.frameLocator("#view");
	const hostState = () => page.evaluate(() => window.host);
	const shots = process.env.OPF_DECK_APP_SCREENSHOTS;
	if (shots) mkdirSync(shots, { recursive: true });
	const shoot = async (name) => {
		if (shots) await page.locator("#view").screenshot({ path: path.join(shots, `${name}.png`) });
	};

	const open = async (args, theme = "light") => {
		const result = await client.callTool({ name: "show_deck", arguments: args });
		await page.evaluate((setup) => {
			window.host = { requests: [], context: [], messages: [], toolCalls: [], displayModes: [] };
			window.startView(setup);
		}, { viewUrl, arguments: args, result, theme });
		await page.waitForFunction(() => window.host.context.length > 0, null, { timeout: 60000 });
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

	// A deck in the default font scheme (Aptos, drawn with the vendored Intos faces): the view must get them through read_font_file.
	const deck = {
		name: "Quarterly update",
		language: "en-US",
		slides: [
			{ id: "intro", title: "Revenue grew 18% in Q3", blocks: [{ text: "Driven by the enterprise plan and lower churn." }] },
			{ id: "next", title: "What we do next", blocks: [{ items: ["Hire two account executives", "Ship the usage dashboard", "Renegotiate the hosting contract"] }] },
		],
	};

	await run("draws a JSON deck under the restrictive CSP, with fonts from read_font_file", async () => {
		await open({ document: deck });
		await view().locator("#deck-canvas svg").first().waitFor({ timeout: 60000 });
		const text = await view().locator("#deck-canvas").innerText();
		assert.match(text, /Revenue grew 18% in Q3/);
		const state = await hostState();
		assert.ok(state.toolCalls.includes("read_font_file"), `the deck's Intos faces come from the server (calls: ${state.toolCalls.join(", ")})`);
		const fontsLoaded = await page.frame({ url: /\/view$/ }).evaluate(async () => {
			await document.fonts.ready;
			return [...document.fonts].filter((face) => face.status === "loaded").map((face) => face.family);
		});
		assert.ok(fontsLoaded.some((family) => /Intos/.test(family)), `Intos is registered as bytes (loaded: ${fontsLoaded.join(", ")})`);
		assert.ok(fontsLoaded.some((family) => /Roboto/.test(family)), "Roboto, the startup face, is registered");
		await shoot("preview-light");
	});

	await run("tells the model what the viewer shows and what its checks found", async () => {
		const [first] = (await hostState()).context;
		const text = first.content[0].text;
		assert.match(text, /The OPF viewer shows the deck you sent \(2 slides, slide 1 open, preview view\)/);
		assert.match(text, /Checks in the viewer: \d+ errors, \d+ warnings/);
		assert.equal(first.structuredContent.edited, false);
		assert.equal(first.structuredContent.document, undefined, "an unedited deck is not sent back");
		assert.equal(await view().locator("#deck-checks").isVisible(), true);
	});

	await run("switches between Preview, Source and Both", async () => {
		assert.equal(await view().locator("#deck-source").isVisible(), false);
		await view().locator("#tab-source").click();
		await view().locator("#deck-source .cm-editor").waitFor();
		assert.match(await view().locator("#deck-source .cm-content").innerText(), /"Revenue grew 18% in Q3"/);
		assert.equal(await view().locator(".deck-stage-col").isVisible(), false);
		await shoot("source-light");
		await view().locator("#tab-both").click();
		assert.equal(await view().locator("#deck-source").isVisible(), true);
		assert.equal(await view().locator(".deck-stage-col").isVisible(), true);
		assert.equal(await view().locator("#tab-both").getAttribute("aria-selected"), "true");
		// 960px is room enough for side by side: Both does not ask the host for fullscreen.
		assert.deepEqual((await hostState()).displayModes, []);
		await shoot("both-light");
		await view().locator("#tab-preview").click();
		assert.equal(await view().locator("#deck-source").isVisible(), false);
	});

	await run("an edit goes back to the model as the whole deck, and Send to Claude starts a turn", async () => {
		const title = view().locator("#deck-title input");
		await title.fill("Q3 board update");
		await title.press("Enter");
		await page.waitForFunction(() => window.host.context.some((update) => update.structuredContent?.edited), null, { timeout: 15000 });
		const update = (await hostState()).context.findLast((item) => item.structuredContent?.edited);
		assert.equal(update.structuredContent.document.name, "Q3 board update");
		assert.match(update.content[0].text, /The user edited the deck in the OPF viewer/);
		assert.match(update.content[0].text, /"name": "Q3 board update"/);
		const send = view().locator("#deck-send");
		assert.equal(await send.isVisible(), true);
		await send.click();
		await page.waitForFunction(() => window.host.messages.length === 1, null, { timeout: 15000 });
		assert.match((await hostState()).messages[0].content[0].text, /I edited the deck in the OPF viewer/);
	});

	await run("opens a YAML deck in the view named by the arguments, on the slide asked for, in the host's dark theme", async () => {
		const yaml = "name: From YAML\nlanguage: en-US\nslides:\n  - title: First YAML slide\n  - title: Second YAML slide\n";
		await open({ document: yaml, format: "yaml", view: "both", slide: 2 }, "dark");
		await view().locator("#deck-source .cm-editor").waitFor();
		assert.match(await view().locator("#deck-source .cm-content").innerText(), /title: Second YAML slide/);
		await view().locator("#deck-canvas", { hasText: "Second YAML slide" }).waitFor({ timeout: 30000 });
		assert.equal(await page.frame({ url: /\/view$/ }).evaluate(() => document.documentElement.dataset.theme), "dark");
		assert.match((await hostState()).context[0].content[0].text, /2 slides, slide 2 open, both view/);
		await shoot("both-dark");
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
