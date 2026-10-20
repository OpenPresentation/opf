// Shared by the export menu (RR-98) and the agent handoff dialog: the few DOM helpers both use, and the Lucide icons they draw.
// Lucide (https://lucide.dev) is ISC-licensed, Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT) and
// Lucide Contributors 2022. The path data below is inlined from lucide-react 1.48.0; nothing is loaded from a CDN. Internal: not a package entry.

const SVG_NS = "http://www.w3.org/2000/svg";

const ICONS = {
  Download: [["path",{"d":"M12 15V3"}],["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}],["path",{"d":"m7 10 5 5 5-5"}]],
  ChevronDown: [["path",{"d":"m6 9 6 6 6-6"}]],
  X: [["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]],
  Check: [["path",{"d":"M20 6 9 17l-5-5"}]],
  Copy: [["rect",{"width":"14","height":"14","x":"8","y":"8","rx":"2","ry":"2"}],["path",{"d":"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"}]],
  Bot: [["path",{"d":"M12 8V4H8"}],["rect",{"width":"16","height":"12","x":"4","y":"8","rx":"2"}],["path",{"d":"M2 14h2"}],["path",{"d":"M20 14h2"}],["path",{"d":"M15 13v2"}],["path",{"d":"M9 13v2"}]],
  FileText: [["path",{"d":"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"}],["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5"}],["path",{"d":"M10 9H8"}],["path",{"d":"M16 13H8"}],["path",{"d":"M16 17H8"}]],
  FileJson: [["path",{"d":"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"}],["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5"}],["path",{"d":"M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1"}],["path",{"d":"M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1"}]],
  FileCode: [["path",{"d":"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"}],["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5"}],["path",{"d":"M10 12.5 8 15l2 2.5"}],["path",{"d":"m14 12.5 2 2.5-2 2.5"}]],
  FileType: [["path",{"d":"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"}],["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5"}],["path",{"d":"M11 18h2"}],["path",{"d":"M12 12v6"}],["path",{"d":"M9 13v-.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v.5"}]],
  Image: [["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2","ry":"2"}],["circle",{"cx":"9","cy":"9","r":"2"}],["path",{"d":"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"}]],
  Images: [["path",{"d":"m22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16"}],["path",{"d":"M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2"}],["circle",{"cx":"13","cy":"7","r":"1","fill":"currentColor"}],["rect",{"x":"8","y":"2","width":"14","height":"14","rx":"2"}]],
  Presentation: [["path",{"d":"M2 3h20"}],["path",{"d":"M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"}],["path",{"d":"m7 21 5-5 5 5"}]],
};

/** An inline Lucide icon as an SVG element. It is decorative (aria-hidden); the control that holds it carries the name. */
export function icon(doc, name, size = 14) {
  const nodes = ICONS[name];
  const svg = doc.createElementNS(SVG_NS, "svg");
  for (const [key, value] of Object.entries({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false", class: "opf-icon" })) svg.setAttribute(key, String(value));
  for (const [tag, attributes] of nodes ?? []) {
    const child = doc.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) child.setAttribute(key, value);
    svg.append(child);
  }
  return svg;
}

/** `el(doc, "button", { class, type, "aria-label" }, ...children)`; `text` sets textContent, a false or nullish value leaves the attribute off. */
export function el(doc, tag, props = {}, ...children) {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

/** Save a Blob through a temporary link, the default for every download the export components make. */
export function saveBlob(doc, blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = el(doc, "a", { href: url, download: fileName, hidden: true });
  doc.body.append(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
