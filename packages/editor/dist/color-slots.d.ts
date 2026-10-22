import type { Catalog } from "@openpresentation/opf";

/** The four background slots a variant maps to the background: `light1`, `light2`, `dark1`, `dark2`. */
export declare const VARIANT_BACKGROUND_SLOTS: readonly ["light1", "light2", "dark1", "dark2"];
/** The six accent slots, in the scheme's own order. */
export declare const ACCENT_SLOTS: readonly ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"];
export type VariantBackgroundSlot = (typeof VARIANT_BACKGROUND_SLOTS)[number];
export type AccentSlot = (typeof ACCENT_SLOTS)[number];
/** Slot name to `#RRGGBB`; a slot the resolved scheme leaves out is absent. */
export type SchemeSlots = Partial<Record<VariantBackgroundSlot | AccentSlot, string>>;
/** The deck's resolved color scheme slots at `slideIndex` (default 0), for swatches. Never throws: an unresolvable document gives `{}`. */
export declare function readSchemeSlots(presentation: unknown, options?: { slideIndex?: number; catalogs?: readonly Catalog[] }): SchemeSlots;
