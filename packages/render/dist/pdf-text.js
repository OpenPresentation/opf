import bidiFactory from "bidi-js";
import { hasGlyph, shape } from "./pdf-fonts.js";
import { openTypeLanguage } from "./script-fonts.js";
import { isElement } from "./pdf-xml.js";
import { attributesOf, inheritStyle, parseFontFamilies, parseFontWeight, parseLength } from "./pdf-style.js";

// SVG text layout for the vector PDF export (RR-12): the renderer has already decided every line, position and
// width (x, y, text-anchor, textLength), so this module only turns that into positioned glyph runs: text chunks,
// the Unicode bidirectional algorithm (the SVG carries directional isolates around right-to-left paragraphs),
// per-character font fallback, OpenType shaping with fontkit and textLength adjustment. It never wraps, shrinks
// or truncates text.

const bidi = bidiFactory();
const IGNORED = /[⁦-⁩‎‏‪-‮؜]/u;

/** Parse `font-feature-settings` / `font-variant-ligatures` of a style into an object of OpenType feature booleans. */
export function featuresOf(style) {
  const features = {};
  if (/^none$/i.test(style["font-variant-ligatures"] ?? "")) { features.liga = false; features.clig = false; }
  const settings = style["font-feature-settings"];
  if (settings && !/^normal$/i.test(settings)) {
    for (const match of settings.matchAll(/["']([A-Za-z0-9 ]{4})["']\s*(on|off|\d+)?/g)) {
      const value = match[2];
      features[match[1]] = value === undefined || value === "on" ? true : value === "off" ? false : Number(value) !== 0;
    }
  }
  return Object.keys(features).length ? features : undefined;
}

/**
 * Lay out one <text> element. `env` provides `fonts` (FontLibrary), `defaults` (the family list used when a requested
 * family has no face) and `diagnostic(d)`; `style` is the inherited style at the element; `link` the enclosing <a>.
 * Returns {runs, chunks}: runs are in drawing (visual) order, each with absolute user-space positions.
 */
export function layoutText(textNode, env, parentStyle, link) {
  const chars = [];
  const scopes = [];
  const pending = [];
  const rootAttrs = attributesOf(textNode);
  const rootStyle = inheritStyle(parentStyle, rootAttrs);

  const walk = (node, style, scope, decoration, activeLink) => {
    const attrs = node === textNode ? rootAttrs : attributesOf(node);
    const own = node === textNode ? rootStyle : inheritStyle(style, attrs);
    const fontSize = parseFloat(own["font-size"]) || 16;
    const startIndex = chars.length;
    for (const key of ["x", "y", "dx", "dy"]) {
      if (attrs[key] === undefined) continue;
      const values = String(attrs[key]).trim().split(/[\s,]+/).filter(Boolean).map((item) => parseLength(item, { fontSize }));
      values.forEach((value, offset) => { if (value !== undefined) pending.push({ index: startIndex + offset, key, value }); });
    }
    let nextScope = scope;
    if (attrs.textLength !== undefined && parseLength(attrs.textLength, { fontSize }) > 0) {
      nextScope = { id: scopes.length + 1, length: parseLength(attrs.textLength, { fontSize }), adjust: attrs.lengthAdjust === "spacingAndGlyphs" ? "glyphs" : "spacing" };
      scopes.push(nextScope);
    }
    let nextDecoration = decoration;
    if (attrs["text-decoration"] && attrs["text-decoration"] !== "none") nextDecoration = new Set([...decoration, ...String(attrs["text-decoration"]).split(/\s+/).filter((item) => /^(underline|line-through|overline)$/.test(item))]);
    const preserve = own["xml:space"] === "preserve" || /^pre/.test(own["white-space"] ?? "");
    for (const child of node.children) {
      if (child.text !== undefined) {
        for (const character of child.text.replace(/[\r\n\t]/g, " ")) chars.push({ ch: character, style: own, scope: nextScope, decoration: nextDecoration, link: activeLink, preserve, owner: node });
      } else if (isElement(child)) {
        if (child.name === "tspan" || child.name === "textPath" || child.name === "tref") walk(child, own, nextScope, nextDecoration, activeLink);
        else if (child.name === "a") {
          const href = attributesOf(child).href ?? attributesOf(child)["xlink:href"];
          walk(child, own, nextScope, nextDecoration, href === undefined ? activeLink : { href, node: child });
        }
      }
    }
  };
  walk(textNode, parentStyle, null, new Set(), link);
  for (const item of pending) if (chars[item.index]) chars[item.index][item.key] = item.value;
  collapseWhitespace(chars);
  if (!chars.length) return { runs: [] };

  // Text chunks start at every character with an absolute position.
  const chunks = [];
  let currentX = 0, currentY = 0;
  for (let index = 0; index < chars.length; index++) {
    const char = chars[index];
    if (index === 0 || char.x !== undefined || char.y !== undefined) {
      chunks.push({ chars: [], x: char.x ?? currentX, y: char.y ?? currentY });
      currentX = chunks.at(-1).x; currentY = chunks.at(-1).y;
    }
    chunks.at(-1).chars.push(char);
  }

  const styleIds = new Map();
  const faceCache = new Map();
  const linkIds = new Map();
  const ownerIds = new Map();
  const runsByChunk = chunks.map((chunk) => buildRuns(chunk, env, styleIds, faceCache, linkIds, ownerIds));

  // textLength: the renderer gives lines and tabs an exact width; reproduce it per scope over all its runs.
  const scopeWidth = new Map();
  for (const runs of runsByChunk) for (const run of runs) if (run.scope) scopeWidth.set(run.scope, (scopeWidth.get(run.scope) ?? 0) + run.natural);
  for (const runs of runsByChunk) {
    for (const run of runs) {
      run.width = run.natural;
      run.scaleX = 1;
      if (!run.scope) continue;
      const total = scopeWidth.get(run.scope);
      if (!(total > 0)) continue;
      if (run.scope.adjust === "glyphs") {
        run.scaleX = run.scope.length / total;
        run.width = run.natural * run.scaleX;
      } else {
        const glyphs = chunkGlyphCount(runsByChunk, run.scope);
        if (glyphs > 1) {
          const extra = (run.scope.length - total) / (glyphs - 1);
          run.extraSpacing = extra;
          run.width = run.natural + extra * run.glyphs.length;
        }
      }
    }
  }

  // Anchor and place each chunk.
  const placed = [];
  chunks.forEach((chunk, chunkIndex) => {
    const runs = runsByChunk[chunkIndex];
    const total = runs.reduce((sum, run) => sum + run.width, 0);
    const anchor = chunk.chars[0].style["text-anchor"];
    let x = chunk.x + (anchor === "middle" ? -total / 2 : anchor === "end" ? -total : 0);
    for (const run of reorder(runs)) {
      run.x = x + (run.dx ?? 0);
      run.y = chunk.y + (run.dy ?? 0);
      x += run.width;
      placed.push(run);
    }
  });
  return { runs: placed };
}

function chunkGlyphCount(runsByChunk, scope) {
  let count = 0;
  for (const runs of runsByChunk) for (const run of runs) if (run.scope === scope) count += run.glyphs.length;
  return count;
}

function collapseWhitespace(chars) {
  let previousSpace = true;
  const kept = [];
  for (const char of chars) {
    if (char.preserve) { kept.push(char); previousSpace = false; continue; }
    if (char.ch === " ") {
      if (previousSpace) continue;
      previousSpace = true;
    } else previousSpace = false;
    kept.push(char);
  }
  while (kept.length && !kept.at(-1).preserve && kept.at(-1).ch === " ") kept.pop();
  // Not chars.push(...kept): a spread of a very long text overflows the call stack.
  chars.length = 0;
  for (const char of kept) chars.push(char);
}

function buildRuns(chunk, env, styleIds, faceCache, linkIds, ownerIds) {
  const text = chunk.chars.map((char) => char.ch).join("");
  const baseDirection = chunk.chars[0].style.direction === "rtl" ? "rtl" : "ltr";
  // Levels per UTF-16 unit; characters take the level of their first unit.
  const embedding = bidi.getEmbeddingLevels(text, baseDirection);
  const levels = [];
  let unit = 0;
  for (const char of chunk.chars) { levels.push(embedding.levels[unit]); unit += char.ch.length; }
  const mirrored = bidi.getMirroredCharactersMap(text, embedding.levels);
  const runs = [];
  const chunkInfo = { logical: chunk.chars.filter((char) => !IGNORED.test(char.ch)).map((char) => char.ch).join(""), rtl: baseDirection === "rtl" || /^[⁧‫‮]/.test(text) };
  let current = null;
  unit = 0;
  chunk.chars.forEach((char, index) => {
    const start = unit;
    unit += char.ch.length;
    if (IGNORED.test(char.ch)) return;
    const level = levels[index];
    const resolved = pickFace(char, env, styleIds, faceCache);
    // RR-64: outlined text keeps each element's trace, so with `env.splitByOwner` a run never spans two elements.
    const owner = env.splitByOwner ? linkId(ownerIds, { node: char.owner }) : 0;
    const key = `${resolved.styleId}|${resolved.face.id}|${level}|${char.scope?.id ?? 0}|${linkId(linkIds, char.link)}|${[...char.decoration].sort().join(",")}|${owner}`;
    if (!current || current.key !== key) {
      // `start`: the run's first character in logical order, so a reader can put runs back in reading order (RR-64).
      current = { chunk: chunkInfo, start: index, key, face: resolved.face, style: char.style, level, scope: char.scope, link: char.link, decoration: char.decoration, owner: char.owner, chars: [], text: "", logical: "", weight: resolved.weight, italic: resolved.italic };
      runs.push(current);
    }
    current.logical += char.ch;
    current.text += level % 2 === 1 && mirrored.has(start) ? mirrored.get(start) : char.ch;
    current.chars.push(char);
  });
  for (const run of runs) shapeRun(run, env);
  return runs;
}

// A number per link within one layout call, so runs of different links never merge; nothing is written on the nodes.
function linkId(linkIds, link) {
  if (!link) return 0;
  let id = linkIds.get(link.node);
  if (id === undefined) { id = linkIds.size + 1; linkIds.set(link.node, id); }
  return id;
}

function pickFace(char, env, styleIds, faceCache) {
  const style = char.style;
  let styleId = styleIds.get(style);
  if (styleId === undefined) { styleId = styleIds.size + 1; styleIds.set(style, styleId); }
  let base = faceCache.get(style);
  if (!base) {
    const weight = parseFontWeight(style["font-weight"], 400);
    const italic = /italic|oblique/i.test(style["font-style"] ?? "");
    const families = parseFontFamilies(style["font-family"]);
    let match = env.fonts.match(families, weight, italic);
    if (!match) match = env.fonts.match(env.defaults, weight, italic);
    if (!match) match = { face: env.fonts.usable()[0] && bestAny(env.fonts, weight, italic), requested: families[0] };
    if (!match.face) throw env.unavailable(families);
    const requestedFirst = families[0];
    if (requestedFirst && !match.face.names.has(requestedFirst.toLowerCase()) && !/^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/i.test(requestedFirst)) {
      env.diagnostic({ code: "pdf-font-substituted", message: `Font '${requestedFirst}' has no face in the PDF font set; '${[...match.face.names][0]}' is embedded instead.`, requestedFamily: requestedFirst, resolvedFamily: [...match.face.names][0], weight, italic });
    }
    base = { face: match.face, weight, italic };
    faceCache.set(style, base);
  }
  const codePoint = char.ch.codePointAt(0);
  let face = base.face;
  if (!hasGlyph(face, codePoint) && !/\p{Default_Ignorable_Code_Point}|\s/u.test(char.ch)) {
    const fallback = env.fonts.fallbackFor(codePoint, base.weight, base.italic, face);
    if (fallback) {
      face = fallback;
      env.diagnostic({ code: "pdf-font-fallback", message: `'${[...base.face.names][0]}' has no glyph for U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}; '${[...face.names][0]}' draws it.`, fontFamily: [...base.face.names][0], fallbackFamily: [...face.names][0], codePoint });
    } else if (!/[\p{Cc}\p{Cf}\p{Zs}]/u.test(char.ch)) {
      // No supplied face has the character: the font's .notdef box is drawn, which is never what was written.
      env.missing({ code: "pdf-glyph-missing", message: `No supplied font has a glyph for U+${codePoint.toString(16).toUpperCase().padStart(4, "0")} (${JSON.stringify(char.ch)}); the font's missing-glyph box is drawn instead.`, fontFamily: [...base.face.names][0], codePoint });
    }
  }
  return { face, styleId, weight: base.weight, italic: base.italic };
}

function bestAny(fonts, weight, italic) {
  const [first] = fonts.usable();
  const same = fonts.usable().filter((face) => face.italic === italic);
  return (same.length ? same : [first]).sort((a, b) => Math.abs(a.weight - weight) - Math.abs(b.weight - weight) || a.id - b.id)[0];
}

function shapeRun(run, env) {
  const style = run.style;
  const size = parseFloat(style["font-size"]) || 16;
  const direction = run.level % 2 === 1 ? "rtl" : "ltr";
  const language = openTypeLanguage(style.lang ?? style["xml:lang"]);
  // RR-64: outlined text is shaped by HarfBuzz (env.shape), the browser's shaper; the vector PDF keeps fontkit.
  // HarfBuzz takes the BCP 47 tag (`lang`); fontkit the OpenType language system (`language`).
  const glyphs = (env.shape ?? shape)(run.face, run.text, { features: featuresOf(style), language, lang: style.lang ?? style["xml:lang"], direction });
  const scale = size / run.face.upem;
  const letterSpacing = parseLength(style["letter-spacing"], { fontSize: size }) ?? 0;
  const wordSpacing = parseLength(style["word-spacing"], { fontSize: size }) ?? 0;
  run.size = size;
  run.glyphs = glyphs;
  run.natural = glyphs.reduce((sum, glyph, index) => {
    glyph.spacing = letterSpacing + (glyph.codePoints.length === 1 && glyph.codePoints[0] === 0x20 ? wordSpacing : 0);
    glyph.nominalIndex = index;
    return sum + glyph.advance * scale + glyph.spacing;
  }, 0);
  run.scale = scale;
  run.dx = 0;
  run.dy = 0;
}

/** Reorder a chunk's runs into visual (left to right) order: rule L2 applied at run granularity. */
function reorder(runs) {
  const order = [...runs];
  if (!order.some((run) => run.level > 0)) return order;
  const max = Math.max(...order.map((run) => run.level));
  const minOdd = Math.min(...order.filter((run) => run.level % 2 === 1).map((run) => run.level));
  for (let level = max; level >= minOdd; level--) {
    for (let index = 0; index < order.length;) {
      if (order[index].level < level) { index++; continue; }
      let end = index;
      while (end + 1 < order.length && order[end + 1].level >= level) end++;
      for (let low = index, high = end; low < high; low++, high--) [order[low], order[high]] = [order[high], order[low]];
      index = end + 1;
    }
  }
  return order;
}



/**
 * The logical text of a glyph when the glyph-to-Unicode map cannot give it in a right-to-left run (read back to front by
 * extractors): a ligature of several characters, or a mirrored bracket whose glyph is the other bracket. Otherwise null.
 */
export function actualTextFor(run, glyph) {
  if (run.level % 2 !== 1) return null;
  const text = String.fromCodePoint(...glyph.codePoints);
  if (glyph.codePoints.length > 1) return text;
  return bidi.getMirroredCharacter(text) ?? null;
}

const NON_ASCII_SPACE = new RegExp("[" + [" ", " ", " - ", " ", " ", "　"].join("") + "]");

/**
 * Split a left-to-right run into clusters: the shortest glyph groups whose characters are exactly the next characters of
 * the logical text (a reordered Indic syllable is one cluster). Each cluster gets `actual`, its logical text, when its
 * glyphs do not give that text in order or it holds a space the glyph map copies as a plain space. Null when the glyphs
 * and the text do not line up.
 */
export function textClusters(run) {
  // Fonts decompose some characters (a Bengali two-part vowel becomes its parts) and compose others, so try the text as
  // written first and its canonical decomposition second.
  return alignClusters(run, run.logical) ?? alignClusters(run, run.logical.normalize("NFD"));
}

function alignClusters(run, text) {
  const logical = [...text].map((character) => character.codePointAt(0));
  const balance = new Map();
  let open = 0;
  const add = (point, delta) => {
    const before = balance.get(point) ?? 0, after = before + delta;
    balance.set(point, after);
    if (before === 0 && after !== 0) open++;
    else if (before !== 0 && after === 0) open--;
  };
  const clusters = [];
  let group = [], taken = [], consumed = 0, start = 0;
  for (const glyph of run.glyphs) {
    group.push(glyph);
    for (const point of glyph.codePoints) {
      if (consumed >= logical.length) return null;
      add(point, 1);
      add(logical[consumed++], -1);
      taken.push(point);
    }
    if (open === 0 && taken.length) {
      const slice = logical.slice(start, consumed);
      const exact = slice.every((point, index) => point === taken[index]) && !slice.some((point) => NON_ASCII_SPACE.test(String.fromCodePoint(point)));
      clusters.push({ glyphs: group, actual: exact ? null : String.fromCodePoint(...slice).normalize("NFC") });
      group = []; taken = []; start = consumed;
    }
  }
  if (group.length || consumed !== logical.length) {
    // Trailing glyphs without characters join the last cluster; anything else means no alignment.
    if (!group.length || taken.length || !clusters.length) return null;
    clusters.at(-1).glyphs.push(...group);
  }
  return clusters;
}
