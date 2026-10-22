import type { Catalog } from "@openpresentation/opf";
import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";
import type { AccentSlot, VariantBackgroundSlot } from "./color-slots.js";

export { ACCENT_SLOTS, VARIANT_BACKGROUND_SLOTS } from "./color-slots.js";
export type { AccentSlot, VariantBackgroundSlot } from "./color-slots.js";

/** A variant of the deck's one color scheme: the slot that is the background and, optionally, the order of the accents (core's `ColorVariant`). */
export interface DesignVariant {
  background: VariantBackgroundSlot;
  /** A permutation of `accent1` to `accent6`: entry i is the slot drawn as accent i + 1 (primary, secondary, accent and the chart series colors follow it). */
  accents?: AccentSlot[];
}
/** What `design.variant` takes: the background slot (the shorthand) or the object. */
export type DesignVariantInput = VariantBackgroundSlot | DesignVariant;
/** What the editor writes: the slot as a string, or the object only for a reordered accent order. */
export type StoredDesignVariant = VariantBackgroundSlot | { background: VariantBackgroundSlot; accents: AccentSlot[] };

/** For each background slot, the slots the variant maps to bg1, tx1, bg2 and tx2 (PowerPoint's color map), and whether it is dark. */
export declare const VARIANT_MAPS: Readonly<Record<VariantBackgroundSlot, { readonly bg1: string; readonly tx1: string; readonly bg2: string; readonly tx2: string; readonly dark: boolean }>>;

/** Validate a variant and return what to store (see {@link StoredDesignVariant}). Throws `invalid-variant` with a sentence a person can act on. */
export declare function normalizeVariant(value: DesignVariantInput): StoredDesignVariant;

export interface DesignVariantOptions {
  /** One slide instead of the deck. */
  slideIndex?: number;
  /** Deck scope: also remove the slides' own variants that would hide the change. */
  clearSlideOverrides?: boolean;
  /** Catalogs the document's references resolve against (a session form uses the session's). */
  catalogs?: readonly Catalog[];
  /** Session change metadata (session form only). */
  meta?: Record<string, unknown>;
}
export interface DesignVariantState {
  /** What this scope's own `design.variant` says, normalized to the object; undefined when it sets none. */
  own?: DesignVariant;
  /** The slide's effective variant background, by core's resolution (a variant, a theme-slot background or a picture's tone, the deck's, the theme's, else light1). */
  background: VariantBackgroundSlot;
  /** The effective accent order (the six slots; the scheme's own order unless a variant reorders it). */
  accents: AccentSlot[];
  /** Where `own` comes from: "slide" (the slide sets it), "deck", or "default" (nothing sets one). */
  scope: "slide" | "deck" | "default";
  /** True when a slide takes its variant from the deck (it sets none itself). */
  inherited: boolean;
}
export declare function readDesignVariant(presentation: unknown, options?: Pick<DesignVariantOptions, "slideIndex" | "catalogs">): DesignVariantState;

/** One of the four variants as a swatch built from the deck's own scheme slots. */
export interface VariantSwatch {
  slot: VariantBackgroundSlot;
  dark: boolean;
  /** Hex colors of the slots the variant maps to its background, text and alternate surface; undefined when the scheme leaves a slot out. */
  background?: string;
  text?: string;
  surface?: string;
  /** The first three accents in the effective accent order. */
  accents: Array<string | undefined>;
  /** Whether it is the effective variant of the slide. */
  selected: boolean;
}
/** The four variants (`light1`, `light2`, `dark1`, `dark2`) as swatches from the deck's scheme at a scope, like PowerPoint's Variants gallery. */
export declare function variantSwatches(presentation: unknown, options?: Pick<DesignVariantOptions, "slideIndex" | "catalogs">): VariantSwatch[];

export interface PreparedDesignVariant {
  option: "variant";
  scope: "deck" | "slide";
  slideIndex?: number;
  presentation: unknown;
  patches: JsonPatchOperation[];
  changed: boolean;
  /** Slides whose own variant, or theme-slot or toned background, still hides a deck-level change. */
  shadowed: number[];
}
/**
 * The patch that sets the variant (a slot, `{ background, accents? }`, or `null` to remove it; `{ accents }` alone keeps the background)
 * at the deck, or on one slide with `slideIndex`. The document is not modified.
 */
export declare function prepareDesignVariant(presentation: unknown, value: DesignVariantInput | { accents: AccentSlot[] } | null, options?: Omit<DesignVariantOptions, "meta">): PreparedDesignVariant;
export interface DesignVariantChange extends Omit<EditorChange, "presentation" | "patches"> {
  presentation: unknown;
  patches: JsonPatchOperation[];
  option: "variant";
  scope: "deck" | "slide";
  slideIndex?: number;
  changed: boolean;
  shadowed: number[];
}
/** Set the variant as one undoable transaction. */
export declare function setDesignVariant(editor: EditorSession, value: DesignVariantInput | { accents: AccentSlot[] } | null, options?: DesignVariantOptions): DesignVariantChange;
