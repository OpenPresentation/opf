// @openpresentation/gallery/icon-sets (LH-14, RR-63): the gallery's icon sets as a catalog to register beside `gallery`. Copied to
// dist/ by scripts/build.mjs. The icon data is not in this module: it is plain static files under dist/icons/ (written by the build from
// catalog/icon-sets/), read one icon at a time through `load`, so a host pays for the icons its decks draw and for nothing else.
//
//   <set>.json        the set's name, license, copyright, license text, version, viewBox, style and every icon name (the index)
//   <set>/<name>.json one icon's path data (a string, or { stroke, fill })
//   <set>.icons.json  the whole set: the index and every icon's path data, read when a batch asks for many icons or a per-icon file is
//                     missing (a host that serves only the set-level files), or imported by a server that bundles a set
//   <set>.tags.json   the search keywords of every icon (only a search reads them)
import { INSTALLED_ICON_FILES, readIcons } from "#icon-files";
import { GALLERY_ICON_SETS } from "./icon-set-ids.js";

export { GALLERY_ICON_SETS };

const GALLERY_SOURCE = "https://www.pptx.gallery";
/** A batch that asks for more icons of one set than this reads the whole-set file once instead (an icon browser's page). */
export const WHOLE_SET_BATCH = 40;
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const messageOf = (error) => (error instanceof Error ? error.message : String(error));
const isIndex = (value) => isObject(value) && Array.isArray(value.names) && Array.isArray(value.viewBox);
/** A read's reason and its fallback's: both, unless they are the same (a runtime that reads no file says so once). */
const both = (first, fallback) => (fallback === first ? first : `${first} (and ${fallback})`);

/**
 * The gallery's icon sets as a catalog (`source` and `iconSets`).
 *
 * - `galleryIconSets()`: the files of the installed package, in Node, Bun and Deno (found next to this module, else as the
 *   `@openpresentation/gallery` package installed for the working directory). Elsewhere a set icon is a finding that says to serve them.
 * - `galleryIconSets(load)`: `load(path)` reads one file of dist/icons/ by its path there (`lucide.json`, `lucide/truck.json`,
 *   `lucide.icons.json`, `lucide.tags.json`) and resolves with its JSON value; `fetchIcons(baseUrl)` is the `load` for served files.
 * - `galleryIconSets({ lucide })`: sets a server imported into its bundle, each a whole-set file (`<set>.icons.json`); only those
 *   sets are registered, and nothing is read.
 *
 * Each set is a loader core calls with `{ icons: [names] }` (and a search with `{ tags: true }`): it resolves with the set's record
 * holding `names` (every icon name), the requested icons it could read in `icons`, the reason for each one it could not in `errors`,
 * and `tags` when asked. A batch of more than `WHOLE_SET_BATCH` icons of a set, or one whose per-icon file is missing, reads the
 * whole-set file once instead. Files are read once and kept; a failed read is not kept, so a later request tries again.
 */
export function galleryIconSets(load = readIcons) {
	if (isObject(load)) return bundledIconSets(load);
	if (typeof load !== "function") throw new TypeError("galleryIconSets(load): load must be a function (path) => Promise of the file's JSON value, or the whole-set files by set id.");
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
		// The whole set, once it has been read: from then on every icon comes from it and no other file is read.
		let whole;
		const readWhole = async () => {
			if (whole) return whole;
			const value = await read(`${id}.icons.json`);
			if (!isIndex(value) || !isObject(value.icons)) throw new Error(`${id}.icons.json is not a whole icon set.`);
			whole = value;
			files.delete(`${id}.icons.json`);
			return whole;
		};
		iconSets[id] = async (request = {}) => {
			const asked = [...new Set(Array.isArray(request?.icons) ? request.icons : [])].filter((name) => typeof name === "string");
			if (!whole && asked.length > WHOLE_SET_BATCH) await readWhole().catch(() => undefined);
			let index = whole;
			if (!index) {
				try {
					index = await read(`${id}.json`);
				} catch (error) {
					// No index: a host that serves only the whole-set file still draws.
					index = await readWhole().catch((fallback) => {
						throw new Error(both(messageOf(error), messageOf(fallback)));
					});
				}
			}
			if (!isIndex(index)) throw new Error(`${id}.json is not an icon-set index.`);
			const { icons: _icons, ...meta } = index;
			const known = new Set(index.names);
			const wanted = asked.filter((name) => known.has(name));
			const icons = {};
			const errors = {};
			const missing = [];
			if (whole) missing.push(...wanted);
			else {
				const settled = await Promise.allSettled(wanted.map((name) => read(`${id}/${name}.json`)));
				settled.forEach((result, at) => {
					if (result.status === "fulfilled") icons[wanted[at]] = result.value;
					else {
						missing.push(wanted[at]);
						errors[wanted[at]] = messageOf(result.reason);
					}
				});
			}
			if (missing.length) {
				// A missing per-icon file (a 404, or a page served in its place): the whole set, once, before an icon is reported.
				try {
					const set = await readWhole();
					for (const name of missing) {
						if (Object.hasOwn(set.icons, name)) {
							icons[name] = set.icons[name];
							delete errors[name];
						} else errors[name] = `${id}.icons.json has no icon ${name}.`;
					}
				} catch (error) {
					for (const name of missing) errors[name] = errors[name] ? both(errors[name], messageOf(error)) : messageOf(error);
				}
			}
			const tags = request?.tags ? await read(`${id}.tags.json`) : undefined;
			return { ...meta, icons, ...(Object.keys(errors).length ? { errors } : {}), ...(tags ? { tags } : {}) };
		};
	}
	return Object.freeze({ source: GALLERY_SOURCE, iconSets: Object.freeze(iconSets) });
}

