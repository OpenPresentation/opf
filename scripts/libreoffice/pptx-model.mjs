// What a PPTX says, read independently of the exporter: the slides in presentation order, each shape's box on the slide (group
// transforms and inherited placeholder positions applied), its text as paragraphs with explicit breaks counted, and the font
// families the file asks for. The LibreOffice qualification (docs/libreoffice.md) measures rendered pages against these boxes
// and compares the words a viewer kept with the words the file holds.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requirePptx = createRequire(path.join(root, "packages/pptx/package.json"));
const { unzipSync, strFromU8 } = requirePptx("fflate");
const { parseXml } = await import(pathToFileURL(requirePptx.resolve("@rgrove/parse-xml")).href);

export const EMU_PER_POINT = 12700;
const pt = (emu) => Number(emu) / EMU_PER_POINT;

const elements = (node) => (node?.children ?? []).filter((child) => child.type === "element");
const kids = (node, name) => elements(node).filter((child) => child.name === name);
const kid = (node, name) => elements(node).find((child) => child.name === name);
const path2 = (node, ...names) => names.reduce((current, name) => kid(current, name), node);
function descendants(node, name, out = []) {
  for (const child of elements(node)) {
    if (child.name === name) out.push(child);
    descendants(child, name, out);
  }
  return out;
}

/** The text of a run container (a:r, a:fld) without markup. */
const runText = (run) => kid(run, "a:t")?.text ?? "";

/** Paragraphs of a txBody: [{text, breaks, fields}], text with "\n" at each explicit a:br. Fields keep their type. */
export function bodyParagraphs(txBody) {
  return kids(txBody, "a:p").map((paragraph) => {
    let text = "", breaks = 0;
    const fields = [];
    for (const child of elements(paragraph)) {
      if (child.name === "a:r") text += runText(child);
      else if (child.name === "a:br") { text += "\n"; breaks += 1; }
      else if (child.name === "a:fld") { fields.push({ type: child.attributes.type ?? "", text: runText(child) }); text += runText(child); }
    }
    return { text, breaks, fields };
  });
}

function bodyProperties(txBody) {
  const bodyPr = kid(txBody, "a:bodyPr");
  const attributes = bodyPr?.attributes ?? {};
  const inset = (name, fallback) => pt(attributes[name] ?? fallback);
  return {
    wrap: attributes.wrap ?? "square",
    anchor: attributes.anchor ?? "t",
    insets: { left: inset("lIns", 91440), top: inset("tIns", 45720), right: inset("rIns", 91440), bottom: inset("bIns", 45720) },
    autofit: kid(bodyPr, "a:normAutofit") ? "normal" : kid(bodyPr, "a:spAutoFit") ? "shape" : "none",
    vert: attributes.vert ?? "horz",
  };
}

const IDENTITY = { a: 1, d: 1, e: 0, f: 0 };
const compose = (outer, inner) => ({ a: outer.a * inner.a, d: outer.d * inner.d, e: outer.a * inner.e + outer.e, f: outer.d * inner.f + outer.f });

function readXfrm(xfrm) {
  if (!xfrm) return null;
  const off = kid(xfrm, "a:off")?.attributes, ext = kid(xfrm, "a:ext")?.attributes;
  if (!off || !ext) return null;
  return { x: Number(off.x), y: Number(off.y), w: Number(ext.cx), h: Number(ext.cy), rot: Number(xfrm.attributes.rot ?? 0), chOff: kid(xfrm, "a:chOff")?.attributes, chExt: kid(xfrm, "a:chExt")?.attributes };
}

function placeholderOf(shape) {
  const nv = elements(shape).find((child) => /^p:nv/.test(child.name));
  const ph = path2(nv, "p:nvPr", "p:ph");
  return ph ? { type: ph.attributes.type ?? "body", idx: ph.attributes.idx ?? null } : null;
}

function nameOf(shape) {
  const nv = elements(shape).find((child) => /^p:nv/.test(child.name));
  const cNvPr = kid(nv, "p:cNvPr")?.attributes ?? {};
  return { id: cNvPr.id ?? "", name: cNvPr.name ?? "", descr: cNvPr.descr ?? "" };
}

const xfrmOf = (shape) => readXfrm(shape.name === "p:graphicFrame" ? kid(shape, "p:xfrm") : path2(shape, shape.name === "p:grpSp" ? "p:grpSpPr" : "p:spPr", "a:xfrm"));

/** Placeholder boxes of a layout or master part: [{type, idx, xfrm}]. */
function placeholderBoxes(xml) {
  if (!xml) return [];
  const tree = path2(parseXml(xml).root, "p:cSld", "p:spTree");
  return descendants(tree, "p:sp").map((shape) => ({ ...placeholderOf(shape), xfrm: xfrmOf(shape) })).filter((entry) => entry.type && entry.xfrm);
}

