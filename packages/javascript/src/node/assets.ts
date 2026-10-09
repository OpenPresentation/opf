// Local images for render and export. A deck's relative image paths resolve against the deck's folder (or
// --asset-dir; the assetDir option of convert, which defaults to the input file's folder and has none for a deck object). Nothing outside that folder is read, nothing is fetched, and only image files are accepted, so a deck
// cannot pull another file on the machine into an output. Data URIs need no resolver and are used as they are.
import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Reporter } from "./reporter.js";

const MEDIA: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" };
const MAX_BYTES = 32 * 1024 * 1024;

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) => signature.every((value, index) => bytes[offset + index] === value);
function looksLike(type: string, bytes: Uint8Array) {
	switch (type) {
		case "image/png":
			return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]);
		case "image/jpeg":
			return startsWith(bytes, [0xff, 0xd8, 0xff]);
		case "image/gif":
			return startsWith(bytes, [0x47, 0x49, 0x46, 0x38]);
		case "image/webp":
			return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
		default:
			return /<svg[\s>]/i.test(new TextDecoder().decode(bytes.subarray(0, 4096)));
	}
}

export interface ResolvedImage {
	bytes: Uint8Array;
	mediaType: string;
}
type Outcome = { image: ResolvedImage } | { skipped: true } | { problem: "blocked" | "missing"; reason: string };

/** Raised by the PPTX resolver for a local image that cannot be read: opf-pptx would otherwise read the path itself, outside the asset directory. */
export class AssetError extends Error {
	readonly code = "asset-unresolved";
	constructor(
		message: string,
		readonly details: { path: string },
	) {
		super(message);
	}
}

export function createImageResolver(root: string | undefined, reporter: Reporter, passDirectory = "pass --asset-dir") {
	const base = root === undefined ? undefined : realpathSync(root);
	const cache = new Map<string, Outcome>();
	const shown = (source: string) => (source.length > 80 ? `${source.slice(0, 77)}...` : source);
	function load(source: string): Outcome {
		// Schemes (https:, data:, asset:) are never read here: opf-render and opf-pptx handle them, and nothing is fetched.
		if (/^[a-z][a-z0-9+.-]*:/i.test(source) && !/^file:/i.test(source) && !/^[a-z]:[\\/]/i.test(source)) return { skipped: true };
		if (base === undefined) return { problem: "blocked", reason: "no asset directory was given, so no local file is read." };
		let file: string;
		try {
			file = /^file:/i.test(source) ? fileURLToPath(source) : path.resolve(base, source);
		} catch {
			return { problem: "blocked", reason: "the path is not valid." };
		}
		let real: string;
		try {
			real = realpathSync(file);
		} catch {
			return { problem: "missing", reason: `no such file under ${base}.` };
		}
		const relative = path.relative(base, real);
		if (relative.startsWith("..") || path.isAbsolute(relative)) return { problem: "blocked", reason: `it is outside the asset directory ${base}.` };
		const mediaType = MEDIA[path.extname(real).toLowerCase()];
		if (!mediaType) return { problem: "blocked", reason: "only .png, .jpg, .jpeg, .gif, .webp and .svg files are read." };
		const info = statSync(real);
		if (!info.isFile() || info.size > MAX_BYTES) return { problem: "blocked", reason: `it is not a regular file under ${MAX_BYTES / 1024 / 1024} MB.` };
		const bytes = new Uint8Array(readFileSync(real));
		if (!looksLike(mediaType, bytes)) return { problem: "blocked", reason: `the content is not a ${mediaType} image.` };
		return { image: { bytes, mediaType } };
	}
	function read(source: string): Outcome {
		let outcome = cache.get(source);
		if (!outcome) {
			outcome = load(source);
			cache.set(source, outcome);
		}
		return outcome;
	}
	return {
		/** opf-render: a data URI string, or null for the placeholder (a missing file is reported by the renderer as unresolved-asset). */
		forSvg: (source: string | undefined, context: { path: string }): string | null => {
			if (!source) return null;
			const outcome = read(source);
			if ("image" in outcome) return `data:${outcome.image.mediaType};base64,${Buffer.from(outcome.image.bytes).toString("base64")}`;
			if ("problem" in outcome && outcome.problem === "blocked") reporter.add("cli", { code: "asset-blocked", path: context.path, message: `Image "${shown(source)}" was not read: ${outcome.reason}` });
			return null;
		},
		/** opf-pptx: bytes and media type; null for URLs and references it handles itself. An unreadable local file stops the export. */
		forPptx: (source: string, context: { path: string }) => {
			const outcome = read(source);
			if ("image" in outcome) return { data: outcome.image.bytes, mediaType: outcome.image.mediaType };
			if ("skipped" in outcome) return null;
			throw new AssetError(`Image "${shown(source)}" was not read: ${outcome.reason} Fix the path, embed the image as a data URI, or ${passDirectory}.`, { path: context.path });
		},
	};
}
