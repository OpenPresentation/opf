// RR-64: `textAsPaths: true` draws every <text> of a slide as glyph outlines, so the SVG needs no font. The renderer has
// already decided every line, position and width (x, y, text-anchor, textLength); the vector PDF export's SVG text layout
// (layoutText: text chunks, bidirectional runs, per-character fallback, fontkit shaping, textLength) turns that into positioned
// glyph runs, and this module writes each glyph as a <use> of its outline. Outlines are kept once per slide in <defs>, in font
// units, under an id made of the face's content hash and the glyph id, so SVGs inlined on one page never resolve to another
// face's glyph. Everything outside the <text> elements is left byte for byte as the renderer wrote it.
//
// A <text> becomes a <g> that keeps the element's own attributes except the text-only ones (so its transform, opacity and
// data-opf-* trace stay), labelled with its text for assistive technology unless it is aria-hidden; a tspan with a trace keeps
// it on a nested <g>; a link becomes an <a> around its runs; underline and line-through are rectangles in the text colour from
// the font's own metrics. Text drawn with a colour or bitmap font (COLR, CBDT, sbix, SVG tables) stays <text>, reported as
// `text-as-paths-kept-text`, and the SVG then embeds that face as usual.

import { FontLibrary } from "./pdf-fonts.js";
import { layoutText } from "./pdf-text.js";
import { ROOT_STYLE, attributesOf, inheritStyle, parseLength } from "./pdf-style.js";
import { decodeEntities, escapeAttribute, parseXml } from "./pdf-xml.js";

