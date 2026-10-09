import { createFontRegistry, OPFFontError } from "./font-registry.js";
import { lazyFontEntries, lazyFontList, normalizeExtraLazyFonts } from "./lazy-font-list.js";
import { lazyFacesNeeded } from "./lazy-fonts.js";
import { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
import { textOutlines } from "./text-paths.js";
import { createSubsetter, fontSubsets } from "./font-subset.js";
import { analyzePresentationScripts, nextFallbackPackage, scriptFontPackages, scriptPackageEntries, scriptSelectionOf, uncoveredCjkCharacters } from "./script-font-pack.js";
export { autoScriptSelection, detectPresentationScripts, scriptFontEntries, scriptFontPackages } from "./script-font-pack.js";
export { lazyFontEntries, lazyFontList, splitStartupFaces } from "./lazy-font-list.js";
export { lazyFacesNeeded, lazyFontsFor, presentationFaces, presentationFamilies } from "./lazy-fonts.js";

async function verifyDigest(entry, data, subtle) {
  if (entry.sha256 === undefined) return;
  if (!subtle?.digest)
    throw new OPFFontError("font-api-unavailable", "Verifying a font SHA-256 requires Web Crypto.");
  const digest = new Uint8Array(await subtle.digest("SHA-256", data));
  const actual = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (actual !== String(entry.sha256).toLowerCase())
    throw new OPFFontError(
      "font-integrity-mismatch",
      "The font file differs from its reviewed SHA-256; serve the pinned package.",
      { url: entry.url, expected: entry.sha256, actual },
    );
}

// The registry behind `loadFonts`: fetch only host-selected font files, then use those exact bytes for shaping and CSS.
async function loadRegistry(entries, options = {}) {
  // Validate the host's extra faces first: a bad list must not leave startup faces registered in the document with no registry to dispose.
  const extraLazy = normalizeExtraLazyFonts(options.extraLazyFonts);
  const documentRef = options.document ?? globalThis.document;
  const FontFaceRef = documentRef?.defaultView?.FontFace ?? globalThis.FontFace;
  if (!documentRef?.fonts || !FontFaceRef)
    throw new OPFFontError(
      "font-api-unavailable",
      "The browser Font Loading API is required.",
    );
  const fetcher = options.fetch ?? globalThis.fetch;
  const subtle = options.crypto?.subtle ?? globalThis.crypto?.subtle;
  const fetchFaces = (list, signal) => Promise.all(
    list.map(async (entry) => {
      let loaded = entry;
      if (!entry.data) {
        if (!entry.url)
          throw new OPFFontError(
            "invalid-font-source",
            "Supply font bytes or a font-file URL.",
          );
        const response = await fetcher(entry.url, { signal });
        if (!response.ok)
          throw new OPFFontError(
            "font-fetch-failed",
            `Could not load font (${response.status}).`,
            { url: entry.url },
          );
        loaded = { ...entry, data: new Uint8Array(await response.arrayBuffer()) };
      }
      // Script-pack entries carry the reviewed hash (FF-19); verify before use.
      await verifyDigest(entry, loaded.data, subtle);
      return loaded;
    }),
  );
  const faces = await fetchFaces(entries, options.signal);
  const registry = createFontRegistry(faces, options),
    loaded = [];
  // Normalize family names using the registry's parsed font metadata.
  const described = registry.describeFaces();
  // Registers browser FontFaces for faces already parsed by the registry; on failure nothing stays registered.
  const registerBrowserFaces = async (list, descriptors) => {
    const added = [];
    try {
      await Promise.all(
        list.map(async (entry, index) => {
          const descriptor = descriptors[index];
          const face = new FontFaceRef(
            descriptor.family,
            entry.data.slice().buffer,
            {
              weight: String(descriptor.weight),
              style: descriptor.italic ? "italic" : "normal",
            },
          );
          await face.load();
          added.push(face);
        }),
      );
      for (const face of added) documentRef.fonts.add(face);
      await documentRef.fonts.ready;
    } catch (error) {
      for (const face of added) documentRef.fonts.delete(face);
      throw new OPFFontError("font-load-failed", error.message);
    }
    loaded.push(...added);
  };
  await registerBrowserFaces(faces, described);

  // Script faces (FF-19) are loaded lazily, once a document needs them, and only for the scripts it uses.
  const scriptPackages = new Set();
  let queue = Promise.resolve(), disposed = false;
  // FF-41: the `renderSvg` options a document resolves with (`catalogs`, ...). `options.renderOptions` are the defaults; a call's own
  // options (everything but `signal`) are added over them, so a host that passes its canvas options gets the same resolution here.
  const renderOptionsFor = (callOptions) => { const { signal: _signal, ...own } = callOptions ?? {}; return { ...options.renderOptions, ...own }; };
  const gone = () => new OPFFontError("font-registry-disposed", "The font registry was disposed.");
  const baseUrl = () => {
    if (typeof options.scriptBaseUrl !== "string" || !options.scriptBaseUrl)
      throw new OPFFontError("invalid-font-source", "Loading script fonts requires scriptBaseUrl, where the host serves the installed @expo-google-fonts packages.");
    return options.scriptBaseUrl;
  };
  // Loads whole packages. Order matters: fetch and verify, load every FontFace (not yet visible to the document),
  // then register them with the document and add them to the registry atomically. Nothing is half loaded: on any
  // failure (fetch, hash, FontFace.load, registry) the document and registry are unchanged and the packages stay
  // pending, so the next call retries. `signal` belongs to this call only.
  const loadPackageList = (packages, { signal } = {}) => {
    const result = queue.then(async () => {
      if (disposed) throw gone();
      signal?.throwIfAborted?.();
      const pending = packages.filter((item) => !scriptPackages.has(item.name));
      if (!pending.length) return [];
      const fetched = await fetchFaces(scriptPackageEntries(pending, { baseUrl: baseUrl() }), signal);
      let browserFaces;
      try {
        browserFaces = await Promise.all(fetched.map(async (entry) => {
          const face = new FontFaceRef(entry.family, entry.data.slice().buffer, { weight: String(entry.weight ?? 400), style: entry.italic ? "italic" : "normal" });
          await face.load();
          return face;
        }));
      } catch (error) { throw new OPFFontError("font-load-failed", error.message); }
      if (disposed) throw gone();
      const shown = [];
      try {
        for (const face of browserFaces) { documentRef.fonts.add(face); shown.push(face); }
        registry.addFaces(fetched);
      } catch (error) {
        for (const face of shown) documentRef.fonts.delete(face);
        throw error;
      }
      loaded.push(...browserFaces);
      for (const item of pending) scriptPackages.add(item.name);
      try { await documentRef.fonts.ready; } catch { /* the faces are loaded and registered */ }
      return pending.map((item) => item.name);
    });
    queue = result.catch(() => {});
    return result;
  };
  const covers = (character) => registry.scriptFacesCover(character);
  Object.assign(registry, {
    /** Load the script faces for explicit ISO 15924 codes (or 'all'). Resolves with the newly loaded package names. `signal` aborts this call's fetches. */
    loadScripts: (scripts, callOptions) => loadPackageList(scriptFontPackages(scripts), callOptions),
    /**
     * Load the script faces the presentation's text needs, once each (FF-19), then the (at most one) CJK face a glyph
     * fallback needs for characters the loaded faces lack. Cheap when nothing new is needed; call it after edits and
     * render again afterwards. Resolves with the detected scripts, the packages loaded by this call, the scripts no
     * pinned font serves and `uncovered`, drawn CJK characters no loaded face covers (the renderer reports
     * `missing-glyph` for them). Besides `signal`, the call takes the `renderSvg` options the document resolves with
     * (`catalogs`, ...) over the loader's `renderOptions`. Each package loads all or nothing. If some package fails, the others still load: the
     * call then rejects with an OPFFontError (the first failure's code) whose `details` hold `loaded` (packages this
     * call did load) and `failed` (`{package, code, message}` per failed package); nothing is lost and a later call
     * retries only the failures. `signal` aborts this call's fetches.
     */
    async ensureScripts(presentation, callOptions) {
      if (disposed) throw gone();
      const analysis = analyzePresentationScripts(presentation, undefined, renderOptionsFor(callOptions)), selection = scriptSelectionOf(analysis);
      const loadedNow = [], failed = [];
      const attempt = async (item) => {
        try { loadedNow.push(...(await loadPackageList([item], callOptions))); }
        catch (error) { failed.push({ package: item.name, code: error?.code ?? "font-load-failed", message: error?.message ?? String(error), error }); }
      };
      for (const item of scriptFontPackages(selection.scripts)) await attempt(item);
      // Fallback faces only follow a clean primary load: a failed package would otherwise be judged uncovered.
      if (!failed.length) for (let next = nextFallbackPackage(analysis, { covers, loaded: scriptPackages }); next && !failed.length; next = nextFallbackPackage(analysis, { covers, loaded: scriptPackages })) await attempt(next);
      // An aborted call rejects with the signal's reason; packages loaded before the abort stay loaded.
      if (callOptions?.signal?.aborted) throw callOptions.signal.reason ?? failed[0]?.error;
      if (failed.length) {
        const first = failed[0];
        throw new OPFFontError(first.code, first.message, { loaded: loadedNow, failed: failed.map(({ package: name, code, message }) => ({ package: name, code, message })), cause: first.error });
      }
      return { ...selection, loaded: loadedNow, uncovered: uncoveredCjkCharacters(analysis, { covers }) };
    },
    /** Synchronous: script-pack packages the presentation needs that are not loaded yet. Empty means `ensureScripts` would fetch nothing. `renderOptions` are the `renderSvg` options the document resolves with (`catalogs`, ...). */
    pendingScripts(presentation, renderOptions) {
      const analysis = analyzePresentationScripts(presentation, undefined, renderOptionsFor(renderOptions));
      const primary = scriptFontPackages(scriptSelectionOf(analysis).scripts).map((item) => item.name).filter((name) => !scriptPackages.has(name));
      if (primary.length) return primary;
      const next = nextFallbackPackage(analysis, { covers, loaded: scriptPackages });
      return next ? [next.name] : [];
    },
  });
  // FF-31: vendored faces (the open families and Intos) load on demand, once a document needs them. They share the
  // script loader's queue and disposed state, and the same all-or-nothing order: fetch and verify, load every FontFace,
  // then add them to the document and the registry together.
  // FF-41: the host's extra lazy faces (`options.extraLazyFonts`, validated above) load like the vendored ones, from their own urls,
  // hash-verified, in the same `lazyFacesNeeded` pass, so a document that draws both fetches both in one call.
  const lazy = Object.freeze([...lazyFontList(), ...extraLazy]), lazyLoaded = new Set();
  const policy = options.substitutionPolicy ?? "none";
  const aliasTargets = new Map(Object.entries(options.aliases ?? {}).map(([from, to]) => [from.toLowerCase(), to]));
  // Face level (FF-41): the faces the document draws, resolved as the registry resolves them with every vendored face loaded.
  // A document that does not resolve throws what `renderSvg` throws for it.
  const neededLazy = (presentation, callOptions) => lazyFacesNeeded(presentation, renderOptionsFor(callOptions), { lazy, held: registry.describeFaces(), loaded: lazyLoaded, policy, aliases: aliasTargets, fallbackFamily: options.fallbackFamily });
  const lazyBaseUrl = () => {
    if (typeof options.lazyFontsBaseUrl !== "string" || !options.lazyFontsBaseUrl)
      throw new OPFFontError("invalid-font-source", "Loading vendored fonts requires lazyFontsBaseUrl, where the host serves the package's fonts directory.");
    return options.lazyFontsBaseUrl;
  };
  Object.assign(registry, {
    /** Every face a host can load on demand: the vendored ones (family, style, package-relative file, pinned sha256) and the host's `extraLazyFonts` (`package: "host"`, `file` and `url` the url it serves them from). */
    lazyFonts: lazy,
    /**
     * Load the vendored faces the presentation draws (FF-41: only the faces, by family, weight and style, that the renderer
     * draws; a bold or italic run added by an edit adds just that face) as the registry resolves them under its substitution
     * policy (nothing is downloaded for a family the policy would not resolve), once each. All or nothing: on any failure
     * (fetch, hash, FontFace.load, registry) the document and registry are unchanged and the call can be retried. Cheap when
     * nothing is needed. Call it before measuring a document, and again after edits that change fonts. Resolves with the faces
     * added. Besides `signal`, the call takes the `renderSvg` options the document resolves with (`catalogs`, ...) over the
     * loader's `renderOptions`; a document that does not resolve rejects with what `renderSvg` throws for it.
     */
    ensureLazyFonts(presentation, callOptions = {}) {
      const result = queue.then(async () => {
        if (disposed) throw gone();
        callOptions.signal?.throwIfAborted?.();
        const pending = neededLazy(presentation, callOptions);
        if (!pending.length) return [];
        // The vendored faces need lazyFontsBaseUrl; the host's own faces carry their url. Both are embed "used": not in registry.embeddedFonts.
        const entries = lazyFontEntries({ baseUrl: pending.some((face) => face.package !== "host") ? lazyBaseUrl() : undefined }, pending);
        const fetched = (await fetchFaces(entries, callOptions.signal)).map((entry) => ({ ...entry, embed: "used" }));
        let browserFaces;
        try {
          browserFaces = await Promise.all(fetched.map(async (entry) => {
            const face = new FontFaceRef(entry.family, entry.data.slice().buffer, { weight: String(entry.weight), style: entry.italic ? "italic" : "normal" });
            await face.load();
            return face;
          }));
        } catch (error) { throw new OPFFontError("font-load-failed", error.message); }
        if (disposed) throw gone();
        const shown = [];
        try {
          for (const face of browserFaces) { documentRef.fonts.add(face); shown.push(face); }
          registry.addFaces(fetched);
        } catch (error) {
          for (const face of shown) documentRef.fonts.delete(face);
          throw error;
        }
        loaded.push(...browserFaces);
        for (const item of pending) lazyLoaded.add(item.file);
        try { await documentRef.fonts.ready; } catch { /* the faces are loaded and registered */ }
        return pending;
      });
      queue = result.catch(() => {});
      return result;
    },
    /** Synchronous: the vendored faces the presentation draws under the registry's policy that are not loaded yet. Empty means `ensureLazyFonts` fetches nothing. `renderOptions` are the `renderSvg` options the document resolves with (`catalogs`, ...). */
    pendingLazyFonts: (presentation, renderOptions) => neededLazy(presentation, renderOptions),
  });
  /** Names of the script-pack packages loaded so far. */
  Object.defineProperty(registry, "loadedScriptPackages", { get: () => [...scriptPackages], enumerable: true });
  try {
    if (options.scripts === "auto") {
      if (options.presentation === null || typeof options.presentation !== "object")
        throw new OPFFontError("invalid-font-scripts", "scripts: 'auto' needs the presentation whose text decides the scripts.", { scripts: options.scripts });
      await registry.ensureScripts(options.presentation, { signal: options.signal });
    } else if (options.scripts !== undefined && !(Array.isArray(options.scripts) && !options.scripts.length)) {
      await registry.loadScripts(options.scripts, { signal: options.signal });
    }
  } catch (error) {
    for (const face of loaded) documentRef.fonts.delete(face);
    throw error;
  }
  return Object.assign(registry, {
    dispose() {
      disposed = true;
      for (const face of loaded) documentRef.fonts.delete(face);
    },
  });
}

const MAX_ENSURE_ROUNDS = 4;

/**
 * The fonts handle for a browser: the faces you list (`faces`, each `{ url | data, family, weight, italic, sha256 }`, fetched and
 * hash-verified, then registered with the document) and, on demand, the script and vendored faces a deck draws. Pass it as `{ fonts }` to
 * `renderSvg`, `renderSlideSvg`, `<opf-deck>` and the player, core `paginate` and `validate`, and the editor. `scripts`, `scriptBaseUrl`,
 * `lazyFontsBaseUrl`, `extraLazyFonts`, `renderOptions`, `signal`, `document`, `fetch`, `crypto` and the registry options
 * (`substitutionPolicy`, `aliases`, `fallbackFamily`, `themeFonts`, `strictGlyphs`) are as for the registry (see `fonts-browser.d.ts`).
 * `dispose()` removes every face from the document.
 */
// RR-65: the host's copy of harfbuzzjs's `harfbuzz-subset.wasm` (a URL it serves, the bytes or a compiled module), instantiated
// asynchronously here (a browser may refuse to compile a large module synchronously on the main thread).
async function browserSubsetter(source, fetchImpl, signal) {
  if (source instanceof WebAssembly.Module) return createSubsetter(await WebAssembly.instantiate(source, {}));
  if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) return createSubsetter((await WebAssembly.instantiate(source, {})).instance);
  if (typeof source !== "string" && !(source instanceof URL)) throw new OPFFontError("invalid-font-source", "subsetWasm must be the URL of harfbuzz-subset.wasm, its bytes or a compiled WebAssembly.Module.");
  const response = await (fetchImpl ?? globalThis.fetch)(String(source), { signal });
  if (!response.ok) throw new OPFFontError("font-resource-unavailable", `harfbuzz-subset.wasm could not be fetched (${response.status}).`, { url: String(source) });
  return createSubsetter((await WebAssembly.instantiate(await response.arrayBuffer(), {})).instance);
}

