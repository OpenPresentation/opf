/** The `design` keys that a layout record, the deck and a slide all share and that composition resolves per key. */
export const DESIGN_HINT_KEYS = ['titleAlignment', 'contentAlignment', 'contentBox', 'contentDirection', 'chartPrimary', 'imageFit', 'listBullet', 'listStyle', 'mirror'] as const;
export type DesignHintKey = typeof DESIGN_HINT_KEYS[number];
/** The design keys a theme record may carry (`theme.design`), so a house style such as boxed content is set once. */
export const THEME_DESIGN_KEYS = ['titleAlignment', 'contentAlignment', 'contentBox', 'contentDirection', 'imageFit', 'listBullet', 'listStyle'] as const;
/** Where an effective design hint came from: the slide's own `design`, the deck's `design`, the resolved theme record, or the slide's layout record. */
export type DesignHintSource = 'slide' | 'deck' | 'theme' | 'layout';

/** A design alignment as a document writes it: logical, so `start` is the left edge of a left-to-right deck and the right edge of a right-to-left one. */
export type DesignAlignment = 'start' | 'center' | 'end';
/**
 * The engine's word for a design alignment. Composed items keep `left` for the start edge and `right` for the end edge
 * (`physicalAlignment` resolves them against each paragraph's direction), so a consumer of `SlideComposition.design`
 * that needs an item alignment converts with this. Any other value is `undefined`.
 */
export const itemAlignment = (value: unknown): 'left' | 'center' | 'right' | undefined => value === 'start' ? 'left' : value === 'end' ? 'right' : value === 'center' ? 'center' : undefined;

/** The effective value of every shared design key, in the document's words. A key nobody sets is absent, so the engine default applies. */
export interface DesignHints {
  titleAlignment?: DesignAlignment;
  contentAlignment?: DesignAlignment;
  contentBox?: boolean;
  contentDirection?: 'horizontal' | 'vertical';
  chartPrimary?: 'none' | 'top' | 'bottom' | 'start' | 'end';
  imageFit?: 'cover' | 'contain' | 'stretch' | 'auto';
  listBullet?: 'character' | 'image' | 'none';
  /** LH-08: how list entries are arranged: stacked (`stack`) or as ruled rows (`rows`). Absent: automatic (rows for a list of short labels with descriptions). */
  listStyle?: 'stack' | 'rows';
  /** A layout template drawn mirrored: each row's cells and the column sizes reversed (OPF 0.19). Logical, so a right-to-left deck mirrors on top. */
  mirror?: boolean;
}

/** The effective hints plus which level supplied each key and the document path that names it. */
export interface ResolvedDesignHints extends DesignHints {
  /** The level that supplied each key that is set. */
  sources: { [K in DesignHintKey]?: DesignHintSource };
  /** Path of the supplying value: `slides.N.design.key`, `design.key`, for a theme the reference that selected it (`slides.N.design.theme` or `design.theme`), or for a layout `slides.N.layout` (the reference that selected the record). */
  paths: { [K in DesignHintKey]?: string };
}

export interface ResolveDesignHintsOptions {
  /** The slide, for its own `design`. */
  slide?: unknown;
  /** The slide's resolved layout record, for its `design`. */
  layout?: unknown;
  /** The slide's resolved theme record, for its `design` (THEME_DESIGN_KEYS only). */
  theme?: unknown;
  /** The document, for the deck's `design`. */
  presentation?: unknown;
  /** Index used in the reported paths; defaults to 0. */
  slideIndex?: number;
  /** Host-resolved deck-level values. They rank with the deck's `design`, above it, and below the slide's. */
  deck?: DesignHints;
}

const ALIGNMENTS = ['start', 'center', 'end'];
const VALUES: { [K in DesignHintKey]: readonly unknown[] | 'boolean' } = {
  titleAlignment: ALIGNMENTS, contentAlignment: ALIGNMENTS, contentBox: 'boolean', contentDirection: ['horizontal', 'vertical'],
  chartPrimary: ['none', 'top', 'bottom', 'start', 'end'], imageFit: ['cover', 'contain', 'stretch', 'auto'], listBullet: ['character', 'image', 'none'], listStyle: ['stack', 'rows'], mirror: 'boolean',
};
const themeKeys: ReadonlySet<string> = new Set(THEME_DESIGN_KEYS);
/** A value the schema allows for the key; anything else is skipped, so the next level answers. */
const accepts = (key: DesignHintKey, value: unknown) => VALUES[key] === 'boolean' ? typeof value === 'boolean' : (VALUES[key] as readonly unknown[]).includes(value);

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/**
 * Resolves the shared design keys with one merge, per key, the slide winning: the slide's `design`, then the
 * deck's `design` (or the host's `deck` values), then the resolved theme record's `design` (THEME_DESIGN_KEYS only;
 * new in 0.19), then the resolved layout record's `design`. A key none of them
 * sets stays absent. A value the schema does not allow for its key is skipped, so the next level answers. Composition, the renderer, the PPTX exporter and the audit all take their values from here
 * (`SlideComposition.design`), so they cannot disagree.
 */
export function resolveDesignHints(options: ResolveDesignHintsOptions = {}): ResolvedDesignHints {
  const slide = object(object(options.slide).design), host = object(options.deck), deck = object(object(options.presentation).design), theme = object(object(options.theme).design), layout = object(object(options.layout).design);
  const index = options.slideIndex ?? 0;
  const result: ResolvedDesignHints = { sources: {}, paths: {} };
  const set = (key: DesignHintKey, value: unknown, source: DesignHintSource, path: string) => {
    (result as unknown as Record<string, unknown>)[key] = value;
    result.sources[key] = source;
    result.paths[key] = path;
  };
  for (const key of DESIGN_HINT_KEYS) {
    if (accepts(key, slide[key])) set(key, slide[key], 'slide', `slides.${index}.design.${key}`);
    else if (accepts(key, host[key])) set(key, host[key], 'deck', `design.${key}`);
    else if (accepts(key, deck[key])) set(key, deck[key], 'deck', `design.${key}`);
    else if (themeKeys.has(key) && accepts(key, theme[key])) set(key, theme[key], 'theme', slide.theme !== undefined ? `slides.${index}.design.theme` : 'design.theme');
    else if (accepts(key, layout[key])) set(key, layout[key], 'layout', `slides.${index}.layout`);
  }
  return result;
}
