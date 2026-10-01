// SVG value parsing for the vector PDF export (RR-12): colors, lengths, transforms, path data and the
// presentation-attribute cascade. Only what the renderer's SVG (and ordinary hand-written SVG) uses.

export const IDENTITY = [1, 0, 0, 1, 0, 0];

/** parent ∘ child: the matrix that applies `child` first, then `parent` (SVG convention). */
export function multiply(parent, child) {
  const [pa, pb, pc, pd, pe, pf] = parent, [ca, cb, cc, cd, ce, cf] = child;
  return [pa * ca + pc * cb, pb * ca + pd * cb, pa * cc + pc * cd, pb * cc + pd * cd, pa * ce + pc * cf + pe, pb * ce + pd * cf + pf];
}

export function invert([a, b, c, d, e, f]) {
  const det = a * d - b * c;
  if (!det || !Number.isFinite(det)) return null;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

export function applyPoint([a, b, c, d, e, f], x, y) {
  return [a * x + c * y + e, b * x + d * y + f];
}

export function parseTransform(value) {
  let matrix = IDENTITY;
  if (!value) return matrix;
  for (const match of String(value).matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)) {
    const args = match[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (args.some((item) => !Number.isFinite(item))) continue;
    let next;
    switch (match[1]) {
      case "matrix": if (args.length === 6) next = args; break;
      case "translate": next = [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0]; break;
      case "scale": next = [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0]; break;
      case "rotate": {
        const angle = (args[0] ?? 0) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
        next = [cos, sin, -sin, cos, 0, 0];
        if (args.length >= 3) next = multiply(multiply([1, 0, 0, 1, args[1], args[2]], next), [1, 0, 0, 1, -args[1], -args[2]]);
        break;
      }
      case "skewX": next = [1, 0, Math.tan((args[0] ?? 0) * Math.PI / 180), 1, 0, 0]; break;
      case "skewY": next = [1, Math.tan((args[0] ?? 0) * Math.PI / 180), 0, 1, 0, 0]; break;
      default: break;
    }
    if (next) matrix = multiply(matrix, next);
  }
  return matrix;
}

const NAMED = { "aliceblue":"f0f8ff", "antiquewhite":"faebd7", "aqua":"00ffff", "aquamarine":"7fffd4", "azure":"f0ffff", "beige":"f5f5dc", "bisque":"ffe4c4", "black":"000000", "blanchedalmond":"ffebcd", "blue":"0000ff", "blueviolet":"8a2be2", "brown":"a52a2a", "burlywood":"deb887", "cadetblue":"5f9ea0", "chartreuse":"7fff00", "chocolate":"d2691e", "coral":"ff7f50", "cornflowerblue":"6495ed", "cornsilk":"fff8dc", "crimson":"dc143c", "cyan":"00ffff", "darkblue":"00008b", "darkcyan":"008b8b", "darkgoldenrod":"b8860b", "darkgray":"a9a9a9", "darkgreen":"006400", "darkgrey":"a9a9a9", "darkkhaki":"bdb76b", "darkmagenta":"8b008b", "darkolivegreen":"556b2f", "darkorange":"ff8c00", "darkorchid":"9932cc", "darkred":"8b0000", "darksalmon":"e9967a", "darkseagreen":"8fbc8f", "darkslateblue":"483d8b", "darkslategray":"2f4f4f", "darkslategrey":"2f4f4f", "darkturquoise":"00ced1", "darkviolet":"9400d3", "deeppink":"ff1493", "deepskyblue":"00bfff", "dimgray":"696969", "dimgrey":"696969", "dodgerblue":"1e90ff", "firebrick":"b22222", "floralwhite":"fffaf0", "forestgreen":"228b22", "fuchsia":"ff00ff", "gainsboro":"dcdcdc", "ghostwhite":"f8f8ff", "gold":"ffd700", "goldenrod":"daa520", "gray":"808080", "green":"008000", "greenyellow":"adff2f", "grey":"808080", "honeydew":"f0fff0", "hotpink":"ff69b4", "indianred":"cd5c5c", "indigo":"4b0082", "ivory":"fffff0", "khaki":"f0e68c", "lavender":"e6e6fa", "lavenderblush":"fff0f5", "lawngreen":"7cfc00", "lemonchiffon":"fffacd", "lightblue":"add8e6", "lightcoral":"f08080", "lightcyan":"e0ffff", "lightgoldenrodyellow":"fafad2", "lightgray":"d3d3d3", "lightgreen":"90ee90", "lightgrey":"d3d3d3", "lightpink":"ffb6c1", "lightsalmon":"ffa07a", "lightseagreen":"20b2aa", "lightskyblue":"87cefa", "lightslategray":"778899", "lightslategrey":"778899", "lightsteelblue":"b0c4de", "lightyellow":"ffffe0", "lime":"00ff00", "limegreen":"32cd32", "linen":"faf0e6", "magenta":"ff00ff", "maroon":"800000", "mediumaquamarine":"66cdaa", "mediumblue":"0000cd", "mediumorchid":"ba55d3", "mediumpurple":"9370db", "mediumseagreen":"3cb371", "mediumslateblue":"7b68ee", "mediumspringgreen":"00fa9a", "mediumturquoise":"48d1cc", "mediumvioletred":"c71585", "midnightblue":"191970", "mintcream":"f5fffa", "mistyrose":"ffe4e1", "moccasin":"ffe4b5", "navajowhite":"ffdead", "navy":"000080", "oldlace":"fdf5e6", "olive":"808000", "olivedrab":"6b8e23", "orange":"ffa500", "orangered":"ff4500", "orchid":"da70d6", "palegoldenrod":"eee8aa", "palegreen":"98fb98", "paleturquoise":"afeeee", "palevioletred":"db7093", "papayawhip":"ffefd5", "peachpuff":"ffdab9", "peru":"cd853f", "pink":"ffc0cb", "plum":"dda0dd", "powderblue":"b0e0e6", "purple":"800080", "rebeccapurple":"663399", "red":"ff0000", "rosybrown":"bc8f8f", "royalblue":"4169e1", "saddlebrown":"8b4513", "salmon":"fa8072", "sandybrown":"f4a460", "seagreen":"2e8b57", "seashell":"fff5ee", "sienna":"a0522d", "silver":"c0c0c0", "skyblue":"87ceeb", "slateblue":"6a5acd", "slategray":"708090", "slategrey":"708090", "snow":"fffafa", "springgreen":"00ff7f", "steelblue":"4682b4", "tan":"d2b48c", "teal":"008080", "thistle":"d8bfd8", "tomato":"ff6347", "turquoise":"40e0d0", "violet":"ee82ee", "wheat":"f5deb3", "white":"ffffff", "whitesmoke":"f5f5f5", "yellow":"ffff00", "yellowgreen":"9acd32", "transparent":"00000000" };

/** A color as {r, g, b, a} in 0..1, `null` for none, or `undefined` when the text is not a color this reader knows. */
export function parseColor(value, current) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim().toLowerCase();
  if (text === "none") return null;
  if (text === "currentcolor") return current;
  let match = /^#([0-9a-f]{3,8})$/.exec(text);
  if (match) {
    let digits = match[1];
    if (digits.length === 3 || digits.length === 4) digits = [...digits].map((digit) => digit + digit).join("");
    if (digits.length !== 6 && digits.length !== 8) return undefined;
    const channel = (index) => parseInt(digits.slice(index * 2, index * 2 + 2), 16) / 255;
    return { r: channel(0), g: channel(1), b: channel(2), a: digits.length === 8 ? channel(3) : 1 };
  }
  match = /^rgba?\(([^)]*)\)$/.exec(text);
  if (match) {
    const parts = match[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return undefined;
    const channel = (part) => Math.min(1, Math.max(0, part.endsWith("%") ? parseFloat(part) / 100 : parseFloat(part) / 255));
    const alpha = parts[3] === undefined ? 1 : Math.min(1, Math.max(0, parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])));
    const result = { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: alpha };
    return Object.values(result).every(Number.isFinite) ? result : undefined;
  }
  match = /^hsla?\(([^)]*)\)$/.exec(text);
  if (match) {
    const parts = match[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return undefined;
    const hue = (((parseFloat(parts[0]) % 360) + 360) % 360) / 360;
    const saturation = Math.min(1, Math.max(0, parseFloat(parts[1]) / 100)), lightness = Math.min(1, Math.max(0, parseFloat(parts[2]) / 100));
    const alpha = parts[3] === undefined ? 1 : Math.min(1, Math.max(0, parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])));
    const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation, p = 2 * lightness - q;
    const channel = (t) => {
      t = (t + 1) % 1;
      return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    };
    const result = { r: channel(hue + 1 / 3), g: channel(hue), b: channel(hue - 1 / 3), a: alpha };
    return Object.values(result).every(Number.isFinite) ? result : undefined;
  }
  if (NAMED[text]) return parseColor("#" + NAMED[text]);
  return undefined;
}

