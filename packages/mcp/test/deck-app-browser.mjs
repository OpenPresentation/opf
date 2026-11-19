// The deck view (show_deck's MCP App, ui://opf/deck) in Chromium, the way an MCP Apps host runs it: a host page on one origin
// frames the view on another, in an iframe with the sandbox flags SEP-1865 requires (allow-scripts allow-same-origin) and the
// restrictive default CSP a host must apply to a resource that declares no `ui.csp` (no network, no font-src, no eval, no
// WASM). The host speaks the protocol by hand (ui/initialize, tool-input, tool-result) and relays the view's tools/call to the
// real server (createOpfServer with the stdio font reader) over an in-memory MCP client. Run it after `pnpm run build`:
//   node test/deck-app-browser.mjs
// OPF_DECK_APP_SCREENSHOTS=<directory> also saves a screenshot of each view (Preview, Source, Both; light and dark; a chat column
// in a host's own colours) there.
// OPF_MCP_URL=<endpoint> drives a server over Streamable HTTP instead, a hosted one such as https://openpresentation.org/mcp or a
// local Workers preview (http://127.0.0.1:8787/mcp): the same checks, with its own viewer page and fonts. Node's fetch needs
// NODE_USE_ENV_PROXY=1 behind a proxy.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { chromium } from "playwright";
import { createOpfServer } from "../dist/index.js";
import { installedFontFiles } from "../dist/stdio.js";
import { minifyAppCss } from "../scripts/app-css.mjs";
import { canonicalCssomRules } from "./helpers/app-cssom.mjs";

const require = createRequire(import.meta.url);
const rawViewCss = [readFileSync(require.resolve("@openpresentation/opf-editor/styles.css"), "utf8"), readFileSync(new URL("../app/view.css", import.meta.url), "utf8")].join("\n");
const cssLiteralSource = '/*! @license preserved browser control */\n.css-literal[data-label=" x  y "]::before { content: "a  b 日本語 </style>"; --literal: " x  y "; margin: calc(1px + 2px); }';
const cssLiteralMinified = await minifyAppCss(cssLiteralSource);

// SEP-1865, "Restrictive Default": what a host must use when the resource declares no ui.csp (the view declares none).
const VIEW_CSP = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'self'";

const remote = process.env.OPF_MCP_URL;
const client = new Client({ name: "deck-app-browser", version: "1.0.0" });
if (remote) await client.connect(new StreamableHTTPClientTransport(new URL(remote)));
else {
	const server = createOpfServer({ version: "0.0.0-test", deckApp: { readFontFile: installedFontFiles() } });
	const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
	await server.connect(serverSide);
	await client.connect(clientSide);
}
console.log(`# server: ${remote ?? "in memory"} (${client.getServerVersion()?.name} ${client.getServerVersion()?.version})`);

const viewUri = (await client.listTools()).tools.find((tool) => tool.name === "show_deck")._meta.ui.resourceUri;
const resource = (await client.readResource({ uri: viewUri })).contents[0];
assert.equal(resource.mimeType, "text/html;profile=mcp-app");
assert.equal(resource._meta?.ui?.csp, undefined, "the view declares no CSP domains: it needs none");

