// CE-06 (promoted from openpresentation.org's playground runtime): which slide to show after the document changed outside the canvas
// (the source pane, an opened file, a restored copy). Stable ids survive a reorder; a deck without ids, or an id that is not unique, keeps
// the position and clamps it to the deck.

/** @param {readonly {id?: string}[]} before @param {readonly {id?: string}[]} after @param {number} index */
export function retainedSlideIndex(before, after, index) {
  const id = before[index]?.id;
  if (id && before.filter((slide) => slide.id === id).length === 1) {
    const matches = after.flatMap((slide, position) => (slide.id === id ? [position] : []));
    if (matches.length === 1) return matches[0];
  }
  return Math.max(0, Math.min(index, after.length - 1));
}
