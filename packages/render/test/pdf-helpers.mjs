// Independent PDF reading for the vector PDF tests (RR-12): pdf.js (Apache-2.0) extracts text and rasterizes pages,
// so the checks do not depend on the writer's own model of the file.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";

export async function openPdf(bytes) {
  return pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, verbosity: 0, useSystemFonts: false }).promise;
}

/** The text items of a page in the order pdf.js reports them (content order), each {str, dir}. */
export async function pageItems(doc, pageNumber) {
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  return content.items.filter((item) => typeof item.str === "string");
}

export async function pageText(doc, pageNumber) {
  const items = await pageItems(doc, pageNumber);
  return items.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim();
}

/** Render a page at scale 1 (1 PDF point = 1 pixel) on white; returns {png, width, height}. */
export async function renderPdfPage(doc, pageNumber, scale = 1) {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport, canvas }).promise;
  return { png: canvas.toBuffer("image/png"), width: canvas.width, height: canvas.height };
}

/**
 * Compare two PNGs of equal size after averaging down by `factor` (anti-aliasing differs between rasterizers, geometry
 * must not). Returns the mean absolute channel error (0-255) and the percentage of pixels whose largest channel
 * difference exceeds `threshold`.
 */
export async function compareImages(a, b, { factor = 2, threshold = 48 } = {}) {
  const sizeA = await sharp(a).metadata(), sizeB = await sharp(b).metadata();
  if (sizeA.width !== sizeB.width || sizeA.height !== sizeB.height) throw new Error(`Image sizes differ: ${sizeA.width}x${sizeA.height} vs ${sizeB.width}x${sizeB.height}`);
  const width = Math.round(sizeA.width / factor), height = Math.round(sizeA.height / factor);
  const prepare = (image) => sharp(image).removeAlpha().resize(width, height, { kernel: "lanczos3" }).raw().toBuffer();
  const [left, right] = await Promise.all([prepare(a), prepare(b)]);
  let sum = 0, large = 0;
  const pixels = left.length / 3;
  for (let pixel = 0; pixel < pixels; pixel++) {
    let largest = 0;
    for (let channel = 0; channel < 3; channel++) {
      const difference = Math.abs(left[pixel * 3 + channel] - right[pixel * 3 + channel]);
      sum += difference;
      if (difference > largest) largest = difference;
    }
    if (largest > threshold) large++;
  }
  return { mae: sum / left.length, largePercent: 100 * large / pixels };
}

export function percentile(sortedValues, fraction) {
  if (!sortedValues.length) return 0;
  return sortedValues[Math.min(sortedValues.length - 1, Math.floor(fraction * (sortedValues.length - 1) + 0.5))];
}

// ---- Other engines (PDFium, poppler) and a structural check (qpdf) ------------------------------------------------

let pdfiumLibrary = null;
async function pdfium() {
  if (!pdfiumLibrary) {
    const { PDFiumLibrary } = await import("@hyzyla/pdfium");
    pdfiumLibrary = await PDFiumLibrary.init();
  }
  return pdfiumLibrary;
}

/** The text of page 1 as PDFium (Chrome, Edge) extracts it, lines joined with a single space. */
export async function pdfiumText(bytes) {
  const document = await (await pdfium()).loadDocument(new Uint8Array(bytes));
  try { return document.getPage(0).getText().replace(/\s+/g, " ").trim(); } finally { document.destroy(); }
}

/** poppler's pdftotext when it is installed, else null. */
export async function popplerText(bytes) {
  const { spawnSync } = await import("node:child_process");
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  if (spawnSync("pdftotext", ["-v"], { encoding: "utf8" }).error) return null;
  const directory = await mkdtemp(join(tmpdir(), "opf-poppler-"));
  try {
    const file = join(directory, "in.pdf");
    await writeFile(file, bytes);
    const run = spawnSync("pdftotext", ["-enc", "UTF-8", "-nopgbrk", file, "-"], { encoding: "utf8" });
    if (run.status !== 0) return null;
    // poppler adds directional marks around right-to-left runs.
    return run.stdout.replace(/[\u202a-\u202e\u2066-\u2069\u200e\u200f]/g, "").replace(/\s+/g, " ").trim();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** `qpdf --check` (WebAssembly build); returns the diagnostics other than the success lines, empty when the file is sound. */
export async function qpdfCheck(bytes) {
  // The CommonJS build reads the WebAssembly file itself; the streaming loader would try to fetch it.
  const { createRequire } = await import("node:module");
  const { dirname } = await import("node:path");
  const { readFile } = await import("node:fs/promises");
  const require = createRequire(import.meta.url);
  const createModule = require("@jspawn/qpdf-wasm");
  const wasmBinary = await readFile(`${dirname(require.resolve("@jspawn/qpdf-wasm/package.json"))}/qpdf.wasm`);
  const output = [];
  const streaming = WebAssembly.instantiateStreaming;
  WebAssembly.instantiateStreaming = undefined;
  let qpdf;
  try { qpdf = await createModule({ wasmBinary, print: (line) => output.push(line), printErr: (line) => output.push(`E:${line}`) }); } finally { WebAssembly.instantiateStreaming = streaming; }
  qpdf.FS.writeFile("/in.pdf", new Uint8Array(bytes));
  let status;
  // The module also writes its report to the console.
  const write = process.stdout.write, writeError = process.stderr.write;
  process.stdout.write = (chunk) => { output.push(String(chunk)); return true; };
  process.stderr.write = (chunk) => { output.push(`E:${chunk}`); return true; };
  try { status = qpdf.callMain(["--check", "/in.pdf"]); } catch (error) { status = error.status ?? 99; } finally { process.stdout.write = write; process.stderr.write = writeError; }
  const text = output.join("\n").replace(/No syntax or stream encoding errors found[^\n]*\s*errors that qpdf cannot detect/g, "").replace(/checking \/in\.pdf/g, "").replace(/PDF Version: [\d.]+/g, "").replace(/File is not encrypted/g, "").replace(/File is not linearized/g, "").trim();
  return { status, text };
}
