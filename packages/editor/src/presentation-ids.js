/** Shared slide and content-payload id collection (matches @openpresentation/opf pagination). */

const promotedRegionKeys = [
  "start", "center", "end", "start+center", "center+end", "start+center+end",
  "top", "middle", "bottom", "top+middle", "middle+bottom", "top+middle+bottom",
  "top:start", "top:center", "top:end", "top:start+center", "top:center+end", "top:start+center+end",
  "middle:start", "middle:center", "middle:end", "middle:start+center", "middle:center+end", "middle:start+center+end",
  "bottom:start", "bottom:center", "bottom:end", "bottom:start+center", "bottom:center+end", "bottom:start+center+end",
  "top+middle:start", "top+middle:center", "top+middle:end", "top+middle:start+center", "top+middle:center+end", "top+middle:start+center+end",
  "middle+bottom:start", "middle+bottom:center", "middle+bottom:end", "middle+bottom:start+center", "middle+bottom:center+end", "middle+bottom:start+center+end",
  "top+middle+bottom:start", "top+middle+bottom:center", "top+middle+bottom:end", "top+middle+bottom:start+center", "top+middle+bottom:center+end", "top+middle+bottom:start+center+end",
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

export function collectReservedPresentationIds(presentation) {
  const ids = [];
  for (const slide of presentation.slides ?? []) ids.push(...slideIds(slide));
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
