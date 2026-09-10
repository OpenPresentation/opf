import { createFontRegistry, OPFFontError } from "./fonts.js";
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
  const faces = await Promise.all(
    entries.map(async (entry) => {
      if (entry.data) return entry;
      if (!entry.url)
        throw new OPFFontError(
          "invalid-font-source",
          "Supply font bytes or a font-file URL.",
        );
      const response = await fetcher(entry.url, { signal: options.signal });
      if (!response.ok)
        throw new OPFFontError(
          "font-fetch-failed",
          `Could not load font (${response.status}).`,
          { url: entry.url },
        );
      return { ...entry, data: new Uint8Array(await response.arrayBuffer()) };
    }),
  );
  const registry = createFontRegistry(faces, options),
    loaded = [];
  // Normalize family names using the registry's parsed font metadata.
  const embedded = registry.embeddedFonts;
  try {
    await Promise.all(
      faces.map(async (entry, index) => {
        const descriptor = embedded[index];
        const face = new FontFaceRef(
          descriptor.family,
          entry.data.slice().buffer,
          {
            weight: String(descriptor.weight),
            style: descriptor.italic ? "italic" : "normal",
          },
        );
        await face.load();
        loaded.push(face);
      }),
    );
    for (const face of loaded) documentRef.fonts.add(face);
    await documentRef.fonts.ready;
  } catch (error) {
    for (const face of loaded) documentRef.fonts.delete(face);
    throw new OPFFontError("font-load-failed", error.message);
  }
  return Object.assign(registry, {
    dispose() {
      for (const face of loaded) documentRef.fonts.delete(face);
    },
  });
}
