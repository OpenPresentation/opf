// RR-17 (FF-44): complex-script text for the raster path (resvg-js 2.6.2). Two resvg limits, found by test/script-corpora-raster.mjs:
//   - usvg draws every HarfBuzz cluster with the advance of its widest glyph instead of the sum of its glyphs (`outline_cluster`), so a
//     spacing vowel sign, a split vowel or a decomposed sara am that shares a cluster with its consonant loses its advance: भाषा draws as
//     भषा, words run together, and a textLength then stretches the glyphs by the lost amount;
//   - rustybuzz breaks a ligature conjunct under a pre-base vowel sign (द्धि, દ્ધિ, ট্টি draw with an explicit halant) and ignores the
//     SVG lang (Korean text is shaped without the KOR language system).
// Browsers and the vector PDF path (fontkit) are right; only PNG and raster PDF were wrong.
//
// For the SVG about to be rasterized (never the emitted SVG), every <text> whose content has characters of an affected script (the
// Indic scripts, Thai, Lao, Khmer, Myanmar), or Hangul in a KOR-language text, becomes a <g> that carries the text's attributes and
// draws its content cluster by cluster at absolute positions:
//   - the x of each cluster is the fontkit pen at its first character in its run shaped as a whole (opf-render#189: a prefix shaped
//     alone loses the context of the next character, such as a Thai leading vowel kerned to its consonant; the prefix's advance is used
//     where the run's glyphs do not map back to its characters, or the run has a kinzi), measured with the face resvg will pick for the run
//     (fontdb's family, style and weight matching over the same font files, with the same glyph fallback order), the OpenType language
//     of the SVG's lang and the policy features, scaled to the run's textLength when it has one; text-anchor middle and end are
//     resolved into absolute starts, baseline-shift into the y;
//   - a cluster of a script whose fontkit glyph runs equal HarfBuzz's in the corpus (Devanagari, Gujarati, Oriya, Tamil, Kannada,
//     Sinhala) is drawn as fontkit's glyph outlines (<path> per glyph), so a conjunct under a pre-base vowel is the browser's;
//   - any other cluster (Bengali, Gurmukhi, Telugu, Malayalam, Thai, Lao, Khmer and Myanmar, where fontkit orders marks differently
//     or needs the no-mark-positioning retry; every grapheme of a KOR text, where fontkit's outlines of the KOR punctuation composites
//     lack their shift) is its own <text x y> that resvg shapes correctly in isolation (its glyphs are placed by the sum of the
//     advances; only the cluster's own advance is wrong, and that is not needed when the next cluster is pinned);
//   - runs of other scripts in such a text stay one <text> each, so they keep their own shaping and kerning.
// Clusters are extended grapheme clusters (Intl.Segmenter) joined across a virama, halant, coeng or Myanmar virama (plus a ZWJ) to the
// following letter, and across the Myanmar signs UAX #29 leaves out of SpacingMark (vowel sign aa, tall aa, visarga): the syllables
// HarfBuzz's Indic, Khmer and Myanmar shapers cluster. Text with no affected character is left byte-identical; a <text> the rewrite
// cannot lay out (right-to-left content, letter-spacing, per-character x lists, dx/dy/rotate, relative units) is left to resvg as it was.
import { readFile } from "node:fs/promises";
import { create } from "fontkit";
import { disabledFeaturesFor } from "./font-compatibility.js";
import { pinGlyphCodePoints } from "./font-registry.js";
import { openTypeLanguage } from "./script-fonts.js";

