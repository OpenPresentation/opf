// RR-12: vector PDF with selectable text. Checks the PDF structure, a text-extraction round trip against the authored
// text (Latin ligatures and accents, CJK, right-to-left and mixed-direction), determinism, links, metadata, tagging,
// font-embedding permissions, diagnostics and fallbacks, and (separately, test/pdf-vector-visual.mjs) appearance.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFString, PDFHexString, decodePDFRawStream } from "pdf-lib";
import {svgToPdf, svgToPng, renderSvg} from "../dist/index.js";
import {loadFonts} from "../dist/fonts-node.js";
import sharp from "sharp";
import { compareImages, openPdf, pageItems, pageText, pdfiumText, popplerText, qpdfCheck, renderPdfPage } from "./pdf-helpers.mjs";

const TINY_PNG = "data:image/png;base64," + (await sharp({ create: { width: 4, height: 4, channels: 3, background: "#e03030" } }).png().toBuffer()).toString("base64");
const SCHEMA = "https://openpresentation.org/schema/opf/v1";
const nfkc = (text) => text.normalize("NFKC").replace(/\s+/g, " ").trim();
// Lines wrap, so whole-text comparisons ignore all whitespace; word-level checks keep it.
const compact = (text) => nfkc(text).replace(/\s/g, "");

async function renderDeck(deck, options = {}) {
  const fonts = (await loadFonts({pack: 'office', substitutionPolicy: "visual", scripts: "auto", presentation: deck})).registry;
  const svgs = renderSvg(deck, { fonts: {textMeasurement: fonts.textMeasurement, embeddedFonts: fonts.embeddedFonts}, trace: true, ...options });
  return { svgs, pdfOptions: { fonts: {fontFiles: fonts.fontFiles, useBundledFonts: false}} };
}

async function lowLevel(bytes) {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const objects = document.context.enumerateIndirectObjects();
  const stream = (object) => Buffer.from(decodePDFRawStream(object).decode());
  return { document, objects, stream };
}