export async function loadFonts({ faces = [], subsetWasm, ...options } = {}) {
  const [registry, subsetter] = await Promise.all([loadRegistry(faces, options), subsetWasm === undefined ? null : browserSubsetter(subsetWasm, options.fetch, options.signal)]);
  // The embedded list is base64 of every eager face: compute it once, and again only when faces were added.
  let embedded, stale = true;
  const addFaces = registry.addFaces;
  registry.addFaces = (added) => { const result = addFaces(added); stale = true; return result; };
  const pending = (presentation, renderOptions) => [
    ...registry.pendingLazyFonts(presentation, renderOptions).map((face) => face.file),
    ...registry.pendingScripts(presentation, renderOptions),
  ];
  return {
    textMeasurement: registry.textMeasurement,
    get embeddedFonts() { if (stale) { embedded = registry.embeddedFonts; stale = false; } return embedded; },
    registry,
    // RR-64: the outline engine `renderSvg(deck, { fonts, textAsPaths: true })` draws text with, over this registry's faces.
    outlines: textOutlines({ registry }),
    // RR-65: with `subsetWasm`, the subset engine that cuts each face an SVG embeds to the characters the slide draws.
    ...(subsetter ? { subsets: fontSubsets(registry, subsetter) } : {}),
    manifest: BUNDLED_FONT_MANIFEST,
    get substitutions() { return registry.substitutions; },
    /**
     * Load the vendored and script faces the presentation draws, each hash-verified, all or nothing, and repeat while loading
     * changes what is needed (a script face can need a vendored one). Cheap when nothing is needed. Besides `signal`, the call
     * takes the `renderSvg` options the document resolves with (`catalogs`, ...) over the loader's `renderOptions`. A document that
     * does not resolve rejects with what `renderSvg` throws for it. After `dispose()` it rejects with `font-registry-disposed`.
     */
    async ensure(presentation, callOptions = {}) {
      const lazy = [], scripts = [];
      let uncovered = [];
      for (let round = 0; round < MAX_ENSURE_ROUNDS; round++) {
        const needLazy = registry.pendingLazyFonts(presentation, callOptions).length > 0, needScripts = registry.pendingScripts(presentation, callOptions).length > 0;
        if (!needLazy && !needScripts) break;
        callOptions.signal?.throwIfAborted?.();
        if (needLazy) lazy.push(...(await registry.ensureLazyFonts(presentation, callOptions)));
        if (needScripts) { const result = await registry.ensureScripts(presentation, callOptions); scripts.push(...result.loaded); uncovered = result.uncovered; }
      }
      return { scripts, lazy, uncovered };
    },
    /** Synchronous: the files and script packages `ensure` would fetch. Empty means a render can start now. Throws what `renderSvg` throws for a document that does not resolve. */
    pending,
    dispose: () => registry.dispose(),
  };
}