/** A number with an optional unit as user units (px). `reference` resolves percentages, `fontSize` em. */
export function parseLength(value, { reference = 0, fontSize = 16 } = {}) {
  if (value === undefined || value === null) return undefined;
  const match = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(px|pt|pc|mm|cm|in|em|ex|%)?\s*$/i.exec(String(value));
  if (!match) return undefined;
  const number = parseFloat(match[1]);
  switch ((match[2] ?? "").toLowerCase()) {
    case "pt": return number * 96 / 72;
    case "pc": return number * 16;
    case "mm": return number * 96 / 25.4;
    case "cm": return number * 96 / 2.54;
    case "in": return number * 96;
    case "em": return number * fontSize;
    case "ex": return number * fontSize / 2;
    case "%": return number * reference / 100;
    default: return number;
  }
}

export function parseNumberList(value) {
  if (value === undefined || value === null) return [];
  return String(value).trim().split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isFinite);
}

/** Inline `style="a:b;c:d"` declarations as an object. */
export function parseDeclarations(style) {
  const result = {};
  if (!style) return result;
  for (const declaration of String(style).split(";")) {
    const at = declaration.indexOf(":");
    if (at > 0) result[declaration.slice(0, at).trim().toLowerCase()] = declaration.slice(at + 1).trim();
  }
  return result;
}

