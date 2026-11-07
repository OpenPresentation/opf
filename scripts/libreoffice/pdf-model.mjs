// What LibreOffice drew, read from its PDF with the same pdf.js, PDFium-free path the renderer's PDF tests use (lockfile-pinned
// in packages/render): text runs with their positions, the font programs the PDF embeds (the faces LibreOffice actually used),
// and rasterized pages, optionally with a margin around the page so ink drawn past the slide edge is visible.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requireRender = createRequire(path.join(root, "packages/render/package.json"));
const load = async (specifier) => import(pathToFileURL(requireRender.resolve(specifier)).href);
const pdfjs = await load("pdfjs-dist/legacy/build/pdf.mjs");
const { createCanvas } = await load("@napi-rs/canvas");
const pdfLib = await load("pdf-lib");
export const sharp = (await load("sharp")).default;

export async function openPdf(bytes) {
  return pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, verbosity: 0, useSystemFonts: false, disableFontFace: true }).promise;
}

/**
 * The text runs of a page in points, y downward from the page top: [{str, x, baseline, width, size, rotated}]. `width` is the run's
 * advance as pdf.js reports it; trailing spaces are part of it (checks.mjs trims them). With `slideWidth`, positions are scaled to a
 * slide of that width (OPF's own PDF draws the 1280 x 720 reference slide; LibreOffice's PDF is the slide size in points).
 */
export async function pageRuns(doc, number, slideWidth = null) {
  const page = await doc.getPage(number);
  const [, , , pageTop] = page.view;
  const viewport = page.getViewport({ scale: 1 });
  const k = slideWidth ? slideWidth / viewport.width : 1;
  const width = viewport.width * k, height = viewport.height * k;
  const content = await page.getTextContent();
  const runs = [];
  for (const item of content.items) {
    if (typeof item.str !== "string" || !item.str.trim()) continue;
    const [a, b, c, d, e, f] = item.transform;
    runs.push({ str: item.str, x: (e - page.view[0]) * k, baseline: (pageTop - f) * k, width: item.width * k, size: (Math.hypot(c, d) || Math.abs(d) || item.height) * k, rotated: Math.abs(b) > 1e-6 || Math.abs(c) > 1e-6 || a < 0 });
  }
  return { width, height, runs };
}

/** The page's text as pdf.js extracts it, runs joined with spaces. */
export const pageText = (page) => page.runs.map((run) => run.str).join(" ");

/** The font programs the PDF names (BaseFont, subset prefix removed), with whether each is embedded, sorted by name. */
export async function pdfFonts(bytes) {
  const document = await pdfLib.PDFDocument.load(bytes, { updateMetadata: false });
  const { PDFName, PDFDict } = pdfLib;
  const fonts = new Map();
  for (const [, object] of document.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) continue;
    if (object.get(PDFName.of("Type"))?.toString() !== "/Font") continue;
    const base = object.get(PDFName.of("BaseFont"))?.toString().replace(/^\//, "");
    if (!base) continue;
    const name = base.replace(/^[A-Z]{6}\+/, "").replace(/#20/g, " ");
    let descriptor = object.lookup(PDFName.of("FontDescriptor"));
    const descendants = object.lookup(PDFName.of("DescendantFonts"));
    if (!descriptor && descendants) descriptor = descendants.lookup(0)?.lookup(PDFName.of("FontDescriptor"));
    const embedded = Boolean(descriptor && ["FontFile", "FontFile2", "FontFile3"].some((key) => descriptor.get(PDFName.of(key))));
    const entry = fonts.get(name) ?? { name, embedded: false, subtype: object.get(PDFName.of("Subtype"))?.toString().replace(/^\//, "") };
    entry.embedded ||= embedded;
    fonts.set(name, entry);
  }
  return [...fonts.values()].sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Rasterize a page on white at `scale` pixels per point with `margin` points of canvas around it. Returns {png, raw, width,
 * height, channels, offset} where offset is the page origin in pixels; ink outside [offset, offset + page] was drawn past the slide.
 */
export async function rasterize(doc, number, { scale = 1, margin = 0 } = {}) {
  const page = await doc.getPage(number);
  const viewport = page.getViewport({ scale });
  const offset = Math.round(margin * scale);
  const canvas = createCanvas(Math.round(viewport.width) + 2 * offset, Math.round(viewport.height) + 2 * offset);
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport, canvas, transform: offset ? [1, 0, 0, 1, offset, offset] : undefined, background: "rgba(0,0,0,0)" }).promise;
  const png = canvas.toBuffer("image/png");
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { png, raw: data, width: info.width, height: info.height, channels: info.channels, offset, pageWidth: Math.round(viewport.width), pageHeight: Math.round(viewport.height) };
}