const TOKENS = /<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|[^<]+/g;
const ATTRIBUTE = /([^\s=/>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
// Attributes that only mean something on text: the outline group does not carry them.
const TEXT_ONLY = new Set(["x", "y", "dx", "dy", "rotate", "textLength", "lengthAdjust", "text-anchor", "text-rendering", "xml:space", "font-family", "font-size",
  "font-weight", "font-style", "font-variant", "font-stretch", "font-feature-settings", "font-variant-ligatures", "letter-spacing", "word-spacing", "text-decoration",
  "dominant-baseline", "alignment-baseline", "baseline-shift", "direction", "unicode-bidi", "writing-mode"]);
const COLOUR_TABLES = ["COLR", "CBDT", "sbix", "SVG "];
const libraries = new WeakMap();

/**
 * The outline font library of a fonts handle: every face of its registry (`registry.exportFaces()`), or the faces of its
 * `embeddedFonts` list. Built once per registry and extended when the registry gains faces (`ensure`, `addFaces`). Null when
 * the handle holds no font bytes.
 */
export function outlineLibrary(fonts) {
  const registry = fonts?.registry;
  if (typeof registry?.exportFaces === "function") {
    const exported = registry.exportFaces();
    const described = typeof registry.describeFaces === "function" ? registry.describeFaces() : [];
    let entry = libraries.get(registry);
    if (!entry) { entry = { library: newLibrary(fonts), added: 0 }; libraries.set(registry, entry); }
    // Registries only ever append faces.
    for (let index = entry.added; index < exported.length; index++) addFace(entry.library, exported[index].data, exported[index].family, described[index]);
    entry.added = exported.length;
    return entry.library;
  }
  const list = fonts?.embeddedFonts;
  if (!Array.isArray(list) || !list.length) return null;
  let library = libraries.get(list);
  if (!library) {
    library = newLibrary(fonts);
    for (const font of list) {
      const match = /^data:font\/[a-z0-9]+;base64,([A-Za-z0-9+/=]+)$/.exec(String(font?.dataUrl ?? ""));
      if (match) addFace(library, decodeBase64(match[1]), font.family, font);
    }
    libraries.set(list, library);
  }
  return library;
}

function newLibrary(fonts) {
  const fallback = fonts?.registry?.fallbackFamily ?? "Roboto";
  return new FontLibrary({ genericFamilies: () => [fallback] });
}

// The face is matched by the family, weight and style the registry gives it, the ones the SVG names.
function addFace(library, data, family, described) {
  const face = library.addData(data, "fonts", family);
  if (!face || face.outlineStyled) return;
  if (Number.isInteger(described?.weight)) face.weight = described.weight;
  if (typeof described?.italic === "boolean") face.italic = described.italic;
  face.outlineStyled = true;
}

function decodeBase64(text) {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(text, "base64"));
  const binary = atob(text), bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * Replace the <text> elements of the slide's content strings by glyph outlines. `library` comes from `outlineLibrary`,
 * `rootStyle` holds what the <svg> element gives its children (lang), `report(diagnostic)` receives what cannot be outlined
 * and `fail(code, message)` builds the error thrown when no face draws a text. Returns the new content and the <defs> markup.
 */
export function outlineSlideText(content, { library, rootStyle = {}, report = () => {}, fail }) {
  const defs = new Map();
  const reported = new Set();
  const env = {
    fonts: library,
    defaults: [],
    splitByOwner: true,
    // The renderer reports its own font substitutions and missing glyphs while it lays the slide out.
    diagnostic: () => {},
    missing: () => {},
    unavailable: (families) => fail("text-as-paths-font-unavailable", `No font face can outline text in ${families.length ? `'${families.join("', '")}'` : "the requested family"}; pass the fonts handle the slide was laid out with.`),
  };
  const base = inheritStyle(ROOT_STYLE, rootStyle);
  const keep = (family) => {
    if (reported.has(family)) return;
    reported.add(family);
    report({ code: "text-as-paths-kept-text", fontFamily: family, message: `'${family}' is a colour or bitmap font, which has no plain outlines; its text stays text and the SVG embeds the face.` });
  };
  const outlined = content.map((markup) => typeof markup === "string" && markup.includes("<text") ? outlineMarkup(markup, base, env, defs, keep) : markup);
  const definitions = [...defs].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join("");
  return { content: outlined, defs: definitions ? `<defs>${definitions}</defs>` : "" };
}

// Splices each <text> element of `markup`; the style it inherits is folded from its ancestors' attributes.
function outlineMarkup(markup, base, env, defs, keep) {
  const ancestors = [];
  let out = "", from = 0, start = -1, depth = 0, parentStyle = null;
  for (const match of markup.matchAll(TOKENS)) {
    const [token, close, name, attributes = "", selfClose] = match;
    if (name === undefined) continue;
    if (start >= 0) {
      if (name === "text") depth += close ? -1 : selfClose ? 0 : 1;
      if (depth > 0) continue;
      const end = match.index + token.length;
      out += markup.slice(from, start) + outlineText(markup.slice(start, end), parentStyle, env, defs, keep);
      from = end;
      start = -1;
      continue;
    }
    if (close) { ancestors.pop(); continue; }
    if (name === "text" && selfClose) {
      // An empty <text/> (an empty table cell) draws nothing: it becomes an empty group with the element's other attributes.
      const end = match.index + token.length;
      out += markup.slice(from, match.index) + outlineText(token, base, env, defs, keep);
      from = end;
      continue;
    }
    if (name === "text") {
      start = match.index;
      depth = 1;
      parentStyle = ancestors.reduce((style, attrs) => inheritStyle(style, attrs), base);
      continue;
    }
    if (!selfClose) ancestors.push(attributesOf({ attrs: parseAttributes(attributes) }));
  }
  return from === 0 ? markup : out + markup.slice(from);
}

function parseAttributes(text) {
  const attrs = {};
  for (const attribute of text.matchAll(ATTRIBUTE)) attrs[attribute[1]] = decodeEntities(attribute[2] ?? attribute[3] ?? "");
  return attrs;
}

function outlineText(source, parentStyle, env, defs, keep) {
  const node = parseXml(`<svg>${source}</svg>`)?.children.find((child) => child.name === "text");
  if (!node) return source;
  const { runs } = layoutText(node, env, parentStyle, null);
  const colour = runs.find((run) => COLOUR_TABLES.some((table) => run.face.font.directory?.tables?.[table]));
  if (colour) { keep([...colour.face.names][0]); return source; }
  const attrs = Object.entries(node.attrs).filter(([key]) => !TEXT_ONLY.has(key));
  const hidden = node.attrs["aria-hidden"] === "true", words = logicalText(runs);
  const label = hidden || !words ? [] : [["role", "img"], ["aria-label", words]];
  const groups = [];
  for (const run of runs) {
    const drawn = drawRun(run, defs);
    if (!drawn) continue;
    const owner = run.owner !== node && run.owner ? run.owner : null;
    const last = groups.at(-1);
    if (last && last.owner === owner) last.parts.push(drawn);
    else groups.push({ owner, parts: [drawn] });
  }
  const body = groups.map(({ owner, parts }) => {
    const trace = owner ? Object.entries(owner.attrs).filter(([key]) => key.startsWith("data-")) : [];
    return trace.length ? element("g", trace, parts.join("")) : parts.join("");
  }).join("");
  return element("g", [...attrs, ...label], body);
}

// The text in reading order: runs are placed in visual order, so a right-to-left chunk is read from its logical text.
function logicalText(runs) {
  const chunks = [];
  for (const run of runs) if (!chunks.includes(run.chunk)) chunks.push(run.chunk);
  return chunks.map((chunk) => chunk.logical).join(" ").replace(/\s+/g, " ").trim();
}

function drawRun(run, defs) {
  const style = run.style, size = run.size, face = run.face, upem = face.upem;
  const scale = size / upem, extra = run.extraSpacing ?? 0, scaleX = run.scaleX ?? 1;
  // The run is drawn in font units (y up) under one transform; each glyph is a <use> at its pen position in font units.
  const uses = [];
  let pen = 0;
  for (const glyph of run.glyphs) {
    const id = glyphId(face, glyph.gid, defs);
    if (id) {
      const x = units(pen / scale + glyph.xOffset), y = units(glyph.yOffset);
      uses.push(`<use href="#${id}"${x === "0" ? "" : ` x="${x}"`}${y === "0" ? "" : ` y="${y}"`}/>`);
    }
    pen += glyph.advance * scale + glyph.spacing + extra;
  }
  const decorations = [...run.decoration].map((kind) => decorationRect(kind, run, scale));
  if (!uses.length && !decorations.length) return "";
  const paint = [["fill", style.fill]];
  if (style["fill-opacity"] !== undefined && style["fill-opacity"] !== "1") paint.push(["fill-opacity", style["fill-opacity"]]);
  if (style.stroke && style.stroke !== "none") {
    // Glyphs are drawn at the em scale, so the stroke width is given in font units.
    const width = parseLength(style["stroke-width"], { fontSize: size }) ?? 1;
    paint.push(["stroke", style.stroke], ["stroke-width", precise(width / scale)]);
    if (style["stroke-opacity"] !== undefined && style["stroke-opacity"] !== "1") paint.push(["stroke-opacity", style["stroke-opacity"]]);
  }
  if (style.visibility && style.visibility !== "visible") paint.push(["visibility", style.visibility]);
  const glyphs = uses.length ? `<g transform="matrix(${precise(scale * scaleX)} 0 0 ${precise(-scale)} ${fixed(run.x)} ${fixed(run.y)})">${uses.join("")}</g>` : "";
  const drawn = element("g", paint, glyphs + decorations.join(""));
  // A link inside the text keeps its element's attributes (href, rel, target).
  return run.link ? element("a", Object.entries(run.link.node?.attrs ?? { href: run.link.href }), drawn) : drawn;
}

// Underline, line-through and overline in the text colour, from the font's own metrics (the vector PDF draws the same).
function decorationRect(kind, run, scale) {
  const font = run.face.font, upem = run.face.upem;
  let position, thickness;
  if (kind === "underline") { position = -(font.underlinePosition || -upem * 0.1) * scale; thickness = (font.underlineThickness || upem * 0.05) * scale; }
  else if (kind === "line-through") { position = -(font["OS/2"]?.yStrikeoutPosition || upem * 0.3) * scale; thickness = (font["OS/2"]?.yStrikeoutSize || upem * 0.05) * scale; }
  else { position = -font.ascent * scale; thickness = (font.underlineThickness || upem * 0.05) * scale; }
  return `<rect x="${fixed(run.x)}" y="${fixed(run.y + position - thickness / 2)}" width="${fixed(run.width)}" height="${fixed(thickness)}" stroke="none"/>`;
}

// The outline of a glyph, once per slide, in font units (y up); null for a glyph that draws nothing (a space).
function glyphId(face, gid, defs) {
  const id = `opf-g-${face.hash.slice(0, 12)}-${gid}`;
  if (defs.has(id)) return id;
  const d = outlinePath(face.font.getGlyph(gid).path.commands);
  if (!d) return null;
  defs.set(id, d);
  return id;
}

// Relative commands, each delta taken from the previous rounded point, so rounding to a tenth of a unit never drifts.
function outlinePath(commands) {
  const parts = [];
  let x = 0, y = 0, startX = 0, startY = 0, draws = false;
  for (const { command, args } of commands) {
    const letter = { moveTo: "m", lineTo: "l", quadraticCurveTo: "q", bezierCurveTo: "c", closePath: "z" }[command];
    if (!letter) continue;
    if (letter === "z") { parts.push("z"); x = startX; y = startY; continue; }
    const points = [];
    for (let index = 0; index < args.length; index += 2) points.push([round(args[index]), round(args[index + 1])]);
    parts.push(letter + numbers(points.flatMap(([px, py]) => [px - x, py - y])));
    [x, y] = points.at(-1);
    if (letter === "m") { startX = x; startY = y; } else draws = true;
  }
  return draws ? parts.join("") : "";
}

function round(value) { return Math.round(value * 10) / 10; }
// Numbers joined the short SVG way: no separator before a minus sign.
function numbers(values) {
  return values.map((value, index) => { const text = units(Math.round(value * 10) / 10); return index && !text.startsWith("-") ? " " + text : text; }).join("");
}

function element(name, attrs, body) {
  const text = attrs.filter(([, value]) => value !== undefined && value !== null).map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`).join("");
  return body ? `<${name}${text}>${body}</${name}>` : `<${name}${text}/>`;
}

// Font units to a tenth; positions to a thousandth of a pixel; the em scale to six significant digits.
function units(value) { const text = String(Math.round(value * 10) / 10); return text === "-0" ? "0" : text; }
function fixed(value) { const text = Number(value).toFixed(3).replace(/\.?0+$/, ""); return text === "-0" ? "0" : text; }
function precise(value) { return String(Number(Number(value).toPrecision(6))); }


/**
 * The outline engine a fonts handle carries as `outlines` (RR-64): `renderSvg(deck, { fonts, textAsPaths: true })` draws each
 * slide's text with it. The faces are read from the handle when a slide is outlined, so faces it loads later are used too.
 */
export function textOutlines(fonts) {
  return Object.freeze({
    outlineSlideText: (content, options) => {
      const library = outlineLibrary(fonts);
      if (!library) throw options.fail("text-as-paths-needs-fonts", "textAsPaths needs font faces to outline: pass the handle loadFonts() returns as `fonts`.");
      return outlineSlideText(content, { ...options, library });
    },
  });
}
