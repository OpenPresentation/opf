import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const req = createRequire("C:/opf-work/sh-03-effects/packages/render/package.json");
const { chromium } = req("playwright");
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
for (const n of [1, 2, 3]) {
  await page.setContent(`<html><body style="margin:0">${readFileSync(`cmp1/slide${n}.svg`, "utf8")}</body></html>`);
  await page.screenshot({ path: `cmp1/chrome-slide${n}.png` });
}
await browser.close();