function inheritedXfrm(ph, layers) {
  for (const layer of layers) {
    const match = (ph.idx !== null && layer.find((entry) => entry.idx === ph.idx)) || layer.find((entry) => entry.type === ph.type) || (ph.type === "body" && layer.find((entry) => entry.type === "body"));
    if (match) return match.xfrm;
  }
  return null;
}

function relationships(files, part) {
  const rels = `${path.posix.dirname(part)}/_rels/${path.posix.basename(part)}.rels`;
  if (!files[rels]) return {};
  const map = {};
  for (const rel of kids(parseXml(strFromU8(files[rels])).root, "Relationship")) {
    const { Id, Target, TargetMode, Type } = rel.attributes;
    map[Id] = { type: Type, target: TargetMode === "External" ? Target : path.posix.normalize(path.posix.join(path.posix.dirname(part), Target)), external: TargetMode === "External" };
  }
  return map;
}

function chartStrings(xml) {
  const doc = parseXml(xml).root;
  const strings = [];
  for (const cache of [...descendants(doc, "c:strCache"), ...descendants(doc, "cx:strDim")]) for (const value of descendants(cache, "c:v").concat(descendants(cache, "cx:v"))) strings.push(value.text);
  for (const title of [...descendants(doc, "c:title"), ...descendants(doc, "cx:title")]) for (const t of descendants(title, "a:t")) strings.push(t.text);
  return strings.filter((text) => text.trim());
}

/**
 * Read a PPTX. Returns { slideSize: {width, height} (points), slides: [{number, part, shapes, fonts}], fonts: [families] }.
 * Each shape: { id, name, kind (text|table|chart|picture|connector|group-text|other), box: {x, y, width, height} (points, on the slide),
 * rotated, placeholder, body: {wrap, anchor, insets, autofit, vert} | null, paragraphs: [{text, breaks, fields}], strings (chart) }.
 */
