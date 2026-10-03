// RR-17 (Mac checks): the preview SVG of one slide drawn in Chromium and in WebKit at the same size, with the same font files.
//   cp engine-screens.mjs <dir with node_modules> && cd <dir> && node engine-screens.mjs <out dir> <example:fragment|deck.json> <slide index>
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
const [outDir, which, slideIndex] = process.argv.slice(2);
const { renderSvgDeck } = await import("@openpresentation/opf-render");
const { loadOfficeFontRegistry } = await import("@openpresentation/opf-render/fonts-node");
const { examples } = await import("@openpresentation/opf/examples");
const { chromium, webkit } = await import("playwright");
const fonts = await loadOfficeFontRegistry({ substitutionPolicy: "visual", scripts: "all" });
const deck = which.startsWith("example:") ? examples.find((e) => e.file.includes(which.slice(8))).deck : JSON.parse(readFileSync(which, "utf8"));
const svg = renderSvgDeck(deck, { trace: true, textMeasurement: fonts.textMeasurement, embeddedFonts: fonts.embeddedFonts })[Number(slideIndex)].replace(/@font-face\{[^}]*\}/g, "");
const families = new Set([...svg.matchAll(/font-family="([^"]*)"/g)].flatMap((m) => m[1].split(",").map((n) => n.trim())));
const described = fonts.describeFaces();
const faces = fonts.fontFiles.map((file, i) => ({ file, ...described[i] })).filter((f) => families.has(f.family)).map((f) => ({ family: f.family, weight: f.weight, italic: f.italic, url: `data:font/ttf;base64,${readFileSync(f.file).toString("base64")}` }));
mkdirSync(outDir, { recursive: true });
const name = path.basename(which).replace(/\.opf\.json$/, "").replace(/^example:.*\//, "");
for (const [engine, launcher] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await launcher.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  await page.setContent("<body style='margin:0'><main></main></body>");
  await page.evaluate(async (faces) => { for (const f of faces) document.fonts.add(await new FontFace(f.family, `url(${f.url})`, { weight: String(f.weight), style: f.italic ? "italic" : "normal" }).load()); }, faces);
  await page.evaluate(async (svg) => { document.querySelector("main").innerHTML = svg; await document.fonts.ready; }, svg);
  await page.locator("svg").first().screenshot({ path: path.join(outDir, `${name}-slide${Number(slideIndex) + 1}-${engine}.png`) });
  await browser.close();
}
