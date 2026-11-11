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

const resource = (await client.readResource({ uri: "ui://opf/deck" })).contents[0];
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
		const send = view().locator("#deck-send");
		assert.equal(await send.isDisabled(), true, "nothing to send before an edit");
		assert.equal(await view().locator("#deck-undo").isDisabled(), true);
		const title = view().locator("#deck-title input");
		await title.fill("Q3 board update");
		await title.press("Enter");
		await page.waitForFunction(() => window.host.context.some((update) => update.structuredContent?.edited), null, { timeout: 15000 });
		// The footer says where the edits are: with the model, without a click.
		await view().locator('#deck-sync[data-state="shared"]').waitFor();
		assert.equal(await view().locator("#deck-sync").innerText(), "The assistant has your edits");
		const update = (await hostState()).context.findLast((item) => item.structuredContent?.edited);
		assert.equal(update.structuredContent.document.name, "Q3 board update");
		assert.match(update.content[0].text, /The user edited the deck in the OPF viewer/);
		assert.match(update.content[0].text, /"name": "Q3 board update"/);
		assert.equal(await send.isVisible(), true);
		assert.equal(await send.getAttribute("data-unsent"), "true", "Send is the primary action while there are unsent edits");
		await send.click();
		await page.waitForFunction(() => window.host.messages.length === 1, null, { timeout: 15000 });
		assert.match((await hostState()).messages[0].content[0].text, /I edited the deck in the OPF viewer/);
		await view().locator('#deck-sync[data-state="sent"]').waitFor();
		assert.equal(await send.isDisabled(), true, "sent: nothing more to send until the next edit");
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
			return { shell: style("#opf-deck").backgroundColor, text: style("#opf-deck").color, title: style(".deck-foot").color, counter: style(".opf-nav-counter").color, design: style(".opf-design-menu-trigger").color, send: document.getElementById("deck-send").textContent, strip: [strip.left, strip.right], current: [current.left, current.right], height: document.getElementById("opf-deck").getBoundingClientRect().height };
		});
		assert.equal(seen.shell, "rgb(38, 38, 36)", "the view's surface is the host's background");
		assert.equal(seen.text, "rgb(250, 249, 245)");
		assert.equal(seen.counter, "rgb(250, 249, 245)", "the editor's own parts take the same text colour");
		assert.equal(seen.design, "rgb(194, 192, 182)", "and its quiet icon buttons the same muted colour as the viewer's");
		assert.equal(seen.title, "rgb(194, 192, 182)", "muted text is the host's secondary text");
		assert.equal(seen.send, "Send to Claude");
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
		assert.deepEqual((await hostState()).downloads, [{ contents: [{ type: "resource", resource: { uri: "file:///Q3%231-100%25.opf.json", mimeType: "application/json", text } }] }]);
		assert.equal(await view().locator("#deck-status").innerText(), "", "host acknowledgement does not invent a saved-file success notice");
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
		for (const mode of ["denied", "cancelled", "rpc-error"]) {
			await open({ document: downloadDeck, view: "source" }, "light", { downloadMode: mode });
			await view().locator("#deck-source .cm-editor").waitFor();
			await probeIframeDownload();
			await view().getByRole("button", { name: "Download source", exact: true }).click();
			await noIframeDownload();
			await view().locator("#deck-status").waitFor();
			assert.match(await view().locator("#deck-status").innerText(), /download failed/i);
			assert.equal((await hostState()).downloads.length, 1);
			if (mode !== "rpc-error") assert.match(await view().locator("#deck-status").innerText(), /cancelled or denied/i);
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
		await view().locator(".opf-export-status").filter({ hasText: /download failed.*cancelled or denied/i }).waitFor();
		assert.match(await view().locator("#deck-status").innerText(), /download failed.*cancelled or denied/i);
		await noIframeDownload();
		await shoot("host-download-export-denied");
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
