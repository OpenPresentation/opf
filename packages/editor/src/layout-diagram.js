// A nested-box diagram of a layout record (FA-33): one box per region in reading order, a split as a flex row or column, and each size
// as the flex weight of its box. Used by the layout picker and the custom layout editor; it needs a DOM document, importing needs none.

/** Append the boxes of one region list to `box`: a region is a `span` named by the region, a split a nested `div`. */
function fill(doc, box, regions, direction) {
  box.style.flexDirection = direction;
  for (const entry of Array.isArray(regions) ? regions : []) {
    if (entry === null || typeof entry !== "object") continue;
    const split = entry.name === undefined;
    const child = doc.createElement(split ? "div" : "span");
    const size = entry.size ?? (!split && (entry.name === "title" || entry.name === "subtitle") && direction === "column" ? "auto" : 1);
    child.style.flex = size === "auto" ? "0 0 auto" : `${Number.isFinite(size) ? size : 1} 1 0`;
    if (split) { child.className = "opf-layout-split"; fill(doc, child, entry.regions, entry.direction === "row" ? "row" : "column"); }
    else { child.textContent = entry.name; child.dataset.region = entry.name; }
    box.append(child);
  }
}

/** The diagram of `record` (its `direction` and `regions`); a `div.opf-layout-diagram` holding the region boxes. */
export function buildLayoutDiagram(doc, record) {
  const diagram = doc.createElement("div");
  diagram.className = "opf-layout-diagram";
  fill(doc, diagram, record?.regions, record?.direction === "row" ? "row" : "column");
  return diagram;
}
