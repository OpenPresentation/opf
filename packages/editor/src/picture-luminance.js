// LH-145: the pictures behind the slide text, measured once, for the preview and the exports. Core sizes the automatic scrim of a picture
// background (LH-02) for the grays under the text when the host passes `pictureLuminance`; this reads the pixels in the page
// (`measurePictures` of the renderer's browser entry: the picture decoded once on a canvas, cached per resolved source) and hands
// the preview, `convert` and the PPTX export the same sampler, so a dark photo under white text gets no scrim in any of them.
import { measurePictures } from "@openpresentation/opf-render/svg";

const hostFetch = () => (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined);

/** The options `measurePictures` takes from a render-options object: the host's resolver, catalogs and a fetch for the addresses it returns. */
export function measureOptionsFor(renderOptions = {}, extra = {}) {
  const fetch = extra.fetch ?? hostFetch();
  return {
    ...(renderOptions.imageResolver ? { imageResolver: renderOptions.imageResolver } : {}),
    ...(renderOptions.catalogs ? { catalogs: renderOptions.catalogs } : {}),
    ...(fetch ? { fetch } : {}),
    ...(renderOptions.onDiagnostic ? { onDiagnostic: renderOptions.onDiagnostic } : {}),
    ...extra,
  };
}

/**
 * Measure the pictures of `deck` for an export: the host's own `renderOptions.pictureLuminance` when it set one, else a fresh measurement
 * (or the one `cache` holds). Resolves the sampler to pass as `pictureLuminance`, or undefined when the deck has no measurable picture.
 * Never rejects: a picture that cannot be read keeps its worst-case scrim.
 */
export async function measureDeck(deck, renderOptions = {}, extra = {}) {
  if (typeof renderOptions.pictureLuminance === "function") return renderOptions.pictureLuminance;
  try {
    const sampler = await (extra.measure ?? measurePictures)(deck, measureOptionsFor(renderOptions, extra));
    return sampler.measured ? sampler : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The editing canvas's picture meter. `sampler` is the stable function the canvas draws with (it answers from the latest measurement);
 * `update(deck, renderOptions)` measures the deck's picture backgrounds and calls `onChange` when the answer for any of them changed, so
 * the canvas draws again with the right scrim. Calls coalesce: one measurement runs at a time, and the last deck asked for is measured last.
 */
export function createPictureMeter({ onChange, measure = measurePictures, fetch } = {}) {
  const cache = new Map();
  let current = () => undefined;
  let running = false, queued, disposed = false;
  const sampler = (src) => current(src);
  async function run(deck, renderOptions) {
    const next = await measure(deck, measureOptionsFor(renderOptions, { cache, ...(fetch ? { fetch } : {}) })).catch(() => undefined);
    if (disposed || !next) return;
    const before = current;
    const changed = next.sources.some((src) => before(src) !== next(src)) || next.measured !== (before.measured ?? 0);
    current = next;
    if (changed) onChange?.();
  }
  return {
    sampler,
    async update(deck, renderOptions = {}) {
      // A host that measures for itself (renderOptions.pictureLuminance) is not measured over.
      if (disposed || typeof renderOptions.pictureLuminance === "function") return;
      queued = { deck, renderOptions };
      if (running) return;
      running = true;
      try {
        while (queued && !disposed) {
          const job = queued;
          queued = undefined;
          await run(job.deck, job.renderOptions);
        }
      } finally {
        running = false;
      }
    },
    dispose() { disposed = true; queued = undefined; cache.clear(); },
  };
}
