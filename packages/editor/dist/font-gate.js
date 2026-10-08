// Fonts before pixels. A document can need faces the browser has not loaded yet: script faces for the languages it draws
// (Japanese, Arabic, ...) and vendored preview faces for the font families it resolves (Intos for Aptos, Open Sans, Barlow,
// ...). The renderer cannot draw such a document until those faces are loaded (a deck that sets Aptos and contains Japanese
// fails with "Intos Display cannot display U+65E5"), so nothing may render or measure a new document before `ensure`
// resolves. The renderer's fonts handle (`loadFonts()` from `@openpresentation/opf-render/fonts-browser`) is the source of
// truth: its `pending(presentation, renderOptions)` and `ensure(presentation, options)` know what is missing and load it. The
// canvas and `exportDeck` take that handle as `fonts` and gate every document-replacing path through this module.

/** Error code of a document whose required faces are still loading. */
export const FONTS_PENDING = "fonts-pending";
/** Error code of a document whose required faces could not be loaded. */
export const FONTS_UNAVAILABLE = "fonts-unavailable";

const GATE = Symbol("opf-editor.fontGate");

/**
 * The gate over a fonts handle: the two calls the canvas and the export need, with the editor's error contract.
 *
 * - `pending(presentation, renderOptions?)` lists the faces (vendored files and script packages) the document needs that are
 *   not loaded. Synchronous; empty means the document can render now. Never throws: a document the renderer rejects for other
 *   reasons reports nothing pending and fails with its own validation message when rendered. A handle without `pending`
 *   (a plain `{ textMeasurement }`) gates nothing.
 * - `ensure(presentation, { signal, renderOptions })` loads what is missing through the handle's `ensure`, then checks that
 *   nothing is left. It rejects with a `fonts-unavailable` error (the handle's error is its `cause`), never retries by itself,
 *   and rethrows an abort as it is.
 *
 * `renderOptions` are the options the host renders with (`catalogs`, ...); they reach the handle, so a layout or font scheme
 * that only the host's catalogs know resolves the same way there. Hand a gate back unchanged.
 */
export function fontGate(fonts) {
  if (!fonts || typeof fonts !== "object") return undefined;
  if (fonts[GATE]) return fonts;
  const pending = (presentation, renderOptions) => {
    try { return fonts.pending?.(presentation, renderOptions) ?? []; } catch { return []; /* the renderer reports the document itself when it renders */ }
  };
  const gate = {
    [GATE]: true,
    pending,
    async ensure(presentation, { signal, renderOptions } = {}) {
      if (!pending(presentation, renderOptions).length) return;
      try {
        signal?.throwIfAborted?.();
        await fonts.ensure(presentation, { ...renderOptions, signal });
      } catch (cause) {
        if (signal?.aborted) throw cause;
        throw fontsUnavailable(cause?.message ?? String(cause), cause);
      }
      const left = pending(presentation, renderOptions);
      if (left.length) throw fontsUnavailable(`${left.join(", ")} did not finish loading.`);
    },
  };
  return gate;
}

function fontsUnavailable(message, cause) {
  const error = new Error(`Fonts for this document could not be loaded: ${message}`, cause ? { cause } : undefined);
  error.code = FONTS_UNAVAILABLE;
  return error;
}

/** The error a synchronous render raises when it is asked to draw a document whose faces are pending. */
export function fontsPendingError(pending) {
  const error = new Error("Loading fonts for this document…");
  error.code = FONTS_PENDING;
  error.pending = pending;
  return error;
}

/**
 * Ensure fonts for a presentation, then run `ready`: the one "ensure fonts, then render" helper.
 * With nothing pending, `ready` runs synchronously, so documents in already-loaded fonts render at once. Otherwise
 * `loading(pending)` runs, the faces load and `ready` runs after them. `isCurrent()` is checked after the wait, so a
 * result for a superseded document is dropped. A load failure, and an exception thrown by `ready`, go to `failed(error)`
 * (they are rethrown when there is no `failed`). `renderOptions` reach the fonts handle. `fonts` is the renderer's fonts
 * handle (anything with `pending(presentation, renderOptions)` and `ensure(presentation, options)`); without one the
 * document is treated as ready. Resolves once `ready` or `failed` has run.
 */
export function whenFontsReady(fonts, presentation, { isCurrent = () => true, loading, ready, failed, renderOptions } = {}) {
  const gate = fontGate(fonts);
  const finish = () => {
    try {
      ready?.();
    } catch (error) {
      if (!failed) throw error;
      failed(error);
    }
  };
  const left = gate?.pending(presentation, renderOptions) ?? [];
  if (!left.length) {
    finish();
    return Promise.resolve();
  }
  loading?.(left);
  return Promise.resolve(gate.ensure(presentation, { renderOptions })).then(
    () => {
      if (isCurrent()) finish();
    },
    (error) => {
      if (isCurrent()) {
        if (!failed) throw error;
        failed(error);
      }
    },
  );
}