export function readPptx(bytes) {
  const files = unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  const text = (part) => (files[part] ? strFromU8(files[part]) : null);
  const presentation = parseXml(text("ppt/presentation.xml")).root;
  const size = kid(presentation, "p:sldSz").attributes;
  const presentationRels = relationships(files, "ppt/presentation.xml");
  const slideParts = kids(kid(presentation, "p:sldIdLst"), "p:sldId").map((entry) => presentationRels[entry.attributes["r:id"]].target);
  const themeFonts = {};
  const themePart = Object.keys(files).find((file) => /^ppt\/theme\/theme\d+\.xml$/.test(file));
  if (themePart) {
    const scheme = descendants(parseXml(text(themePart)).root, "a:fontScheme")[0];
    themeFonts["+mj-lt"] = path2(scheme, "a:majorFont", "a:latin")?.attributes.typeface;
    themeFonts["+mn-lt"] = path2(scheme, "a:minorFont", "a:latin")?.attributes.typeface;
    for (const [token, font, slot] of [["+mj-ea", "a:majorFont", "a:ea"], ["+mn-ea", "a:minorFont", "a:ea"], ["+mj-cs", "a:majorFont", "a:cs"], ["+mn-cs", "a:minorFont", "a:cs"]]) {
      const typeface = path2(scheme, font, slot)?.attributes.typeface;
      if (typeface) themeFonts[token] = typeface;
    }
  }
  const families = new Set([themeFonts["+mj-lt"], themeFonts["+mn-lt"]].filter(Boolean));
  const slides = slideParts.map((part, index) => {
    const rels = relationships(files, part);
    const layoutPart = Object.values(rels).find((rel) => rel.type.endsWith("/slideLayout"))?.target;
    const masterPart = layoutPart ? Object.values(relationships(files, layoutPart)).find((rel) => rel.type.endsWith("/slideMaster"))?.target : null;
    const layers = [placeholderBoxes(text(layoutPart)), placeholderBoxes(text(masterPart))];
    const doc = parseXml(text(part)).root;
    const slideFonts = new Set();
    for (const latin of [...descendants(doc, "a:latin"), ...descendants(doc, "a:ea"), ...descendants(doc, "a:cs")]) {
      const family = themeFonts[latin.attributes.typeface] ?? latin.attributes.typeface;
      if (family?.startsWith("+")) continue;
      if (family) { slideFonts.add(family); families.add(family); }
    }
    const shapes = [];
    const visit = (container, transform) => {
      for (const node of elements(container)) {
        if (node.name === "mc:AlternateContent") {
          // The Choice: OPF writes chartex charts (Requires="cx...") with a Fallback, and LibreOffice 26.8 reads the chartex Choice
          // itself (it draws a histogram natively; a chart type it lacks becomes its "unsupported" placeholder, which run.mjs counts).
          // LibreOffice's own re-export adds a text Fallback ("This chart isn't available...") that a viewer of the Choice never shows.
          visit(kid(node, "mc:Choice") ?? kid(node, "mc:Fallback"), transform);
          continue;
        }
        if (!["p:sp", "p:pic", "p:graphicFrame", "p:grpSp", "p:cxnSp"].includes(node.name)) continue;
        const ph = placeholderOf(node);
        const xfrm = xfrmOf(node) ?? (ph ? inheritedXfrm(ph, layers) : null);
        if (node.name === "p:grpSp") {
          let inner = transform;
          if (xfrm?.chOff && xfrm?.chExt) {
            const sx = Number(xfrm.chExt.cx) ? xfrm.w / Number(xfrm.chExt.cx) : 1, sy = Number(xfrm.chExt.cy) ? xfrm.h / Number(xfrm.chExt.cy) : 1;
            inner = compose(transform, { a: sx, d: sy, e: xfrm.x - Number(xfrm.chOff.x) * sx, f: xfrm.y - Number(xfrm.chOff.y) * sy });
          }
          visit(node, inner);
          continue;
        }
        const box = xfrm ? { x: pt(transform.a * xfrm.x + transform.e), y: pt(transform.d * xfrm.y + transform.f), width: pt(transform.a * xfrm.w), height: pt(transform.d * xfrm.h) } : null;
        const entry = { ...nameOf(node), kind: "other", box, rotated: Boolean(xfrm?.rot), placeholder: ph, body: null, paragraphs: [], strings: [] };
        if (node.name === "p:sp") {
          const txBody = kid(node, "p:txBody");
          if (txBody) {
            entry.body = bodyProperties(txBody);
            entry.paragraphs = bodyParagraphs(txBody);
            if (entry.paragraphs.some((paragraph) => paragraph.text.trim())) entry.kind = "text";
          }
        } else if (node.name === "p:pic") entry.kind = "picture";
        else if (node.name === "p:cxnSp") entry.kind = "connector";
        else if (node.name === "p:graphicFrame") {
          const data = path2(node, "a:graphic", "a:graphicData");
          const uri = data?.attributes.uri ?? "";
          const table = kid(data, "a:tbl");
          if (table) {
            entry.kind = "table";
            entry.cells = kids(table, "a:tr").map((row) => kids(row, "a:tc").map((cell) => bodyParagraphs(kid(cell, "a:txBody"))));
            entry.paragraphs = entry.cells.flat(2);
          } else if (/\/chart$|\/chartex$/.test(uri)) {
            entry.kind = "chart";
            const chart = elements(data)[0];
            const target = rels[chart?.attributes["r:id"]]?.target;
            if (target && files[target]) entry.strings = chartStrings(text(target));
          } else if (/\/diagram$/.test(uri)) {
            // SmartArt: its node text lives in the data part (dgm:relIds r:dm). A viewer that does not lay SmartArt out draws the
            // fallback drawing part instead; either way the node text is what the slide must show.
            entry.kind = "smartart";
            const ids = kid(data, "dgm:relIds");
            const target = rels[ids?.attributes["r:dm"]]?.target;
            // Each node's text once: the data part repeats a node's text in its presentation points.
            if (target && files[target]) entry.strings = [...new Set(descendants(parseXml(text(target)).root, "a:t").map((t) => t.text).filter((value) => value.trim()))];
          }
        }
        shapes.push(entry);
      }
    };
    visit(path2(doc, "p:cSld", "p:spTree"), IDENTITY);
    return { number: index + 1, part, hidden: doc.attributes.show === "0", shapes, fonts: [...slideFonts].sort() };
  });
  return { slideSize: { width: pt(size.cx), height: pt(size.cy) }, slides, fonts: [...families].sort() };
}

/** Field types whose text a viewer computes (slide numbers, dates): their words are not required to survive verbatim. */
export const COMPUTED_FIELDS = /^(slidenum|datetime\d*)$/;

/** The words of a slide that a viewer must keep: text shapes and table cells, without computed fields. */
export function slideWords(slide) {
  const words = [];
  for (const shape of slide.shapes) {
    for (const paragraph of shape.paragraphs) {
      let text = paragraph.text;
      for (const field of paragraph.fields) if (COMPUTED_FIELDS.test(field.type) && field.text) text = text.replace(field.text, " ");
      words.push(...tokenize(text));
    }
  }
  return words;
}

// Built from code points: format characters (soft hyphen, zero-width and direction marks, line and paragraph separators, BOM) and spaces.
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => String.fromCodePoint(from + index)).join("");
const INVISIBLE = new RegExp(`[${[String.fromCodePoint(0xad), range(0x200b, 0x200f), range(0x2028, 0x202e), range(0x2060, 0x2069), String.fromCodePoint(0xfeff)].join("")}]`, "gu");
const SPACES = new RegExp(`[${String.raw`\s`}${String.fromCodePoint(0xa0)}]+`, "u");

/** Whitespace-separated tokens, NFC, with invisible format characters removed. */
export function tokenize(text) {
  return String(text ?? "")
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .split(SPACES)
    .filter(Boolean);
}
