// The deck's set icons ("lucide:truck") in the view (RR-111). The view cannot fetch, so each icon set registered here is a loader that
// asks the server's app-only tool read_icons for the icons a deck names, at most ICON_BATCH a call, and for the set's index (every
// icon name, its viewBox, style, license and copyright) on its first call only. Core calls a loader through ensureIcons and settles a
// failed load (RR-63): the slide draws without the icon and opf/icon-unknown says why, so nothing here blocks the canvas or throws
// into the UI. No icon data is in the page.
import { GALLERY_ICON_SETS } from "@openpresentation/gallery/icon-sets";

/** The most icon names one read_icons call carries (the server's own limit). */
export const ICON_BATCH = 100;
/** The source of the gallery's icon-set catalog: core groups embedded icons by it, as the server's own catalog does. */
const GALLERY_SOURCE = "https://www.pptx.gallery";

/** What read_icons returns: the icons it could read, why it could not read the others, and the set's index when asked for. */
export interface IconBatch {
	icons?: Record<string, unknown>;
	errors?: Record<string, string>;
	index?: Record<string, unknown>;
}
/** One read_icons call; it rejects when the call fails (no such tool, a host that cannot call the server, an error result). */
export type ReadIcons = (set: string, names: readonly string[], index: boolean) => Promise<IconBatch>;
type IconRequest = { icons?: readonly unknown[]; tags?: boolean };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
const isIndex = (value: unknown): value is Record<string, unknown> & { names: string[] } => typeof value === "object" && value !== null && Array.isArray((value as { names?: unknown }).names) && Array.isArray((value as { viewBox?: unknown }).viewBox);

/**
 * The gallery's icon sets as a catalog whose loaders read through `read`. `offered()` is the list of sets the server announced (its
 * show_deck or open_editor result names them), or undefined while it is not known: a set the server does not offer fails at once,
 * without a call; while it is not known the view asks, and a server without the tool answers with an error, which settles the load.
 * Search keywords (`tags`) are not read: the viewer has no icon picker.
 */
export function serverIconSets(read: ReadIcons, offered: () => readonly string[] | undefined) {
	const iconSets: Record<string, (request?: IconRequest) => Promise<Record<string, unknown>>> = {};
	for (const id of GALLERY_ICON_SETS) {
		let index: Promise<Record<string, unknown>> | undefined;
		iconSets[id] = async (request = {}) => {
			const sets = offered();
			if (sets && !sets.includes(id)) throw new Error(sets.length ? `this server offers the icon sets ${sets.join(", ")}, not ${id}.` : "this server offers the viewer no icon sets.");
			const names = [...new Set((Array.isArray(request.icons) ? request.icons : []).filter((name): name is string => typeof name === "string"))];
			const batches: string[][] = [];
			for (let at = 0; at < names.length; at += ICON_BATCH) batches.push(names.slice(at, at + ICON_BATCH));
			if (!batches.length) batches.push([]);
			const icons: Record<string, unknown> = {};
			const errors: Record<string, string> = {};
			const take = (batch: IconBatch) => {
				Object.assign(icons, batch.icons ?? {});
				Object.assign(errors, batch.errors ?? {});
			};
			let rest = batches;
			if (!index) {
				// The first call of a set also brings its index; a failed one is not kept, so a later load asks again.
				const first = read(id, batches[0] as string[], true);
				const pending = first.then((batch) => {
					if (!isIndex(batch.index)) throw new Error(`the server sent no index of the icon set ${id}.`);
					return batch.index;
				});
				index = pending;
				pending.catch(() => {
					if (index === pending) index = undefined;
				});
				take(await first);
				rest = batches.slice(1);
			}
			const meta = await index;
			// A batch that fails leaves its icons unread, each with the reason; the others still draw.
			await Promise.all(rest.map((batch) => read(id, batch, false).then(take, (error: unknown) => {
				for (const name of batch) errors[name] = messageOf(error);
			})));
			return { ...meta, icons, ...(Object.keys(errors).length ? { errors } : {}) };
		};
	}
	return { source: GALLERY_SOURCE, iconSets };
}
