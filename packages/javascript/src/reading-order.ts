/** A positioned thing whose reading position is wanted. */
export interface ReadingBox {
  box: { x: number; y: number; width: number; height: number };
}

/**
 * Visual reading order: rows from top to bottom, and within a row from the start to the end of the line.
 *
 * Items whose vertical center falls inside an existing row's vertical extent join that row (so a full-height
 * item shares one row with everything beside it and the row reads left to right). Rows are ordered by their
 * top edge. Ties keep the input order, so the result is deterministic.
 *
 * The boxes are read as given: pass them in logical (unmirrored) coordinates and the order is the reading
 * order of both a left-to-right and a right-to-left deck, because mirroring a deck moves where an item is
 * drawn and where a line starts together. For boxes that are already mirrored, pass `direction: 'rtl'` to
 * order each row from right to left. composeSlide uses this for promoted regions and `opf/reading-order` uses it to
 * check the composed order, so the two cannot drift apart.
 */
export function visualReadingOrder<T extends ReadingBox>(items: readonly T[], direction: 'ltr' | 'rtl' = 'ltr'): T[] {
  const index = new Map(items.map((item, i) => [item, i] as const));
  const along = direction === 'rtl' ? (item: T) => -(item.box.x + item.box.width) : (item: T) => item.box.x;
  return readingRows(items).flatMap(row => [...row].sort((a, b) => along(a) - along(b) || a.box.y - b.box.y || index.get(a)! - index.get(b)!));
}

/**
 * The rows of {@link visualReadingOrder}, top to bottom, each in input order. Used to check row order alone.
 *
 * A tall item (one whose height holds the centers of two or more items that sit one above the other: a full-height list beside a
 * grid of tiles) is not allowed to join those rows into one. The other items form their rows by themselves, row by row, and the tall
 * item joins the first row it spans when it is at the start side of what it spans (a picture before the text it is beside), the last
 * row when it is at the end side. So a grid of tiles beside a full-height list reads row by row, then the list, instead of column by
 * column, whatever the heights of the boxes: the order is the same for the cells of a region grid and for the boxes drawn in them.
 */
export function readingRows<T extends ReadingBox>(items: readonly T[]): T[][] {
  const index = new Map(items.map((item, i) => [item, i] as const));
  const center = (item: T) => item.box.y + item.box.height / 2;
  const tall = items.filter(item => {
    const inside = items.filter(other => other !== item && center(other) >= item.box.y && center(other) <= item.box.y + item.box.height);
    return inside.some(a => inside.some(b => a.box.y + a.box.height <= b.box.y));
  });
  const rest = items.filter(item => !tall.includes(item));
  const rows = rowsOf(rest.length ? rest : items, index);
  if (rest.length) {
    for (const item of tall) {
      const spanned = rows.filter(row => row.some(other => center(other) >= item.box.y && center(other) <= item.box.y + item.box.height));
      if (!spanned.length) {
        const at = rows.findIndex(row => Math.min(...row.map(other => other.box.y)) > item.box.y);
        rows.splice(at < 0 ? rows.length : at, 0, [item]);
        continue;
      }
      const atEnd = spanned.every(row => row.every(other => other.box.x + other.box.width <= item.box.x + 1));
      (atEnd ? spanned[spanned.length - 1]! : spanned[0]!).push(item);
    }
    for (const row of rows) row.sort((a, b) => index.get(a)! - index.get(b)!);
  }
  return rows;
}

function rowsOf<T extends ReadingBox>(items: readonly T[], index: Map<T, number>): T[][] {
  const sorted = [...items].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x || index.get(a)! - index.get(b)!);
  const rows: { top: number; bottom: number; items: T[] }[] = [];
  for (const item of sorted) {
    const center = item.box.y + item.box.height / 2;
    const row = rows.find(candidate => center >= candidate.top && center <= candidate.bottom);
    if (row) {
      row.items.push(item);
      row.top = Math.min(row.top, item.box.y);
      row.bottom = Math.max(row.bottom, item.box.y + item.box.height);
    } else rows.push({ top: item.box.y, bottom: item.box.y + item.box.height, items: [item] });
  }
  rows.sort((a, b) => a.top - b.top);
  return rows.map(row => row.items.sort((a, b) => index.get(a)! - index.get(b)!));
}
