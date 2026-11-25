/**
 * Shared id collection for slides, content payloads and (FR-02) the list items, bullets, timeline events and table rows inside them: one
 * document-wide namespace (matches @openpresentation/opf). Edit, move and reorder keep an id. A copy inside the document gets a new one
 * (remapSlideTreeIds); pasting from another document keeps an id that is free and replaces one that is taken (the same call). Splitting a
 * slide keeps every id on the part that holds the entry, and merging keeps the first slide's id (core splitSlide and mergeSlides).
 */

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
}

/** The entries of one payload (or slide) that can carry an id: items, bullets, timeline events, inline table rows. Dataset and chart rows are data. */
export function payloadEntries(payload) {
  if (!isRecord(payload)) return [];
  const timeline = Array.isArray(payload.timeline) ? payload.timeline : isRecord(payload.timeline) && Array.isArray(payload.timeline.events) ? payload.timeline.events : [];
  const rows = isRecord(payload.table) && Array.isArray(payload.table.rows) ? payload.table.rows : [];
  return [payload.items, payload.bullets, timeline, rows].flatMap((list) => (Array.isArray(list) ? list : [])).filter(isRecord);
}

export function slideIds(slide) {
  const ids = typeof slide?.id === "string" ? [slide.id] : [];
  if (isRecord(slide)) {
    for (const entry of payloadEntries(slide)) if (typeof entry.id === "string") ids.push(entry.id);
    visitContentPayloads(slide, "", (payload) => {
      if (typeof payload.id === "string") ids.push(payload.id);
      for (const entry of payloadEntries(payload)) if (typeof entry.id === "string") ids.push(entry.id);
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
  for (const entry of payloadEntries(slide)) remapNodeId(entry, ids);
  visitContentPayloads(slide, "", (payload) => {
    remapNodeId(payload, ids);
    for (const entry of payloadEntries(payload)) remapNodeId(entry, ids);
  });
}