/** The element's attributes with its style declarations merged over them (declarations win). */
export function attributesOf(node) {
  if (node.__attributes) return node.__attributes;
  const merged = { ...node.attrs, ...node.__css, ...parseDeclarations(node.attrs.style) };
  Object.defineProperty(node, "__attributes", { value: merged, enumerable: false });
  return merged;
}

// ---------------------------------------------------------------------------------------------------------------
// Path data

/** Parse SVG path data to absolute commands: ["M",x,y] ["L",x,y] ["C",x1,y1,x2,y2,x,y] ["Z"]. */
export function parsePath(data) {
  const tokens = String(data ?? "").match(/[a-zA-Z]|[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi) ?? [];
  const commands = [];
  let index = 0, command = "", x = 0, y = 0, startX = 0, startY = 0, lastControlX = 0, lastControlY = 0, previous = "";
  const read = () => Number(tokens[index++]);
  const available = () => index < tokens.length && !/^[a-zA-Z]$/.test(tokens[index]);
  const flag = () => { const token = tokens[index]; if (token.length > 1 && /^[01]/.test(token) && !token.includes(".")) { tokens[index] = token.slice(1); return Number(token[0]); } index++; return Number(token); };
  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index])) command = tokens[index++];
    else if (!command) break;
    const relative = command === command.toLowerCase();
    const type = command.toUpperCase();
    if (type === "Z") {
      commands.push(["Z"]);
      x = startX; y = startY; previous = "Z";
      if (available()) break;
      continue;
    }
    if (!available()) break;
    const arity = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 }[type];
    if (!arity) break;
    if (type === "A") {
      const rx = read(), ry = read(), rotation = read(), large = flag(), sweep = flag();
      let ex = read(), ey = read();
      if (relative) { ex += x; ey += y; }
      for (const curve of arcToCurves(x, y, rx, ry, rotation, large, sweep, ex, ey)) commands.push(curve);
      x = ex; y = ey; previous = "A";
    } else {
      const values = [];
      for (let count = 0; count < arity; count++) values.push(read());
      if (values.some((value) => !Number.isFinite(value))) break;
      switch (type) {
        case "M": {
          const px = values[0] + (relative ? x : 0), py = values[1] + (relative ? y : 0);
          commands.push(["M", px, py]);
          x = startX = px; y = startY = py;
          command = relative ? "l" : "L";
          break;
        }
        case "L": { x = values[0] + (relative ? x : 0); y = values[1] + (relative ? y : 0); commands.push(["L", x, y]); break; }
        case "H": { x = values[0] + (relative ? x : 0); commands.push(["L", x, y]); break; }
        case "V": { y = values[0] + (relative ? y : 0); commands.push(["L", x, y]); break; }
        case "C": {
          const c = relative ? [x + values[0], y + values[1], x + values[2], y + values[3], x + values[4], y + values[5]] : values;
          commands.push(["C", ...c]);
          lastControlX = c[2]; lastControlY = c[3]; x = c[4]; y = c[5];
          break;
        }
        case "S": {
          const first = previous === "C" || previous === "S" ? [2 * x - lastControlX, 2 * y - lastControlY] : [x, y];
          const c = relative ? [x + values[0], y + values[1], x + values[2], y + values[3]] : values;
          commands.push(["C", first[0], first[1], c[0], c[1], c[2], c[3]]);
          lastControlX = c[0]; lastControlY = c[1]; x = c[2]; y = c[3];
          break;
        }
        case "Q": {
          const c = relative ? [x + values[0], y + values[1], x + values[2], y + values[3]] : values;
          commands.push(quadratic(x, y, c[0], c[1], c[2], c[3]));
          lastControlX = c[0]; lastControlY = c[1]; x = c[2]; y = c[3];
          break;
        }
        case "T": {
          const control = previous === "Q" || previous === "T" ? [2 * x - lastControlX, 2 * y - lastControlY] : [x, y];
          const end = relative ? [x + values[0], y + values[1]] : values;
          commands.push(quadratic(x, y, control[0], control[1], end[0], end[1]));
          lastControlX = control[0]; lastControlY = control[1]; x = end[0]; y = end[1];
          break;
        }
        default: break;
      }
      previous = type;
    }
  }
  return commands;
}

