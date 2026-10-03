// RR-17 (Mac checks): the preview SVG of a few decks drawn in Chromium and in WebKit (Playwright), text element by text element.
// The renderer writes textLength = its own measured advance of the line. Removing textLength and lengthAdjust and asking the engine
// for the natural advance (getComputedTextLength) shows how far the engine's own shaping is from the renderer's measurement; the
// existing gates allow 0.1 px (0.15 px for the variable-font gate). Nothing is relaxed: this reports the numbers.
//   cp engine-text-compare.mjs <dir with node_modules (opf, opf-render, playwright, the script font packs)> && cd <dir>
//   node engine-text-compare.mjs <out.json> <deck json files or example:<path fragment>...>
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const out = path.resolve(process.argv[2]);
const deckFiles = process.argv.slice(3);
const { renderSvgDeck } = await import("@openpresentation/opf-render");
const { loadOfficeFontRegistry } = await import("@openpresentation/opf-render/fonts-node");
const { examples } = await import("@openpresentation/opf/examples");
const { chromium, webkit } = await import("playwright");
const fonts = await loadOfficeFontRegistry({ substitutionPolicy: "visual", scripts: "all" });

const decks = deckFiles.map((file) => {
  if (file.startsWith("example:")) return { name: file.slice(8).split("/").pop(), deck: examples.find((e) => e.file.includes(file.slice(8))).deck };
  return { name: path.basename(file).replace(/\.opf\.json$/, ""), deck: JSON.parse(readFileSync(file, "utf8")) };
});
const slides = [];
for (const { name, deck } of decks) renderSvgDeck(deck, { trace: true, textMeasurement: fonts.textMeasurement, embeddedFonts: fonts.embeddedFonts }).forEach((svg, index) => slides.push({ id: `${name}#${index + 1}`, svg }));

// Faces the slides name in font-family attributes (the registry's own files, family/weight/italic from describeFaces, same order as fontFiles).
const usedFamilies = new Set(slides.flatMap((s) => [...s.svg.matchAll(/font-family="([^"]*)"/g)].flatMap((m) => m[1].split(",").map((name) => name.trim().replace(/^'|'$/g, "")))));
const described = fonts.describeFaces();
const usedFaces = fonts.fontFiles.map((file, i) => ({ file, ...described[i] })).filter((f) => usedFamilies.has(f.family)).map((f) => ({ family: f.family, weight: f.weight, italic: f.italic, dataUrl: `data:font/ttf;base64,${readFileSync(f.file).toString("base64")}` }));

async function measure(engine, launcher) {
  const browser = await launcher.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1050 } });
  const external = [];
  await page.route("http://**", (route) => { external.push(route.request().url()); return route.abort(); });
  await page.route("https://**", (route) => { external.push(route.request().url()); return route.abort(); });
  await page.setContent("<!doctype html><meta charset=utf-8><style>body{margin:0}</style><main></main>");
  // The registry's faces are added once through the FontFace API (as opf-render's own browser gates do), then the SVG is drawn
  // without its inline @font-face copies, so every engine draws with exactly the bundled font files and no system font.
  const faces = usedFaces;
  const loaded = await page.evaluate(async (faces) => {
    let ok = 0;
    for (const face of faces) { document.fonts.add(await new FontFace(face.family, `url(${face.dataUrl})`, { weight: String(face.weight), style: face.italic ? "italic" : "normal" }).load()); ok += 1; }
    await document.fonts.ready;
    return ok;
  }, faces);
  const result = [];
  for (const slide of slides) {
    const rows = await page.evaluate(async (svg) => {
      const main = document.querySelector("main");
      main.innerHTML = svg.replace(/@font-face\{[^}]*\}/g, "");
      await document.fonts.ready;
      const root = main.querySelector("svg");
      // Force every declared face to load before measuring: draw once, wait, measure.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await document.fonts.ready;
      const rows = [];
      for (const node of root.querySelectorAll("text")) {
        const text = node.textContent;
        if (!text.trim()) continue;
        const expected = parseFloat(node.getAttribute("textLength") ?? "NaN");
        const withLength = node.getComputedTextLength();
        const clone = node.cloneNode(true);
        clone.removeAttribute("textLength"); clone.removeAttribute("lengthAdjust");
        node.after(clone);
        const natural = clone.getComputedTextLength();
        const first = clone.getNumberOfChars() ? clone.getStartPositionOfChar(0) : null;
        const lastIndex = clone.getNumberOfChars() - 1;
        const last = lastIndex >= 0 ? clone.getEndPositionOfChar(lastIndex) : null;
        const bbox = clone.getBBox();
        clone.remove();
        rows.push({ path: node.getAttribute("data-opf-path"), family: node.getAttribute("font-family"), size: Number(node.getAttribute("font-size")), weight: node.getAttribute("font-weight"), chars: [...text].length, expected, withLength, natural, firstX: first?.x, lastX: last?.x, bboxW: bbox.width, bboxH: bbox.height });
      }
      return { rows, faces: [...document.fonts].filter((f) => f.status === "loaded").length, declared: document.fonts.size };
    }, slide.svg);
    result.push({ id: slide.id, ...rows });
  }
  const version = browser.version();
  await browser.close();
  return { engine, version, external, facesLoaded: loaded, slides: result };
}
const runs = [await measure("chromium", chromium), await measure("webkit", webkit)];