const AFFECTED = /[\p{scx=Devanagari}\p{scx=Bengali}\p{scx=Gurmukhi}\p{scx=Gujarati}\p{scx=Oriya}\p{scx=Tamil}\p{scx=Telugu}\p{scx=Kannada}\p{scx=Malayalam}\p{scx=Sinhala}\p{scx=Thai}\p{scx=Lao}\p{scx=Khmer}\p{scx=Myanmar}]/u;
// Scripts whose fontkit glyph runs equal HarfBuzz's for every corpus sample (glyph ids, order and advances, no retry): drawn as outlines.
const OUTLINED = /[\p{scx=Devanagari}\p{scx=Gujarati}\p{scx=Oriya}\p{scx=Tamil}\p{scx=Kannada}\p{scx=Sinhala}]/u;
const HANGUL = /\p{Script=Hangul}/u;
const LETTER = /^(?=\p{L})[\p{scx=Devanagari}\p{scx=Bengali}\p{scx=Gurmukhi}\p{scx=Gujarati}\p{scx=Oriya}\p{scx=Tamil}\p{scx=Telugu}\p{scx=Kannada}\p{scx=Malayalam}\p{scx=Sinhala}\p{scx=Khmer}\p{scx=Myanmar}]/u;
// Virama, halant, al-lakuna, coeng and the Myanmar virama: a cluster ending in one (optionally followed by ZWJ) joins the next letter.
const JOINER = /[\u094D\u09CD\u0A4D\u0ACD\u0B4D\u0BCD\u0C4D\u0CCD\u0D4D\u0DCA\u17D2\u1039]\u200D?$/u;
// Myanmar signs that UAX #29 excludes from SpacingMark (they start a grapheme cluster) but HarfBuzz keeps in the syllable.
const MYANMAR_SIGN = /^[\u102B\u102C\u1038\u1062-\u1064\u1067-\u106D\u1083\u1087-\u108C\u108F\u109A-\u109C]/u;
// Kinzi (nga, asat, virama) is the zero-advance mark HarfBuzz forms above the next consonant; fontkit's universal shaper keeps the full nga.
const KINZI = "\u1004\u103A\u1039";
// Strong right-to-left characters and directional controls: the text would be reordered by bidi, which per-cluster pinning cannot follow.
const RTL = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}\p{Script=Adlam}\u061C\u200F\u202B\u202E\u2067]/u;
const IGNORABLE = /\p{Default_Ignorable_Code_Point}/u;
const TOKENS = /<(\/?)([A-Za-z_][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[?!][^>]*>|[^<]+/g;
const ATTRIBUTE = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const STRETCH = { "ultra-condensed": 1, "extra-condensed": 2, condensed: 3, "semi-condensed": 4, normal: 5, "semi-expanded": 6, expanded: 7, "extra-expanded": 8, "ultra-expanded": 9 };
// Attributes that position or size a text element or a span: never copied to a piece.
const POSITIONAL = new Set(["x", "y", "dx", "dy", "rotate", "textLength", "lengthAdjust", "text-anchor", "baseline-shift", "id"]);
// Attributes of a span that paint its glyphs: the only ones a glyph outline takes from its spans.
const PAINT = new Set(["fill", "fill-opacity", "fill-rule", "opacity", "stroke", "stroke-width", "stroke-opacity", "visibility", "display"]);
const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
const faceCache = new Map();

/** Rewrites complex-script text of `svg` into per-cluster positioned pieces for resvg (see the file comment). */
export async function pinScriptClusters(svg, { fontFiles = [], defaultFontFamily = "Roboto", sansSerifFamily, serifFamily, monospaceFamily, cursiveFamily, fantasyFamily } = {}) {
  if (!AFFECTED.test(svg) && !HANGUL.test(svg)) return svg;
  // resvg-js names for the generic families (its own defaults where rasterizeSvg sets none) and for text without a font-family.
  const generics = {
    default: defaultFontFamily, "sans-serif": sansSerifFamily ?? defaultFontFamily, serif: serifFamily ?? "Times New Roman",
    monospace: monospaceFamily ?? "Roboto Mono", cursive: cursiveFamily ?? "Comic Sans MS", fantasy: fantasyFamily ?? "Impact"
  };
  let db = null;
  const database = async () => db ?? (db = await loadFaces(fontFiles));
  const stack = [{ props: { fontFamily: undefined, fontSize: 12, fontWeight: 400, fontStyle: "normal", fontStretch: 5, lang: undefined, preserve: false, anchor: "start", direction: "ltr", spacing: false } }];
  const tokens = new RegExp(TOKENS.source, "g");
  let output = "", end = 0;
  for (let match = tokens.exec(svg); match; match = tokens.exec(svg)) {
    const [, close, name, attributes, selfClose] = match;
    if (name === undefined) continue;
    if (close) { if (stack.length > 1) stack.pop(); continue; }
    const attrs = parseAttributes(attributes);
    const props = inherit(stack.at(-1).props, attrs);
    if (name !== "text" || selfClose) { if (!selfClose) stack.push({ props }); continue; }
    const closeIndex = svg.indexOf("</text>", tokens.lastIndex);
    if (closeIndex < 0) break;
    const inner = svg.slice(tokens.lastIndex, closeIndex);
    tokens.lastIndex = closeIndex + "</text>".length;
    if (!needsRewrite(inner, props)) continue;
    const rewritten = rewriteText({ attrs, attributes, inner, props }, await database(), generics);
    if (rewritten === null) continue;
    output += svg.slice(end, match.index) + rewritten;
    end = tokens.lastIndex;
  }
  return end ? output + svg.slice(end) : svg;
}

function needsRewrite(inner, props) {
  const content = decodeEntities(inner.replace(/<!--[\s\S]*?-->|<[^>]*>/g, ""));
  if (!/\S/.test(content)) return false;
  if (AFFECTED.test(content)) return true;
  return HANGUL.test(content) && openTypeLanguage(props.lang) === "KOR";
}

function parseAttributes(attributes) {
  const attrs = new Map();
  for (const found of attributes.matchAll(ATTRIBUTE)) attrs.set(found[1], decodeEntities(found[2] ?? found[3] ?? ""));
  return attrs;
}

function styleProperty(attrs, name) {
  const style = attrs.get("style");
  if (!style) return undefined;
  const found = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`).exec(style);
  return found ? found[1].trim() : undefined;
}

const property = (attrs, name) => styleProperty(attrs, name) ?? attrs.get(name);

/** The inherited text properties of an element, from its attributes and style over its parent's. `invalid` marks what the rewrite cannot lay out. */
function inherit(parent, attrs) {
  const props = { ...parent };
  const family = property(attrs, "font-family");
  if (family !== undefined) props.fontFamily = family;
  const size = property(attrs, "font-size");
  if (size !== undefined) {
    const number = /^\s*(\d+(?:\.\d+)?|\.\d+)(px)?\s*$/.exec(size);
    if (number) props.fontSize = Number(number[1]); else props.invalid = true;
  }
  const weight = property(attrs, "font-weight");
  if (weight !== undefined) {
    const value = weight.trim();
    if (value === "normal") props.fontWeight = 400;
    else if (value === "bold") props.fontWeight = 700;
    else if (value === "bolder") props.fontWeight = parent.fontWeight < 350 ? 400 : parent.fontWeight < 550 ? 700 : 900;
    else if (value === "lighter") props.fontWeight = parent.fontWeight < 550 ? 100 : parent.fontWeight < 750 ? 400 : 700;
    else if (/^\d+(\.\d+)?$/.test(value)) props.fontWeight = Number(value);
    else props.invalid = true;
  }
  const style = property(attrs, "font-style");
  if (style !== undefined) props.fontStyle = /italic/.test(style) ? "italic" : /oblique/.test(style) ? "oblique" : "normal";
  const stretch = property(attrs, "font-stretch");
  if (stretch !== undefined) {
    const percent = /^\s*(\d+(?:\.\d+)?)%\s*$/.exec(stretch);
    props.fontStretch = percent ? Math.min(9, Math.max(1, Math.round(Number(percent[1]) / 12.5))) : STRETCH[stretch.trim()] ?? 5;
  }
  const lang = attrs.get("xml:lang") ?? attrs.get("lang");
  if (lang !== undefined) props.lang = lang;
  const space = attrs.get("xml:space");
  if (space !== undefined) props.preserve = space === "preserve";
  const anchor = property(attrs, "text-anchor");
  if (anchor !== undefined) props.anchor = anchor.trim();
  const direction = property(attrs, "direction");
  if (direction !== undefined) props.direction = direction.trim();
  const shift = property(attrs, "baseline-shift");
  if (shift !== undefined) {
    const number = singleNumber(shift);
    if (number === null) props.invalid = true; else props.shift = (parent.shift ?? 0) + number;
  }
  for (const name of ["letter-spacing", "word-spacing"]) {
    const value = property(attrs, name);
    if (value !== undefined && !/^\s*(normal|0+(\.0+)?(px)?)\s*$/.test(value)) props.spacing = true;
  }
  for (const name of ["dx", "dy", "rotate", "writing-mode", "unicode-bidi"]) if (attrs.has(name)) props.invalid = true;
  if (property(attrs, "writing-mode") !== undefined) props.invalid = true;
  return props;
}

/** Parses the content of one <text> into a tree of elements and text nodes. */
function parseInner(inner) {
  const root = { type: "element", children: [] }, open = [root];
  for (const match of inner.matchAll(TOKENS)) {
    const [token, close, name, attributes, selfClose] = match;
    const parent = open.at(-1);
    if (name === undefined) {
      if (!token.startsWith("<")) parent.children.push({ type: "text", value: decodeEntities(token) });
      continue;
    }
    if (close) { if (open.length > 1) open.pop(); continue; }
    if (name === "textPath") return null;
    const element = { type: "element", name, attrs: parseAttributes(attributes), children: [] };
    parent.children.push(element);
    if (!selfClose) open.push(element);
  }
  return root;
}

function decodeEntities(value) {
  if (!value.includes("&")) return value;
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (entity, code) => {
    if (code[0] === "#") {
      const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    }
    return { amp: "&", quot: "\"", apos: "'", lt: "<", gt: ">" }[code.toLowerCase()] ?? entity;
  });
}

const escapeText = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const escapeAttr = value => escapeText(value).replaceAll("\"", "&quot;");
const stable = value => Number.isInteger(value) ? String(value) : Number(value).toFixed(3).replace(/\.?0+$/, "");

function singleNumber(value) {
  if (value === undefined) return undefined;
  const number = /^\s*(-?(?:\d+(?:\.\d+)?|\.\d+)(?:e-?\d+)?)(px)?\s*$/i.exec(value);
  return number ? Number(number[1]) : null;
}

/** The affected-script syllables and the runs of other text of `text`, as [start, end) offsets with `affected`. */
export function clusterPieces(text, pinAll = false) {
  const segments = [];
  for (const { segment, index } of segmenter.segment(text)) {
    const previous = segments.at(-1);
    if (previous && ((JOINER.test(previous.text) && LETTER.test(segment)) || MYANMAR_SIGN.test(segment))) { previous.text += segment; previous.end = index + segment.length; continue; }
    segments.push({ text: segment, start: index, end: index + segment.length });
  }
  const pieces = [];
  for (const segment of segments) {
    const affected = pinAll || AFFECTED.test(segment.text);
    const previous = pieces.at(-1);
    if (!affected && previous && !previous.affected) { previous.end = segment.end; continue; }
    pieces.push({ start: segment.start, end: segment.end, affected });
  }
  return pieces;
}

function rewriteText(text, db, generics) {
  const root = parseInner(text.inner);
  if (!root) return null;
  const rootProps = text.props;
  if (rootProps.invalid || rootProps.spacing || rootProps.direction === "rtl" || RTL.test(text.inner)) return null;
  const rootX = singleNumber(text.attrs.get("x")), rootY = singleNumber(text.attrs.get("y")), rootLength = singleNumber(text.attrs.get("textLength"));
  if (rootX === null || rootY === null || rootLength === null) return null; // a list of x values, a unit the rewrite does not resolve
  const pinAll = openTypeLanguage(rootProps.lang) === "KOR";
  // Leaves in document order with their resolved properties, span chain, textLength scope and the x that positions their first character.
  const leaves = [];
  let pending = { x: rootX ?? 0 }, invalid = false;
  const walk = (element, props, scope, chain) => {
    for (const child of element.children) {
      if (child.type === "text") { leaves.push({ value: child.value, props, scope, chain, pending }); pending = null; continue; }
      const childProps = inherit(props, child.attrs);
      if (childProps.invalid || childProps.spacing || childProps.direction === "rtl" || child.attrs.has("y")) { invalid = true; return; }
      if (child.attrs.has("x")) {
        const x = singleNumber(child.attrs.get("x"));
        if (x === null) { invalid = true; return; }
        pending = { x };
      }
      const textLength = singleNumber(child.attrs.get("textLength"));
      if (textLength === null) { invalid = true; return; }
      walk(child, childProps, textLength !== undefined && textLength > 0 ? { textLength, natural: 0 } : scope, [...chain, child]);
      if (invalid) return;
    }
  };
  walk(root, rootProps, rootLength !== undefined && rootLength > 0 ? { textLength: rootLength, natural: 0 } : undefined, []);
  if (invalid || !leaves.length) return null;
  // Whitespace: without xml:space="preserve" resvg removes newlines, turns tabs into spaces, collapses runs of spaces and trims the ends.
  if (!rootProps.preserve) {
    let previousSpace = true;
    for (const leaf of leaves) {
      let out = "";
      for (const character of leaf.value.replace(/[\r\n]+/g, "").replace(/\t/g, " ")) { if (character === " ") { if (previousSpace) continue; previousSpace = true; } else previousSpace = false; out += character; }
      leaf.value = out;
    }
    for (let index = leaves.length - 1; index >= 0; index--) { leaves[index].value = leaves[index].value.replace(/ +$/, ""); if (leaves[index].value) break; }
  }
  // Pieces, their faces and their natural advances from the fontkit prefix widths of each leaf.
  for (const leaf of leaves) {
    leaf.pieces = clusterPieces(leaf.value, pinAll);
    const base = selectFace(db, leaf.props, generics);
    if (!base) return null;
    leaf.runs = faceRuns(db, base, leaf.value);
    const widths = measurePrefixes(leaf.runs, leaf.pieces.map(piece => piece.end), leaf.props);
    if (!widths) return null;
    let previous = 0;
    for (const [index, piece] of leaf.pieces.entries()) { piece.width = widths[index] - previous; previous = widths[index]; }
    if (leaf.scope) leaf.scope.natural += previous;
  }
  // Positions: chunks start at each absolutely positioned character (an element's x applies to the next character drawn, as in
  // resvg, so an empty element passes it on); a chunk's anchor shifts all of its pieces. A textLength scope ends at its own
  // length: its pieces are scaled to it, and a scope with no natural advance (a tab) still advances by it.
  let chunk = null, x = 0, carried = null;
  const chunks = [];
  const finish = () => { if (chunk) chunks.push(chunk); chunk = null; };
  for (const leaf of leaves) {
    const start = leaf.pending ?? carried;
    carried = leaf.pieces.length ? null : start;
    if (leaf.scope) leaf.scope.remaining = (leaf.scope.remaining ?? leaves.filter(item => item.scope === leaf.scope).length) - 1;
    for (const [index, piece] of leaf.pieces.entries()) {
      if (index === 0 && start) { finish(); x = start.x; chunk = { anchor: leaf.props.anchor, pieces: [], width: 0 }; }
      const factor = leaf.scope && leaf.scope.natural > 0 ? leaf.scope.textLength / leaf.scope.natural : 1;
      const advance = piece.width * factor;
      piece.x = x; piece.advance = advance; piece.leaf = leaf;
      chunk.pieces.push(piece);
      chunk.width += advance;
      x += advance;
    }
    if (leaf.scope && leaf.scope.remaining === 0 && leaf.scope.natural === 0 && chunk) { chunk.width += leaf.scope.textLength; x += leaf.scope.textLength; }
  }
  finish();
  for (const item of chunks) {
    const shift = item.anchor === "middle" ? -item.width / 2 : item.anchor === "end" ? -item.width : 0;
    for (const piece of item.pieces) piece.x += shift;
  }
  // Emit: a <g> with the text's attributes, one <path> per glyph of an outlined cluster or one <text> per other piece.
  const group = startTag("g", text.attributes, { x: null, y: null, textLength: null, lengthAdjust: null, "text-anchor": null });
  const parts = [];
  for (const leaf of leaves) {
    const spanAttrs = new Map();
    for (const element of leaf.chain) for (const [key, value] of element.attrs) if (!POSITIONAL.has(key)) spanAttrs.set(key, key === "style" && spanAttrs.has("style") ? `${spanAttrs.get("style")};${value}` : value);
    const y = (rootY ?? 0) - (leaf.props.shift ?? 0); // a positive baseline-shift raises the baseline
    const decoration = (property(spanAttrs, "text-decoration") ?? property(text.attrs, "text-decoration") ?? "").split(/\s+/);
    for (const piece of leaf.pieces) {
      const value = leaf.value.slice(piece.start, piece.end);
      const run = leaf.runs.find(item => item.start <= piece.start && item.start + item.text.length >= piece.end);
      const outlined = piece.affected && run && OUTLINED.test(value) ? shapeOutlines(run.face, value, leaf.props) : null;
      if (outlined) {
        const paint = [...spanAttrs].filter(([key]) => PAINT.has(key)).map(([key, value]) => ` ${key}="${escapeAttr(value)}"`).join("");
        const scale = leaf.props.fontSize / run.face.font.unitsPerEm;
        // A textLength scales the advances inside the cluster too (resvg and browsers stretch the glyphs; the outlines keep their shape).
        const factor = piece.width > 0 ? piece.advance / piece.width : 1;
        let glyphX = piece.x;
        for (const glyph of outlined) {
          if (glyph.d) parts.push(`<path${paint} transform="translate(${stable(glyphX + glyph.xOffset * scale)} ${stable(y - glyph.yOffset * scale)}) scale(${stable(scale)} ${stable(-scale)})" d="${glyph.d}"/>`);
          glyphX += glyph.xAdvance * scale * factor;
        }
        for (const line of decorationLines(run.face, decoration, scale)) parts.push(`<rect${paint} x="${stable(piece.x)}" y="${stable(y + line.offset)}" width="${stable(piece.advance)}" height="${stable(line.thickness)}"/>`);
        continue;
      }
      const attrs = [...spanAttrs].map(([key, value]) => ` ${key}="${escapeAttr(value)}"`).join("");
      parts.push(`<text x="${stable(piece.x)}" y="${stable(y)}"${attrs} text-anchor="start" xml:space="preserve">${escapeText(value)}</text>`);
    }
  }
  return `${group}${parts.join("")}</g>`;
}

/** A start tag from its original attribute source with `changes` applied (null removes, undefined keeps, a string sets or adds). */
function startTag(name, attributes, changes) {
  let source = attributes;
  const added = [];
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    const pattern = new RegExp(`\\s${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*(?:"[^"]*"|'[^']*')`);
    if (pattern.test(source)) source = source.replace(pattern, value === null ? "" : ` ${key}="${escapeAttr(value)}"`);
    else if (value !== null) added.push(` ${key}="${escapeAttr(value)}"`);
  }
  return `<${name}${source}${added.join("")}>`;
}

// --- faces: the files resvg loads, matched as fontdb matches them ---

async function loadFaces(files) {
  const faces = [];
  for (const file of files) {
    if (!faceCache.has(file)) faceCache.set(file, readFace(file).catch(() => null));
    const face = await faceCache.get(file);
    if (face) faces.push(face);
  }
  return faces;
}

async function readFace(file) {
  const data = new Uint8Array(await readFile(file));
  const font = create(data);
  if (!font?.layout || !font.unitsPerEm) return null;
  // opf-render#125: an outline drawn for one cluster (ऱ, whose component is the nukta glyph) must not change how a later nukta shapes.
  pinGlyphCodePoints(font);
  const records = font.name?.records ?? {};
  const names = Object.values(records.preferredFamily ?? {}).length ? Object.values(records.preferredFamily) : Object.values(records.fontFamily ?? {});
  const os2 = font["OS/2"], selection = os2?.fsSelection;
  return {
    file, font, families: new Set(names.filter(name => typeof name === "string")), outlines: new Map(),
    weight: os2?.usWeightClass ?? 400, stretch: os2?.usWidthClass ?? 5,
    style: selection?.italic || (!os2 && font.head?.macStyle?.italic) ? "italic" : selection?.oblique ? "oblique" : "normal"
  };
}

/** resvg's face for the properties: the first family of the list that fontdb has, matched like CSS Fonts (stretch, style, weight). */
function selectFace(db, props, generics) {
  const list = props.fontFamily === undefined ? [generics.default] : props.fontFamily.split(",").map(name => name.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  list.push("serif");
  for (const name of list) {
    const family = generics[name.toLowerCase()] ?? name;
    const candidates = db.filter(face => face.families.has(family));
    if (candidates.length) return bestMatch(candidates, props);
  }
  return null;
}

function bestMatch(candidates, props) {
  let set = candidates;
  const stretches = set.map(face => face.stretch);
  if (!stretches.includes(props.fontStretch)) {
    const below = stretches.filter(value => value < props.fontStretch), above = stretches.filter(value => value > props.fontStretch);
    const chosen = props.fontStretch <= 5 ? (below.length ? Math.max(...below) : Math.min(...above)) : (above.length ? Math.min(...above) : Math.max(...below));
    set = set.filter(face => face.stretch === chosen);
  } else set = set.filter(face => face.stretch === props.fontStretch);
  const order = props.fontStyle === "italic" ? ["italic", "oblique", "normal"] : props.fontStyle === "oblique" ? ["oblique", "italic", "normal"] : ["normal", "oblique", "italic"];
  for (const style of order) { const styled = set.filter(face => face.style === style); if (styled.length) { set = styled; break; } }
  const weights = set.map(face => face.weight), wanted = props.fontWeight;
  const pick = weight => set.find(face => face.weight === weight);
  if (weights.includes(wanted)) return pick(wanted);
  const below = weights.filter(value => value < wanted), above = weights.filter(value => value > wanted);
  const nearestBelow = below.length ? Math.max(...below) : undefined, nearestAbove = above.length ? Math.min(...above) : undefined;
  if (wanted === 400 && weights.includes(500)) return pick(500);
  if (wanted === 500 && weights.includes(400)) return pick(400);
  if (wanted <= 500) return pick(nearestBelow ?? nearestAbove);
  return pick(nearestAbove ?? nearestBelow);
}

const hasGlyph = (face, character) => face.font.hasGlyphForCodePoint(character.codePointAt(0));

/** The face resvg falls back to for a character the base face lacks: the first loaded face that has it and shares the base's style, weight or stretch. */
function fallbackFace(db, base, character) {
  return db.find(face => face !== base && (face.style === base.style || face.weight === base.weight || face.stretch === base.stretch) && hasGlyph(face, character)) ?? null;
}

/** Maximal runs of `text` drawn with one face: the base face, or resvg's fallback for a character it lacks. */
function faceRuns(db, base, text) {
  const runs = [];
  for (const character of text) {
    const face = IGNORABLE.test(character) || hasGlyph(base, character) ? base : fallbackFace(db, base, character) ?? base;
    const previous = runs.at(-1);
    if (previous && previous.face === face) previous.text += character; else runs.push({ face, text: character, start: previous ? previous.start + previous.text.length : 0 });
  }
  return runs;
}

/** fontkit's glyph run of `value` in `face`, shaped like the renderer measures (language, policy features), with the renderer's mark retry. */
function shapeRun(face, value, props) {
  const language = openTypeLanguage(props.lang);
  const off = disabledFeaturesFor([...face.families][0]), policyFeatures = off && Object.fromEntries(off.map(tag => [tag, false]));
  const layout = extra => face.font.layout(value, policyFeatures || extra ? { ...policyFeatures, ...extra } : undefined, undefined, language);
  try { return { run: layout(), retry: false }; }
  catch { return { run: layout({ abvm: false, blwm: false, mark: false, mkmk: false }), retry: true }; }
}

/** Advance widths (px) of the prefixes of the runs' text ending at each offset of `ends`. */
function measurePrefixes(runs, ends, props) {
  const width = (face, value) => {
    if (!value) return 0;
    // The Myanmar kinzi is a zero-advance mark in HarfBuzz; fontkit's universal shaper keeps the nga's advance, so it is not measured.
    const measured = value.includes(KINZI) ? value.replaceAll(KINZI, "") : value;
    return shapeRun(face, measured, props).run.positions.reduce((total, position) => total + position.xAdvance, 0) / face.font.unitsPerEm * props.fontSize;
  };
  const widths = [];
  try {
    const pens = new Map();
    // opf-render#189: the pen at a cluster boundary inside a run is read from the run shaped as a whole, so an advance its context
    // changes (a Thai leading vowel kerned to its consonant) is the one the browser draws; a prefix shaped alone ends without it.
    const prefix = (run, length) => {
      if (!pens.has(run)) pens.set(run, contextPens(run.face, run.text, props));
      return pens.get(run)?.get(length) ?? width(run.face, run.text.slice(0, length));
    };
    let runIndex = 0, before = 0;
    for (const end of ends) {
      while (runIndex < runs.length && runs[runIndex].start + runs[runIndex].text.length <= end) { before += width(runs[runIndex].face, runs[runIndex].text); runIndex++; }
      const run = runs[runIndex];
      widths.push(run && end > run.start ? before + prefix(run, end - run.start) : before);
    }
  } catch { return null; }
  return widths;
}

/**
 * The pen (px) at each character offset of `value` where a glyph carrying characters starts, with `value` shaped as one run: the sum
 * of the advances of the glyphs before it. Null for text with a kinzi (measured without it, so its offsets are not the text's).
 */
function contextPens(face, value, props) {
  if (value.includes(KINZI)) return null;
  const { run } = shapeRun(face, value, props);
  const pens = new Map(), scale = props.fontSize / face.font.unitsPerEm;
  let consumed = 0, pen = 0;
  for (const [index, glyph] of run.glyphs.entries()) {
    if (glyph.codePoints?.length) {
      if (!pens.has(consumed)) pens.set(consumed, pen * scale);
      for (const point of glyph.codePoints) consumed += point > 0xffff ? 2 : 1;
    }
    pen += run.positions[index].xAdvance;
  }
  return consumed === value.length ? pens : null;
}

/** The glyph outlines of one cluster, or null when fontkit needed the mark retry (its glyph placement is then not the browser's). */
function shapeOutlines(face, value, props) {
  let shaped;
  try { shaped = shapeRun(face, value, props); } catch { return null; }
  if (shaped.retry) return null;
  const glyphs = [];
  for (const [index, glyph] of shaped.run.glyphs.entries()) {
    const position = shaped.run.positions[index];
    let d = face.outlines.get(glyph.id);
    if (d === undefined) { d = glyph.path.toSVG(); face.outlines.set(glyph.id, d); }
    glyphs.push({ d, xOffset: position.xOffset, yOffset: position.yOffset, xAdvance: position.xAdvance });
  }
  return glyphs;
}

/** Underline and line-through geometry (px, from the baseline) for the face, as resvg draws them from the post and OS/2 tables. */
function decorationLines(face, decoration, scale) {
  const lines = [];
  const font = face.font, os2 = font["OS/2"];
  if (decoration.includes("underline")) lines.push({ offset: -(font.underlinePosition ?? -100) * scale, thickness: Math.max(1, (font.underlineThickness ?? 50) * scale) });
  if (decoration.includes("line-through") && os2) lines.push({ offset: -(os2.yStrikeoutPosition ?? 250) * scale, thickness: Math.max(1, (os2.yStrikeoutSize ?? 50) * scale) });
  return lines;
}