function quadratic(x0, y0, cx, cy, x, y) {
  return ["C", x0 + 2 / 3 * (cx - x0), y0 + 2 / 3 * (cy - y0), x + 2 / 3 * (cx - x), y + 2 / 3 * (cy - y), x, y];
}

function arcToCurves(x1, y1, rx, ry, rotationDegrees, large, sweep, x2, y2) {
  if ((x1 === x2 && y1 === y2)) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!rx || !ry) return [["L", x2, y2]];
  const phi = rotationDegrees * Math.PI / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { const scale = Math.sqrt(lambda); rx *= scale; ry *= scale; }
  const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const factor = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = factor * (rx * y1p / ry), cyp = factor * (-ry * x1p / rx);
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const start = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  else if (sweep && delta < 0) delta += 2 * Math.PI;
  const segments = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const step = delta / segments, alpha = 4 / 3 * Math.tan(step / 4);
  const curves = [];
  let theta = start;
  const point = (t) => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
  const derivative = (t) => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
  for (let count = 0; count < segments; count++) {
    const next = theta + step;
    const p1 = point(theta), p2 = point(next), d1 = derivative(theta), d2 = derivative(next);
    curves.push(["C", p1[0] + alpha * d1[0], p1[1] + alpha * d1[1], p2[0] - alpha * d2[0], p2[1] - alpha * d2[1], count === segments - 1 ? x2 : p2[0], count === segments - 1 ? y2 : p2[1]]);
    theta = next;
  }
  return curves;
}

