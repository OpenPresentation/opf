// FF-39: the preview's drawn table: the union of its cell rectangles (rows are as tall as their text needs, so a
// table can be shorter than the box composed for it). PowerPoint derives a table's height from its rows, so the PPTX
// table frame is compared with this, not with the composed allocation box. null when no cell is drawn.
export function drawnTableBox(elements, path) {
  const cells = elements.filter(e => e.kind === 'shape' && e.tag === 'rect' && Number.isFinite(e.x + e.y + e.w + e.h) && (e.path?.startsWith(path + '.columns.') || e.path?.startsWith(path + '.rows.')));
  if (!cells.length) return null;
  const x = Math.min(...cells.map(e => e.x)), y = Math.min(...cells.map(e => e.y));
  return {x, y, w: Math.max(...cells.map(e => e.x + e.w)) - x, h: Math.max(...cells.map(e => e.y + e.h)) - y};
}
