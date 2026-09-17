/** Shared slide and content-payload id collection (matches @openpresentation/opf pagination). */

const promotedRegionKeys = [
  "left", "center", "right", "left+center", "center+right", "left+center+right",
  "top", "middle", "bottom", "top+middle", "middle+bottom", "top+middle+bottom",
  "top:left", "top:center", "top:right", "top:left+center", "top:center+right", "top:left+center+right",
  "middle:left", "middle:center", "middle:right", "middle:left+center", "middle:center+right", "middle:left+center+right",
  "bottom:left", "bottom:center", "bottom:right", "bottom:left+center", "bottom:center+right", "bottom:left+center+right",
  "top+middle:left", "top+middle:center", "top+middle:right", "top+middle:left+center", "top+middle:center+right", "top+middle:left+center+right",
  "middle+bottom:left", "middle+bottom:center", "middle+bottom:right", "middle+bottom:left+center", "middle+bottom:center+right", "middle+bottom:left+center+right",
  "top+middle+bottom:left", "top+middle+bottom:center", "top+middle+bottom:right", "top+middle+bottom:left+center", "top+middle+bottom:center+right", "top+middle+bottom:left+center+right",
];

const MAX_COMPOSITION_DEPTH = 8;

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function visitContentPayloads(slide, slidePath, visit) {
  const walk = (payload, path, depth, ancestors) => {
    visit(payload, path);
    if (!Array.isArray(payload.blocks) || depth >= MAX_COMPOSITION_DEPTH || ancestors.includes(payload)) return;
    const nested = [...ancestors, payload];
    payload.blocks.forEach((block, index) => {
      if (isRecord(block)) walk(block, path ? `${path}.blocks.${index}` : `blocks.${index}`, depth + 1, nested);
    });
  };
  if (Array.isArray(slide?.blocks)) {
    slide.blocks.forEach((block, index) => {
      if (isRecord(block)) walk(block, slidePath ? `${slidePath}.blocks.${index}` : `blocks.${index}`, 0, []);
    });
  }
  for (const key of promotedRegionKeys) {
    const region = slide?.[key];
    if (isRecord(region)) walk(region, slidePath ? `${slidePath}.${key}` : key, 0, []);
  }
}

export function slideIds(slide) {
  const ids = typeof slide?.id === "string" ? [slide.id] : [];
  if (isRecord(slide)) {
    visitContentPayloads(slide, "", (payload) => {
      if (typeof payload.id === "string") ids.push(payload.id);
    });
  }
  return ids;
}

export function collectReservedPresentationIds(document) {
  const ids = [];
  for (const slide of document.slides ?? []) ids.push(...slideIds(slide));
  return ids.filter(Boolean);
}

function remapNodeId(node, ids) {
  if (typeof node.id !== "string") return;
  const base = node.id;
  let suffix = 2;
  while (ids.has(node.id)) node.id = `${base}-${suffix++}`;
  ids.add(node.id);
}

/** Remap slide and payload ids when inserting slides (shared document namespace). */
export function remapSlideTreeIds(slide, ids) {
  remapNodeId(slide, ids);
  visitContentPayloads(slide, "", (payload) => remapNodeId(payload, ids));
}