const stat = (values) => {
  const abs = values.filter(Number.isFinite).map(Math.abs).sort((a, b) => a - b);
  const round = (v) => Math.round(v * 1000) / 1000;
  return { count: abs.length, meanAbs: round(abs.reduce((s, v) => s + v, 0) / (abs.length || 1)), p95Abs: round(abs[Math.floor(abs.length * 0.95)] ?? 0), maxAbs: round(abs.at(-1) ?? 0), over0_1: abs.filter((v) => v > 0.1).length, over0_15: abs.filter((v) => v > 0.15).length };
};
const summary = {};
for (const run of runs) {
  const all = run.slides.flatMap((s) => s.rows.map((r) => ({ ...r, slide: s.id })));
  const perDeck = {};
  for (const slide of run.slides) {
    const deckName = slide.id.split("#")[0];
    (perDeck[deckName] ??= []).push(...slide.rows.map((r) => r.natural - r.expected));
  }
  summary[run.engine] = { version: run.version, externalRequests: run.external.length, textElements: all.length, naturalMinusRendererWidthPx: stat(all.map((r) => r.natural - r.expected)), perDeck: Object.fromEntries(Object.entries(perDeck).map(([k, v]) => [k, stat(v)])), textLengthHonoured: stat(all.map((r) => r.withLength - r.expected)), facesLoaded: run.facesLoaded };
}
// Engine against engine: natural widths and first/last positions of the same element.
const [a, b] = runs;
summary.faces = { families: [...usedFamilies].sort(), loaded: usedFaces.length };
const pairs = a.slides.flatMap((slide, i) => slide.rows.map((r, j) => ({ chromium: r, webkit: b.slides[i].rows[j], slide: slide.id })));
summary.webkitMinusChromiumNaturalPx = stat(pairs.map((p) => p.webkit.natural - p.chromium.natural));
summary.webkitMinusChromiumStartXPx = stat(pairs.map((p) => (p.webkit.firstX ?? 0) - (p.chromium.firstX ?? 0)));
summary.webkitMinusChromiumEndXPx = stat(pairs.map((p) => (p.webkit.lastX ?? 0) - (p.chromium.lastX ?? 0)));
summary.worstWebkitElements = pairs.map((p) => ({ slide: p.slide, path: p.webkit.path, family: p.webkit.family, size: p.webkit.size, chars: p.webkit.chars, deltaPx: Math.round((p.webkit.natural - p.webkit.expected) * 1000) / 1000, deltaPercent: Math.round(((p.webkit.natural - p.webkit.expected) / p.webkit.expected) * 100000) / 1000, chromiumDeltaPx: Math.round((p.chromium.natural - p.chromium.expected) * 1000) / 1000 })).sort((x, y) => Math.abs(y.deltaPx) - Math.abs(x.deltaPx)).slice(0, 12);
writeFileSync(out, `${JSON.stringify({ date: "2026-10-02", decks: decks.map((d) => d.name), summary }, null, 1)}\n`);
console.log(JSON.stringify(summary, null, 1));
