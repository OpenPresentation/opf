// RR-17 (Mac checks): vector PDFs (opf-render 0.12.0 svgToPdf, mode vector) and PPTX files (opf-pptx) of five decks, plus the text each
// slide's SVG draws (for the PDFKit comparison). Run from a directory where @openpresentation/opf, opf-render, opf-pptx and the
// optional script font packs (the opf-render peer dependencies) are installed:
//   cp generate-pdf-pptx.mjs <dir> && cd <dir> && node generate-pdf-pptx.mjs <decks dir> <out dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { examples } from "@openpresentation/opf/examples";
import { renderSvgDeck, svgToPdf } from "@openpresentation/opf-render";
import { loadOfficeFontRegistry } from "@openpresentation/opf-render/fonts-node";
import { parseXml, textContent } from "./node_modules/@openpresentation/opf-render/dist/pdf-xml.js";
import { toPptx } from "@openpresentation/opf-pptx";

const [decksDir, outDir] = process.argv.slice(2).map((p) => path.resolve(p));
const picks = ["business-functions/contract-cycle-time-brief", "technical/chart-data-sources", "decks:cjk", "decks:rtl", "decks:indic-sea"];
mkdirSync(path.join(outDir, "pdf"), { recursive: true }); mkdirSync(path.join(outDir, "pptx"), { recursive: true });
const fonts = await loadOfficeFontRegistry({ substitutionPolicy: "visual", scripts: "all" });
const drawnLines = (svg) => { const out = []; const visit = (n) => { if (n.name === "text") out.push(textContent(n)); else for (const c of n.children ?? []) visit(c); }; visit(parseXml(svg)); return out; };
const summary = [];
for (const name of picks) {
  const entry = name.startsWith("decks:") ? { deck: JSON.parse(readFileSync(path.join(decksDir, `${name.slice(6)}.opf.json`), "utf8")) } : examples.find((e) => e.file.includes(name));
  const slug = name.split(/[/:]/).pop();
  const svgs = renderSvgDeck(entry.deck, { trace: true, textMeasurement: fonts.textMeasurement, embeddedFonts: fonts.embeddedFonts });
  const embedded = new Set();
  const diagnostics = {};
  const pdf = await svgToPdf(svgs, { fontFiles: fonts.fontFiles, useBundledFonts: false, mode: "vector", metadata: { title: entry.deck.name ?? slug, language: typeof entry.deck.language === "string" ? entry.deck.language : "en" }, onDiagnostic: (d) => { if (d.code === "pdf-font-embedded") embedded.add(`${d.family} ${d.weight}`); else diagnostics[d.code] = (diagnostics[d.code] ?? 0) + 1; } });
  writeFileSync(path.join(outDir, "pdf", `${slug}.pdf`), pdf);
  const lines = svgs.map(drawnLines);
  writeFileSync(path.join(outDir, "pdf", `${slug}.expected.json`), JSON.stringify({ slides: svgs.length, pages: lines.map((l) => l.join("")), lines }));
  const pptx = await toPptx(entry.deck);
  writeFileSync(path.join(outDir, "pptx", `${slug}.pptx`), pptx);
  summary.push({ deck: slug, slides: svgs.length, pdfBytes: pdf.length, pptxBytes: pptx.length, embeddedFaces: [...embedded].sort(), pdfDiagnostics: diagnostics });
}
writeFileSync(path.join(outDir, "pdf", "summary.json"), `${JSON.stringify(summary, null, 1)}\n`);
console.log(JSON.stringify(summary, null, 1));
