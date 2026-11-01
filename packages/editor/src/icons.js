// CE-29: icons the host can replace. Every editor part that draws an icon builds it through `resolveIcon`, so a host that passes
// `icons: { <name>: <icon> }` swaps it for its own (an SVG element, a function returning one, or SVG path data) and the default stays
// otherwise. Plain DOM, no framework, no network. The built-in icons are Lucide paths (ISC license), inlined by the parts.
const SVG_NS = "http://www.w3.org/2000/svg";
// SVG path data: commands, numbers, separators. Anything else (markup, a URL) is not a path and is rejected.
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]+$/;

const isSvgElement = (value) => Boolean(value) && typeof value === "object" && value.nodeType === 1 && String(value.localName).toLowerCase() === "svg";
const isPathData = (value) => typeof value === "string" && value.trim() !== "" && PATH_DATA.test(value);

function describeError(label) {
  return `${label} must be an SVG element, a function returning one, or SVG path data (24x24, stroked, currentColor).`;
}

/**
 * Check a part's `icons` option: an object whose keys are in `names` and whose values are an SVG element, a function, path data or null.
 * Returns a plain copy ({} for undefined); throws a TypeError for a bad shape or value and a RangeError for a name the part does not have,
 * so a typo does not silently do nothing.
 */
export function normalizeIcons(icons, names, label = "icons") {
  if (icons === undefined || icons === null) return {};
  if (typeof icons !== "object" || Array.isArray(icons) || isSvgElement(icons)) throw new TypeError(`${label} must be an object of icon names and icons.`);
  const out = {};
  for (const [name, value] of Object.entries(icons)) {
    if (!names.includes(name)) throw new RangeError(`${label}: "${name}" is not an icon of this part. Use one of ${names.join(", ")}.`);
    if (value === undefined || value === null) continue;
    if (typeof value !== "function" && !isSvgElement(value) && !isPathData(value)) throw new TypeError(describeError(`${label}.${name}`));
    out[name] = value;
  }
  return out;
}

function decorate(svg, name, className) {
  svg.classList.add("opf-icon");
  if (className) for (const extra of String(className).split(/\s+/).filter(Boolean)) svg.classList.add(extra);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  if (name) svg.setAttribute("data-opf-icon", name);
  return svg;
}

function builtin(doc, shapes) {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  for (const [tag, attributes] of shapes) {
    const node = doc.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    svg.append(node);
  }
  return svg;
}

/**
 * The icon for one place in a part, as `<svg class="opf-icon" aria-hidden="true" focusable="false">`.
 *
 * `given` is the host's choice: an SVG element (cloned into `doc`, never moved), a function that returns one (called with `doc`; it may also
 * return path data), or SVG path data for a 24x24 icon drawn as a 2px round stroke in `currentColor`. `null` or `undefined` (or a function
 * that returns nothing) means the default, `fallback`: path data, or a list of `[tag, attributes]` shapes for the few built-in icons that
 * are more than one stroked path (a filled dot, a circle with a dash). With neither, the result is null.
 *
 * `options`: `name` (written as `data-opf-icon`, so CSS can target one icon), `className` (added after `opf-icon`, for the part's own class)
 * and `size` (the `width` and `height` attributes, in px; a host element that sets its own keeps them, and the part's CSS overrides either).
 * Throws a TypeError for a given value that is none of the three forms.
 */
export function resolveIcon(doc, given, fallback, options = {}) {
  const { name, className, size } = options;
  let source = given;
  if (typeof source === "function") source = source(doc);
  const finish = (svg) => {
    if (size !== undefined && !svg.hasAttribute("width") && !svg.hasAttribute("height")) {
      svg.setAttribute("width", String(size));
      svg.setAttribute("height", String(size));
    }
    return decorate(svg, name, className);
  };
  if (source !== undefined && source !== null) {
    if (isSvgElement(source)) return finish(doc.importNode(source, true));
    if (isPathData(source)) return finish(builtin(doc, [["path", { d: source }]]));
    throw new TypeError(describeError("An icon"));
  }
  if (fallback === undefined || fallback === null) return null;
  return finish(builtin(doc, typeof fallback === "string" ? [["path", { d: fallback }]] : fallback));
}
