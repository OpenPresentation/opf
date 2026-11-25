// FR-03: links in a slide that is read, not edited (the editor's viewer layout, a read-only editor, the MCP viewer). One place finds the link an
// event sits in, finds the slide a `slide:<id>` link names and opens any other link through the host; the canvas and the presenter use it.
/**
 * The link an event target sits in: `{ anchor, slide }` for a `slide:<id>` link (the renderer marks its anchor with `data-opf-slide-link`),
 * `{ anchor, href }` for any other, undefined for a target in no link (or in one outside `root`).
 */
export function linkAt(target, root) {
  const anchor = target && typeof target.closest === "function" ? target.closest("a[href]") : null;
  if (!anchor || (root && !root.contains(anchor))) return undefined;
  const slide = anchor.getAttribute("data-opf-slide-link");
  return slide ? { anchor, slide } : { anchor, href: anchor.getAttribute("href") ?? "" };
}

/** The index of the slide with this id in a document, or -1 (a slide link to a slide that does not exist goes nowhere). */
export function slideIndexOf(presentation, id) {
  const slides = Array.isArray(presentation?.slides) ? presentation.slides : [];
  return slides.findIndex((slide) => slide && typeof slide === "object" && slide.id === id);
}

/**
 * Open a web, mail or phone link outside the deck: the host's `openLink(href)` when it gave one, else a new tab that cannot reach back
 * (`noopener`, `noreferrer`). The caller has already kept only the schemes a link may open (the renderer's `isOpenableLink`).
 */
export function openOutside(href, { openLink, win } = {}) {
  const address = href.trim();
  if (typeof openLink === "function") {
    openLink(address);
    return true;
  }
  win?.open?.(address, "_blank", "noopener,noreferrer");
  return true;
}
