// FF-41: the page starts with a small set of faces and loads the rest of the renderer's eager faces (Roboto's other weights and
// styles, Roboto Mono, the Office substitutes Arimo, Tinos, Carlito, ...) on demand, face by face, only when a document draws
// them. `base-fonts.json` lists them ({family, weight, italic, license, file, sha256}; the files sit beside the page), and this
// wrapper adds them to a font gate: it asks the renderer which faces the document draws (`lazyFacesNeeded`, over the registry's
// own faces, the vendored faces and these) and fetches, hash-verifies and registers the base faces among them before the
// registry's own loaders (vendored and script faces) run. Older renderers (before 0.11.5) have no `lazyFacesNeeded`: then the
// page must carry every face in fonts.json, and the wrapper changes nothing.
import { FONTS_UNAVAILABLE, whenFontsReady } from '../src/canvas.js';

async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {{registry: object, gate: {pending: Function, ensure: Function}, faces: {family: string, weight: number, italic: boolean, license?: string, file: string, sha256: string}[],
 *   renderFonts: {lazyFacesNeeded?: Function}, baseUrl?: string, fetch?: typeof fetch, document?: Document, fallbackFamily?: string}} options
 */
export function withBaseFaces({ registry, gate, faces, renderFonts, baseUrl = globalThis.document?.baseURI, fetch: fetcher = globalThis.fetch, document: documentRef = globalThis.document, fallbackFamily = 'Roboto' }) {
  if (!faces?.length || typeof renderFonts?.lazyFacesNeeded !== 'function') return gate;
  const list = faces.map(face => ({ ...face, package: 'base' }));
  const loaded = new Set();
  const pendingBase = (deck, renderOptions) => {
    // A document the renderer cannot resolve needs no base face; rendering it reports why.
    try {
      return renderFonts.lazyFacesNeeded(deck, renderOptions, { lazy: [...(registry.lazyFonts ?? []), ...list], held: registry.describeFaces(), loaded, policy: 'visual', fallbackFamily }).filter(face => face.package === 'base');
    } catch { return []; }
  };
  let queue = Promise.resolve();
  const loadBase = (deck, renderOptions, signal) => {
    const run = queue.then(async () => {
      const pending = pendingBase(deck, renderOptions);
      if (!pending.length) return;
      const fetched = await Promise.all(pending.map(async face => {
        const response = await fetcher(new URL(face.file, baseUrl).href, { signal });
        if (!response.ok) throw new Error(`${face.family} could not be loaded (${response.status}).`);
        const data = new Uint8Array(await response.arrayBuffer());
        if (await digest(data) !== face.sha256) throw new Error(`${face.family} differs from its reviewed SHA-256; serve the pinned file.`);
        return { face, data };
      }));
      const browserFaces = await Promise.all(fetched.map(async ({ face, data }) => {
        const font = new documentRef.defaultView.FontFace(face.family, data.slice().buffer, { weight: String(face.weight), style: face.italic ? 'italic' : 'normal' });
        await font.load();
        return font;
      }));
      registry.addFaces(fetched.map(({ face, data }) => ({ data, family: face.family, weight: face.weight, italic: face.italic, license: face.license })));
      for (const font of browserFaces) documentRef.fonts.add(font);
      for (const { face } of fetched) loaded.add(face.file);
      await documentRef.fonts.ready?.catch?.(() => undefined);
    });
    queue = run.catch(() => undefined);
    return run;
  };
  const wrapped = {
    // The base faces resolve first: the registry's own loaders judge a family by what is already loaded.
    pending(deck, renderOptions) {
      const own = pendingBase(deck, renderOptions);
      return own.length ? own.map(face => face.file) : gate.pending(deck, renderOptions);
    },
    async ensure(deck, options = {}) {
      try {
        await loadBase(deck, options.renderOptions, options.signal);
      } catch (cause) {
        if (options.signal?.aborted) throw cause;
        const error = new Error(`Fonts for this document could not be loaded: ${cause?.message ?? cause}`, { cause });
        error.code = FONTS_UNAVAILABLE;
        throw error;
      }
      await gate.ensure(deck, options);
    },
  };
  wrapped.run = (deck, handlers) => whenFontsReady(wrapped, deck, handlers);
  return wrapped;
}
