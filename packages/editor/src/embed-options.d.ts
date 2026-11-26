import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

/** The aspect ratios the inspector offers beside a number field: the frame's width over its height. */
export declare const EMBED_ASPECT_PRESETS: readonly { readonly id: string; readonly label: string; readonly value: number }[];
/** The fields an embed object holds, in schema order. */
export declare const EMBED_FIELDS: readonly ["src", "title", "aspectRatio", "preview"];

/** What an edit sets (a value) or removes (`null`); a field left out stays as it is. */
export interface EmbedFields {
  /** The page's https address (at most 2048 characters). */
  src?: string;
  /** The accessible name and the card's heading; `null` uses the site name. */
  title?: string | null;
  /** Width over height of the frame, above 0 and up to 10; `null` is 16:9. */
  aspectRatio?: number | null;
  /** A picture of the page: an `asset:` reference, an https address, a data URI or a relative path; `null` draws the card. */
  preview?: string | null;
}
export interface EmbedState { path: string; src: string; title?: string; aspectRatio?: number; preview?: string }

/** The embed of a block or slide, whichever form it was written in. Throws `invalid-embed` when the target holds none. */
export declare function readEmbed(presentation: unknown, blockPath: string | string[]): EmbedState;
/** The embed an edit leaves: the string shorthand while it holds only an address. Throws `invalid-embed`. */
export declare function editedEmbed(presentation: unknown, blockPath: string | string[], fields: EmbedFields): string | Record<string, unknown>;
/** The patches of an edit (one replace of the embed's value, none when nothing changes). */
export declare function embedPatches(presentation: unknown, blockPath: string | string[], fields: EmbedFields): JsonPatchOperation[];
export interface PreparedEmbed { presentation: unknown; patches: JsonPatchOperation[]; changed: boolean; path: string; slideIndex: number }
/** Compute the change of `setEmbed` without touching a session. */
export declare function prepareEmbed(presentation: unknown, blockPath: string | string[], fields: EmbedFields): PreparedEmbed;
/** Set or remove fields of one embed as a single undoable transaction. */
export declare function setEmbed(editor: EditorSession, blockPath: string | string[], fields: EmbedFields, meta?: Record<string, unknown>): Omit<PreparedEmbed, "presentation"> & Partial<EditorChange>;
