// The deck view names the host's product in its own words ("Send to ChatGPT", "Claude has your edits") from what the host sent in
// ui/initialize (hostInfo: an MCP Implementation, `name` and an optional `title`), and shows what the host reported. Here: app/hosts.ts,
// bundled as build-app bundles it (esbuild, browser platform).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const esbuild = createRequire(createRequire(path.join(packageRoot, "package.json")).resolve("tsup"))("esbuild");
const built = await esbuild.build({ entryPoints: [path.join(packageRoot, "app", "hosts.ts")], absWorkingDir: packageRoot, bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent" });
const { hostAbilities, hostProduct, hostReport } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);

test("a host that names itself Claude or ChatGPT is called so; any other host is not named", () => {
	for (const info of [{ name: "Claude" }, { name: "claude-ai" }, { name: "claude.ai", title: "Claude" }, { name: "x", title: "Claude Desktop" }]) assert.equal(hostProduct(info), "Claude", JSON.stringify(info));
	for (const info of [{ name: "ChatGPT" }, { name: "chatgpt" }, { name: "chatgpt-ios" }, { name: "chat_gpt" }, { name: "Chat GPT" }, { name: "openai-apps" }, { name: "OpenAI" }, { name: "host", title: "ChatGPT" }]) assert.equal(hostProduct(info), "ChatGPT", JSON.stringify(info));
	for (const info of [undefined, {}, { name: "" }, { name: "test-host" }, { name: "Other host" }, { name: 42 }, { name: "gpt" }]) assert.equal(hostProduct(info), undefined, JSON.stringify(info));
});

test("what the host reported reads as one short line", () => {
	assert.equal(hostReport({ name: "chatgpt", version: "1.2026.300" }), "Host: chatgpt 1.2026.300");
	assert.equal(hostReport({ name: "claude-ai", title: "Claude", version: "0.1.0" }), "Host: claude-ai (Claude) 0.1.0");
	assert.equal(hostReport({ name: "Claude", title: "Claude" }), "Host: Claude");
	assert.equal(hostReport(undefined), "The host sent no name.");
	assert.equal(hostReport({ version: "1" }), "Host: (no name) 1");
	assert.ok(hostReport({ name: "x".repeat(500) }).length < 80, "a long name is cut");
});

test("what the host announced that the view acts on: Send, saving files, full screen, server tools, model context", () => {
	const all = { message: { text: {} }, downloadFile: {}, serverTools: {}, updateModelContext: { text: {} } };
	assert.equal(hostAbilities(all, ["inline", "fullscreen"]).join(" · "), "message: yes · save files: yes · full screen: yes · tools: yes · context: yes");
	assert.equal(hostAbilities(undefined, undefined).join(" · "), "message: no · save files: no · full screen: no · tools: no · context: no");
	assert.equal(hostAbilities({}, ["inline"]).join(" · "), "message: no · save files: no · full screen: no · tools: no · context: no");
	assert.equal(hostAbilities({ serverTools: {} }, ["inline"]).join(" · "), "message: no · save files: no · full screen: no · tools: yes · context: no");
});
