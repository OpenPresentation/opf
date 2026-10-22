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
  // RR-99: "Build a custom layout" opens the Layouts view, the layout editor on the presentation's own custom layouts.
  await page.locator("#custom-layout").click();
  const studio = page.locator("#layouts-view");
  await studio.locator(".opf-lx-node").first().waitFor();
  assert.equal(await page.locator("#view-layouts").getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator(".inspector").isVisible(), false, "the slide inspector gives way to the layout editor");
  await studio.getByLabel("Id", { exact: true }).fill("review-grid");
  await studio.getByLabel("Name", { exact: true }).fill("Review grid");
  await studio.getByLabel("Summary").fill("Recommendation with notes");
  assert.deepEqual(await studio.locator(".opf-lx-node[data-kind='region']").evaluateAll((nodes) => nodes.map((node) => node.dataset.name)), ["title", "content"], "regions are drawn in reading order");
  // Split the content region into a row with the tool, then name and size the regions in the inspector.
  await studio.getByRole("button", { name: "Split into a row" }).click();
  const content = await studio.locator(".opf-lx-node[data-name='content']").boundingBox();
  await page.mouse.click(content.x + content.width / 2, content.y + content.height / 2);
  assert.equal(await studio.locator(".opf-lx-node[data-kind='split']").count(), 1, "a row split holds the region and the new one");
  assert.ok(await studio.locator(".opf-lx-node[data-name='region-1'][aria-pressed='true']").count() === 1, "the new region is selected");
  await studio.getByLabel("Name", { exact: true }).fill("notes");
  await studio.getByRole("treeitem", { name: /^content/ }).locator("> .opf-lx-row").click();
  await studio.getByLabel("Size", { exact: true }).fill("2");
  await studio.getByRole("button", { name: "Save to deck" }).click();
  await page.waitForFunction(() => /Saved review-grid/.test(document.querySelector("#layouts-status").textContent));
  const readDoc = async () => JSON.parse(await page.locator("#json").inputValue());
  let document = await readDoc();
  assert.deepEqual(document.catalogs.custom.layouts["review-grid"], {
    name: "Review grid", summary: "Recommendation with notes", direction: "column",
    regions: [
      { name: "title" },
      { direction: "row", regions: [
        { name: "content", size: 2 },
        { name: "notes" },
      ] },
    ],
  });
  // Saving the same id again is refused for a new layout, and replaces it when the layout was opened from the deck.
  await studio.getByLabel("Layout to edit").selectOption("review-grid");
  await studio.getByRole("button", { name: "Save to deck" }).click();
  assert.match(await page.locator("#layouts-status").textContent(), /Saved review-grid/);
  await page.locator("#view-slide").click();
  await page.locator("#preview svg").waitFor();
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
  assert.equal(await page.locator("#layouts-view").isVisible(), true, "the Design tab button opens the Layouts view again");
  await page.locator("#view-slide").click();
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
  console.log("layout browser: Layouts mode, grouped picker, live preview, region placement and undo passed");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
