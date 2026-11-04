// LH-99: the canvas's page indicator for a slide the export continues on further pages (core `continueOverfull`, LH-90). The canvas
// keeps editing the slide as written (every path and selection addresses the source slide); the indicator names the pages the export
// draws and previews each one, read only, over the canvas. A preview-only split: it changes nothing in the document.
//
// Why an indicator and a preview rather than drawing the pages on the canvas: an edit addresses the source slide's paths, and a
// continuation page holds only some of its blocks, under another slide index. Editing the slide as written keeps every block editable
// in place, and the preview shows exactly what the PDF and PPTX draw (the same `toSvg` call on the export's deck).

const BAR_CSS = "position:absolute;right:8px;bottom:8px;z-index:7;align-items:center;gap:4px;max-width:calc(100% - 16px);padding:3px 4px 3px 10px;font:12px/1.4 system-ui;color:#2d2a40;background:#ffffffee;border:1px solid #c9c3e8;border-radius:6px;box-shadow:0 1px 3px #0002";
const BUTTON_CSS = "min-width:26px;min-height:24px;padding:0 6px;font:600 12px/1 system-ui;color:inherit;background:transparent;border:1px solid #c9c3e8;border-radius:4px;cursor:pointer";
const LAYER_CSS = "position:absolute;inset:0;z-index:6;flex-direction:column;background:#fff";
const CAPTION_CSS = "position:absolute;left:8px;top:8px;display:flex;align-items:center;gap:8px;max-width:calc(100% - 16px);padding:4px 4px 4px 10px;font:12px/1.4 system-ui;color:#2d2a40;background:#ffffffee;border:1px solid #c9c3e8;border-radius:6px;box-shadow:0 1px 3px #0002";

// The inline styles set the display, so showing and hiding sets it too (an inline display beats the [hidden] rule).
const toggle = (node, shown) => { node.hidden = !shown; node.style.display = shown ? "flex" : "none"; };

const DEFAULT_LABELS = {
  /** The indicator's text, before the page buttons. */
  pages: (count) => `Exports as ${count} slides`,
  page: (page, count) => `Preview export page ${page} of ${count}`,
  preview: (page, count) => `Export page ${page} of ${count}, read only`,
  back: "Back to editing",
};

/**
 * Mount the indicator in the canvas `root`. `update(count, drawPage)` shows it for a slide the export draws on `count` pages (`drawPage(page)`
 * returns the SVG of a 0-based page), or hides it for one page; `close()` leaves a preview. `onChange({ page })` hears the preview open
 * (`page` from 0) and close (`page: null`).
 */
export function createCanvasPages(root, { labels: custom, onChange } = {}) {
  const doc = root.ownerDocument;
  const labels = { ...DEFAULT_LABELS, ...(custom ?? {}) };
  const bar = doc.createElement("div");
  bar.className = "opf-canvas-pages";
  bar.setAttribute("role", "group");
  bar.style.cssText = BAR_CSS;
  toggle(bar, false);
  const text = doc.createElement("span");
  text.className = "opf-canvas-pages-text";
  const buttons = doc.createElement("span");
  buttons.style.cssText = "display:flex;gap:4px";
  bar.append(text, buttons);
  const layer = doc.createElement("div");
  layer.className = "opf-canvas-page-preview";
  layer.setAttribute("role", "group");
  layer.style.cssText = LAYER_CSS;
  toggle(layer, false);
  const drawing = doc.createElement("div");
  drawing.style.cssText = "flex:1;min-height:0";
  const caption = doc.createElement("div");
  caption.style.cssText = CAPTION_CSS;
  const captionText = doc.createElement("span");
  const back = doc.createElement("button");
  back.type = "button";
  back.className = "opf-canvas-page-back";
  back.style.cssText = BUTTON_CSS;
  back.textContent = labels.back;
  caption.append(captionText, back);
  layer.append(drawing, caption);
  root.append(layer, bar);

  let count = 1, draw = null, page = null;
  const paint = () => {
    for (const [index, button] of [...buttons.children].entries()) {
      button.setAttribute("aria-pressed", String(index === page));
      button.style.background = index === page ? "#7765d0" : "transparent";
      button.style.color = index === page ? "#fff" : "inherit";
    }
  };
  function open(next) {
    if (!draw || next < 0 || next >= count) return false;
    let svg;
    try { svg = draw(next); } catch (error) { svg = null; drawing.textContent = error?.message ?? "Preview unavailable"; }
    if (typeof svg === "string") {
      drawing.innerHTML = svg;
      const node = drawing.querySelector("svg");
      if (node) {
        node.style.cssText = "display:block;width:100%;height:auto";
        node.setAttribute("aria-hidden", "true");
        for (const focusable of node.querySelectorAll("[tabindex]")) focusable.removeAttribute("tabindex");
      }
    }
    page = next;
    const label = labels.preview(next + 1, count);
    layer.setAttribute("aria-label", label);
    captionText.textContent = label;
    toggle(layer, true);
    paint();
    onChange?.({ page });
    return true;
  }
  function close() {
    if (page === null) return false;
    page = null;
    toggle(layer, false);
    drawing.replaceChildren();
    paint();
    onChange?.({ page: null });
    return true;
  }
  back.addEventListener("click", () => { close(); buttons.firstElementChild?.focus(); });
  layer.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); buttons.children[0]?.focus(); } });
  bar.addEventListener("keydown", (event) => { if (event.key === "Escape" && page !== null) { event.preventDefault(); event.stopPropagation(); close(); } });
  return {
    element: bar,
    layer,
    get count() { return count; },
    /** The 0-based page previewed, or null while the slide is edited. */
    get page() { return page; },
    update(nextCount, drawPage) {
      const wasOpen = page;
      count = Number.isInteger(nextCount) && nextCount > 1 ? nextCount : 1;
      draw = count > 1 ? drawPage : null;
      toggle(bar, count > 1);
      if (count < 2) { close(); buttons.replaceChildren(); return; }
      text.textContent = labels.pages(count);
      bar.setAttribute("aria-label", labels.pages(count));
      if (buttons.children.length !== count) {
        buttons.replaceChildren(...Array.from({ length: count }, (_, index) => {
          const button = doc.createElement("button");
          button.type = "button";
          button.style.cssText = BUTTON_CSS;
          button.textContent = String(index + 1);
          button.setAttribute("aria-label", labels.page(index + 1, count));
          button.addEventListener("click", () => { if (page === index) close(); else open(index); });
          return button;
        }));
      } else for (const [index, button] of [...buttons.children].entries()) button.setAttribute("aria-label", labels.page(index + 1, count));
      // A preview that is open draws the page again (the slide changed), or closes when the page is gone.
      if (wasOpen !== null) { if (wasOpen < count) open(wasOpen); else close(); }
      paint();
    },
    open,
    close,
    destroy() { bar.remove(); layer.remove(); },
  };
}
