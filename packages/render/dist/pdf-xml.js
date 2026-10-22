// A minimal, dependency-free XML reader for the SVG the renderer (and other SVG producers) emit. It builds
// {name, attrs, children, parent} elements and {text} nodes, decodes the predefined and numeric entities, keeps
// CDATA as text, and ignores comments, processing instructions and the DOCTYPE. It does not validate.

const TOKEN = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE(?:[^>[]|\[[\s\S]*?\])*>|<(\/?)([A-Za-z_][\w:.-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>|[^<]+|</g;
const ATTRIBUTE = /([^\s=/>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const MAX_DEPTH = 1000;
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeEntities(text) {
  if (!text.includes("&")) return text;
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === "#") {
      const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : match;
    }
    return ENTITIES[code] ?? match;
  });
}

export function parseXml(source) {
  const root = { name: "#document", attrs: {}, children: [], parent: null };
  let current = root;
  let depth = 0;
  for (const match of source.matchAll(TOKEN)) {
    const [token, cdata, closing, tagName, attrText, selfClosing] = match;
    if (tagName !== undefined) {
      const local = tagName.includes(":") ? tagName.slice(tagName.indexOf(":") + 1) : tagName;
      if (closing) {
        // Tolerate stray end tags: close up to the nearest matching open element.
        let node = current;
        while (node && node.name !== local) node = node.parent;
        if (node?.parent) { let up = current; while (up !== node) { up = up.parent; depth--; } depth--; current = node.parent; }
        continue;
      }
      const attrs = {};
      for (const attribute of attrText.matchAll(ATTRIBUTE)) attrs[attribute[1]] = decodeEntities(attribute[2] ?? attribute[3] ?? "");
      const element = { name: local, attrs, children: [], parent: current };
      current.children.push(element);
      if (!selfClosing) {
        current = element;
        // Every walk over the tree is recursive: refuse trees deep enough to overflow the stack.
        if (++depth > MAX_DEPTH) throw new RangeError(`SVG elements are nested more than ${MAX_DEPTH} deep.`);
      }
    } else if (cdata !== undefined) {
      current.children.push({ text: cdata });
    } else if (token[0] !== "<" || token === "<") {
      current.children.push({ text: decodeEntities(token) });
    }
  }
  return root.children.find((child) => child.name === "svg") ?? null;
}

export function isElement(node) {
  return node && node.name !== undefined;
}

/** Serialize an element subtree back to XML (used to rasterize the few effects the PDF cannot draw as vectors). */
export function serialize(node, keepAttribute = () => true) {
  if (node.text !== undefined) return escapeText(node.text);
  const attrs = Object.entries(node.attrs).filter(([key, value]) => keepAttribute(key, value, node)).map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`).join("");
  if (!node.children.length) return `<${node.name}${attrs}/>`;
  return `<${node.name}${attrs}>${node.children.map((child) => serialize(child, keepAttribute)).join("")}</${node.name}>`;
}

export function escapeText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttribute(value) {
  return escapeText(value).replace(/"/g, "&quot;");
}

/** Text content of an element, concatenated in document order. */
export function textContent(node) {
  if (node.text !== undefined) return node.text;
  return node.children.map(textContent).join("");
}