/** The sets a server put in its bundle: each a whole-set file's value, registered as is. */
function bundledIconSets(sets) {
	const iconSets = {};
	for (const [id, set] of Object.entries(sets)) {
		if (!GALLERY_ICON_SETS.includes(id)) throw new TypeError(`galleryIconSets({ ${id} }): the gallery has no icon set ${id} (sets: ${GALLERY_ICON_SETS.join(", ")}).`);
		const value = isObject(set) && isObject(set.default) && !isObject(set.icons) ? set.default : set;
		if (!isIndex(value) || !isObject(value.icons)) throw new TypeError(`galleryIconSets({ ${id} }): pass the whole-set file @openpresentation/gallery/icons/${id}.icons.json.`);
		iconSets[id] = async () => value;
	}
	return Object.freeze({ source: GALLERY_SOURCE, iconSets: Object.freeze(iconSets) });
}

/**
 * `galleryIconSets()` where this runtime reads the installed package's files (the `node` export condition: Node, Bun and Deno), else
 * undefined: what a host registers by default when it may run where no file can be read (a Worker), so there a set icon stays
 * unregistered, as in a host that registers no icon sets, instead of failing on every load.
 */
export function installedIconSets() {
	return INSTALLED_ICON_FILES ? galleryIconSets() : undefined;
}

/**
 * A `load` for `galleryIconSets` that fetches the files a host serves: the package's dist/icons/ folder (all of it, or only the
 * set-level files `<set>.json` and `<set>.icons.json`, plus `<set>.tags.json` for search), copied or served as is, at `baseUrl`. A
 * relative `baseUrl` resolves against the page; outside a page it must be absolute. `fetcher` is a fetch function or an object with a
 * `fetch` method, such as a Worker's `env.ASSETS` binding (called as `fetcher.fetch(url)`); it defaults to the global `fetch`. A file
 * that does not answer with JSON (a 404, or an HTML page a single-page host answers with) rejects with a message that names its URL.
 */
export function fetchIcons(baseUrl, fetcher) {
	if (typeof baseUrl !== "string" && !(baseUrl instanceof URL)) throw new TypeError("fetchIcons(baseUrl): baseUrl must be the URL the icon files are served from.");
	const written = String(baseUrl);
	let base;
	try {
		base = new URL(written.endsWith("/") ? written : `${written}/`, globalThis.document?.baseURI ?? globalThis.location?.href);
	} catch {
		throw new TypeError(`fetchIcons(${JSON.stringify(written)}): a relative base URL needs a page to resolve against; pass an absolute URL (in a Worker, new URL("/opf-icons/", request.url)).`);
	}
	const get =
		fetcher === undefined
			? (url) => globalThis.fetch(url)
			: typeof fetcher === "function"
				? (url) => fetcher(url)
				: typeof fetcher?.fetch === "function"
					? (url) => fetcher.fetch(url)
					: undefined;
	if (!get) throw new TypeError("fetchIcons(baseUrl, fetcher): fetcher must be a fetch function or an object with a fetch method (such as env.ASSETS).");
	return async (file) => {
		const url = new URL(file, base).href;
		let response;
		try {
			response = await get(url);
		} catch (error) {
			throw new Error(`${url} could not be fetched: ${messageOf(error)}`);
		}
		if (!response.ok) throw new Error(`${url} answered ${response.status}.`);
		const text = await response.text();
		const type = response.headers?.get?.("content-type") ?? "";
		if (/html/i.test(type) || text.trimStart().startsWith("<")) throw new Error(`${url} answered a web page, not the icon file: serve @openpresentation/gallery's dist/icons/ there.`);
		try {
			return JSON.parse(text);
		} catch (error) {
			throw new Error(`${url} is not JSON: ${messageOf(error)}`);
		}
	};
}
