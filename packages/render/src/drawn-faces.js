// The faces and characters an SVG's text draws, read from its markup: the families of each text's font-family list, at the
// font-weight and font-style the text takes (attributes are inherited down the element tree, as in SVG). RR-61 embeds only the
// faces a slide draws; RR-65 cuts each to the characters drawn in its family. Shared by the SVG writer and the SSR deck markup.

const FONT_WEIGHT_KEYWORDS = { normal: "400", bold: "700" };
const TEXT_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export function decodeTextEntities(text) {
  if (!text.includes("&")) return text;
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => code[0] === "#" ? String.fromCodePoint(code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)) : TEXT_ENTITIES[code] ?? match);
}
/** family (lowercase) to the set of "weight|style" pairs the markup draws text in; with `characters` (a Map), also the code points each family draws. */
export function drawnFaces(markup, characters) {
  const drawn = new Map();
  const tokens = /<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|[^<]+/g;
  const stack = [{ families: [], weight: "400", style: "normal", text: false }];
  const attribute = (attributes, name) => { const found = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attributes); return found ? found[1] ?? found[2] : undefined; };
  for (const [token, close, name, attributes, selfClose] of markup.matchAll(tokens)) {
    const top = stack.at(-1);
    if (name === undefined) {
      if (top.text && /\S/.test(token)) for (const family of top.families) { const set = drawn.get(family) ?? new Set(); set.add(`${top.weight}|${top.style}`); drawn.set(family, set); }
      if (characters && top.text && token[0] !== "<") {
        const points = [...decodeTextEntities(token)].map(character => character.codePointAt(0));
        for (const family of top.families) { const set = characters.get(family) ?? new Set(); for (const point of points) set.add(point); characters.set(family, set); }
      }
      continue;
    }
    if (close) { if (stack.length > 1) stack.pop(); continue; }
    const family = attribute(attributes, "font-family"), weight = attribute(attributes, "font-weight"), style = attribute(attributes, "font-style");
    const next = {
      families: family === undefined ? top.families : family.split(",").map(item => item.trim().replace(/^&quot;|&quot;$|^["']|["']$/g, "").toLowerCase()).filter(Boolean),
      weight: weight === undefined ? top.weight : FONT_WEIGHT_KEYWORDS[weight.trim()] ?? weight.trim(),
      style: style === undefined ? top.style : /italic|oblique/.test(style) ? "italic" : "normal",
      text: top.text || name === "text",
    };
    if (!selfClose) stack.push(next);
  }
  return drawn;
}
