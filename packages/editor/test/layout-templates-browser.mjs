import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../artifacts/playground/", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".ttf": "font/ttf", ".wasm": "application/wasm" };
const server = createServer(async (req, res) => {
  try {
    const target = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
    const relative = path.relative(root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
    const body = await readFile(target);
    res.writeHead(200, { "Content-Type": types[path.extname(target)] ?? "application/octet-stream" }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.locator("#preview svg").waitFor({ timeout: 60000 });
  await page.getByRole("tab", { name: "Design" }).click();
  await page.locator("#custom-layout").click();
  const grid = page.locator("dialog.opf-grid-dialog[open]");
  await grid.getByLabel("Layout ID").fill("review-grid");
  await grid.getByLabel("Name", { exact: true }).fill("Review grid");
  await grid.getByLabel("Summary").fill("Recommendation with notes");
  const regionGroup = (label) => grid.getByRole("group", { name: label, exact: true });
  assert.deepEqual(await grid.locator(".opf-grid-region legend").allTextContents(), ["title", "content"], "regions are listed in reading order");
  assert.equal(await regionGroup("title").getByLabel("Role").count(), 0, "a heading region takes only a size");
  // Split the content region: a row split holds it and a new region, and focus moves to the new region's name.
  await grid.getByRole("button", { name: "Split content" }).click();
  assert.equal(await grid.locator(".opf-grid-split").count(), 1);
  assert.equal(await grid.locator("[data-control='name']").evaluateAll((nodes) => nodes.some((node) => node === document.activeElement)), true, "splitting a region focuses the new region");
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("notes");
  assert.ok(await grid.locator(".opf-layout-diagram span[data-region='notes']").count() === 1, "the structure preview follows the region name");
  await regionGroup("content").getByLabel("Size").fill("2");
  await grid.getByRole("button", { name: "Move notes up" }).click();
  assert.deepEqual(await grid.locator(".opf-grid-region legend").allTextContents(), ["title", "notes", "content"], "move up reorders the reading order");
  await grid.getByRole("button", { name: "Move notes down" }).click();
  await grid.getByRole("button", { name: /Add a region to this row/ }).click();
  assert.equal(await grid.locator(".opf-grid-region").count(), 4);
  await grid.getByRole("button", { name: "Remove region-1" }).click();
  assert.deepEqual(await grid.locator(".opf-grid-region legend").allTextContents(), ["title", "content", "notes"]);
  await grid.getByRole("button", { name: "Save layout" }).click();
  await page.waitForFunction(() => !document.querySelector("dialog.opf-grid-dialog"));
  const readDoc = async () => JSON.parse(await page.locator("#json").inputValue());
  let document = await readDoc();
  assert.deepEqual(document.catalogs.custom.layouts["review-grid"], {
    name: "Review grid", summary: "Recommendation with notes", direction: "column",
    regions: [
      { name: "title" },
      { direction: "row", regions: [
        { name: "content", size: 2, accepts: ["text"], role: "primary", flow: "auto" },
        { name: "notes", accepts: ["text"], role: "primary", flow: "auto" },
      ] },
    ],
  });
  await page.locator("#choose-layout").click();
  const picker = page.locator("dialog.opf-layout-dialog[open]");
  await picker.getByPlaceholder("Filter layouts").fill("review-grid");
  assert.equal(await picker.locator("optgroup[label='Custom layouts'] option").count(), 1);
  assert.ok(await picker.locator(".opf-layout-diagram span").count() >= 3, "template diagram is shown");
  assert.ok(await picker.locator(".opf-layout-current svg").count() === 1, "current content is previewed");
  await picker.getByRole("button", { name: "Use layout" }).click();
  document = await readDoc();
  assert.equal(document.slides[0].layout, "review-grid");
  await page.locator("#arrange").click();
  const target = page.locator(".opf-region-drop[data-opf-region='notes']");
  await target.waitFor();
  assert.match(await target.textContent(), /Drop content here/);
  await target.press("Enter");
  await target.getByRole("button", { name: "Block 1" }).press("Enter");
  await page.waitForFunction(() => JSON.parse(document.querySelector("#json").value).slides[0].blocks[0].region === "notes");
  document = await readDoc();
  assert.equal(document.slides[0].blocks[0].region, "notes");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForFunction(() => !JSON.parse(document.querySelector("#json").value).slides[0].blocks[0].region);
  await target.press("Enter");
  await target.getByRole("button", { name: "Block 1" }).press("Escape");
  assert.equal(await target.locator("[data-region-menu]").count(), 0, "Escape closes the region menu");
  assert.equal(await target.evaluate((node) => node === document.activeElement), true, "Escape returns focus to region");
  await target.press("Space");
  await target.getByRole("button", { name: "Block 1" }).press("Space");
  await page.waitForFunction(() => JSON.parse(document.querySelector("#json").value).slides[0].blocks[0].region === "notes");
  await page.locator("#custom-layout").click();
  await page.locator("dialog.opf-grid-dialog[open]").getByRole("button", { name: "Cancel" }).click();
  assert.equal(await page.locator("#custom-layout").evaluate((node) => node === document.activeElement), true, "custom dialog restores opener focus");
  document = await readDoc();
  document.slides[0].blocks = [];
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page.locator("#json").fill(JSON.stringify(document));
  await page.waitForFunction(() => !globalThis.document.querySelector("#apply-json").disabled && !globalThis.document.querySelector("#json-error").textContent);
  await page.locator("#apply-json").click();
  await page.waitForFunction(() => !globalThis.document.querySelector("#source-dialog").open);
  await page.waitForFunction(() => JSON.parse(globalThis.document.querySelector("#json").value).slides[0].blocks.length === 0);
  for (const area of ["content", "notes"]) {
    const empty = page.locator(`.opf-region-drop[data-opf-region='${area}']`);
    await empty.waitFor();
    const box = await empty.boundingBox();
    assert.ok(box.width > 0 && box.height > 0, "empty collapsed regions retain reachable targets");
    await empty.press("Enter");
    assert.match(await empty.locator("[data-region-menu]").textContent(), /No compatible blocks/);
    await empty.press("Escape");
  }
  assert.deepEqual(errors, []);
  console.log("layout browser: region-list editor, grouped picker, live preview, region placement and undo passed");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
