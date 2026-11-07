// The fonts of the deck view. The view runs in the host's sandboxed iframe, which may fetch nothing: Roboto Regular (the
// renderer's fallback face) is inside the HTML, and every other face the deck draws is asked of the server through the host, with
// the app-only tool read_font_file. The renderer still verifies each file against its pinned SHA-256 before it registers it, and it
// registers fonts as bytes (FontFace from an ArrayBuffer), which needs no font URL and so no font-src in the sandbox's CSP.
import type { BrowserFontInput } from "@openpresentation/opf-render/fonts-browser";

/** A face the build put in the HTML (base64), or one the view can ask the server for (`file`, verified with `sha256`). */
export interface DeckFontManifest {
	startup: { family: string; weight: number; italic: boolean; license: string; data: string }[];
	extra: { family: string; weight: number; italic: boolean; license: number; sha256: string; file: string }[];
	/** License texts, shared by index (most faces carry one of a few). */
	licenses: string[];
}

declare const OPF_DECK_FONTS: DeckFontManifest;

/**
 * Where the renderer believes the font files are. Nothing is ever fetched from it: the fetch the renderer is given turns a URL under
 * this base into a read_font_file call. `.invalid` is reserved (RFC 2606), so the name can never reach a real host.
 */
export const FONT_BASE = "https://fonts.opf.invalid/";

const bytesOf = (base64: string): Uint8Array => Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));

/** The faces to start with: what `loadFonts({ faces })` takes. */
export function startupFaces(): BrowserFontInput[] {
	return OPF_DECK_FONTS.startup.map((face) => ({ family: face.family, weight: face.weight, italic: face.italic, license: face.license, data: bytesOf(face.data) }));
}

/** The other eager faces of the Office pack, as the renderer's extra lazy faces: loaded the first time a deck draws one. */
export function extraFaces(): { family: string; weight: number; italic: boolean; license: string; sha256: string; url: string }[] {
	return OPF_DECK_FONTS.extra.map((face) => ({ family: face.family, weight: face.weight, italic: face.italic, license: OPF_DECK_FONTS.licenses[face.license] ?? "", sha256: face.sha256, url: FONT_BASE + face.file }));
}

/** Reads one font file (a path under FONT_BASE) from the server, or rejects. */
export type ReadFontFile = (file: string) => Promise<Uint8Array>;

/**
 * The `fetch` the renderer's font loader uses. A URL under FONT_BASE becomes a read of that file; anything else is refused at once,
 * since the sandbox would block it anyway. A failed read answers 503, which the loader reports as a face it could not load; the
 * renderer then draws with its fallback face and names the substitution.
 */
export function fontFetch(read: ReadFontFile): typeof fetch {
	return (async (input: RequestInfo | URL) => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		if (!url.startsWith(FONT_BASE)) return new Response("The deck view has no network access.", { status: 403 });
		const file = decodeURIComponent(url.slice(FONT_BASE.length));
		try {
			const bytes = await read(file);
			return new Response(bytes as BodyInit, { status: 200, headers: { "content-type": "font/ttf" } });
		} catch (error) {
			return new Response(error instanceof Error ? error.message : String(error), { status: 503 });
		}
	}) as typeof fetch;
}

export { bytesOf };
