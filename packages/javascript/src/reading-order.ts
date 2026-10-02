/** A positioned thing whose reading position is wanted. */
export interface ReadingBox {
  box: { x: number; y: number; width: number; height: number };
}

/**
 * Visual reading order: rows from top to bottom, and within a row from the start to the end of the line.
 *
 * Items whose vertical centre falls inside an existing row's vertical extent join that row (so a full-height
 * item shares one row with everything beside it and the row reads left to right). Rows are ordered by their
 * top edge. Ties keep the input order, so the result is deterministic.
 *
 * The boxes are read as given: pass them in logical (unmirrored) coordinates and the order is the reading
 * order of both a left-to-right and a right-to-left deck, because mirroring a deck moves where an item is
 * drawn and where a line starts together. For boxes that are already mirrored, pass `direction: 'rtl'` to
 * order each row from right to left. composeSlide uses this for promoted regions and `opf audit` uses it to
 * check the composed order, so the two cannot drift apart.
 */
export function visualReadingOrder<T extends ReadingBox>(items: readonly T[], direction: 'ltr' | 'rtl' = 'ltr'): T[] {
  const index = new Map(items.map((item, i) => [item, i] as const));
  const along = direction === 'rtl' ? (item: T) => -(item.box.x + item.box.width) : (item: T) => item.box.x;
  return readingRows(items).flatMap(row => [...row].sort((a, b) => along(a) - along(b) || a.box.y - b.box.y || index.get(a)! - index.get(b)!));
}

/** The rows of {@link visualReadingOrder}, top to bottom, each in input order. Used to check row order alone. */
export function readingRows<T extends ReadingBox>(items: readonly T[]): T[][] {
  const index = new Map(items.map((item, i) => [item, i] as const));
  const sorted = [...items].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x || index.get(a)! - index.get(b)!);
  const rows: { top: number; bottom: number; items: T[] }[] = [];
  for (const item of sorted) {
    const centre = item.box.y + item.box.height / 2;
    const row = rows.find(candidate => centre >= candidate.top && centre <= candidate.bottom);
    if (row) {
      row.items.push(item);
      row.top = Math.min(row.top, item.box.y);
      row.bottom = Math.max(row.bottom, item.box.y + item.box.height);
    } else rows.push({ top: item.box.y, bottom: item.box.y + item.box.height, items: [item] });
  }
  rows.sort((a, b) => a.top - b.top);
  return rows.map(row => row.items.sort((a, b) => index.get(a)! - index.get(b)!));
}