/** Path commands for a basic shape element, or null. */
/** Percentages in shape attributes are of the viewport: width for x-like keys, height for y-like keys, the normalized diagonal for r. */
export function shapeToPath(node, attrs, resolve, viewport = { w: 0, h: 0 }) {
  const axis = { x: viewport.w, cx: viewport.w, x1: viewport.w, x2: viewport.w, width: viewport.w, rx: viewport.w, y: viewport.h, cy: viewport.h, y1: viewport.h, y2: viewport.h, height: viewport.h, ry: viewport.h, r: Math.sqrt((viewport.w ** 2 + viewport.h ** 2) / 2) };
  const length = (key) => resolve(attrs[key], axis[key]) ?? 0;
  switch (node.name) {
    case "rect": {
      const x = length("x"), y = length("y"), width = length("width"), height = length("height");
      if (!(width > 0 && height > 0)) return null;
      let rx = attrs.rx === undefined ? undefined : resolve(attrs.rx, axis.rx), ry = attrs.ry === undefined ? undefined : resolve(attrs.ry, axis.ry);
      if (rx === undefined && ry === undefined) { rx = ry = 0; } else { rx ??= ry; ry ??= rx; }
      rx = Math.min(Math.max(rx, 0), width / 2); ry = Math.min(Math.max(ry, 0), height / 2);
      if (!rx || !ry) return [["M", x, y], ["L", x + width, y], ["L", x + width, y + height], ["L", x, y + height], ["Z"]];
      const k = 0.5522847498;
      return [
        ["M", x + rx, y], ["L", x + width - rx, y],
        ["C", x + width - rx + rx * k, y, x + width, y + ry - ry * k, x + width, y + ry], ["L", x + width, y + height - ry],
        ["C", x + width, y + height - ry + ry * k, x + width - rx + rx * k, y + height, x + width - rx, y + height], ["L", x + rx, y + height],
        ["C", x + rx - rx * k, y + height, x, y + height - ry + ry * k, x, y + height - ry], ["L", x, y + ry],
        ["C", x, y + ry - ry * k, x + rx - rx * k, y, x + rx, y], ["Z"],
      ];
    }
    case "circle":
    case "ellipse": {
      const cx = length("cx"), cy = length("cy");
      const rx = node.name === "circle" ? length("r") : length("rx"), ry = node.name === "circle" ? rx : length("ry");
      if (!(rx > 0 && ry > 0)) return null;
      const k = 0.5522847498;
      return [
        ["M", cx + rx, cy], ["C", cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry], ["C", cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy],
        ["C", cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry], ["C", cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy], ["Z"],
      ];
    }
    case "line": return [["M", length("x1"), length("y1")], ["L", length("x2"), length("y2")]];
    case "polyline":
    case "polygon": {
      const points = parseNumberList(attrs.points);
      if (points.length < 4) return null;
      const commands = [];
      for (let index = 0; index + 1 < points.length; index += 2) commands.push([index ? "L" : "M", points[index], points[index + 1]]);
      if (node.name === "polygon") commands.push(["Z"]);
      return commands;
    }
    case "path": {
      const commands = parsePath(attrs.d);
      return commands.length ? commands : null;
    }
    default: return null;
  }
}

export function transformPath(commands, matrix) {
  return commands.map(([type, ...values]) => {
    const out = [type];
    for (let index = 0; index < values.length; index += 2) out.push(...applyPoint(matrix, values[index], values[index + 1]));
    return out;
  });
}

export function pathBounds(commands) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [, ...values] of commands) {
    for (let index = 0; index + 1 < values.length; index += 2) {
      minX = Math.min(minX, values[index]); maxX = Math.max(maxX, values[index]);
      minY = Math.min(minY, values[index + 1]); maxY = Math.max(maxY, values[index + 1]);
    }
  }
  return Number.isFinite(minX) ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Style cascade

const INHERITED = ["fill", "fill-opacity", "fill-rule", "stroke", "stroke-opacity", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "font-family", "font-size", "font-style", "font-weight", "text-anchor", "direction",
  "color", "letter-spacing", "word-spacing", "visibility", "white-space", "xml:space", "lang", "xml:lang", "font-variant-ligatures", "font-feature-settings"];

export const ROOT_STYLE = Object.freeze({
  fill: "#000000", "fill-opacity": "1", "fill-rule": "nonzero", stroke: "none", "stroke-opacity": "1", "stroke-width": "1",
  "stroke-linecap": "butt", "stroke-linejoin": "miter", "stroke-miterlimit": "4", "font-size": "16", "font-weight": "400", "font-style": "normal",
  "text-anchor": "start", color: "#000000", visibility: "visible", direction: "ltr",
});

/** The inherited properties of `node` over its parent's. */
export function inheritStyle(parentStyle, attrs) {
  const style = { ...parentStyle };
  for (const key of INHERITED) {
    if (attrs[key] !== undefined && attrs[key] !== "inherit") style[key] = attrs[key];
  }
  if (attrs["font-size"] !== undefined && attrs["font-size"] !== "inherit") {
    const parentSize = parseFloat(parentStyle["font-size"]) || 16;
    const named = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 }[String(attrs["font-size"]).trim()];
    style["font-size"] = String(named ?? parseLength(attrs["font-size"], { reference: parentSize, fontSize: parentSize }) ?? parentSize);
  }
  if (attrs["font-weight"] !== undefined) {
    const parentWeight = parseFontWeight(parentStyle["font-weight"], 400);
    style["font-weight"] = String(parseFontWeight(attrs["font-weight"], parentWeight));
  }
  return style;
}

