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
 * - `pending(document, renderOptions?)` lists the faces (script packages and vendored files) the document needs that are
 *   not loaded. Synchronous; empty means the document can render now. Never throws: a document the renderer rejects for
 *   other reasons reports nothing pending and fails with its own validation message when rendered. Script faces and
 *   vendored faces are asked separately, so one that cannot be answered does not hide the other.
 * - `ensure(document, { signal, renderOptions })` loads vendored faces first (script fallback depends on them), then script faces,
 *   and repeats until nothing is pending. It makes a bounded number of rounds and rejects with a `fonts-unavailable`
 *   error (the registry's error is its `cause`); it never retries by itself, a later call is a new attempt.
 * - `run(document, handlers)` is `whenFontsReady` on this gate.
 * - `renderOptions` (per call, or `createFontGate(registry, { renderOptions })` as an object or a getter) are the options the
 *   host renders with (`catalogs`, ...). They are passed to the registry, so a layout or font scheme that only the host's
 *   catalogs know resolves the same way there (renderer 0.11.5 and newer; older renderers ignore them).
 */
export function createFontGate(registry, gateOptions = {}) {
  // FF-41: the render options (`catalogs` above all) the document resolves with. The registry resolves a document the way the
  // host renders it only when it gets the same options, so every call passes them: the gate's defaults (an object, or a
  // function called each time, for options that change like `canvas.setRenderOptions`) under the call's own.
  const defaults = () => (typeof gateOptions.renderOptions === "function" ? gateOptions.renderOptions() : gateOptions.renderOptions) ?? {};
  const optionsFor = (renderOptions) => ({ ...defaults(), ...renderOptions });
  // Each source answers on its own: a document one loader cannot resolve (an unresolvable layout throws in the renderer's
  // lazy font loader) must not hide what the other still reports pending.
  const sources = (document, renderOptions) => {
    const options = optionsFor(renderOptions);
    let scripts = [], lazy = [];
    try { scripts = registry?.pendingScripts?.(document, options) ?? []; } catch { /* the renderer reports the document itself when it renders */ }
    try { lazy = (registry?.pendingLazyFonts?.(document, options) ?? []).map((face) => face?.file ?? String(face)); } catch { /* likewise */ }
    return { lazy, scripts };
  };
  const pending = (document, renderOptions) => {
    const { lazy, scripts } = sources(document, renderOptions);
    return [...lazy, ...scripts];
  };
  const gate = {
    pending,
    async ensure(document, options = {}) {
      const { signal, renderOptions } = options;
      const call = { ...optionsFor(renderOptions), signal };
      try {
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const { lazy, scripts } = sources(document, renderOptions);
          if (!lazy.length && !scripts.length) break;
          signal?.throwIfAborted?.();
          // Vendored faces first (script fallback depends on them). A source with nothing pending is not asked to load.
          if (lazy.length) await registry.ensureLazyFonts?.(document, call);
          if (scripts.length) await registry.ensureScripts?.(document, call);
        }
      } catch (cause) {
        if (signal?.aborted) throw cause;
        throw fontsUnavailable(cause?.message ?? String(cause), cause);
      }
      const left = pending(document, renderOptions);
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
 * (they are rethrown when there is no `failed`). `renderOptions` are passed to the gate. `gate` is any object with
 * `pending(document, renderOptions)` and `ensure(document, { renderOptions })`;
 * without one the document is treated as ready. Resolves once `ready` or `failed` has run.
 */
export function whenFontsReady(gate, document, { isCurrent = () => true, loading, ready, failed, renderOptions } = {}) {
  const finish = () => {
    try {
      ready?.();
    } catch (error) {
      if (!failed) throw error;
      failed(error);
    }
  };
  const left = gate?.pending?.(document, renderOptions) ?? [];
  if (!left.length) {
    finish();
    return Promise.resolve();
  }
  loading?.(left);
  return Promise.resolve(gate.ensure(document, { renderOptions })).then(
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