// The host page: frames the view and answers it. Everything the view asks for is recorded on window.host for the test to read.
const HOST_PAGE = `<!doctype html><meta charset="utf-8"><title>host</title><style>body{margin:0}iframe{border:0;width:960px;height:640px}</style>
<iframe id="view" sandbox="allow-scripts allow-same-origin"></iframe>
<script>
window.host = { requests: [], context: [], messages: [], toolCalls: [], displayModes: [], downloads: [] };
const frame = document.getElementById("view");
const send = (message) => frame.contentWindow.postMessage({ jsonrpc: "2.0", ...message }, "*");
let initialized = false;
window.startView = (setup) => {
  window.setup = setup;
  initialized = false;
  frame.style.width = setup.width ? setup.width + "px" : "";
  frame.style.height = "";
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
        hostInfo: { name: setup.hostName ?? "test-host", version: "1.0.0" },
        hostCapabilities: { serverTools: {}, serverResources: {}, logging: {}, openLinks: {}, updateModelContext: { text: {}, structuredContent: {} }, message: { text: {} }, ...(setup.download || setup.downloadMode ? { downloadFile: {} } : {}) },
        hostContext: { theme: setup.theme, displayMode: "inline", availableDisplayModes: ["inline", "fullscreen"], containerDimensions: { width: setup.width ?? 960, maxHeight: 640 }, platform: "web", ...(setup.variables ? { styles: { variables: setup.variables } } : {}) },
      });
    case "ui/notifications/size-changed":
      // A host gives an inline view the height it asks for, up to the maximum it named.
      if (message.params.height) frame.style.height = Math.min(640, Math.ceil(message.params.height)) + "px";
      return;
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
    case "ui/download-file":
      host.downloads.push(message.params);
      if (setup.downloadMode === "rpc-error") return send({ id: message.id, error: { code: -32000, message: "Download denied by the test host" } });
      return reply(setup.downloadMode === "denied" || setup.downloadMode === "cancelled" ? { isError: true } : {});
    case "ui/message":
      host.messages.push(message.params);
      return reply({});
    case "ui/request-display-mode": {
      host.displayModes.push(message.params.mode);
      // As Claude does: only right after a press in the view (user activation); otherwise the mode stays and is the answer.
      if (!navigator.userActivation.isActive) return reply({ mode: host.mode ?? "inline" });
      host.mode = message.params.mode;
      reply({ mode: host.mode });
      return send({ method: "ui/notifications/host-context-changed", params: { displayMode: host.mode, containerDimensions: host.mode === "fullscreen" ? { width: 960, height: 640 } : { width: setup.width ?? 960, maxHeight: 640 } } });
    }
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
	const browserDownloads = [];
	page.on("download", (download) => browserDownloads.push(download.suggestedFilename()));
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

	const open = async (args, theme = "light", host = {}) => {
		const result = await client.callTool({ name: "show_deck", arguments: args });
		await page.evaluate((setup) => {
			window.host = { requests: [], context: [], messages: [], toolCalls: [], displayModes: [], downloads: [] };
			window.startView(setup);
		}, { viewUrl, arguments: args, result, theme, ...host });
		await page.waitForFunction(() => window.host.context.length > 0, null, { timeout: 60000 });
	};
	const probeIframeDownload = async () => page.frame({ url: /\/view$/ }).evaluate(() => {
		window.downloadProbe = { blobs: 0, anchors: 0 };
		const create = URL.createObjectURL.bind(URL);
		URL.createObjectURL = (...args) => { window.downloadProbe.blobs++; return create(...args); };
		document.addEventListener("click", (event) => {
			if (event.target.closest?.("a[download]")) window.downloadProbe.anchors++;
		}, true);
	});
	const noIframeDownload = async () => {
		assert.deepEqual(await page.frame({ url: /\/view$/ }).evaluate(() => window.downloadProbe), { blobs: 0, anchors: 0 }, "source downloads never use an iframe Blob/anchor fallback");
		assert.deepEqual(browserDownloads, [], "the iframe never directly downloads a file");
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
		// This producer-specific equivalence proof owns the local resource bytes.
		// A remote server supplies its own versioned View; its existing cases below
		// continue to qualify that View without claiming it uses this checkout's CSS.
		if (!remote) {
			const css = await page.frame({ url: /\/view$/ }).evaluate(({ html, raw, literal, minifiedLiteral }) => {
				const snapshot = (rules) => [...rules].map((rule) => {
					if (rule.style) return { type: rule.type, selector: rule.selectorText ?? rule.keyText, declarations: [...rule.style].map((name) => [name, rule.style.getPropertyValue(name), rule.style.getPropertyPriority(name)]), ...(rule.cssRules ? { rules: snapshot(rule.cssRules) } : {}) };
					if (rule.cssRules) return { type: rule.type, header: rule.cssText.slice(0, rule.cssText.indexOf("{")).trim(), rules: snapshot(rule.cssRules) };
					return { type: rule.type, text: rule.cssText };
				});
				const rules = (text) => { const sheet = new CSSStyleSheet(); sheet.replaceSync(text); return snapshot(sheet.cssRules); };
				// CodeMirror prepends its own style tag after initialization. Bind the
				// actual resource's sole static stylesheet, not the first live tag.
				const sourceStyles = new DOMParser().parseFromString(html, "text/html").head.querySelectorAll("style");
				if (sourceStyles.length !== 1) throw new Error("Expected one resource stylesheet");
				const served = [...document.head.querySelectorAll("style")].filter((style) => style.textContent === sourceStyles[0].textContent);
				if (served.length !== 1 || !served[0].sheet) throw new Error("Missing or ambiguous served resource stylesheet");
				return { raw: rules(raw), served: snapshot(served[0].sheet.cssRules), literal: rules(literal), minifiedLiteral: rules(minifiedLiteral) };
			}, { html: resource.text, raw: rawViewCss, literal: cssLiteralSource, minifiedLiteral: cssLiteralMinified });
			assert.ok(css.raw.length > 0, "the complete real concatenated stylesheet is parsed");
			assert.deepEqual(canonicalCssomRules(css.served), canonicalCssomRules(css.raw), "served whitespace-minified CSS preserves every parsed selector/declaration/value/cascade rule");
			assert.deepEqual(canonicalCssomRules(css.minifiedLiteral), canonicalCssomRules(css.literal), "literal/custom-property whitespace and inline-style escapes retain their CSS meaning");
		}
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
		// The footer's verdict is the editor's review pill, with the counts of its own review; the slide navigator and the version follow.
		await view().locator("#deck-verdict .opf-review-pill").waitFor();
		assert.match(await view().locator(".deck-foot #deck-nav .opf-nav-counter").innerText(), /^0?1 \/ 0?2$/);
		assert.match(await view().locator("#deck-version").innerText(), /^OPF \d+\.\d+\.\d+/);
	});

	// RR-111: a deck's set icons come from the server through the app-only read_icons; the view's checks then know every icon name.
	await run("draws set icons read through read_icons, and checks icon names as the server does", async () => {
		const iconDeck = { name: "Launch plan", language: "en-US", slides: [{ id: "launch", title: "Launch", items: [{ text: "Ship it", icon: "lucide:rocket" }, { text: "Check it", icon: "lucide:chek" }] }] };
		await open({ document: iconDeck });
		await view().locator("#deck-canvas svg").first().waitFor({ timeout: 60000 });
		const state = await hostState();
		assert.ok(state.toolCalls.includes("read_icons"), `the icons come from the server (calls: ${state.toolCalls.join(", ")})`);
		const text = state.context[0].content[0].text;
		assert.match(text, /warning opf\/icon-unknown at \/slides\/0\/items\/1\/icon: The icon set lucide has no icon chek\./);
		assert.doesNotMatch(text, /items\/0\/icon/, "an icon the set has is not reported");
		const server = (await client.callTool({ name: "validate_deck", arguments: { document: iconDeck } })).structuredContent;
		const fromServer = server?.findings?.filter((finding) => finding.ruleId === "opf/icon-unknown").map((finding) => finding.message);
		if (fromServer) assert.deepEqual(state.context[0].structuredContent.findings.filter((finding) => finding.ruleId === "opf/icon-unknown").map((finding) => finding.message), fromServer);
		await shoot("icons-light");
		await open({ document: deck });
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

	await run("manual edits reach the model as context and Ask sends the typed request", async () => {
		const send = view().locator("#deck-send");
		assert.equal(await send.isDisabled(), false, "a request can start from the original deck");
		assert.equal(await view().locator("#deck-undo").isDisabled(), true);
		const title = view().locator("#deck-title input");
		await title.fill("Q3 board update");
		await title.press("Enter");
		await page.waitForFunction(() => window.host.context.some((update) => update.structuredContent?.edited), null, { timeout: 15000 });
		// The footer says where the edits are: with the model, without a click.
		await view().locator('#deck-sync[data-state="shared"]').waitFor({ state: "attached" });
		assert.equal(await view().locator("#deck-sync").textContent(), "The assistant can see this version");
		assert.equal(await view().locator("#deck-sync").isVisible(), false);
		const update = (await hostState()).context.findLast((item) => item.structuredContent?.edited);
		assert.equal(update.structuredContent.document.name, "Q3 board update");
		assert.match(update.content[0].text, /The user edited the deck in the OPF viewer/);
		assert.match(update.content[0].text, /"name": "Q3 board update"/);
		assert.equal(await send.isVisible(), true);
		assert.equal(await send.getAttribute("data-unsent"), "true", "Send is the primary action while there are unsent edits");
		await send.click();
		assert.equal(await view().getByRole("textbox", { name: /What should change on slide/ }).evaluate(el => el === document.activeElement), true);
		assert.equal((await hostState()).messages.length, 0);
		await view().locator("#deck-instruction").fill("Shorten the title");
		await view().locator("#deck-instruction").press("Enter");
		await page.waitForFunction(() => window.host.messages.length === 1, null, { timeout: 15000 });
		assert.match((await hostState()).messages[0].content[0].text, /In the open deck, on slide \d+: Shorten the title/);
		await view().locator('#deck-sync[data-state="sent"]').waitFor({ state: "attached" });
		assert.equal(await view().locator("#deck-status").innerText(), "Sent to the assistant", "another host took it: no more is claimed (in Claude it reads \"Sent to Claude for your approval\")");
		assert.equal(await send.isDisabled(), false, "Send stays usable, to send again");
		assert.equal(await send.getAttribute("data-unsent"), "false", "and is no longer the primary action");
	});

	await run("Undo and Redo, Find, the Review panel and the Design menu are the editor's own", async () => {
		const title = view().locator("#deck-title input");
		await view().locator("#deck-undo").click();
		await page.waitForFunction(() => window.host.context.at(-1)?.structuredContent?.document?.name === "Quarterly update", null, { timeout: 15000 });
		assert.equal(await title.inputValue(), "Quarterly update", "Undo takes the rename back, and the model hears it");
		assert.equal(await view().locator("#deck-redo").isDisabled(), false);
		await view().locator("#deck-redo").click();
		await page.waitForFunction(() => window.host.context.at(-1)?.structuredContent?.document?.name === "Q3 board update", null, { timeout: 15000 });

		assert.equal(await view().locator("#deck-find").isVisible(), false);
		await view().locator("#deck-find-open").click();
		const field = view().locator("#deck-find input").first();
		await field.waitFor();
		await field.fill("churn");
		assert.equal(await view().locator("#deck-find").isVisible(), true);
		await shoot("find-light");
		await field.press("Escape");
		await view().locator("#deck-find").waitFor({ state: "hidden" });

		await view().locator("#deck-verdict .opf-review-pill").click();
		await view().locator("#deck-review").waitFor();
		assert.ok((await view().locator("#deck-review-panel").innerText()).trim().length > 0, "the Review panel lists its checks");
		await shoot("review-light");
		await view().locator("#deck-review-close").click();
		await view().locator("#deck-review").waitFor({ state: "hidden" });

		await view().locator(".opf-design-menu-trigger").click();
		await view().locator(".opf-design-menu-popover").waitFor();
		await shoot("design-light");
		const theme = view().locator('.opf-design-menu-item[data-section="theme"][aria-checked="false"]').first();
		const chosen = await theme.getAttribute("data-value");
		await theme.click();
		await page.waitForFunction((id) => window.host.context.at(-1)?.structuredContent?.document?.design?.theme === id, chosen, { timeout: 15000 });
	});

	await run("renames the deck over its row at 1280, 600 and 320px: Save, Cancel, Escape, blur keeps the draft, one undoable edit", async () => {
		const named = { ...deck, name: "Rename me" };
		await open({ document: named }, "light", { hostName: "Claude" });
		await view().locator("#deck-canvas svg").first().waitFor({ timeout: 60000 });
		const frame = page.frame({ url: /\/view$/ });
		const input = view().locator("#deck-title input");
		const editing = view().locator(".opf-title[data-editing]");
		const lastName = () => page.evaluate(() => window.host.context.at(-1)?.structuredContent?.document?.name);
		for (const width of [1280, 600, 320]) {
			await page.evaluate((px) => {
				document.getElementById("view").style.width = `${px}px`;
				send({ method: "ui/notifications/host-context-changed", params: { containerDimensions: { width: px, maxHeight: 640 } } });
			}, width);
			await page.waitForTimeout(300);
			const before = await input.inputValue();
			await input.click();
			await editing.waitFor();
			const placed = await frame.evaluate(() => {
				const overlay = document.querySelector(".opf-title[data-editing]").getBoundingClientRect();
				const row = document.querySelector("[data-opf-title-row]");
				const outer = row.getBoundingClientRect();
				const edge = getComputedStyle(row);
				// The padding box: the row keeps its own border (the bar's rule under it).
				const box = { left: outer.left + parseFloat(edge.borderLeftWidth), top: outer.top + parseFloat(edge.borderTopWidth), right: outer.right - parseFloat(edge.borderRightWidth), bottom: outer.bottom - parseFloat(edge.borderBottomWidth) };
				const buttons = [...document.querySelectorAll(".opf-title[data-editing] .opf-title-button")].map((button) => { const rect = button.getBoundingClientRect(); return { text: button.textContent, width: rect.width, height: rect.height, right: rect.right }; });
				const shell = document.getElementById("opf-deck").getBoundingClientRect();
				return { row: row.id || row.className, overlay: [overlay.left, overlay.top, overlay.right, overlay.bottom], box: [box.left, box.top, box.right, box.bottom], buttons, client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, shellTop: shell.top, hidden: [...row.children].filter((child) => !child.contains(document.querySelector(".opf-title")) && getComputedStyle(child).visibility !== "hidden" && child.getBoundingClientRect().width > 0).length };
			});
			assert.equal(placed.row, width < 640 ? "deck-title-row" : "deck-bar", `${width}px: the edit opens over the ${width < 640 ? "name's own row" : "bar"}`);
			assert.deepEqual(placed.overlay.map(Math.round), placed.box.map(Math.round), `${width}px: the edit covers its row exactly`);
			assert.equal(placed.hidden, 0, `${width}px: the row's other controls give way`);
			assert.deepEqual(placed.buttons.map((button) => button.text), ["Save", "Cancel"]);
			assert.ok(placed.buttons.every((button) => button.right <= placed.client), `${width}px: Save and Cancel are inside the frame`);
			assert.ok(placed.scroll <= placed.client && placed.overlay[1] >= placed.shellTop, `${width}px: nothing is clipped or scrolls sideways`);
			if (width === 320) assert.ok(placed.buttons.every((button) => button.width >= 44 && button.height >= 44), `320px: Save and Cancel are at least 44px (${JSON.stringify(placed.buttons)})`);
			await input.fill(`Renamed at ${width}`);
			await shoot(`rename-${width}`);
			// Leaving the field keeps the edit open with the draft.
			await view().locator("#deck-stage").click({ position: { x: 4, y: 4 } });
			assert.equal(await editing.count(), 1, `${width}px: blur does not close the edit`);
			assert.equal(await input.inputValue(), `Renamed at ${width}`, "and keeps the draft");
			await view().locator('.opf-title-button[data-action="save"]').click();
			await editing.waitFor({ state: "detached" });
			await page.waitForFunction((name) => window.host.context.at(-1)?.structuredContent?.document?.name === name, `Renamed at ${width}`, { timeout: 15000 });
			// One undoable edit: Undo puts the name back, Redo brings the new one.
			await view().locator("#deck-undo").click();
			await page.waitForFunction((name) => window.host.context.at(-1)?.structuredContent?.document?.name === name, before, { timeout: 15000 });
			await view().locator("#deck-redo").click();
			await page.waitForFunction((name) => window.host.context.at(-1)?.structuredContent?.document?.name === name, `Renamed at ${width}`, { timeout: 15000 });
		}
		// Cancel and Escape put the name back and change nothing.
		for (const close of ["cancel", "escape"]) {
			const contexts = await page.evaluate(() => window.host.context.length);
			// (The field kept the focus after Save, so typing, not a click, opens the edit again.)
			await input.click();
			await input.fill(`Not kept (${close})`);
			await editing.waitFor();
			if (close === "cancel") await view().locator('.opf-title-button[data-action="cancel"]').click();
			else await input.press("Escape");
			await editing.waitFor({ state: "detached" });
			assert.equal(await input.inputValue(), "Renamed at 320");
			await page.waitForTimeout(1500);
			assert.equal(await page.evaluate(() => window.host.context.length), contexts, `${close}: nothing changed, so nothing new goes to the model`);
		}
		assert.equal(await lastName(), "Renamed at 320");
		await page.evaluate(() => {
			document.getElementById("view").style.width = "";
			send({ method: "ui/notifications/host-context-changed", params: { containerDimensions: { width: 960, maxHeight: 640 } } });
		});
	});

	await run("fits a frame as narrow as a chat column: the bar stays one row, nothing scrolls sideways", async () => {
		// Claude's chat column frames the view about 660 CSS pixels wide (860 on a wide desktop window); 420 is a phone.
		await view().locator("body").press("Escape");
		for (const width of [860, 660, 640, 600, 420]) {
			await page.evaluate((px) => {
				document.getElementById("view").style.width = `${px}px`;
			}, width);
			await page.waitForTimeout(150);
			const fit = await page.frame({ url: /\/view$/ }).evaluate(() => {
				const send = document.getElementById("deck-send").getBoundingClientRect();
				const bar = document.querySelector(".deck-bar").getBoundingClientRect();
				return { scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, sendRight: send.right, bar: bar.height };
			});
			assert.ok(fit.scroll <= fit.client, `${width}px: the page is ${fit.scroll}px wide in a ${fit.client}px frame`);
			assert.ok(fit.sendRight <= fit.client, `${width}px: Send ends at ${fit.sendRight}px`);
			if (width >= 640) assert.equal(fit.bar, 48, `${width}px: the bar is one 48px row`);
			if (width === 420) await shoot("narrow-420");
			if (width === 860) await shoot("narrow-860");
		}
		await page.evaluate(() => {
			document.getElementById("view").style.width = "";
		});
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

	await run("in a chat column with the host's own colours the whole view is one palette, and the open slide's thumbnail is in view", async () => {
		// The standard MCP Apps variables, as a dark host sends them (warm greys, like Claude's).
		const variables = { "--color-background-primary": "#262624", "--color-background-secondary": "#30302e", "--color-text-primary": "#faf9f5", "--color-text-secondary": "#c2c0b6", "--color-border-primary": "#4a4945", "--font-sans": "system-ui, sans-serif", "--font-mono": "ui-monospace, monospace" };
		const long = { name: "Field notes", language: "en-US", slides: Array.from({ length: 9 }, (_, index) => ({ id: `s${index + 1}`, title: `Slide number ${index + 1}`, blocks: [{ text: "One line of body text." }] })) };
		await open({ document: long, slide: 9 }, "dark", { variables, width: 660, hostName: "Claude", download: true });
		await view().locator("#deck-canvas", { hasText: "Slide number 9" }).waitFor({ timeout: 30000 });
		const frame = page.frame({ url: /\/view$/ });
		const seen = await frame.evaluate(async () => {
			await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
			const style = (selector) => getComputedStyle(document.querySelector(selector));
			const strip = document.querySelector("#deck-thumbs .opf-thumbs").getBoundingClientRect();
			const current = document.querySelector('#deck-thumbs [aria-current="true"]').getBoundingClientRect();
			return { shell: style("#opf-deck").backgroundColor, text: style("#opf-deck").color, title: style(".deck-foot").color, counter: style(".opf-nav-counter").color, design: style(".opf-design-menu-trigger").color, send: [document.getElementById("deck-send").getAttribute("aria-label"), document.getElementById("deck-send").innerText], strip: [strip.left, strip.right], current: [current.left, current.right], height: document.getElementById("opf-deck").getBoundingClientRect().height };
		});
		assert.equal(seen.shell, "rgb(38, 38, 36)", "the view's surface is the host's background");
		assert.equal(seen.text, "rgb(250, 249, 245)");
		assert.equal(seen.counter, "rgb(250, 249, 245)", "the editor's own parts take the same text colour");
		assert.equal(seen.design, "rgb(194, 192, 182)", "and its quiet icon buttons the same muted colour as the viewer's");
		assert.equal(seen.title, "rgb(194, 192, 182)", "muted text is the host's secondary text");
		assert.deepEqual(seen.send, ["Ask Claude to edit…", "Ask Claude to edit…"], "660px: Send says the whole sentence");
		assert.ok(seen.current[0] >= seen.strip[0] && seen.current[1] <= seen.strip[1] + 1, `the open slide's thumbnail is in the strip's view (${seen.current} in ${seen.strip})`);
		assert.ok(seen.height < 560, `inline, the view is as tall as its slide needs (${seen.height}px)`);
		await shoot("chat-dark-preview");
		// Both in a column this narrow stacks the slide over the source, and Download is offered where the host saves files.
		await view().locator("#tab-both").click();
		await view().locator("#deck-source .cm-editor").waitFor();
		const stacked = await frame.evaluate(() => {
			const stage = document.querySelector(".deck-stage-col").getBoundingClientRect();
			const source = document.getElementById("deck-source").getBoundingClientRect();
			return { stageBottom: stage.bottom, sourceTop: source.top };
		});
		assert.ok(stacked.sourceTop >= stacked.stageBottom - 1, "the slide is above the source");
		// The user asked for Both in a narrow frame: the view asks the host for full screen (a message, so it arrives a moment later).
		await page.waitForFunction(() => window.host.displayModes.length > 0, null, { timeout: 15000 });
		assert.deepEqual((await hostState()).displayModes, ["fullscreen"]);
		await shoot("chat-dark-both-fullscreen");
		await view().locator(".opf-source-action-download").click();
		await page.waitForFunction(() => window.host.downloads.length === 1, null, { timeout: 15000 });
		assert.match((await hostState()).downloads[0].contents[0].resource.uri, /\.opf\.json$/);
		await view().locator("#deck-expand").click();
		await page.waitForFunction(() => window.host.displayModes.length === 2);
		await shoot("chat-dark-both");
	});

	await run("exports PowerPoint, PDF and PNG in the sandbox and hands each file to the host", async () => {
		// The host of the last check saves files (ui/download-file), so the editor's Export menu is in the bar.
		const exported = async (format) => {
			const before = (await hostState()).downloads.length;
			await view().locator("#deck-export .opf-export-trigger").click();
			if (format === "pptx") await shoot("export-menu");
			await view().locator(`.opf-export-item[data-format="${format}"]`).click();
			await page.waitForFunction((count) => window.host.downloads.length > count, before, { timeout: 120000 });
			const { resource } = (await hostState()).downloads.at(-1).contents[0];
			return { ...resource, bytes: Buffer.from(resource.blob, "base64") };
		};
		const pptx = await exported("pptx");
		assert.match(pptx.uri, /^file:\/\/\/field-notes\.pptx$/i);
		assert.equal(pptx.bytes.subarray(0, 2).toString("latin1"), "PK", "a PowerPoint file is a ZIP archive");
		assert.ok(pptx.bytes.includes(Buffer.from("ppt/slides/slide9.xml")), "with the deck's nine slides");
		const pdf = await exported("pdf");
		assert.equal(pdf.mimeType, "application/pdf");
		assert.equal(pdf.bytes.subarray(0, 5).toString("latin1"), "%PDF-");
		assert.ok(pdf.bytes.length > 10_000);
		// PNG draws each slide through the browser's image decoder: a data: URL here, since the sandbox allows no blob: image.
		const png = await exported("png");
		assert.equal(png.bytes.subarray(0, 2).toString("latin1"), "PK", "nine PNG slides come as one ZIP archive");
		assert.ok(png.bytes.includes(Buffer.from("-009.png")));
	});

	await run("a host that cannot save files gets no Export menu, and a deck that cannot open says so in place of the slide", async () => {
		await open({ document: deck });
		await view().locator("#deck-canvas svg").first().waitFor({ timeout: 60000 });
		assert.equal(await view().locator("#deck-export").isVisible(), false);
		assert.equal(await view().locator(".opf-source-action-download").count() === 0 || !(await view().locator(".opf-source-action-download").isVisible()), true);
		const result = await client.callTool({ name: "show_deck", arguments: { document: deck } });
		await page.evaluate((setup) => {
			window.host = { requests: [], context: [], messages: [], toolCalls: [], displayModes: [], downloads: [] };
			window.startView(setup);
		}, { viewUrl, arguments: {}, result, theme: "light" });
		await view().locator('#deck-wait[data-failed="true"]').waitFor({ timeout: 30000 });
		assert.equal(await view().locator("#deck-wait-text").innerText(), "The assistant sent no deck.");
		assert.equal(await view().locator(".deck-wait-slide").isVisible(), false);
	});

	const downloadDeck = {
		name: "Download witness", language: "en-US", design: { fontScheme: "roboto" },
		slides: [{ id: "current", title: "Current content", blocks: [{ text: "Original body." }] }],
	};
	await run("Download source sends the exact edited JSON, MIME and filename through the capable host", async () => {
		await open({ document: downloadDeck, view: "both" }, "light", { downloadMode: "accepted" });
		const expected = structuredClone(downloadDeck);
		expected.slides[0].blocks[0].text = "The source body was edited and all of its words remain.";
		const text = JSON.stringify(expected, null, 2);
		const source = view().locator("#deck-source .cm-content");
		await source.click();
		await source.press("ControlOrMeta+A");
		await page.keyboard.insertText(text);
		await page.waitForFunction((body) => window.host.context.at(-1)?.structuredContent?.document?.slides?.[0]?.blocks?.[0]?.text === body, expected.slides[0].blocks[0].text, { timeout: 15000 });
		assert.deepEqual((await hostState()).context.at(-1).structuredContent.document, expected);
		assert.equal(await source.innerText(), text, "the current authored source is retained exactly");
		// Only visual line boundaries may change: every word and interior space must remain.
		const painted = (await view().locator("#deck-canvas").innerText()).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).join(" ");
		assert.equal(painted, expected.slides[0].title + " " + expected.slides[0].blocks[0].text);
		await view().getByRole("button", { name: "Rename deck", exact: true }).click();
		const filename = view().getByRole("textbox", { name: "File name", exact: true });
		await filename.fill("Q3#1 100%");
		await filename.press("Enter");
		await probeIframeDownload();
		await view().getByRole("button", { name: "Download source", exact: true }).click();
		await noIframeDownload();
		await page.waitForFunction(() => window.host.downloads.length === 1, null, { timeout: 15000 });
		// The name is the URI's last segment as written: no percent-encoding, and the characters a host would replace are replaced.
		assert.deepEqual((await hostState()).downloads, [{ contents: [{ type: "resource", resource: { uri: "file:///Q3_1-100_.opf.json", mimeType: "application/json", text } }] }]);
		assert.equal(await view().locator("#deck-status").innerText(), "Download started.", "the host started the download; nothing more is claimed");
		await shoot("host-download-edited-json");
		await view().locator("#deck-undo").click();
		await page.waitForFunction(() => window.host.context.at(-1)?.structuredContent?.document?.slides?.[0]?.blocks?.[0]?.text === "Original body.", null, { timeout: 15000 });
		assert.deepEqual((await hostState()).context.at(-1).structuredContent.document, downloadDeck);
		await view().locator("#deck-redo").click();
		await page.waitForFunction((body) => window.host.context.at(-1)?.structuredContent?.document?.slides?.[0]?.blocks?.[0]?.text === body, expected.slides[0].blocks[0].text, { timeout: 15000 });
		assert.deepEqual((await hostState()).context.at(-1).structuredContent.document, expected);
	});

	await run("host downloads preserve untouched JSON, YAML and Markdown source text and MIME", async () => {
		for (const [format, text, mimeType, extension] of [
			["json", '{\r\n  "name" : "Raw JSON",\r\n  "slides" : [{"title":"Raw source"}]\r\n}\r\n', "application/json", "json"],
			["yaml", '# Keep this YAML comment\nname: Raw YAML\nslides:\n  - title: Raw source\n', "text/yaml", "yaml"],
			["markdown", '---\nname: Raw Markdown\n---\n\n# Raw source\n\nKeep this Markdown sentence.\n', "text/markdown", "md"],
		]) {
			await open({ document: text, format, view: "source" }, "light", { downloadMode: "accepted" });
			await view().locator("#deck-source .cm-editor").waitFor();
			await probeIframeDownload();
			await view().getByRole("button", { name: "Download source", exact: true }).click();
			await noIframeDownload();
			await page.waitForFunction(() => window.host.downloads.length === 1, null, { timeout: 15000 });
			assert.deepEqual((await hostState()).downloads, [{ contents: [{ type: "resource", resource: { uri: `file:///deck.opf.${extension}`, mimeType, text } }] }], format + ": exact source bytes and metadata");
		}
	});

	await run("a host without download capability gets no request or iframe fallback and a visible error", async () => {
		await open({ document: downloadDeck, view: "source" });
		await view().locator("#deck-source .cm-editor").waitFor();
		await probeIframeDownload();
		// The redesigned UI hides this unsupported action. Invoke its real handler only to test the transport guard.
		assert.equal(await view().locator(".opf-source-action-download").isVisible(), false);
		await view().locator(".opf-source-action-download").evaluate((button) => button.click());
		await noIframeDownload();
		await view().locator("#deck-status").waitFor();
		assert.match(await view().locator("#deck-status").innerText(), /host does not support.*download/i);
		assert.deepEqual((await hostState()).downloads, []);
		assert.equal((await hostState()).requests.includes("ui/download-file"), false);
		await shoot("host-download-unsupported");
	});

	await run("host denial, cancellation and protocol errors remain visible failures without fallback", async () => {
		for (const [mode, words] of [["denied", "The download didn't finish."], ["cancelled", "The download didn't finish."], ["rpc-error", "The download couldn't be confirmed."]]) {
			await open({ document: downloadDeck, view: "source" }, "light", { downloadMode: mode });
			await view().locator("#deck-source .cm-editor").waitFor();
			await probeIframeDownload();
			await view().getByRole("button", { name: "Download source", exact: true }).click();
			await noIframeDownload();
			await view().locator("#deck-status").waitFor();
			assert.equal(await view().locator("#deck-status").innerText(), words);
			assert.equal((await hostState()).downloads.length, 1);
			await shoot("host-download-" + mode);
		}
	});

	await run("a capable host binary Export denial is visible and never uses an iframe download", async () => {
		await open({ document: downloadDeck }, "light", { downloadMode: "denied" });
		await probeIframeDownload();
		await view().locator("#deck-export .opf-export-trigger").click();
		await view().locator('.opf-export-item[data-format="pptx"]').click();
		await page.waitForFunction(() => window.host.downloads.length === 1, null, { timeout: 120000 });
		const resource = (await hostState()).downloads[0].contents[0].resource;
		assert.equal(resource.mimeType, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
		assert.equal(Buffer.from(resource.blob, "base64").subarray(0, 2).toString("latin1"), "PK", "the denied transfer really contains a generated PowerPoint archive");
		await view().locator(".opf-export-status").filter({ hasText: /export failed\. The download didn't finish\./i }).waitFor();
		assert.match(await view().locator("#deck-status").innerText(), /^(PowerPoint \(\.pptx\) export failed\. )?The download didn't finish\.$/);
		await noIframeDownload();
		await shoot("host-download-export-denied");
	});


	await run("on a phone the slide comes first: two rows of chrome, the whole view in one screen, 44px targets, the Design sheet under the slide", async () => {
		// A touch phone (390 and 375 CSS pixels wide), the view inline at the host's full width, as Claude's iOS app shows it.
		for (const [width, height] of [[390, 844], [375, 667]]) {
			const phone = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
			const tab = await phone.newPage();
			tab.on("pageerror", (error) => problems.push(String(error)));
			await tab.exposeFunction("callServer", (params) => client.callTool(params));
			await tab.goto(hostUrl);
			const themed = { ...deck, design: { theme: "classic" } };
			const result = await client.callTool({ name: "show_deck", arguments: { document: themed } });
			await tab.evaluate((setup) => window.startView(setup), { viewUrl, arguments: { document: themed }, result, theme: "dark", width, hostName: "Claude" });
			const inner = tab.frameLocator("#view");
			await inner.locator("#deck-canvas svg").first().waitFor({ timeout: 60000 });
			await tab.waitForFunction(() => window.host.context.length > 0, null, { timeout: 60000 });
			await tab.waitForTimeout(500);
			const frame = tab.frame({ url: /\/view$/ });
			const laid = await frame.evaluate(() => {
				const box = (selector) => document.querySelector(selector).getBoundingClientRect();
				const visible = (item) => item.getClientRects().length > 0 && getComputedStyle(item).visibility !== "hidden";
				const small = [...document.querySelectorAll(".deck-bar button, .deck-bar [role=tab], .deck-foot button, #deck-thumbs button")].filter(visible).map((item) => [item.id || item.className || item.textContent, item.getBoundingClientRect()]).filter(([, rect]) => rect.width < 44 || rect.height < 44).map(([name, rect]) => `${name} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
				const rows = new Set([...document.querySelectorAll(".deck-bar > *, .deck-title-row > *")].filter((item) => visible(item) && item.getBoundingClientRect().height > 0 && !item.classList.contains("deck-title-row")).map((item) => Math.round(item.getBoundingClientRect().top / 8)));
				return { size: document.documentElement.dataset.size, slideTop: box("#deck-canvas svg").top, footBottom: box(".deck-foot").bottom, view: box("#opf-deck").height, bar: box(".deck-bar").height, rows: rows.size, small };
			});
			assert.equal(laid.size, "compact narrow tiny");
			assert.ok(laid.slideTop <= 160, `${width}px: the slide starts ${Math.round(laid.slideTop)}px down the view`);
			assert.ok(laid.bar <= 100 && laid.rows === 2, `${width}px: two rows of chrome (${laid.rows} rows, ${Math.round(laid.bar)}px)`);
			assert.ok(laid.view <= 460 && laid.footBottom <= 460, `${width}px: the name, the slide, the strip and the status line fit one phone screen (${Math.round(laid.view)}px)`);
			assert.deepEqual(laid.small, [], `${width}px: every control is at least 44 by 44`);
			// Every action stays within two taps: More holds Find, Expand and (where the host saves files) Export.
			await inner.locator("#deck-more").tap();
			await inner.locator("#deck-menu").waitFor();
			const items = await frame.evaluate(() => [...document.querySelectorAll("#deck-menu > :is(button, select)")].filter((item) => item.getClientRects().length).map((item) => [item.textContent, Math.round(item.getBoundingClientRect().height)]));
			assert.deepEqual(items.map(([text]) => text), ["Find and replace", "Expand"]);
			assert.ok(items.every(([, tall]) => tall >= 44), JSON.stringify(items));
			await inner.locator('#deck-menu [data-run="find"]').tap();
			await inner.locator("#deck-find input").first().waitFor();
			assert.equal(await inner.locator("#deck-menu").isVisible(), false, "an item closes the menu");
			await inner.locator("#deck-find input").first().press("Escape");
			// The Design sheet: one section at a time with its current choice named, one scroll container, the slide in view above it.
			await inner.locator(".opf-design-menu-trigger").tap();
			await inner.locator(".opf-design-menu-popover").waitFor();
			await tab.waitForTimeout(400);
			const sheet = await frame.evaluate(() => {
				const popover = document.querySelector(".opf-design-menu-popover");
				const row = popover.querySelector('.opf-design-menu-item[aria-checked="true"]');
				let scrollers = 0;
				for (let node = row; node && node !== document.body; node = node.parentElement) if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) scrollers += 1;
				const targets = [...popover.querySelectorAll("button")].filter((item) => item.getClientRects().length).map((item) => item.getBoundingClientRect()).filter((rect) => rect.width < 44 || rect.height < 44).length;
				const tab = popover.querySelector('.opf-design-menu-tab[aria-selected="true"]');
				return { scrollers, targets, sheetTop: popover.getBoundingClientRect().top, slideBottom: document.querySelector("#deck-canvas svg").getBoundingClientRect().bottom, tab: tab?.textContent, groups: [...popover.querySelectorAll(".opf-design-menu-group")].filter((group) => group.getClientRects().length).length };
			});
			assert.equal(sheet.scrollers, 1, "the sheet's rows have exactly one scrolling ancestor");
			assert.equal(sheet.groups, 1, "one section at a time");
			assert.equal(sheet.tab, "ThemeClassic", "the section switch names the current choice");
			assert.equal(sheet.targets, 0, "every target in the sheet is at least 44 by 44");
			assert.ok(sheet.sheetTop >= sheet.slideBottom - 1, `the slide stays in view above the sheet (${sheet.slideBottom} / ${sheet.sheetTop})`);
			await inner.locator('.opf-design-menu-item[data-section="theme"][data-value="bold"]').tap();
			await tab.waitForFunction(() => window.host.context.at(-1)?.structuredContent?.document?.design?.theme === "bold", null, { timeout: 15000 });
			await inner.locator('.opf-design-menu-tab[data-section="colors"]').tap();
			assert.equal(await frame.evaluate(() => [...document.querySelectorAll(".opf-design-menu-group")].filter((group) => group.getClientRects().length).map((group) => group.dataset.section).join()), "colors");
			if (shots) await tab.locator("#view").screenshot({ path: path.join(shots, `phone-design-${width}.png`) });
			await phone.close();
		}
		// The narrowest frame scrolls nothing sideways.
		const narrow = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
		const tab = await narrow.newPage();
		await tab.exposeFunction("callServer", (params) => client.callTool(params));
		await tab.goto(hostUrl);
		const result = await client.callTool({ name: "open_editor", arguments: {} });
		await tab.evaluate((setup) => window.startView(setup), { viewUrl, arguments: {}, result, theme: "light", width: 320 });
		await tab.frameLocator("#view").locator("#deck-canvas svg").first().waitFor({ timeout: 60000 });
		await tab.frameLocator("#view").locator("#deck-more").tap();
		const fit = await tab.frame({ url: /\/view$/ }).evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, menu: [...document.querySelectorAll("#deck-menu > :is(button, select)")].filter((item) => item.getClientRects().length).map((item) => item.id || item.textContent) }));
		assert.ok(fit.scroll <= fit.client, `320px: the page is ${fit.scroll}px wide in ${fit.client}px`);
		assert.deepEqual(fit.menu, ["Find and replace", "Expand", "deck-example", "deck-paste"], "the editor's example picker and Paste are in More");
		await narrow.close();
	});

	await run("in ChatGPT on a phone: Ask is compact and names ChatGPT, a long name keeps its room, the footer says a status whole (440px: the owner's iPhone, where it was cut)", async () => {
		const long = { name: "AI Agents That Actually Work", language: "en-US", design: { theme: "classic" }, slides: [{ id: "t", title: "AI Agents That Actually Work" }, { id: "g", title: "Autonomy needs guardrails" }] };
		for (const [width, height] of [[440, 956], [390, 844], [375, 667], [320, 640]]) {
			const phone = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
			const tab = await phone.newPage();
			tab.on("pageerror", (error) => problems.push(String(error)));
			await tab.exposeFunction("callServer", (params) => client.callTool(params));
			await tab.goto(hostUrl);
			const result = await client.callTool({ name: "show_deck", arguments: { document: long } });
			await tab.evaluate((setup) => window.startView(setup), { viewUrl, arguments: { document: long }, result, theme: "dark", width, hostName: "chatgpt" });
			const inner = tab.frameLocator("#view");
			await inner.locator("#deck-canvas svg").first().waitFor({ timeout: 60000 });
			const frame = tab.frame({ url: /\/view$/ });
			// Nothing on the slide is selected or focused until the person taps, and the hover outline is for a pointer that hovers.
			const calm = await frame.evaluate(() => {
				const hover = [...document.styleSheets].flatMap((sheet) => { try { return [...sheet.cssRules]; } catch { return []; } }).flatMap((rule) => (rule.cssRules ? [...rule.cssRules].map((inner) => [rule, inner]) : [[null, rule]])).filter(([, rule]) => /data-canvas-target\]:hover/.test(rule.selectorText ?? ""));
				return { selected: document.querySelectorAll("[data-canvas-selected], [data-canvas-editing]").length, active: document.activeElement?.tagName, hover: hover.map(([outer]) => outer?.conditionText ?? null) };
			});
			assert.deepEqual(calm, { selected: 0, active: "BODY", hover: ["(hover: hover)"] }, `${width}px: ${JSON.stringify(calm)}`);
			// An edit: Send appears in the name's row, filled.
			await inner.locator(".opf-design-menu-trigger").tap();
			await inner.locator('.opf-design-menu-tab[data-section="colors"]').tap();
			await inner.locator('.opf-design-menu-item[data-section="colors"][data-value="burnt-orange"]').evaluate((item) => item.click());
			await inner.locator(".opf-design-menu-close").evaluate((item) => item.click());
			await inner.locator('#deck-send[data-unsent="true"]').waitFor();
			const row = await frame.evaluate(() => {
				const box = (element) => element.getBoundingClientRect();
				const send = document.getElementById("deck-send");
				const title = document.querySelector(".deck-title");
				return { name: send.getAttribute("aria-label"), shown: send.innerText.trim(), title: send.title, nameWidth: box(title).width, row: box(document.querySelector(".deck-title-row")).height, right: box(document.getElementById("deck-more")).right, client: document.documentElement.clientWidth, sendHeight: box(send).height };
			});
			assert.equal(row.name, "Ask ChatGPT to edit…", `${width}px`);
			assert.equal(row.shown, "Ask", `${width}px: a phone shows the icon and "Ask"`);
			assert.match(row.title, /ChatGPT/);
			assert.ok(row.nameWidth >= 96, `${width}px: the deck's name keeps ${Math.round(row.nameWidth)}px`);
			assert.ok(row.row <= 46 && row.sendHeight >= 44, `${width}px: one row (${row.row}px)`);
			assert.ok(row.right <= row.client, `${width}px: More ends inside the frame`);
			await inner.locator("#deck-send").tap();
			await inner.locator("#deck-instruction").fill("Tighten the wording");
			await inner.locator("#deck-request-send").tap();
			await inner.locator('#deck-sync[data-state="sent"]').waitFor({ state: "attached" });
			const foot = await frame.evaluate(() => {
				const status = document.getElementById("deck-status");
				const sync = document.getElementById("deck-sync");
				return { status: status.innerText, statusCut: status.scrollWidth > status.clientWidth + 1, sync: sync.innerText, syncCut: sync.scrollWidth > sync.clientWidth + 1 };
			});
			assert.deepEqual(foot, { status: "Sent to ChatGPT", statusCut: false, sync: "Sent to ChatGPT", syncCut: false }, `${width}px`);
			// What the host reported is one tap away (More), and in the footer version's title on wider frames.
			await inner.locator("#deck-more").tap();
			assert.match(await inner.locator("#deck-about").innerText(), /^OPF \d+\.\d+\.\d+.* · Host: chatgpt 1\.0\.0 · message: yes · save files: no · full screen: yes · tools: yes · context: yes$/);
			assert.equal(await inner.locator("#deck-version").getAttribute("title"), "Host: chatgpt 1.0.0 · message: yes · save files: no · full screen: yes · tools: yes · context: yes");
			if (shots) await tab.locator("#view").screenshot({ path: path.join(shots, `chatgpt-sent-${width}.png`) });
			await phone.close();
		}
	});

	await run("in a very narrow pane with a mouse (Cursor's IDE chat pane, about 215px): two rows of chrome, nothing outside the frame, every action within two clicks, the Design sheet readable; under 200px the view keeps 200px and scrolls", async () => {
		const jaguars = { name: "Jaguars of the Americas", language: "en-US", design: { theme: "classic" }, slides: [{ id: "t", title: "Jaguars", blocks: [{ text: "Power, stealth, and the wild heart of the Americas" }] }, { id: "a", title: "What we will cover", blocks: [{ items: ["Who they are", "Where they live"] }] }, { id: "b", title: "Range" }, { id: "c", title: "Conservation" }] };
		const start = async (width, options = {}) => {
			const context = await browser.newContext({ viewport: { width: 420, height: 900 }, ...options });
			const tab = await context.newPage();
			tab.on("pageerror", (error) => problems.push(String(error)));
			await tab.exposeFunction("callServer", (params) => client.callTool(params));
			await tab.goto(hostUrl);
			const result = await client.callTool({ name: "show_deck", arguments: { document: jaguars } });
			await tab.evaluate((setup) => window.startView(setup), { viewUrl, arguments: { document: jaguars }, result, theme: "dark", width, hostName: "cursor" });
			const inner = tab.frameLocator("#view");
			await inner.locator("#deck-canvas svg").first().waitFor({ timeout: 60000 });
			await tab.waitForFunction(() => window.host.context.length > 0, null, { timeout: 60000 });
			await tab.waitForTimeout(500);
			return { context, tab, inner, frame: tab.frame({ url: /\/view$/ }) };
		};
		// Every visible control of the bar and the footer, and whether any of it lies outside the frame or under another control.
		const fit = (frame) => frame.evaluate(() => {
			const visible = (item) => item.getClientRects().length > 0 && getComputedStyle(item).visibility !== "hidden";
			const client = document.documentElement.clientWidth;
			const boxes = [...document.querySelectorAll(".deck-bar button, .deck-bar [role=tab], .deck-foot button, .deck-title")].filter(visible).map((item) => ({ name: item.id || item.getAttribute("aria-label") || item.className, box: item.getBoundingClientRect() }));
			const overlaps = [];
			for (const [at, a] of boxes.entries()) for (const b of boxes.slice(at + 1)) if (!a.name.includes("title") && !b.name.includes("title") && a.box.left < b.box.right - 1 && b.box.left < a.box.right - 1 && a.box.top < b.box.bottom - 1 && b.box.top < a.box.bottom - 1) overlaps.push(`${a.name}/${b.name}`);
			const rows = new Set([...document.querySelectorAll(".deck-bar > *, .deck-title-row > *")].filter((item) => visible(item) && item.getBoundingClientRect().height > 0 && !item.classList.contains("deck-title-row")).map((item) => Math.round(item.getBoundingClientRect().top / 8)));
			const top = (selector) => Math.round(document.querySelector(selector).getBoundingClientRect().top);
			const thumbs = [...document.querySelectorAll("#deck-thumbs button")].filter(visible).map((item) => Math.round(item.getBoundingClientRect().top));
			return {
				size: document.documentElement.dataset.size, client, scroll: document.documentElement.scrollWidth, rows: rows.size, bar: Math.round(document.querySelector(".deck-bar").getBoundingClientRect().height),
				outside: boxes.filter(({ box }) => box.left < -0.5 || box.right > client + 0.5).map(({ name }) => name), overlaps,
				shown: ["deck-title", "tab-preview", "tab-source", "deck-more"].filter((id) => visible(document.getElementById(id))),
				small: boxes.filter(({ box }) => box.height < 44).length, slide: Math.round(document.querySelector("#deck-canvas svg").getBoundingClientRect().width),
				footOneLine: top(".deck-verdict") === top(".deck-nav"), thumbRows: new Set(thumbs).size,
			};
		});
		for (const width of [215, 240]) {
			const { context, tab, inner, frame } = await start(width);
			const laid = await fit(frame);
			assert.equal(laid.size, "compact narrow micro", `${width}px: a mouse keeps the 32px controls`);
			assert.ok(laid.scroll <= laid.client, `${width}px: nothing scrolls sideways (${laid.scroll} in ${laid.client})`);
			assert.deepEqual([laid.outside, laid.overlaps], [[], []], `${width}px: every control inside the frame, none over another`);
			assert.deepEqual(laid.shown, ["deck-title", "tab-preview", "tab-source", "deck-more"], `${width}px: the name, Preview, Source and More are on screen`);
			assert.ok(laid.rows === 2 && laid.bar <= 80, `${width}px: two rows of chrome (${laid.rows} rows, ${laid.bar}px)`);
			assert.ok(laid.slide >= laid.client - 4, `${width}px: the slide is ${laid.slide}px wide in ${laid.client}px`);
			assert.ok(laid.footOneLine && laid.thumbRows === 1, `${width}px: the footer's verdict and navigator share a line, the thumbnails one row`);
			// More holds what the bar has no room for: Undo and Redo, Find, Expand. A host growing the frame to the view's height leaves it open.
			await inner.locator("#deck-more").click();
			await inner.locator("#deck-menu").waitFor();
			await tab.evaluate(() => { document.getElementById("view").style.height = `${document.getElementById("view").getBoundingClientRect().height + 40}px`; });
			await tab.waitForTimeout(300);
			assert.equal(await inner.locator("#deck-menu").isVisible(), true, `${width}px: a resize that keeps the layout leaves More open`);
			const items = await frame.evaluate(() => [...document.querySelectorAll("#deck-menu > button")].filter((item) => item.getClientRects().length).map((item) => [item.textContent, item.disabled, item.getBoundingClientRect().right <= document.documentElement.clientWidth]));
			assert.deepEqual(items, [["Undo", true, true], ["Redo", true, true], ["Find and replace", false, true], ["Expand", false, true]], `${width}px: ${JSON.stringify(items)}`);
			// The host line says what the host announced, each part whole on its line and inside the menu.
			const about = await frame.evaluate(() => {
				const line = document.getElementById("deck-about");
				const menuRight = document.getElementById("deck-menu").getBoundingClientRect().right;
				return { text: line.innerText.replace(/\s+/g, " "), parts: [...line.querySelectorAll("span")].map((part) => [part.getClientRects().length, part.getBoundingClientRect().right <= menuRight]) };
			});
			assert.match(about.text, /^OPF \S+ · Host: cursor 1\.0\.0 · message: yes · save files: no · full screen: yes · tools: yes · context: yes$/, `${width}px: ${about.text}`);
			assert.deepEqual(about.parts, Array(5).fill([1, true]), `${width}px: each part wraps whole`);
			await inner.locator("#deck-more").click();
			// The Design sheet: one section at a time under the slide, its four segments wide enough to read.
			await inner.locator(".opf-design-menu-trigger").click();
			await inner.locator(".opf-design-menu-popover").waitFor();
			await tab.waitForTimeout(400);
			const sheet = await frame.evaluate(() => {
				const popover = document.querySelector(".opf-design-menu-popover");
				const cut = [...popover.querySelectorAll(".opf-design-menu-tab-label")].filter((label) => label.scrollWidth > label.clientWidth + 1).map((label) => label.textContent);
				return { cut, groups: [...popover.querySelectorAll(".opf-design-menu-group")].filter((group) => group.getClientRects().length).length, sheetTop: popover.getBoundingClientRect().top, slideBottom: document.querySelector("#deck-canvas svg").getBoundingClientRect().bottom, right: popover.getBoundingClientRect().right, client: document.documentElement.clientWidth };
			});
			assert.deepEqual(sheet.cut, [], `${width}px: no section name is cut short`);
			assert.equal(sheet.groups, 1, `${width}px: one section at a time`);
			assert.ok(sheet.sheetTop >= sheet.slideBottom - 1 && sheet.right <= sheet.client, `${width}px: the slide stays in view above the sheet (${JSON.stringify(sheet)})`);
			await inner.locator('.opf-design-menu-item[data-section="theme"][data-value="bold"]').click();
			await tab.waitForFunction(() => window.host.context.at(-1)?.structuredContent?.document?.design?.theme === "bold", null, { timeout: 15000 });
			await inner.locator(".opf-design-menu-close").click();
			// After the edit Send joins the name's row, and More still ends inside the frame.
			await inner.locator('#deck-send[data-unsent="true"]').waitFor();
			const edited = await fit(frame);
			assert.deepEqual([edited.outside, edited.overlaps, edited.rows], [[], [], 2], `${width}px after an edit: ${JSON.stringify(edited)}`);
			// Undo from More takes the edit back.
			await inner.locator("#deck-more").click();
			await inner.locator('#deck-menu [data-run="undo"]').click();
			await tab.waitForFunction(() => window.host.context.at(-1)?.structuredContent?.document?.design?.theme === "classic", null, { timeout: 15000 });
			// Find from More: its card fits the view, and focusing its field does not shift the view sideways.
			await inner.locator("#deck-more").click();
			await inner.locator('#deck-menu [data-run="find"]').click();
			await inner.locator("#deck-find input").first().waitFor();
			await tab.waitForTimeout(300);
			const find = await frame.evaluate(() => ({ left: document.querySelector(".deck-title").getBoundingClientRect().left, card: document.querySelector(".deck-find").getBoundingClientRect().bottom, view: document.getElementById("opf-deck").getBoundingClientRect().bottom, shellScroll: document.getElementById("opf-deck").scrollLeft }));
			assert.ok(find.left >= 0 && find.shellScroll === 0, `${width}px: the view did not scroll sideways (${JSON.stringify(find)})`);
			assert.ok(find.card <= find.view, `${width}px: the Find card ends inside the view (${JSON.stringify(find)})`);
			if (shots) await tab.locator("#view").screenshot({ path: path.join(shots, `narrow-pane-${width}.png`) });
			await context.close();
		}
		// A finger in the same pane keeps 44px targets, still in two rows inside the frame.
		{
			const { context, frame } = await start(240, { isMobile: true, hasTouch: true });
			const laid = await fit(frame);
			assert.equal(laid.size, "compact narrow tiny micro");
			assert.deepEqual([laid.outside, laid.overlaps, laid.rows, laid.small], [[], [], 2, 0], `240px with a finger: ${JSON.stringify(laid)}`);
			await context.close();
		}
		// Under 200px the view keeps 200px and the frame scrolls sideways; nothing overlaps.
		{
			const { context, frame } = await start(180);
			const laid = await frame.evaluate(() => ({ view: document.getElementById("opf-deck").getBoundingClientRect().width, scroll: document.documentElement.scrollWidth, overflow: getComputedStyle(document.documentElement).overflowX }));
			assert.deepEqual(laid, { view: 200, scroll: 200, overflow: "auto" }, `180px: ${JSON.stringify(laid)}`);
			const placed = await fit(frame);
			assert.deepEqual(placed.overlaps, [], `180px: ${JSON.stringify(placed)}`);
			await context.close();
		}
	});

	// A deck Claude made from the published first prompt had `{{organization.name}}` in its footer, and the viewer printed the token as
	// written (the renderer and the exports resolve it). The preview and the thumbnails draw built-in variables resolved.
	await run("the preview and the thumbnails draw built-in variables resolved, not as written", async () => {
		await open({
			document: {
				name: "PantryPilot Seed Pitch",
				language: "en-US",
				organization: { id: "pantrypilot", name: "PantryPilot" },
				design: { footer: { start: { text: "{{organization.name}}" }, end: { text: "{{slide.number}} / {{deck.slideCount}}" } } },
				slides: [{ id: "cover", title: "Dinner, planned from what you already have" }, { id: "ask", title: "Raising $3M" }],
			},
		});
		await view().locator("#deck-canvas svg").first().waitFor({ timeout: 60000 });
		const canvas = await view().locator("#deck-canvas").evaluate((node) => node.textContent);
		assert.match(canvas, /PantryPilot/, "the footer says the organization's name");
		assert.match(canvas, /1 \/ 2/, "the slide tokens still resolve");
		assert.doesNotMatch(canvas, /\{\{/, "no token is drawn as written in the preview");
		await view().locator("#deck-thumbs svg").first().waitFor({ state: "attached", timeout: 60000 });
		const thumbs = await view().locator("#deck-thumbs").evaluate((node) => node.textContent);
		assert.doesNotMatch(thumbs, /\{\{/, "no token is drawn as written in the thumbnails");
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
