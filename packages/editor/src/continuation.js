// LH-99: the export's continuation of overfull slides (core `continueOverfull`, LH-90) for the editor's hosts that draw slide by slide.
// The export draws a slide of two or more whole block units (eight timelines, five tables) that overflows at its readability floor
// as two or more pages; the editor keeps editing the source slide as written, and shows the split as a preview: the thumbnail is a
// stack with its page count, the canvas names the pages and previews each one read-only, and the presenter shows the pages as steps
// after their slide. Source slide indices never shift: selection, paths and slide numbers address the slides of the document.
import { blockUnits, continuationPages, continueOverfull } from "@openpresentation/opf/pagination";

// A few recent answers, shared by every host of the page: the strip, the canvas and the presenter ask about the same deck with the
// same options, and an edit to a slide that cannot continue (no block units) leaves the answer as it was.
const recent = [];
const RECENT = 4;
const sameList = (a = [], b = []) => a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * The continuation of a deck: `{ presentation, pages, continued }`, where `pages[i]` lists the indices in `presentation` (the deck
 * the export draws) that draw source slide `i`, or `null` when no slide continues. `options`: `fonts` (the renderer's fonts handle
 * whose `textMeasurement` chooses the breaks, as the export's), `catalogs` (the catalogs the renderer draws with) and `date`.
 * Only slides of block units can continue, so a deck without one costs a scan of its slides. An answer is reused while the slides that
 * can continue are unchanged; `exact: true` asks for one computed from this very deck, for a host that draws every slide from
 * `presentation` (the presenter), not only the pages of a continued slide.
 */
export function continuationOf(deck, { fonts, catalogs = [], date, exact = false } = {}) {
  const slides = Array.isArray(deck?.slides) ? deck.slides : [];
  const candidates = [];
  slides.forEach((slide, index) => { if (blockUnits(slide)) candidates.push(index); });
  if (!candidates.length) return null;
  const { slides: _slides, ...metadata } = deck;
  // What the breaks depend on: the deck's own settings, the sections and slide count (slide variables, furniture), the candidate
  // slides as written, the measurement and the catalogs.
  const key = JSON.stringify([metadata, slides.length, slides.map((slide) => slide?.section ?? null), candidates.map((index) => [index, slides[index]]), date ?? null]);
  const measurement = fonts?.textMeasurement;
  const found = recent.find((entry) => entry.key === key && entry.measurement === measurement && sameList(entry.catalogs, catalogs) && (!exact || entry.deck === deck));
  if (found) return found.result;
  // The breaks are measured with the faces the slides draw: until they load (the font gate), nothing is split and nothing is kept.
  try { if (fonts?.pending?.(deck, { catalogs })?.length) return null; } catch { return null; }
  let result = null;
  try {
    const split = continueOverfull(deck, { catalogs, ...(measurement ? { fonts: { textMeasurement: measurement } } : {}), ...(date ? { date } : {}) });
    if (split.continued.length) result = { presentation: split.presentation, continued: split.continued, pages: continuationPages(split, slides.length) };
  } catch { /* a deck the split cannot read is drawn as written; the canvas reports why */ }
  recent.unshift({ key, deck, measurement, catalogs: [...catalogs], result });
  recent.length = Math.min(recent.length, RECENT);
  return result;
}

/** How many pages the export draws source slide `index` on (1 when it does not continue). */
export function pageCount(continuation, index) {
  return continuation?.pages[index]?.length ?? 1;
}

/** Forget the recent answers (after the fonts load: the measurement changed). */
export function clearContinuations() {
  recent.length = 0;
}
