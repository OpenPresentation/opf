// @openpresentation/gallery/icon-sets (LH-14, RR-63): the gallery's icon sets as a catalog to register beside `gallery`. Copied to
// dist/ by scripts/build.mjs. The icon data is not in this module: it is plain static files under dist/icons/ (written by the build from
// catalog/icon-sets/), read one icon at a time through `load`, so a host pays for the icons its decks draw and for nothing else.
//
//   <set>.json        the set's name, license, copyright, license text, version, viewBox, style and every icon name
//   <set>/<name>.json one icon's path data (a string, or { stroke, fill })
//   <set>.tags.json   the search keywords of every icon (only a search reads them)
import { readIcons } from "#icon-files";
import { GALLERY_ICON_SETS } from "./icon-set-ids.js";

export { GALLERY_ICON_SETS };

const GALLERY_SOURCE = "https://www.pptx.gallery";

/**
 * The gallery's icon sets as a catalog (`source` and `iconSets`). `load(path)` reads one file of dist/icons/ by its path there
 * (`lucide.json`, `lucide/truck.json`, `lucide.tags.json`) and resolves with its JSON value. Omitted, the files are read from the
 * installed package in Node, Bun and Deno; elsewhere a host passes `fetchIcons(baseUrl)` for the files it serves.
 *
 * Each set is a loader core calls with `{ icons: [names] }` (and a search with `{ tags: true }`): it resolves with the set's record
 * holding `names` (every icon name), the requested icons it has, and `tags` when asked. Files are read once and kept.
 */
export function galleryIconSets(load = readIcons) {
	if (typeof load !== "function") throw new TypeError("galleryIconSets(load): load must be a function (path) => Promise of the file's JSON value.");
	const iconSets = {};
	for (const id of GALLERY_ICON_SETS) {
		const files = new Map();
		const read = (file) => {
			let pending = files.get(file);
			if (!pending) {
				pending = Promise.resolve().then(() => load(file));
				pending.catch(() => files.delete(file));
				files.set(file, pending);
			}
			return pending;
		};
		iconSets[id] = async (request = {}) => {
			const index = await read(`${id}.json`);
			if (!index || typeof index !== "object" || !Array.isArray(index.names)) throw new Error(`${id}.json is not an icon-set index.`);
			const known = new Set(index.names);
			const wanted = [...new Set(Array.isArray(request?.icons) ? request.icons : [])].filter((name) => typeof name === "string" && known.has(name));
			const icons = Object.fromEntries(await Promise.all(wanted.map(async (name) => [name, await read(`${id}/${name}.json`)])));
			const tags = request?.tags ? await read(`${id}.tags.json`) : undefined;
			return { ...index, icons, ...(tags ? { tags } : {}) };
		};
	}
	return Object.freeze({ source: GALLERY_SOURCE, iconSets: Object.freeze(iconSets) });
}

/**
 * A `load` for `galleryIconSets` that fetches the files a host serves: the package's dist/icons/ folder, copied or served as is, at
 * `baseUrl` (a URL that ends with `/`, absolute or relative to the page). `fetchImpl` defaults to the global `fetch`.
 */
export function fetchIcons(baseUrl, fetchImpl = globalThis.fetch) {
	if (typeof baseUrl !== "string" && !(baseUrl instanceof URL)) throw new TypeError("fetchIcons(baseUrl): baseUrl must be the URL the icon files are served from.");
	const base = String(baseUrl).endsWith("/") ? String(baseUrl) : `${baseUrl}/`;
	return async (file) => {
		const response = await fetchImpl(base + file);
		if (!response.ok) throw new Error(`${base + file} answered ${response.status}.`);
		return response.json();
	};
}