// ---- API surface ----------------------------------------------------------------------------------------------
{
  const { svgs, pdfOptions } = await renderDeck({ $schema: SCHEMA, name: "API", slides: [{ title: "Hello", text: "World" }] });
  const byDefault = await svgToPdf(svgs, pdfOptions);
  const explicit = await svgToPdf(svgs, { ...pdfOptions, mode: "vector" });
  assert.deepEqual(byDefault, explicit, "vector is the default PDF mode");
  const raster = await svgToPdf(svgs, { ...pdfOptions, mode: "raster", scale: 0.25 });
  assert.notDeepEqual(raster, byDefault);
  await assert.rejects(svgToPdf(svgs, { mode: "bitmap" }), (error) => error.code === "invalid-conversion-option" && error.details.option === "mode");
  await assert.rejects(svgToPdf(svgs, { ...pdfOptions, fonts: { ...pdfOptions.fonts, loadSystemFonts: true } }), (error) => error.code === "pdf-system-fonts-unsupported");
  // The raster mode stays an image per page; the vector mode has no page-sized picture and real text.
  const rasterLow = await lowLevel(raster);
  const rasterImages = rasterLow.objects.filter(([, object]) => object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype"))?.toString() === "/Image");
  assert.equal(rasterImages.length, 1, "raster mode: one image per slide");
  assert.equal((await pageItems(await openPdf(raster), 1)).length, 0, "raster mode has no extractable text");
  assert.match(await pageText(await openPdf(byDefault), 1), /Hello World/, "vector mode extracts the authored text");
}

// ---- Structure: real text, embedded subsets, no page-sized image ---------------------------------------------------
{
  const deck = { $schema: SCHEMA, name: "Structure", language: "en-GB", slides: [{ title: "Quarterly review", text: "Revenue grew 12% year on year.", items: ["First point", "Second point"] }] };
  const { svgs, pdfOptions } = await renderDeck(deck);
  const diagnostics = [];
  const pdf = await svgToPdf(svgs, { ...pdfOptions, onDiagnostic: (d) => diagnostics.push(d) });
  const { document, objects, stream } = await lowLevel(pdf);
  const [page] = document.getPages();
  const { width, height } = page.getSize();
  assert.deepEqual([width, height], [1280, 720], "page size comes from the SVG");
  let fonts = 0;
  for (const [, object] of objects) {
    if (!(object instanceof PDFDict)) continue;
    if (object.get(PDFName.of("Subtype"))?.toString() === "/Type0") {
      fonts++;
      assert.match(object.get(PDFName.of("BaseFont")).toString(), /^\/[A-Z]{6}\+/, "subset tag");
      assert.ok(object.get(PDFName.of("ToUnicode")), "ToUnicode map");
    }
  }
  assert.ok(fonts >= 1);
  const descriptors = objects.filter(([, object]) => object instanceof PDFDict && object.get(PDFName.of("Type"))?.toString() === "/FontDescriptor");
  assert.equal(descriptors.length, fonts);
  for (const [, descriptor] of descriptors) assert.ok(descriptor.get(PDFName.of("FontFile2")), "TrueType subset embedded");
  for (const [, object] of objects) {
    if (!(object instanceof PDFRawStream) || object.dict.get(PDFName.of("Subtype"))?.toString() !== "/Image") continue;
    const w = object.dict.get(PDFName.of("Width")).asNumber(), h = object.dict.get(PDFName.of("Height")).asNumber();
    assert.ok(w < width * 0.9 || h < height * 0.9, "no page-sized image in vector output");
  }
  const contents = page.node.Contents();
  const content = stream(document.context.lookup(contents));
  const operators = content.toString("latin1");
  assert.match(operators, /BT[\s\S]*?\bTJ\b[\s\S]*?ET/, "text is drawn with text operators");
  assert.ok(!/\sTr\n/.test(operators) || !/\n3 Tr/.test(operators), "no invisible (render mode 3) text layer");
  const embedded = diagnostics.filter((d) => d.code === "pdf-font-embedded");
  assert.equal(embedded.length, fonts);
  for (const report of embedded) {
    assert.equal(report.embedding, "subset");
    assert.ok(report.bytes < 40_000, `subset ${report.postscriptName} is small (${report.bytes} bytes)`);
    assert.ok(!/arial|calibri|aptos|helvetica|times/i.test(report.postscriptName), "never a proprietary face");
  }
  assert.deepEqual(diagnostics.filter((d) => d.code === "pdf-raster-fallback"), [], "nothing was rasterized");
  const doc = await openPdf(pdf);
  assert.match(await pageText(doc, 1), /Quarterly review.*Revenue grew 12% year on year\..*First point.*Second point/);
}

// ---- Text round trips through the renderer, read by pdf.js ---------------------------------------------------------------
const roundTrips = [
  {
    name: "latin",
    deck: { $schema: SCHEMA, name: "Latin", slides: [{
      title: "Résumé: naïve façade ﬁnal ﬂow",
      text: "Café déjà vu, with é and ö combining marks, ligatures ﬁ ﬂ ﬃ, “smart quotes”, an en–dash and 100% — done.",
      items: ["Zoë’s 3 × 4 ≈ 12", "Ångström & Œuvre"],
    }] },
    expect: ["Résumé: naïve façade final flow", "Café déjà vu, with é and ö combining marks, ligatures fi fl ffi, “smart quotes”, an en–dash and 100% — done.", "Zoë’s 3 × 4 ≈ 12", "Ångström & Œuvre"],
  },
  {
    name: "japanese",
    deck: { $schema: SCHEMA, name: "Japanese", language: "ja", slides: [{ title: "四半期レビュー", text: "日本語のテキストと漢字、カタカナ。", items: ["売上は12%増加", "計画を確認する"] }] },
    expect: ["四半期レビュー", "日本語のテキストと漢字、カタカナ。", "売上は12%増加", "計画を確認する"],
  },
  {
    name: "chinese-and-korean",
    deck: { $schema: SCHEMA, name: "CJK", language: "zh-Hans", slides: [{ title: "季度回顾", text: "收入同比增长百分之十二，成本保持稳定。", items: ["분기별 검토", "Ship 日本語 text"] }] },
    expect: ["季度回顾", "收入同比增长百分之十二，成本保持稳定。", "분기별 검토", "Ship 日本語 text"],
  },
];
for (const { name, deck, expect } of roundTrips) {
  const { svgs, pdfOptions } = await renderDeck(deck);
  const pdf = await svgToPdf(svgs, pdfOptions);
  const text = nfkc(await pageText(await openPdf(pdf), 1));
  for (const wanted of expect) assert.ok(compact(text).includes(compact(wanted)), `${name}: extracted text keeps "${wanted}"; got "${text}"`);
}

// ---- Ordered logical text in independent readers --------------------------------------------------------------------
// Each case is one line of one script. pdf.js, PDFium (Chrome, Edge) and, when it is installed, poppler must return
// the authored text in logical order, compared as ordered text (no re-sorting of runs). Right-to-left runs are drawn in visual
// order inside /ReversedChars with per-glyph /ActualText where the glyph map cannot give the text, as Chromium writes them;
// reordered Indic and Khmer clusters carry /ActualText per cluster. The readers named in `skip` do not read that script
// correctly from Chromium's own PDF either (PDFium on Thai and Burmese marks) or by design do not honour /ActualText (pdf.js).
{
  const registry = (await loadFonts({pack: 'base', scripts: "all"})).registry;
  const options = { fonts: {fontFiles: registry.fontFiles, useBundledFonts: false}};
  const rtl = (text) => `⁧${text}⁩`;
  const strip = (text) => text.replace(/[\s​‎‏]/g, "").normalize("NFKC");
  const cases = [
    ["latin ligatures", "Roboto", "Résumé: naïve façade ﬁnal ﬂow office ﬃ", "Résumé: naïve façade final flow office ffi", []],
    ["latin marks", "Roboto", "Café déjà vu é ö", "Café déjà vu é ö", []],
    ["japanese", "Noto Sans JP", "四半期レビュー 日本語のテキストと漢字、カタカナ。", "四半期レビュー 日本語のテキストと漢字、カタカナ。", []],
    ["chinese", "Noto Sans SC", "季度回顾 收入同比增长百分之十二，成本保持稳定。", "季度回顾 收入同比增长百分之十二，成本保持稳定。", []],
    ["korean", "Noto Sans KR", "분기별 검토 매출 성장", "분기별 검토 매출 성장", []],
    ["hebrew", "Noto Sans Hebrew", rtl("ההכנסות צמחו לעומת השנה שעברה"), "ההכנסות צמחו לעומת השנה שעברה", []],
    ["arabic", "Noto Naskh Arabic", rtl("نمت الإيرادات بنسبة مقارنة بالعام الماضي"), "نمت الإيرادات بنسبة مقارنة بالعام الماضي", []],
    ["arabic lam-alef ligature", "Noto Naskh Arabic", rtl("لا يوجد الله"), "لا يوجد الله", []],
    ["syriac", "Noto Sans Syriac", rtl("ܠܫܢܐ ܣܘܪܝܝܐ"), "ܠܫܢܐ ܣܘܪܝܝܐ", []],
    ["devanagari", "Noto Sans Devanagari", "किताब हिन्दी क्षत्रिय तिमाही", "किताब हिन्दी क्षत्रिय तिमाही", ["pdfjs"]],
    ["bengali", "Noto Sans Bengali", "বাংলা ভাষা কিতাব কৌতুক", "বাংলা ভাষা কিতাব কৌতুক", ["pdfjs"]],
    ["tamil", "Noto Sans Tamil", "தமிழ் மொழி கொடு சௌ", "தமிழ் மொழி கொடு சௌ", ["pdfjs"]],
    ["gujarati", "Noto Sans Gujarati", "ગુજરાતી ભાષા કિતાબ", "ગુજરાતી ભાષા કિતાબ", ["pdfjs", "poppler"]],
    ["khmer", "Noto Sans Khmer", "ភាសាខ្មែរ ខ្មែរ", "ភាសាខ្មែរ ខ្មែរ", ["pdfjs"]],
    ["thai", "Noto Sans Thai", "ภาษาไทย ที่ปรึกษา น้ำ", "ภาษาไทย ที่ปรึกษา น้ำ", ["pdfium", "poppler"]],
    ["burmese", "Noto Sans Myanmar", "မြန်မာဘာသာ ကျွန်ုပ်", "မြန်မာဘာသာ ကျွန်ုပ်", ["pdfium", "poppler"]],
  ];
  const readers = { pdfjs: async (pdf) => pageText(await openPdf(pdf), 1), pdfium: pdfiumText, poppler: popplerText };
  let popplerSeen = false;
  for (const [name, family, text, expected, skip] of cases) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="140"><text x="40" y="90" font-family="${family}" font-size="32" xml:space="preserve">${text}</text></svg>`;
    const pdf = await svgToPdf(svg, options);
    for (const [reader, read] of Object.entries(readers)) {
      if (skip.includes(reader)) continue;
      const got = await read(pdf);
      if (got === null) continue; // poppler is optional
      if (reader === "poppler") popplerSeen = true;
      assert.equal(strip(got), strip(expected), `${name}: ${reader} reads "${got}", expected "${expected}"`);
    }
  }
  if (!popplerSeen) console.log("pdf-vector: poppler (pdftotext) is not installed; its extraction was not checked.");

  // Mixed directions: every run reads in logical order inside itself; the order of runs in a line is the reader's.
  const mixed = `Revenue ${rtl("شركة")} growth and ${rtl("שלום עולם")} end`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="140"><text x="40" y="90" font-family="Roboto" font-size="32" xml:space="preserve">${mixed}</text></svg>`;
  const pdf = await svgToPdf(svg, options);
  for (const [reader, read] of Object.entries(readers)) {
    const got = await read(pdf);
    if (got === null) continue;
    for (const word of ["Revenue", "شركة", "growth", "and", "שלום", "עולם", "end"]) assert.ok(strip(got).includes(strip(word)), `mixed: ${reader} keeps "${word}" in "${got}"`);
  }
  assert.equal(strip(await pdfiumText(pdf)).startsWith(strip("Revenue")), true);

  // The structure in the file: right-to-left runs are marked reversed, left-to-right runs are not.
  const { document, stream } = await lowLevel(pdf);
  const content = stream(document.context.lookup(document.getPages()[0].node.Contents())).toString("latin1");
  assert.ok(/\/ReversedChars BMC/.test(content), "right-to-left runs are marked /ReversedChars");
  assert.ok((content.match(/\/ReversedChars BMC/g) ?? []).length >= 2, "each right-to-left run is marked");
  assert.ok(!/\/ActualText <FEFF>/.test(content), "no empty /ActualText spans");
}

// ---- Determinism --------------------------------------------------------------------------------------------------------
{
  const deck = { $schema: SCHEMA, name: "Determinism", slides: [{ title: "Same bytes", text: "Every run, every machine." }, { title: "Second slide", items: ["One", "Two"] }] };
  const { svgs, pdfOptions } = await renderDeck(deck);
  const first = await svgToPdf(svgs, pdfOptions);
  const second = await svgToPdf(svgs, pdfOptions);
  assert.deepEqual(first, second, "repeatable bytes");
  const withDates = await svgToPdf(svgs, { ...pdfOptions, metadata: { title: "T", creationDate: "2026-01-02T03:04:05Z" } });
  assert.deepEqual(withDates, await svgToPdf(svgs, { ...pdfOptions, metadata: { title: "T", creationDate: new Date("2026-01-02T03:04:05Z") } }), "caller-supplied dates are the only dates");
  const text = Buffer.from(first).toString("latin1");
  assert.ok(!/CreationDate|ModDate/.test(text), "no timestamps unless the caller supplies them");
  assert.match(text, /\/ID\[<[0-9A-F]{32}><[0-9A-F]{32}>\]/);
  // Uncompressed output carries the same content (a debugging aid), also repeatable.
  const plain = await svgToPdf(svgs, { ...pdfOptions, compress: false });
  assert.deepEqual(plain, await svgToPdf(svgs, { ...pdfOptions, compress: false }));
  assert.ok(plain.length > first.length);
}

// ---- Byte-for-byte reproducibility across machines ----------------------------------------------------------------------
// A frozen SVG (Latin ligatures and kerning, CJK, Arabic and Hebrew runs, a gradient, a hatch pattern, a clip, a translucent
// group, a link, a rotation) exported with the pinned bundled fonts must hash to the same value on every operating system and
// Node version. If a dependency or font bump changes the bytes on purpose, review the diff and update the hash.
{
  const registry = (await loadFonts({pack: 'base', scripts: "all"})).registry;
  const svg = await readFile(new URL("fixtures/pdf/mixed-script-slide.svg", import.meta.url), "utf8");
  const options = { fonts: {fontFiles: registry.fontFiles, useBundledFonts: false}, metadata: { title: "Fixture", author: "OPF", language: "en-GB", creationDate: "2026-01-01T00:00:00Z" } };
  const pdf = await svgToPdf(svg, options);
  assert.deepEqual(pdf, await svgToPdf(svg, options));
  const digest = createHash("sha256").update(pdf).digest("hex");
  assert.equal(digest, "60ae05d47ee3b394ff6d6b8cadc5e9740b52f9f2e3eb52388e20c80a185591e9", `fixture PDF bytes changed (${pdf.length} bytes, sha256 ${digest})`);
  const text = nfkc(await pageText(await openPdf(pdf), 1));
  for (const wanted of ["Résumé: final flow café", "日本語のテキストと漢字", "openpresentation.org", "Stretched to a measured width"]) assert.ok(compact(text).includes(compact(wanted)), `fixture text: ${wanted}`);
}

// ---- Pages, metadata, language, links, tagging ------------------------------------------------------------------------
{
  const wide = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450" lang="fr-CA"><rect width="800" height="450" fill="#eef"/><a href="https://example.com/path?q=1&amp;r=%C3%A9"><text x="40" y="100" font-family="Roboto" font-size="30" fill="#06c" text-decoration="underline" xml:space="preserve">Lien de test</text></a><a href="javascript:alert(1)"><text x="40" y="160" font-family="Roboto" font-size="30" xml:space="preserve">Not a link</text></a></svg>`;
  const portrait = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="700" viewBox="0 0 400 700" lang="de"><rect width="400" height="700" fill="#fee"/><image width="64" height="64" x="20" y="20" aria-label="Pixel" href="${TINY_PNG}"/><text x="20" y="130" font-family="Roboto" font-size="20">Portrait page</text></svg>`;
  const diagnostics = [];
  const pdf = await svgToPdf([wide, portrait], {
    metadata: { title: "Deck title", author: "Ada Lovelace", subject: "Test", keywords: ["a", "b"], language: "fr-CA", creationDate: "2026-05-06T07:08:09Z" },
    onDiagnostic: (d) => diagnostics.push(d),
  });
  const { document, objects } = await lowLevel(pdf);
  const pages = document.getPages();
  assert.deepEqual(pages.map((page) => Object.values(page.getSize())), [[800, 450], [400, 700]], "each page keeps its own size");
  assert.equal(document.getTitle(), "Deck title");
  assert.equal(document.getAuthor(), "Ada Lovelace");
  assert.equal(document.getKeywords(), "a, b");
  const catalog = document.catalog;
  assert.equal(catalog.get(PDFName.of("Lang")).decodeText(), "fr-CA");
  assert.equal(catalog.get(PDFName.of("MarkInfo")).get(PDFName.of("Marked")).toString(), "true");
  assert.ok(catalog.get(PDFName.of("StructTreeRoot")), "structure tree for reading order");
  assert.ok(catalog.get(PDFName.of("Metadata")), "XMP metadata");
  const annotations = objects.filter(([, object]) => object instanceof PDFDict && object.get(PDFName.of("Subtype"))?.toString() === "/Link");
  assert.equal(annotations.length, 1, "one link; the javascript: target is refused");
  const action = annotations[0][1].get(PDFName.of("A"));
  assert.equal(action.get(PDFName.of("URI")).decodeText(), "https://example.com/path?q=1&r=%C3%A9");
  assert.ok(diagnostics.some((d) => d.code === "pdf-link-skipped"));
  const rect = annotations[0][1].get(PDFName.of("Rect")).asArray().map((n) => n.asNumber());
  assert.ok(rect[0] >= 35 && rect[2] > rect[0] + 100 && rect[1] > 300 && rect[3] < 450, `link rectangle sits on its text (${rect})`);
  const roles = objects.filter(([, object]) => object instanceof PDFDict && object.get(PDFName.of("Type"))?.toString() === "/StructElem").map(([, object]) => object.get(PDFName.of("S")).toString());
  for (const role of ["/Document", "/Sect", "/P", "/Link", "/Figure"]) assert.ok(roles.includes(role), `structure has ${role}`);
  const sectionLanguages = objects.filter(([, object]) => object instanceof PDFDict && object.get(PDFName.of("S"))?.toString() === "/Sect").map(([, object]) => object.get(PDFName.of("Lang"))?.decodeText());
  assert.deepEqual(sectionLanguages.sort(), ["de", undefined], "a slide in another language than the document says so on its section");
  const untagged = await svgToPdf([wide], { tagged: false });
  assert.ok(!(await lowLevel(untagged)).document.catalog.get(PDFName.of("StructTreeRoot")), "tagging can be switched off");
  assert.match(await pageText(await openPdf(pdf), 1), /Lien de test/);
}

// ---- Fonts: only what is supplied; embedding permissions are honoured; no system fonts --------------------------------
{
  const registry = (await loadFonts({pack: 'base'})).registry;
  const roboto = registry.fontFiles.find((file) => /Roboto_400Regular\.ttf$/.test(file));
  assert.ok(roboto, "bundled Roboto Regular");
  const bytes = new Uint8Array(await readFile(roboto));
  // Set the OS/2 fsType restricted-license embedding bit in a private copy.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(4);
  let patched = false;
  for (let index = 0; index < count; index++) {
    const at = 12 + index * 16;
    if (String.fromCharCode(...bytes.subarray(at, at + 4)) === "OS/2") { view.setUint16(view.getUint32(at + 8) + 8, 0x0002); patched = true; }
  }
  assert.ok(patched);
  const directory = await mkdtemp(path.join(os.tmpdir(), "opf-pdf-"));
  try {
    const restricted = path.join(directory, "Restricted.ttf");
    await writeFile(restricted, bytes);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100"><text x="10" y="50" font-family="Roboto" font-size="20">Embeddable text</text></svg>`;
    // Only the restricted face is supplied: nothing may be embedded, so the export refuses rather than bypass it.
    const diagnostics = [];
    await assert.rejects(svgToPdf(svg, { fonts: {useBundledFonts: false, fontFiles: [restricted]}, onDiagnostic: (d) => diagnostics.push(d) }), (error) => error.code === "pdf-font-unavailable");
    assert.ok(diagnostics.some((d) => d.code === "pdf-font-embedding-restricted"), "restriction reported");
    // With a permitted face also available, the permitted one is used and reported as the substitute.
    const both = [];
    const pdf = await svgToPdf(svg, { fonts: {useBundledFonts: false, fontFiles: [restricted, registry.fontFiles.find((file) => /Roboto_500Medium\.ttf$/.test(file))]}, onDiagnostic: (d) => both.push(d) });
    assert.match(await pageText(await openPdf(pdf), 1), /Embeddable text/);
    const embedded = both.filter((d) => d.code === "pdf-font-embedded");
    assert.equal(embedded.length, 1);
    assert.equal(embedded[0].weight, 500, "the permitted face was embedded");
    assert.ok(both.some((d) => d.code === "pdf-font-embedding-restricted"));
    // fontDirs are searched too, and every face found there is checked the same way.
    const fromDirectory = await svgToPdf(svg, { fonts: {useBundledFonts: false}, fontDirs: [path.dirname(roboto)] });
    assert.match(await pageText(await openPdf(fromDirectory), 1), /Embeddable text/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  // A requested family that has no face is reported, with the face used instead.
  const notes = [];
  await svgToPdf(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><text x="10" y="50" font-family="Garamond, serif" font-size="20">Substituted</text></svg>`, { onDiagnostic: (d) => notes.push(d) });
  const substituted = notes.find((d) => d.code === "pdf-font-substituted");
  assert.equal(substituted?.requestedFamily, "Garamond");
  assert.equal(substituted?.resolvedFamily, "roboto");
}

// ---- Effects with no vector equivalent: reported, rasterized for that element only, or rejected in strict mode --------------
{
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><defs><filter id="f"><feColorMatrix type="saturate" values="0"/></filter></defs><rect width="300" height="200" fill="#fff"/><g data-opf-path="slides.0.shape" filter="url(#f)"><rect x="20" y="20" width="100" height="60" fill="#f80"/></g><text x="20" y="150" font-family="Roboto" font-size="24">Still real text</text></svg>`;
  const diagnostics = [];
  const pdf = await svgToPdf(svg, { onDiagnostic: (d) => diagnostics.push(d) });
  const fallback = diagnostics.filter((d) => d.code === "pdf-raster-fallback");
  assert.equal(fallback.length, 1);
  assert.equal(fallback[0].path, "slides.0.shape", "the fallback names the affected path");
  assert.match(await pageText(await openPdf(pdf), 1), /Still real text/);
  await assert.rejects(svgToPdf(svg, { strict: true }), (error) => error.code === "pdf-raster-fallback" && error.details.path === "slides.0.shape");
  await assert.rejects(svgToPdf("<html/>"), (error) => error.code === "invalid-svg");
}

// ---- Vector drawing: shapes stay paths, gradients and patterns stay PDF shadings/tilings, translucent groups stay groups -----
{
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient><pattern id="p" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="#999" stroke-width="2"/></pattern></defs><rect width="400" height="300" fill="url(#p)"/><rect x="20" y="20" width="120" height="80" fill="url(#g)" rx="10"/><g opacity="0.5"><rect x="200" y="20" width="80" height="80" fill="#f00"/><rect x="240" y="60" width="80" height="80" fill="#00f"/></g></svg>`;
  const pdf = await svgToPdf(svg);
  const { objects } = await lowLevel(pdf);
  const types = objects.map(([, object]) => (object instanceof PDFDict ? object : object.dict)?.get?.(PDFName.of("PatternType"))?.toString()).filter(Boolean);
  assert.deepEqual(types.sort(), ["1", "2"], "one tiling pattern and one shading pattern");
  assert.ok(objects.some(([, object]) => (object.dict ?? object)?.get?.(PDFName.of("Subtype"))?.toString() === "/Form"), "opacity group is a form XObject");
  assert.ok(!objects.some(([, object]) => object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype"))?.toString() === "/Image"), "no raster image anywhere");
}

// ---- Pictures: JPEG (all eight EXIF orientations), WebP and PNG alpha keep their pixels in the vector PDF -------------------
{
  const imageSvg = (width, height, uri, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image aria-label="Specimen" x="0" y="0" width="${width}" height="${height}" href="${uri}" ${extra}/></svg>`;
  for (let orientation = 1; orientation <= 8; orientation++) {
    const jpeg = await readFile(new URL(`fixtures/jpeg/orientation-${orientation}.jpg`, import.meta.url));
    const expected = await readFile(new URL(`fixtures/jpeg/expected-${orientation}.png`, import.meta.url));
    const { width, height } = await sharp(expected).metadata();
    const pdf = await svgToPdf(imageSvg(width, height, "data:image/jpeg;base64," + jpeg.toString("base64")));
    const rendered = await renderPdfPage(await openPdf(pdf), 1);
    const { mae } = await compareImages(rendered.png, expected, { factor: 1 });
    assert.ok(mae <= 3, `JPEG orientation ${orientation} keeps its pixels in the vector PDF (mean error ${mae.toFixed(2)})`);
    // An unoriented JPEG is passed through undecoded (DCTDecode).
    const jpegStreams = (await lowLevel(pdf)).objects.filter(([, object]) => object instanceof PDFRawStream && object.dict.get(PDFName.of("Filter"))?.toString() === "/DCTDecode");
    assert.equal(jpegStreams.length, orientation === 1 ? 1 : 0, `orientation ${orientation}: JPEG pass-through only when upright`);
  }
  const references = JSON.parse(await readFile(new URL("fixtures/webp/webp-references.json", import.meta.url), "utf8"));
  for (const [file, reference] of Object.entries(references)) {
    const bytes = await readFile(new URL(`fixtures/webp/${file}`, import.meta.url));
    const decoded = await sharp(bytes).autoOrient().ensureAlpha().png().toBuffer();
    const webpSvg = imageSvg(reference.width, reference.height, "data:image/webp;base64," + bytes.toString("base64"));
    const pngSvg = imageSvg(reference.width, reference.height, "data:image/png;base64," + decoded.toString("base64"));
    const rendered = await renderPdfPage(await openPdf(await svgToPdf(webpSvg)), 1);
    const { mae } = await compareImages(rendered.png, await svgToPng(pngSvg), { factor: 1 });
    assert.ok(mae <= 3, `${file}: WebP (with transparency) draws as the decoded picture (mean error ${mae.toFixed(2)})`);
  }
  // The same picture used twice is stored once.
  const png = TINY_PNG;
  const twice = await svgToPdf(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><image x="0" y="0" width="40" height="40" href="${png}"/><image x="50" y="0" width="40" height="40" href="${png}"/></svg>`);
  assert.equal((await lowLevel(twice)).objects.filter(([, object]) => object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype"))?.toString() === "/Image").length, 1, "identical pictures share one image object");
  await assert.rejects(svgToPdf(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><image x="0" y="0" width="40" height="40" href="https://example.invalid/a.png"/></svg>`, { strict: true }), (error) => error.code === "pdf-image-skipped", "remote pictures are never fetched");
}

// ---- Arbitrary SVG: nothing is dropped silently, hostile input is bounded ------------------------------------------------------
{
  const svgOf = (body, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100" ${extra}>${body}</svg>`;
  const contentOf = async (pdf) => {
    const { document, stream } = await lowLevel(pdf);
    return stream(document.context.lookup(document.getPages()[0].node.Contents())).toString("latin1");
  };
  const collect = async (svg, options = {}) => {
    const diagnostics = [];
    const pdf = await svgToPdf(svg, { compress: true, ...options, onDiagnostic: (d) => diagnostics.push(d) });
    return { pdf, diagnostics, content: await contentOf(pdf) };
  };

  // Colours: every CSS named colour, hsl(), rgb() and style declarations.
  {
    const { content } = await collect(svgOf(`<rect width="10" height="10" fill="rebeccapurple"/><rect width="10" height="10" style="fill:hsl(120,100%,25%)"/><rect width="10" height="10" fill="rgb(100%,0%,0%)"/><rect width="10" height="10" fill="lightgoldenrodyellow"/>`));
    for (const colour of ["0.4 0.2 0.6 rg", "0 0.5 0 rg", "1 0 0 rg", "0.9804 0.9804 0.8235 rg"]) assert.ok(content.includes(colour), `colour operator ${colour}`);
    const unknown = await collect(svgOf(`<rect width="10" height="10" fill="notacolour"/>`));
    assert.ok(unknown.diagnostics.some((d) => d.code === "pdf-unsupported-paint"), "an unknown colour is reported, not dropped silently");
  }
  // Style sheets: type, class and id selectors by specificity, under inline styles; unsupported selectors are reported.
  {
    const css = `<style>rect{fill:#ff0000}.a{fill:#00ff00}#b{fill:#0000ff}</style>`;
    const { content, diagnostics } = await collect(svgOf(`${css}<rect id="x" width="10" height="10"/><rect class="a" width="10" height="10"/><rect id="b" class="a" width="10" height="10"/><rect class="a" style="fill:#ffff00" width="10" height="10"/>`));
    const fills = [...content.matchAll(/([0-9.]+ [0-9.]+ [0-9.]+) rg/g)].map((match) => match[1]).filter((value) => value !== "1 1 1");
    assert.deepEqual(fills, ["1 0 0", "0 1 0", "0 0 1", "1 1 0"], "type < class < id < inline style");
    assert.equal(diagnostics.filter((d) => d.code === "pdf-unsupported-css").length, 0);
    const unsupported = await collect(svgOf(`<style>g > rect{fill:red}</style><g><rect width="10" height="10"/></g>`));
    assert.ok(unsupported.diagnostics.some((d) => d.code === "pdf-unsupported-css"), "a combinator selector is reported");
  }
  // Percentages are of the viewport.
  {
    const { content } = await collect(svgOf(`<rect x="10%" y="20%" width="50%" height="25%" fill="#123456"/>`));
    assert.ok(content.includes("20 20 m 120 20 l 120 45 l 20 45 l h"), "percentage geometry resolves against the 200 x 100 viewBox");
  }
  // <symbol> through <use>, nested <svg> and <switch> are drawn where they belong.
  {
    const body = `<defs><symbol id="s" viewBox="0 0 10 10"><rect width="10" height="10" fill="#ff0000"/></symbol></defs><use href="#s" x="20" y="10" width="40" height="40"/><svg x="100" y="20" width="50" height="50" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#0000ff"/></svg><switch><rect x="170" y="10" width="20" height="20" fill="#00aa00"/><rect x="170" y="40" width="20" height="20" fill="#aa0000"/></switch>`;
    const svg = svgOf(`<rect width="200" height="100" fill="#ffffff"/>${body}`);
    const pdf = await svgToPdf(svg);
    const rendered = await renderPdfPage(await openPdf(pdf), 1, 2);
    const reference = await svgToPng(svg, { scale: 2 });
    const { mae } = await compareImages(rendered.png, reference, { factor: 1 });
    assert.ok(mae < 2, `symbol, nested svg and switch match the preview (mean error ${mae.toFixed(2)})`);
  }
  // Gradient fill on text keeps the text; clip-rule; spreadMethod and unsupported text features are reported.
  {
    const body = `<defs><linearGradient id="g" spreadMethod="reflect"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient><clipPath id="c"><path clip-rule="evenodd" d="M0 0H100V100H0Z M20 20H80V80H20Z"/></clipPath></defs><text x="10" y="40" font-family="Roboto" font-size="30" fill="url(#g)">Gradient</text><rect width="100" height="100" fill="#0a0" clip-path="url(#c)"/><text x="10" y="90" font-family="Roboto" font-size="12" rotate="10" dominant-baseline="hanging" text-transform="uppercase">Features</text>`;
    const { pdf, content, diagnostics } = await collect(svgOf(body));
    assert.match(await pageText(await openPdf(pdf), 1), /Gradient/, "text with a gradient fill is kept");
    assert.ok(/\/Pattern cs/.test(content), "the text is painted with the gradient pattern");
    assert.ok(content.includes("W* n"), "clip-rule evenodd");
    const features = diagnostics.filter((d) => d.code === "pdf-unsupported-feature").map((d) => d.attribute).sort();
    assert.deepEqual(features, ["dominant-baseline", "rotate", "text-transform"]);
    assert.ok(diagnostics.some((d) => d.code === "pdf-unsupported-paint" && /spreadMethod/.test(d.message)));
    await assert.rejects(svgToPdf(svgOf(body), { strict: true }), (error) => /^pdf-unsupported/.test(error.code));
  }
  // A character no supplied font has: reported (strict throws), never a silent .notdef box.
  {
    const svg = svgOf(`<text x="10" y="40" font-family="Roboto" font-size="20">A\u{10348}B</text>`);
    const { diagnostics } = await collect(svg);
    assert.ok(diagnostics.some((d) => d.code === "pdf-glyph-missing" && d.codePoint === 0x10348), "missing glyph reported");
    await assert.rejects(svgToPdf(svg, { strict: true }), (error) => error.code === "pdf-glyph-missing");
  }
  // Absurd coordinates are clamped to something every reader accepts.
  {
    const { content } = await collect(svgOf(`<rect x="1e25" y="-1e30" width="1e22" height="5" fill="#000"/><path d="M0 0L1e40 1e40" stroke="#000"/>`));
    assert.ok(!/e[+-]?\d/.test(content.replace(/[A-Za-z]{2,}/g, "")), "no exponent in a content stream");
  }
  // Hostile input: a <use> chain that doubles at every level, very deep nesting, a very long text.
  {
    let defs = `<g id="u0"><rect width="1" height="1"/></g>`;
    for (let level = 1; level <= 24; level++) defs += `<g id="u${level}"><use href="#u${level - 1}"/><use href="#u${level - 1}"/></g>`;
    const started = performance.now();
    const bomb = await collect(svgOf(`<defs>${defs}</defs><use href="#u24"/>`));
    assert.ok(performance.now() - started < 20000, "the expansion bomb is cut off quickly");
    assert.ok(bomb.diagnostics.some((d) => d.code === "pdf-expansion-limit"), "expansion limit reported");
    await assert.rejects(svgToPdf(svgOf(`<defs>${defs}</defs><use href="#u24"/>`), { strict: true }), (error) => error.code === "pdf-expansion-limit");
    const deep = await collect(svgOf("<g>".repeat(900) + `<rect width="5" height="5"/>` + "</g>".repeat(900)));
    assert.ok(deep.pdf.length > 100);
    assert.ok(deep.diagnostics.some((d) => d.code === "pdf-expansion-limit"), "deep groups are cut off with a diagnostic");
    await assert.rejects(svgToPdf(svgOf("<g>".repeat(60000) + "</g>".repeat(60000))), (error) => ["invalid-svg", "svg-too-deep"].includes(error.code), "absurd nesting is refused cleanly");
    const long = await collect(svgOf(`<text x="0" y="50" font-family="Roboto" font-size="1">${"ab ".repeat(60000)}</text>`));
    assert.ok(long.pdf.length > 1000, "a 180,000-character text does not overflow the stack");
  }
  // A picture that is itself an SVG is rasterized for that element (reported), and drawn where the preview draws it.
  {
    const picture = encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><rect width='20' height='20' fill='#ff0000'/></svg>");
    const svg = svgOf(`<rect width="200" height="100" fill="#ffffff"/><image data-opf-path="slides.0.logo" x="10" y="10" width="60" height="60" href="data:image/svg+xml;charset=utf-8,${picture}"/>`);
    const { pdf, diagnostics } = await collect(svg);
    assert.ok(diagnostics.some((d) => d.code === "pdf-raster-fallback" && d.path === "slides.0.logo"), "an SVG picture is reported as a raster fallback");
    const { mae } = await compareImages((await renderPdfPage(await openPdf(pdf), 1, 2)).png, await svgToPng(svg, { scale: 2 }), { factor: 1 });
    assert.ok(mae < 2, `the SVG picture is drawn as the preview draws it (mean error ${mae.toFixed(2)})`);
  }
  // A file reference inside a rasterized fragment is never read.
  {
    const directory = await mkdtemp(path.join(os.tmpdir(), "opf-pdf-img-"));
    try {
      const red = path.join(directory, "red.png");
      await writeFile(red, await sharp({ create: { width: 8, height: 8, channels: 3, background: "#ff0000" } }).png().toBuffer());
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><defs><filter id="f"><feColorMatrix type="saturate" values="1"/></filter></defs><g filter="url(#f)"><image x="0" y="0" width="100" height="100" href="${red.replace(/\\/g, "/")}"/></g></svg>`;
      const rendered = await renderPdfPage(await openPdf(await svgToPdf(svg)), 1);
      const { data } = await sharp(rendered.png).raw().toBuffer({ resolveWithObject: true });
      assert.ok(!(data[0] > 200 && data[1] < 60 && data[2] < 60), "the local file was not drawn");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

// ---- Fonts: corrupt and restricted files, declared families -----------------------------------------------------------------
{
  const registry = (await loadFonts({pack: 'base'})).registry;
  const roboto = registry.fontFiles.find((file) => /Roboto_400Regular\.ttf$/.test(file));
  const original = new Uint8Array(await readFile(roboto));
  const table = (bytes, tag) => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let index = 0; index < view.getUint16(4); index++) {
      const at = 12 + index * 16;
      if (String.fromCharCode(...bytes.subarray(at, at + 4)) === tag) return { offset: view.getUint32(at + 8), length: view.getUint32(at + 12), view };
    }
    throw new Error(`no ${tag}`);
  };
  const directory = await mkdtemp(path.join(os.tmpdir(), "opf-pdf-fonts-"));
  try {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><text x="10" y="50" font-family="Roboto" font-size="20">Corrupt font text</text></svg>`;
    const medium = registry.fontFiles.find((file) => /Roboto_500Medium\.ttf$/.test(file));
    // A truncated loca table and an out-of-range glyph count are unreadable fonts, not a RangeError.
    for (const [name, damage] of [
      ["numGlyphs", (bytes) => { const maxp = table(bytes, "maxp"); maxp.view.setUint16(maxp.offset + 4, 60000); }],
      ["loca", (bytes) => { const loca = table(bytes, "loca"); for (let index = 0; index + 3 < loca.length; index += 4) loca.view.setUint32(loca.offset + index, 0x7fffffff); }],
      ["truncated", (bytes) => bytes.subarray(0, 4000)],
    ]) {
      const bytes = original.slice();
      const damaged = damage(bytes) ?? bytes;
      const file = path.join(directory, `${name}.ttf`);
      await writeFile(file, damaged);
      const diagnostics = [];
      const pdf = await svgToPdf(svg, { fonts: {useBundledFonts: false, fontFiles: [file, medium]}, onDiagnostic: (d) => diagnostics.push(d) });
      assert.ok(diagnostics.some((d) => d.code === "pdf-font-unreadable"), `${name}: the damaged font is reported unreadable`);
      assert.match(await pageText(await openPdf(pdf), 1), /Corrupt font text/);
    }
    // fsType: preview-and-print is embedded and reported as such; no-embedding never.
    const preview = original.slice();
    const os2 = table(preview, "OS/2");
    os2.view.setUint16(os2.offset + 8, 0x0004);
    const previewFile = path.join(directory, "preview.ttf");
    await writeFile(previewFile, preview);
    const reports = [];
    await svgToPdf(svg, { fonts: {useBundledFonts: false, fontFiles: [previewFile]}, onDiagnostic: (d) => reports.push(d) });
    const embedded = reports.find((d) => d.code === "pdf-font-embedded");
    assert.equal(embedded.embeddingRestriction, "preview-and-print");
    assert.equal(embedded.fsType, 4);
    // A font declared by @font-face in the SVG is found by its declared family, whatever its name table says.
    const declared = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><style>@font-face{font-family:"Brand Sans";src:url("data:font/ttf;base64,${Buffer.from(original).toString("base64")}")}</style><text x="10" y="50" font-family="Brand Sans" font-size="20">Declared family</text></svg>`;
    const notes = [];
    const declaredPdf = await svgToPdf(declared, { fonts: {useBundledFonts: false}, onDiagnostic: (d) => notes.push(d) });
    assert.match(await pageText(await openPdf(declaredPdf), 1), /Declared family/);
    assert.ok(!notes.some((d) => d.code === "pdf-font-substituted"), "the declared family is the one drawn");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

// ---- Dates read as UTC, structure is sound (qpdf --check), the page is painted white ---------------------------------------
{
  const { spawnSync } = await import("node:child_process");
  const script = `import { svgToPdf } from ${JSON.stringify(new URL("../dist/index.js", import.meta.url).href)};
import { createHash } from "node:crypto";
const pdf = await svgToPdf('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="10" height="10"/></svg>', { metadata: { title: "T\\u0001itle", creationDate: "2026-03-04T05:06:07" } });
console.log(createHash("sha256").update(pdf).digest("hex"));`;
  const digests = ["UTC", "Asia/Tokyo", "America/Los_Angeles"].map((zone) => spawnSync(process.execPath, ["--input-type=module", "-e", script], { env: { ...process.env, TZ: zone }, encoding: "utf8" }).stdout.trim());
  assert.match(digests[0], /^[0-9a-f]{64}$/);
  assert.equal(new Set(digests).size, 1, "a zone-less creation date is read as UTC whatever the time zone");
  const dated = await svgToPdf("<svg xmlns='http://www.w3.org/2000/svg' width='100' height='50'/>", { metadata: { title: "T\u0001itle", creationDate: "2026-03-04T05:06:07" } });
  assert.match(Buffer.from(dated).toString("latin1"), /\/CreationDate\(D:20260304050607Z\)/);
  assert.equal((await lowLevel(dated)).document.getTitle(), "Title", "control characters are stripped from the metadata");

  const registry = (await loadFonts({pack: 'base', scripts: "all"})).registry;
  const fixture = await readFile(new URL("fixtures/pdf/mixed-script-slide.svg", import.meta.url), "utf8");
  const samples = [
    await svgToPdf(fixture, { fonts: {fontFiles: registry.fontFiles, useBundledFonts: false}, metadata: { title: "Fixture", language: "en-GB" } }),
    await svgToPdf(fixture, { fonts: {fontFiles: registry.fontFiles, useBundledFonts: false}, tagged: false, compress: false }),
    await svgToPdf(["<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200'><rect width='300' height='200' fill='#eee'/><text x='10' y='50' font-family='Roboto'>Page one</text></svg>", "<svg xmlns='http://www.w3.org/2000/svg' width='200' height='300'><text x='10' y='50' font-family='Roboto'>Page two</text></svg>"]),
  ];
  for (const [index, bytes] of samples.entries()) {
    const check = await qpdfCheck(bytes);
    assert.deepEqual({ status: check.status, text: check.text }, { status: 0, text: "" }, `qpdf --check, sample ${index}: ${check.text}`);
  }
  const white = await svgToPdf("<svg xmlns='http://www.w3.org/2000/svg' width='100' height='50'/>");
  const whiteDoc = await lowLevel(white);
  assert.ok(whiteDoc.stream(whiteDoc.document.context.lookup(whiteDoc.document.getPages()[0].node.Contents())).toString("latin1").includes("1 1 1 rg 0 0 100 50 re f"), "the page is painted white by default");
  const clear = await svgToPdf("<svg xmlns='http://www.w3.org/2000/svg' width='100' height='50'/>", { background: "none" });
  const clearDoc = await lowLevel(clear);
  assert.ok(!clearDoc.stream(clearDoc.document.context.lookup(clearDoc.document.getPages()[0].node.Contents())).toString("latin1").includes("re f"), "background none leaves the page unpainted");
}

console.log("pdf-vector: structure, text round trips, determinism, metadata, fonts and fallbacks passed.");
