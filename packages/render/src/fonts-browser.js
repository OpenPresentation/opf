import { createFontRegistry, OPFFontError } from "./fonts.js";
import { analyzePresentationScripts, nextFallbackPackage, scriptFontPackages, scriptPackageEntries, scriptSelectionOf, uncoveredCjkCharacters } from "./script-font-pack.js";
export { autoScriptSelection, detectPresentationScripts, scriptFontEntries, scriptFontPackages } from "./script-font-pack.js";

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

/** Fetch only host-selected font files, then use those exact bytes for shaping and CSS. */
export async function loadBrowserFontRegistry(entries, options = {}) {
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
     * `missing-glyph` for them). Each package loads all or nothing. If some package fails, the others still load: the
     * call then rejects with an OPFFontError (the first failure's code) whose `details` hold `loaded` (packages this
     * call did load) and `failed` (`{package, code, message}` per failed package); nothing is lost and a later call
     * retries only the failures. `signal` aborts this call's fetches.
     */
    async ensureScripts(presentation, callOptions) {
      if (disposed) throw gone();
      const analysis = analyzePresentationScripts(presentation), selection = scriptSelectionOf(analysis);
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
    /** Synchronous: script-pack packages the presentation needs that are not loaded yet. Empty means `ensureScripts` would fetch nothing. */
    pendingScripts(presentation) {
      const analysis = analyzePresentationScripts(presentation);
      const primary = scriptFontPackages(scriptSelectionOf(analysis).scripts).map((item) => item.name).filter((name) => !scriptPackages.has(name));
      if (primary.length) return primary;
      const next = nextFallbackPackage(analysis, { covers, loaded: scriptPackages });
      return next ? [next.name] : [];
    },
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
