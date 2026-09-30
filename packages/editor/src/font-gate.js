// Fonts before pixels. A document can need faces the browser font registry has not loaded yet: script faces for the
// languages it draws (Japanese, Arabic, ...) and vendored preview faces for the font families it resolves (Intos for
// Aptos, Open Sans, Barlow, ...). The renderer cannot draw such a document until those faces are loaded (a deck that
// sets Aptos and contains Japanese fails with "Intos Display cannot display U+65E5"), so nothing may render or measure
// a new document before `ensure` resolves. This module is the one gate every document-replacing path goes through.

/** Error code of a document whose required faces are still loading. */
export const FONTS_PENDING = "fonts-pending";
/** Error code of a document whose required faces could not be loaded. */
export const FONTS_UNAVAILABLE = "fonts-unavailable";

// A load that cannot finish (a face the registry never reports as loaded) stops after this many rounds.
const MAX_ROUNDS = 4;

/**
 * Wrap a browser font registry (`loadBrowserFontRegistry` from `@openpresentation/opf-render/fonts-browser`).
 * Registries without the lazy loaders (renderer 0.10.0 and older) gate nothing and keep the fonts they have.
 *
 * - `pending(document)` lists the faces (script packages and vendored files) the document needs that are not loaded.
 *   Synchronous; empty means the document can render now. Never throws: a document the renderer rejects for other
 *   reasons reports nothing pending and fails with its own validation message when rendered.
 * - `ensure(document, { signal })` loads vendored faces first (script fallback depends on them), then script faces,
 *   and repeats until nothing is pending. It makes a bounded number of rounds and rejects with a `fonts-unavailable`
 *   error (the registry's error is its `cause`); it never retries by itself, a later call is a new attempt.
 * - `run(document, handlers)` is `whenFontsReady` on this gate.
 */
export function createFontGate(registry) {
  const pending = (document) => {
    try {
      const scripts = registry?.pendingScripts?.(document) ?? [];
      const lazy = (registry?.pendingLazyFonts?.(document) ?? []).map((face) => face?.file ?? String(face));
      return [...lazy, ...scripts];
    } catch {
      return [];
    }
  };
  const gate = {
    pending,
    async ensure(document, options = {}) {
      const { signal } = options;
      try {
        for (let round = 0; round < MAX_ROUNDS && pending(document).length; round++) {
          signal?.throwIfAborted?.();
          await registry.ensureLazyFonts?.(document, { signal });
          await registry.ensureScripts?.(document, { signal });
        }
      } catch (cause) {
        if (signal?.aborted) throw cause;
        throw fontsUnavailable(cause?.message ?? String(cause), cause);
      }
      const left = pending(document);
      if (left.length) throw fontsUnavailable(`${left.join(", ")} did not finish loading.`);
    },
  };
  gate.run = (document, handlers) => whenFontsReady(gate, document, handlers);
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
 * Ensure fonts for a document, then run `ready`: the one "ensure fonts, then render" helper.
 * With nothing pending, `ready` runs synchronously, so documents in already-loaded fonts render at once. Otherwise
 * `loading(pending)` runs, the faces load and `ready` runs after them. `isCurrent()` is checked after the wait, so a
 * result for a superseded document is dropped. A load failure, and an exception thrown by `ready`, go to `failed(error)`
 * (they are rethrown when there is no `failed`). `gate` is any object with `pending(document)` and `ensure(document)`;
 * without one the document is treated as ready. Resolves once `ready` or `failed` has run.
 */
export function whenFontsReady(gate, document, { isCurrent = () => true, loading, ready, failed } = {}) {
  const finish = () => {
    try {
      ready?.();
    } catch (error) {
      if (!failed) throw error;
      failed(error);
    }
  };
  const left = gate?.pending?.(document) ?? [];
  if (!left.length) {
    finish();
    return Promise.resolve();
  }
  loading?.(left);
  return Promise.resolve(gate.ensure(document)).then(
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
