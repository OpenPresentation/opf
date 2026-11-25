// FR-03: a run or shape link `slide:<id>` leaves as PowerPoint's own slide jump (a:hlinkClick action="ppaction://hlinksldjump" with a
// relationship to the target slide part), and a web, mail or phone link as an external hyperlink. The jump needs the slide's number in the
// package, which is its position in the exported deck (every slide is written, a hidden one too). A link to an id no slide has leaves the
// text without a link (validation reports it as opf/slide-link-unknown).

const WEB_LINK = /^(https?:|mailto:|tel:)/i;
const SLIDE_LINK = /^slide:(.+)$/s;

/** The exported slide number (1-based) of each slide id, the first slide that carries it. */
export function slideLinkTargets(presentation) {
  const targets = new Map();
  (presentation?.slides ?? []).forEach((slide, index) => {
    if (typeof slide?.id === 'string' && slide.id && !targets.has(slide.id)) targets.set(slide.id, index + 1);
  });
  return targets;
}

/** The slide number a `slide:<id>` link jumps to, or undefined (not a slide link, or a slide the deck does not have). */
export function slideLinkNumber(link, context) {
  const id = typeof link === 'string' ? SLIDE_LINK.exec(link)?.[1] : undefined;
  return id === undefined ? undefined : context?.slideLinkTargets?.get(id);
}

/** The PptxGenJS hyperlink option for a link, or undefined when the text is not linked: `{url}` outside the deck, `{slide}` inside it. */
export function exportHyperlink(link, context) {
  if (typeof link !== 'string') return undefined;
  if (WEB_LINK.test(link)) return {url: link};
  const slide = slideLinkNumber(link, context);
  return slide === undefined ? undefined : {slide};
}

/**
 * Import: a slide jump (a relationship to a slide part with the hlinksldjump action) is `slide:<id>` again. The id is the slide's stored one
 * (the OPF_SLIDE_V1 record the export wrote), else `slide-<number>`, given only to a slide a link names. `attach` puts a `slideLink` on each
 * relationship to a slide part (reading it marks the slide as linked to); `assignIds` then gives the linked slides without an id theirs.
 */
export function slideLinkResolver({slidePaths, storedIds}) {
  const ids = new Map(), taken = new Set(), used = new Set();
  slidePaths.forEach((path, index) => {
    const stored = storedIds?.[index];
    if (typeof stored === 'string' && stored && !taken.has(stored)) { taken.add(stored); ids.set(path, {id: stored, stored: true}); }
  });
  const idOf = path => {
    let known = ids.get(path);
    if (!known) {
      const number = slidePaths.indexOf(path) + 1;
      let id = `slide-${number}`;
      for (let n = 2; taken.has(id); n += 1) id = `slide-${number}-${n}`;
      taken.add(id);
      known = {id, stored: false};
      ids.set(path, known);
    }
    return known.id;
  };
  return {
    attach(relationships) {
      for (const relationship of relationships.values()) {
        if (!relationship.type?.endsWith('/slide') || relationship.targetMode === 'External' || !slidePaths.includes(relationship.path)) continue;
        Object.defineProperty(relationship, 'slideLink', {enumerable: false, get() { used.add(relationship.path); return `slide:${idOf(relationship.path)}`; }});
      }
      return relationships;
    },
    assignIds(slides) {
      for (const path of used) {
        const slide = slides[slidePaths.indexOf(path)];
        if (slide && slide.id === undefined) slide.id = idOf(path);
      }
    },
  };
}
