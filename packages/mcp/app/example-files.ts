// The image files of the bundled example decks in the view. Several examples name pictures by a relative path (./assets/logo.svg),
// which a view in a sandbox cannot load, so the slides drew the "Image unavailable" placeholder. The view asks the server's app-only
// tool read_example_files for the paths a deck names and draws them from what comes back, in the preview and in every export.
//
// The boundary: the view never reads a file or fetches a URL for a deck's path. It asks the server only for relative paths
// (./name or ./folder/name with an image extension, no ".." and no scheme), the server answers only with the files the examples
// ship (a lookup, never a read), and the view keeps an answer only when it is a path it asked for and a base64 data URI of a raster
// or SVG image. Any other path keeps drawing the placeholder, as before.

/** The most paths one read_example_files call names (the server's own limit). */
export const EXAMPLE_FILE_BATCH = 32;
/** A path the view asks the server for: relative, in folders of plain names, with an image extension. */
const LOCAL_IMAGE = /^\.\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.(?:png|jpe?g|gif|webp|svg)$/i;
/** An answer the view keeps: a base64 data URI of a raster or SVG image. */
const IMAGE_DATA = /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/]*={0,2}$/;

/** Whether the view would ask the server for this path. */
export const isLocalImage = (value: string): boolean => value.length <= 200 && LOCAL_IMAGE.test(value) && !value.split("/").includes("..");

/** The relative image paths a deck names, in the order they first appear. */
export function localImages(deck: unknown): string[] {
	const found = new Set<string>();
	const visit = (value: unknown): void => {
		if (typeof value === "string") {
			if (isLocalImage(value)) found.add(value);
		} else if (Array.isArray(value)) value.forEach(visit);
		else if (value && typeof value === "object") Object.values(value).forEach(visit);
	};
	visit(deck);
	return [...found];
}

/** One read_example_files call: its structured result, or a rejection (no such tool, a host that cannot call the server, an error). */
export type ReadExampleFiles = (names: readonly string[]) => Promise<{ files?: Record<string, unknown> } | undefined>;

/** The example images the view has read, and the loader that reads the ones a deck names. */
export interface ExampleImages {
	/** The data URI for a deck's path, or undefined (the renderer's and the exporter's `imageResolver`). */
	resolve(src: string | undefined): string | undefined;
	/** Reads the paths the deck names that were not asked for yet; resolves true when it got a new image (the slides should redraw). */
	load(deck: unknown): Promise<boolean>;
}

export function exampleImages(read: ReadExampleFiles): ExampleImages {
	const images = new Map<string, string>();
	const asked = new Set<string>();
	return {
		resolve: (src) => (src === undefined ? undefined : images.get(src)),
		async load(deck) {
			const names = localImages(deck).filter((name) => !asked.has(name));
			if (!names.length) return false;
			for (const name of names) asked.add(name);
			let added = false;
			for (let start = 0; start < names.length; start += EXAMPLE_FILE_BATCH) {
				const batch = names.slice(start, start + EXAMPLE_FILE_BATCH);
				let files: Record<string, unknown> | undefined;
				try {
					files = (await read(batch))?.files;
				} catch {
					// No such tool, or a host that cannot call the server: those pictures keep drawing the placeholder.
					return added;
				}
				for (const name of batch) {
					const data = files && Object.hasOwn(files, name) ? files[name] : undefined;
					if (typeof data === "string" && IMAGE_DATA.test(data)) {
						images.set(name, data);
						added = true;
					}
				}
			}
			return added;
		},
	};
}
