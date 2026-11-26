// FR-08: the live frames of a web presenter. The renderer draws an embed as its static form (a picture or a card) and marks it with
// `data-opf-embed*` attributes; engines never load the page. A presenter whose host allows a page (its `embeds` option) calls
// `mountLiveEmbeds` after it draws a slide: a sandboxed iframe goes over the static form of each allowed embed, and the static form
// stays under it until the frame loads (and stays if the frame never does). The deck holds no sandbox policy: which pages are shown
// live is the host's list, and nothing is shown live by default.

/** What a live frame may do. Same-origin pages are never framed (see `isSameOriginPage`), so `allow-same-origin` keeps the page its own origin, not the host's. */
export const LIVE_EMBED_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-forms";

/**
 * Whether an address is on the origin of the page that presents it. Such a page is never shown live whatever the host's list says:
 * a sandbox that allows scripts and its own origin does not contain a page of the host's own origin.
 */
export function isSameOriginPage(src, origin) {
  if (!origin || origin === "null") return false;
  try { return new URL(src).origin === new URL(origin).origin; } catch { return false; }
}

/** The embeds an SVG slide draws: `{ path, src, title, area }`, `area` the element whose box is the frame. */
export function embedsOf(svg) {
  const found = [];
  for (const group of svg?.querySelectorAll?.("[data-opf-embed]") ?? []) {
    const src = group.getAttribute("data-opf-embed-src"), area = group.querySelector("[data-opf-link-area]");
    if (src && area) found.push({ path: group.getAttribute("data-opf-embed"), src, title: group.getAttribute("data-opf-embed-title") ?? "", area });
  }
  return found;
}

/**
 * Put a sandboxed frame over each embed of `svg` that the host allows. `host` is the element that holds the SVG (the frames go in a
 * layer appended to it, which takes no pointer events itself). `embeds(src)` is the host's answer (absent: nothing is live), `origin`
 * the presenting page's origin (default: the document's). Returns `{ frames, destroy }`; `destroy` removes the layer.
 *
 * A click on a live frame never reaches the presenter, so it never changes the slide; the slide keys keep working while the frame
 * does not have focus. Tab enters a frame only after a click on it.
 */
export function mountLiveEmbeds({ host, svg, embeds, origin, document: doc = host?.ownerDocument }) {
  const none = { frames: [], destroy() {} };
  if (typeof embeds !== "function" || !host || !svg || !doc) return none;
  const win = doc.defaultView ?? globalThis, page = origin ?? win.location?.origin;
  const wanted = embedsOf(svg).filter(({ src }) => {
    if (isSameOriginPage(src, page)) return false;
    try { return embeds(src) === true; } catch { return false; }
  });
  if (!wanted.length) return none;
  const layer = doc.createElement("div");
  layer.setAttribute("data-opf-live-embeds", "");
  layer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden";
  const entries = wanted.map(({ path, src, title, area }) => {
    const box = doc.createElement("div");
    box.setAttribute("data-opf-live-embed", path);
    box.style.cssText = "position:absolute;pointer-events:auto;overflow:hidden;visibility:hidden";
    const frame = doc.createElement("iframe");
    frame.setAttribute("sandbox", LIVE_EMBED_SANDBOX);
    frame.setAttribute("referrerpolicy", "no-referrer");
    frame.setAttribute("loading", "lazy");
    frame.setAttribute("title", title);
    // Tab skips the frame (and everything in it) until the viewer has clicked it: a press inside a frame blurs this window with the frame as its active element.
    frame.setAttribute("tabindex", "-1");
    frame.style.cssText = "display:block;width:100%;height:100%;border:0;background:#fff";
    // The static form stays visible under the frame until the page has loaded; a page that never loads leaves the static form.
    frame.addEventListener("load", () => { box.style.visibility = "visible"; });
    box.append(frame);
    // Nothing a press on the frame's box does reaches the presenter's own zones.
    for (const type of ["click", "pointerdown", "pointerup", "touchstart", "touchend"]) box.addEventListener(type, (event) => event.stopPropagation());
    layer.append(box);
    frame.setAttribute("src", src);
    return { box, frame, area };
  });
  const place = () => {
    const base = layer.getBoundingClientRect();
    for (const { box, area } of entries) {
      const at = area.getBoundingClientRect();
      Object.assign(box.style, { left: `${at.left - base.left}px`, top: `${at.top - base.top}px`, width: `${at.width}px`, height: `${at.height}px` });
    }
  };
  const onBlur = () => { for (const { frame } of entries) if (doc.activeElement === frame) frame.setAttribute("tabindex", "0"); };
  host.append(layer);
  place();
  const observer = typeof win.ResizeObserver === "function" ? new win.ResizeObserver(place) : undefined;
  observer?.observe(host);
  win.addEventListener("resize", place);
  win.addEventListener("blur", onBlur);
  return {
    frames: entries.map(({ frame }) => frame),
    destroy() {
      observer?.disconnect();
      win.removeEventListener("resize", place);
      win.removeEventListener("blur", onBlur);
      layer.remove();
    },
  };
}
