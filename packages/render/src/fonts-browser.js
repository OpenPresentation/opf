import { createFontRegistry, OPFFontError } from "./fonts.js";
export { scriptFontEntries, scriptFontPackages } from "./script-font-pack.js";

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
  const faces = await Promise.all(
    entries.map(async (entry) => {
      let loaded = entry;
      if (!entry.data) {
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
        loaded = { ...entry, data: new Uint8Array(await response.arrayBuffer()) };
      }
      // Script-pack entries carry the reviewed hash (FF-19); verify before use.
      await verifyDigest(entry, loaded.data, subtle);
      return loaded;
    }),
  );
  const registry = createFontRegistry(faces, options),
    loaded = [];
  // Normalize family names using the registry's parsed font metadata.
  const described = registry.describeFaces();
  try {
    await Promise.all(
      faces.map(async (entry, index) => {
        const descriptor = described[index];
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
