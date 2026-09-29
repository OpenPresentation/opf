// FF-31: the editor playground loads vendored preview fonts (Intos for the Aptos scheme) on demand, never through
// fonts.json. Serves artifacts/editor (build it first: node scripts/build-editor-demo.mjs) from a local server and drives
// the page in Chromium: a Roboto document fetches no vendored font, choosing the Aptos font scheme fetches exactly the
// Intos and Intos Display files (hash-verified by the loader), and afterwards every text run is painted with Intos at the
// measured advance. Offline apart from the local server.
//   node scripts/test-editor-lazy-fonts.mjs [--out <dir>]
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const site = path.join(root, "artifacts/editor");
const args = process.argv.slice(2);
const outDir = path.resolve(args.includes("--out") ? args[args.indexOf("--out") + 1] : path.join(root, "artifacts/editor-lazy-fonts"));
await mkdir(outDir, { recursive: true });
const renderRoot = path.resolve(root, "../opf-render");
const { chromium } = createRequire(path.join(renderRoot, "package.json"))("playwright");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".ttf": "font/ttf" };
const requests = [];
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  const file = path.join(site, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
  if (!file.startsWith(site)) { response.writeHead(403).end(); return; }
  try { await stat(file); } catch { response.writeHead(404).end(); return; }
  requests.push(url.pathname);
  response.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" }).end(await readFile(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: process.platform === "win32" && !process.env.CI ? "msedge" : undefined });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.route(/^https?:/, (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
  await page.goto(`${origin}/index.html`);
  await page.waitForSelector("#preview svg");
  await page.evaluate(() => document.fonts.ready);
  const choose = (value) => page.evaluate((value) => { const select = document.querySelector("#font"); select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); }, value);
  const lazy = () => requests.filter((url) => url.startsWith("/fonts/"));
  assert.deepEqual(lazy(), [], "a Roboto document fetches no vendored font");
  assert.ok(requests.includes("/fonts.json"));
  const fontsJson = (await stat(path.join(site, "fonts.json"))).size;

  await choose("aptos");
  await page.waitForFunction(() => [...document.fonts].some((face) => face.family.replace(/"/g, "") === "Intos" && face.status === "loaded"), null, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector("#status")?.textContent !== "Loading preview fonts…", null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const fetched = lazy().filter((url) => url.endsWith(".ttf"));
  assert.equal(fetched.length, 8, `the Aptos scheme fetched ${fetched.join(", ")}`);
  assert.ok(fetched.every((url) => /^\/fonts\/intos\/Intos(Display)?-/.test(url)));
  const painted = await page.evaluate(async () => {
    await document.fonts.ready;
    const runs = [...document.querySelectorAll("#preview svg text[textLength], #preview svg tspan[textLength]")].map((element) => {
      const owner = element.closest("text");
      const family = (element.getAttribute("font-family") ?? owner.getAttribute("font-family")).split(",")[0].trim().replace(/^"|"$/g, "");
      return { family, accepted: Number(element.getAttribute("textLength")), natural: element.getComputedTextLength(), loaded: [...document.fonts].some((face) => face.family.replace(/"/g, "") === family && face.status === "loaded") };
    });
    return { runs, status: document.querySelector("#status").textContent, font: document.querySelector("#font").value };
  });
  assert.equal(painted.font, "aptos");
  assert.ok(painted.runs.length > 0, "the preview has measured text runs");
  for (const run of painted.runs) {
    assert.match(run.family, /^Intos/, `the Aptos preview paints ${run.family}`);
    assert.ok(run.loaded, `${run.family} is loaded`);
    assert.ok(Math.abs(run.natural - run.accepted) < 0.1, `${run.family}: drawn ${run.natural} differs from measured ${run.accepted}`);
  }
  await page.locator("#preview svg").first().screenshot({ path: path.join(outDir, "aptos-preview.png") });
  // Back to Roboto: nothing more is fetched, and going to Aptos again is free.
  const count = lazy().length;
  await choose("roboto"); await page.waitForTimeout(300);
  await choose("aptos"); await page.waitForTimeout(500);
  assert.equal(lazy().length, count, "already loaded faces are not fetched again");
  assert.deepEqual(errors, []);
  const bytes = (await Promise.all(fetched.map(async (url) => (await stat(path.join(site, url))).size))).reduce((a, b) => a + b, 0);
  await writeFile(path.join(outDir, "report.json"), JSON.stringify({ browser: browser.version(), fontsJsonBytes: fontsJson, lazyFilesFetched: fetched, lazyBytesFetched: bytes, runs: painted.runs.length }, null, 2) + "\n");
  console.log(`Editor lazy fonts: fonts.json ${fontsJson} bytes; choosing the Aptos scheme fetched ${fetched.length} Intos files (${bytes} bytes); ${painted.runs.length} runs painted in Intos at the measured advance.`);
} finally { await browser.close(); server.close(); }