export function parseFontWeight(value, parent = 400) {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "normal") return 400;
  if (text === "bold") return 700;
  if (text === "bolder") return parent < 400 ? 400 : parent < 600 ? 700 : 900;
  if (text === "lighter") return parent > 700 ? 700 : parent > 500 ? 400 : 100;
  const number = Number(text);
  return Number.isFinite(number) && number >= 1 && number <= 1000 ? number : parent;
}

export function parseFontFamilies(value) {
  if (!value) return [];
  return String(value).split(",").map((item) => item.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}

// ---------------------------------------------------------------------------------------------------------------
// Style sheets: type, class, id and universal selectors, comma lists (what generator output uses). Anything else in a
// selector (combinators, attribute and pseudo selectors) is reported through `unsupported` and the rule is skipped.

/** Apply the <style> rules of an SVG tree: each matching element gets `__css`, merged by `attributesOf` under inline styles. */
export function applyStyleSheets(root, unsupported) {
  const rules = [];
  const sheets = [];
  const collect = (node) => {
    if (node.name === "style" && (!node.attrs.type || /css/i.test(node.attrs.type))) sheets.push(node.children.map((child) => child.text ?? "").join(""));
    for (const child of node.children ?? []) if (child.name) collect(child);
  };
  collect(root);
  let order = 0;
  for (const sheet of sheets) {
    const css = sheet.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectorText = rule[1].trim();
      if (selectorText.startsWith("@")) continue;
      const declarations = parseDeclarations(rule[2].replace(/!important/g, ""));
      for (const raw of selectorText.split(",")) {
        const selector = raw.trim();
        const match = /^(\*|[A-Za-z][\w-]*)?((?:[.#][\w-]+)*)$/.exec(selector);
        if (!match || !selector) {
          unsupported(`The CSS selector "${selector.slice(0, 60)}" is not supported (only type, class, id and universal selectors); its rule is not applied.`);
          continue;
        }
        const parts = [...match[2].matchAll(/([.#])([\w-]+)/g)].map((part) => ({ kind: part[1], name: part[2] }));
        const specificity = (match[1] && match[1] !== "*" ? 1 : 0) + parts.filter((part) => part.kind === ".").length * 10 + parts.filter((part) => part.kind === "#").length * 100;
        rules.push({ tag: match[1], parts, specificity, order: order++, declarations });
      }
    }
  }
  if (!rules.length) return;
  rules.sort((a, b) => a.specificity - b.specificity || a.order - b.order);
  const visit = (node) => {
    if (node.name) {
      const classes = (node.attrs.class ?? "").split(/\s+/).filter(Boolean);
      let merged;
      for (const rule of rules) {
        if (rule.tag && rule.tag !== "*" && rule.tag !== node.name) continue;
        if (!rule.parts.every((part) => (part.kind === "." ? classes.includes(part.name) : node.attrs.id === part.name))) continue;
        merged = { ...merged, ...rule.declarations };
      }
      if (merged) Object.defineProperty(node, "__css", { value: merged, enumerable: false });
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
}

/** The matrix mapping a viewBox [minX, minY, width, height] into the viewport (x, y, width, height) under preserveAspectRatio. */
export function viewBoxTransform(viewBox, preserveAspectRatio, x, y, width, height) {
  const [minX, minY, boxWidth, boxHeight] = viewBox;
  const align = String(preserveAspectRatio ?? "xMidYMid meet").trim().split(/\s+/);
  if (align[0] === "none") return [width / boxWidth, 0, 0, height / boxHeight, x - minX * width / boxWidth, y - minY * height / boxHeight];
  const slice = align[1] === "slice";
  const scale = slice ? Math.max(width / boxWidth, height / boxHeight) : Math.min(width / boxWidth, height / boxHeight);
  const alignX = /xMin/.test(align[0]) ? 0 : /xMax/.test(align[0]) ? 1 : 0.5, alignY = /YMin/.test(align[0]) ? 0 : /YMax/.test(align[0]) ? 1 : 0.5;
  return [scale, 0, 0, scale, x - minX * scale + (width - boxWidth * scale) * alignX, y - minY * scale + (height - boxHeight * scale) * alignY];
}
