import { catalogs } from './catalogs.js';
import { DEFAULT_FONT_SCHEME, imageBackground, resolveCanvasDimensions, resolveFontFamilies, resolveFontSchemeReference } from './composition.js';
import { isRecord, visitContentPayloads } from './content-walk.js';
import { listVariables, type VariableKind } from './variables.js';

/**
 * `stats(presentation)`: neutral, structural facts about a deck. Counts and lists only; no severities, no
 * judgments, no thresholds. Nothing is composed or measured, so it needs no fonts and no layout, it never
 * throws on an invalid deck (it reads what is there), and the same input always gives the same output with
 * the same key order. See docs/stats.md for the definition of every field.
 */

// biome-ignore lint/suspicious/noExplicitAny: authored JSON is walked untyped; every read is guarded.
type Rec = Record<string, any>;

/** A reference as authored: the string (a catalog id, URL, `pkg:` reference, tag or free text) or the inline record's id. */
export interface ReferenceFact {
  id: string | null;
  inline: boolean;
}
export interface SlideSizeFact {
  /** The preset name when one is set (`16:9`, `4:3`, `letter`, ...); null for custom inches. */
  preset: string | null;
  widthInches: number;
  heightInches: number;
  /** width / height, to 3 decimals. */
  aspectRatio: number;
  /** Where the size comes from: the deck's `design.dimensions`, its theme record, or the engine default (widescreen). */
  source: 'design' | 'theme' | 'default';
}
export interface StatsSlideRef {
  /** Zero-based position, the same index as `/slides/<index>`. */
  index: number;
  id: string | null;
}
export interface HeaderFooterFact {
  /** The deck sets this furniture. */
  configured: boolean;
  /** The deck sets it to `false`. */
  suppressed: boolean;
  zones: string[];
  /** Fields set in any zone: logo, image, text, organization, socials, section, slideNumber, date. */
  fields: string[];
}
export interface TableFact {
  slide: number;
  /** JSON Pointer of the table. */
  path: string;
  rows: number;
  columns: number;
  /** The top-level dataset the table takes its data from, if any. */
  dataset: string | null;
}
export interface DatasetFact {
  id: string;
  title: string | null;
  columns: number;
  rows: number;
  /** `source.src` when the dataset declares a source, else null. */
  source: string | null;
  /** Charts and tables that reference it. */
  referencedBy: number;
}
export interface SlideStats {
  index: number;
  id: string | null;
  title: string | null;
  layout: string | null;
  section: string | null;
  hidden: boolean;
  /** Content payload kinds present on the slide (root, blocks and regions), in a fixed order. */
  payloads: string[];
  words: { content: number; notes: number };
  hasNotes: boolean;
  /** Estimated speaking time for the notes at `wordsPerMinute`, in seconds. */
  speakingSeconds: number;
  images: number;
  charts: number;
  tables: number;
  citations: number;
}
export interface PresentationStats {
  deck: {
    name: string | null;
    description: boolean;
    filename: string | null;
    author: string[];
    language: ReferenceFact | null;
    slideSize: SlideSizeFact;
    template: boolean;
    tags: string[];
    takeaways: number;
    declaredMinutes: number | null;
    design: { theme: ReferenceFact | null; colorScheme: ReferenceFact | null; fontScheme: ReferenceFact | null };
    audience: ReferenceFact[];
    purpose: ReferenceFact | null;
    tone: ReferenceFact | null;
    narrative: (ReferenceFact & { beats: number }) | null;
  };
  people: {
    organizations: { id: string; name: string; role: string | null; hasLogo: boolean }[];
    speakers: { id: string; name: string; title: string | null; organizationId: string | null; hasPhoto: boolean }[];
  };
  slides: {
    total: number;
    hidden: StatsSlideRef[];
    withTitle: number;
    withoutTitle: number;
    withBeat: number;
    /** Consecutive slides sharing a `section` label. */
    sections: { name: string; slides: number; firstSlide: number }[];
    unsectioned: number;
    /** Slides per layout id. */
    layouts: Record<string, number>;
    withoutLayout: number;
    /** Slides whose own `design` object overrides the deck design. */
    withOwnDesign: number;
  };
  /** Content payloads by kind, counted across slide roots, blocks and promoted regions. */
  payloads: {
    text: number;
    items: number;
    bullets: number;
    quote: number;
    metric: number;
    code: number;
    timeline: number;
    chart: number;
    table: number;
    image: number;
    video: number;
    /** Block entries at any depth. */
    blocks: number;
    /** Promoted region payloads (`left`, `top:center`, ...). */
    regions: number;
    /** Blocks and regions that hold nested `blocks`. */
    groups: number;
    /** Deepest block nesting; 0 when no slide has blocks. */
    maxDepth: number;
  };
  words: {
    content: number;
    notes: number;
    total: number;
    /** Content words per slide. */
    perSlide: { min: number; max: number; mean: number };
  };
  notes: { withNotes: number; withoutNotes: StatsSlideRef[] };
  speakingTime: {
    basis: 'estimate';
    wordsPerMinute: number;
    notesWords: number;
    minutes: number;
    declaredMinutes: number | null;
  };
  images: {
    /** Image payloads (image blocks and `Slide.image`). */
    content: { total: number; withAlt: number; decorative: number; missingAlt: number };
    /** Logo images: `design.logo` (every LogoSet variant), deck and slides, plus organization logos. */
    logos: number;
    watermarks: { deck: boolean; slides: number };
    backgrounds: { deck: boolean; slides: number };
    headerFooter: number;
    speakerPhotos: number;
    videos: number;
  };
  charts: { total: number; byType: Record<string, number>; data: { inline: number; dataset: number; source: number } };
  tables: { total: number; datasetBacked: number; rows: number; columns: number; items: TableFact[] };
  datasets: { count: number; withSource: number; items: DatasetFact[] };
  citations: {
    references: number;
    /** Reference ids cited by at least one run, in declaration order. */
    cited: string[];
    /** Runs that cite. */
    citations: number;
    footnotes: number;
    captions: number;
    links: number;
  };
  variables: {
    declared: number;
    byKind: Record<string, number>;
    required: number;
    optional: number;
    filled: number;
    unfilled: string[];
    unfilledRequired: string[];
    /** Declared variables nothing references. */
    unused: string[];
  };
  assets: {
    registry: { entries: number; embedded: number; files: number; remote: number };
    /** Every asset-bearing field: images, videos, logos, photos, backgrounds, header/footer images, external chart data. */
    uses: { total: number; references: number; embedded: number; files: number; remote: number };
    /** Decoded size of the embedded `data:` URIs in `uses` and the registry. */
    embeddedBytes: number;
  };
  headerFooter: {
    header: HeaderFooterFact;
    footer: HeaderFooterFact;
    slides: { headerOverrides: number; headerSuppressed: number; footerOverrides: number; footerSuppressed: number };
  };
  fonts: {
    /** Every family named: by a font scheme in effect, an inline scheme, or a run's `fontFamily`. */
    families: string[];
    /** Font-scheme ids in effect (deck and slide overrides). */
    schemeIds: string[];
    /** Ids that match no inline or bundled record. */
    unresolvedSchemeIds: string[];
    runOverrides: string[];
  };
  colors: { variables: { id: string; value: string | null; uses: number }[] };
  /** Keys under `extensions` on the deck, slides and payloads. */
  extensions: string[];
  /** Per-kind inline catalog overrides. */
  catalogOverrides: Record<string, { records: number; source: string | null }>;
  /** Present only with `perSlide: true`. */
  perSlide?: SlideStats[];
}

export interface StatsOptions {
  /** Add the per-slide breakdown as `perSlide`. */
  perSlide?: boolean;
  /** Variable values to count as filled, as for `resolveVariables`. */
  values?: Record<string, unknown>;
  /** Speaking pace for the notes estimate. Default 130. */
  wordsPerMinute?: number;
}

const DEFAULT_WORDS_PER_MINUTE = 130;
const KIND_ORDER = ['text', 'items', 'bullets', 'quote', 'metric', 'code', 'timeline', 'chart', 'table', 'image', 'video'] as const;
const FURNITURE_FIELDS = ['logo', 'image', 'text', 'organization', 'socials', 'section', 'slideNumber', 'date'] as const;
const ZONES = ['left', 'center', 'right'] as const;
const LOGO_VARIANTS = ['default', 'light', 'dark', 'stacked', 'stackedLight', 'stackedDark', 'icon', 'iconLight', 'iconDark', 'wordmark', 'wordmarkLight', 'wordmarkDark'] as const;

const WORD = /[\p{L}\p{N}\p{M}]+(?:['’.,-][\p{L}\p{N}\p{M}]+)*/gu;
/** Scripts written without spaces between words (Thai, Lao, Myanmar, Khmer, kana, Han) count one unit per character: a fixed rule, so a count never depends on the runtime's ICU data. */
const UNSPACED = /[฀-໿က-႟ក-៿぀-ヿ㐀-䶿一-鿿豈-﫿]/gu;
const wordCount = (text: string): number => {
  let extra = 0;
  const spaced = text.replace(UNSPACED, () => { extra++; return ' '; });
  return (spaced.match(WORD)?.length ?? 0) + extra;
};

const sorted = <T extends string>(values: Iterable<T>): T[] => [...new Set(values)].sort();
const sortedCounts = (counts: Map<string, number>): Record<string, number> => Object.fromEntries([...counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const bump = (counts: Map<string, number>, key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const decimals = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

const reference = (value: unknown): ReferenceFact | null => {
  if (typeof value === 'string') return { id: value, inline: false };
  if (isRecord(value)) return { id: str(value.id), inline: true };
  return null;
};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : value === undefined ? [] : [value]);

type AssetForm = 'reference' | 'embedded' | 'remote' | 'file';
const assetForm = (src: string): AssetForm =>
  /^asset:/i.test(src) ? 'reference' : /^data:/i.test(src) ? 'embedded' : /^(https?:)?\/\//i.test(src) || /^pkg:/i.test(src) ? 'remote' : 'file';
const embeddedBytes = (src: string): number => {
  const comma = src.indexOf(',');
  if (comma < 0) return 0;
  const payload = src.slice(comma + 1);
  if (!/;base64$/i.test(src.slice(0, comma))) return payload.length;
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
};
const srcOf = (asset: unknown): string | undefined =>
  typeof asset === 'string' ? asset : isRecord(asset) && typeof asset.src === 'string' ? asset.src : undefined;

/** Resolve a catalog record by id from the deck's inline catalogs, then the bundled ones. */
const lookup = (deck: Rec, kind: 'themes' | 'fontSchemes', id: string): Rec | undefined => {
  const inline = deck.catalogs?.[kind]?.records;
  const found = (Array.isArray(inline) ? inline : []).find((record: Rec) => record?.id === id) ?? (catalogs[kind] as readonly Rec[]).find((record) => record.id === id);
  return isRecord(found) ? found : undefined;
};
const themeRecord = (deck: Rec, value: unknown): Rec => {
  if (typeof value === 'string') return lookup(deck, 'themes', value) ?? {};
  if (isRecord(value)) return { ...(typeof value.id === 'string' ? lookup(deck, 'themes', value.id) : undefined), ...value };
  return {};
};

function slideSize(deck: Rec): SlideSizeFact {
  const design = isRecord(deck.design) ? deck.design : {};
  const theme = themeRecord(deck, design.theme ?? 'minimal');
  const source: SlideSizeFact['source'] = design.dimensions !== undefined ? 'design' : theme.dimensions !== undefined ? 'theme' : 'default';
  const dimensions = design.dimensions ?? theme.dimensions;
  let width = 40 / 3, height = 7.5;
  try {
    const resolved = resolveCanvasDimensions(dimensions);
    width = resolved.width / 96; height = resolved.height / 96;
  } catch { /* an invalid size reads as the default; validate reports it */ }
  const preset = typeof dimensions === 'string' ? dimensions : isRecord(dimensions) && typeof dimensions.preset === 'string' && dimensions.widthInches === undefined && dimensions.heightInches === undefined ? dimensions.preset : null;
  return { preset, widthInches: decimals(width, 4), heightInches: decimals(height, 4), aspectRatio: decimals(width / height, 3), source };
}

const furniture = (value: unknown): HeaderFooterFact => {
  const zones: string[] = [], fields = new Set<string>();
  if (isRecord(value))
    for (const zone of ZONES) {
      const item = value[zone];
      if (!isRecord(item)) continue;
      const present = FURNITURE_FIELDS.filter((field) => item[field] !== undefined && item[field] !== false);
      if (present.length) { zones.push(zone); for (const field of present) fields.add(field); }
    }
  return { configured: isRecord(value), suppressed: value === false, zones, fields: FURNITURE_FIELDS.filter((field) => fields.has(field)) };
};

/** Visit every text run of a text-bearing value: a string, a number, a run array, a run, a list item, a styled cell or a column. */
function visitRuns(value: unknown, visit: (run: Rec) => void): void {
  if (typeof value === 'string') visit({ text: value });
  else if (typeof value === 'number') visit({ text: String(value) });
  else if (Array.isArray(value)) for (const entry of value) visitRuns(entry, visit);
  else if (isRecord(value)) {
    if (typeof value.text === 'string') { visit(value); if (value.description !== undefined) visitRuns(value.description, visit); }
    else if (Array.isArray(value.text)) { visitRuns(value.text, visit); if (value.description !== undefined) visitRuns(value.description, visit); }
    else if (value.value !== undefined) visitRuns(value.value, visit);
    else if (typeof value.name === 'string') visit({ text: value.name });
  }
}

interface Tally {
  words: number;
  citations: number;
  footnotes: number;
  links: number;
  cited: Set<string>;
  families: Set<string>;
}

export function stats(presentation: unknown, options: StatsOptions = {}): PresentationStats {
  if (!isRecord(presentation)) throw new TypeError('stats needs a presentation object.');
  const deck = presentation as Rec;
  const wordsPerMinute = options.wordsPerMinute ?? DEFAULT_WORDS_PER_MINUTE;
  if (!Number.isFinite(wordsPerMinute) || wordsPerMinute <= 0) throw new RangeError('wordsPerMinute must be a positive number.');
  const slides: Rec[] = Array.isArray(deck.slides) ? deck.slides.filter(isRecord) : [];
  const design = isRecord(deck.design) ? deck.design : {};
  const registry: Rec = isRecord(deck.assets) ? deck.assets : {};

  // ---- assets ------------------------------------------------------------------------------
  const uses = { total: 0, references: 0, embedded: 0, files: 0, remote: 0 };
  let embeddedTotal = 0;
  const useAsset = (asset: unknown): void => {
    const src = srcOf(asset);
    if (src === undefined) return;
    const form = assetForm(src);
    uses.total++;
    uses[form === 'reference' ? 'references' : form === 'embedded' ? 'embedded' : form === 'remote' ? 'remote' : 'files']++;
    if (form === 'embedded') embeddedTotal += embeddedBytes(src);
  };
  const registryFacts = { entries: 0, embedded: 0, files: 0, remote: 0 };
  for (const entry of Object.values(registry)) {
    const src = srcOf(entry);
    if (src === undefined) continue;
    registryFacts.entries++;
    const form = assetForm(src);
    if (form === 'embedded') { registryFacts.embedded++; embeddedTotal += embeddedBytes(src); }
    else if (form === 'remote') registryFacts.remote++;
    else if (form === 'file') registryFacts.files++;
  }
  const altOf = (asset: unknown): string | undefined => {
    if (isRecord(asset) && typeof asset.alt === 'string') return asset.alt;
    const src = srcOf(asset);
    if (src?.startsWith('asset:')) {
      const entry = registry[src.slice('asset:'.length)];
      if (isRecord(entry) && typeof entry.alt === 'string') return entry.alt;
    }
    return undefined;
  };

  const images = { content: { total: 0, withAlt: 0, decorative: 0, missingAlt: 0 }, logos: 0, watermarks: { deck: false, slides: 0 }, backgrounds: { deck: false, slides: 0 }, headerFooter: 0, speakerPhotos: 0, videos: 0 };
  const contentImage = (asset: unknown): number => {
    if (srcOf(asset) === undefined) return 0;
    useAsset(asset);
    images.content.total++;
    const alt = altOf(asset);
    if (alt === undefined || (alt !== '' && alt.trim() === '')) images.content.missingAlt++;
    else if (alt === '') images.content.decorative++;
    else images.content.withAlt++;
    return 1;
  };
  const logoImages = (value: unknown): void => {
    if (srcOf(value) !== undefined) { useAsset(value); images.logos++; return; }
    if (isRecord(value)) for (const variant of LOGO_VARIANTS) if (srcOf(value[variant]) !== undefined) { useAsset(value[variant]); images.logos++; }
  };
  const watermarkOf = (value: unknown): boolean => {
    if (value === undefined || value === false) return false;
    if (srcOf(value) !== undefined) useAsset(value);
    return srcOf(value) !== undefined;
  };
  const backgroundImage = (value: unknown): boolean => {
    const picture = imageBackground(value);
    if (!picture) return false;
    useAsset(picture.src);
    return true;
  };
  const furnitureImages = (value: unknown): void => {
    if (!isRecord(value)) return;
    for (const zone of ZONES) {
      const item = value[zone];
      if (isRecord(item) && srcOf(item.image) !== undefined) { useAsset(item.image); images.headerFooter++; }
    }
  };
  /** Deck or slide design: the asset-bearing fields (logo, watermark, background picture, header and footer images). */
  const designAssets = (value: unknown, scope: 'deck' | 'slide'): void => {
    if (!isRecord(value)) return;
    logoImages(value.logo);
    if (watermarkOf(value.watermark)) { if (scope === 'deck') images.watermarks.deck = true; else images.watermarks.slides++; }
    if (backgroundImage(value.background)) { if (scope === 'deck') images.backgrounds.deck = true; else images.backgrounds.slides++; }
    furnitureImages(value.header);
    furnitureImages(value.footer);
  };

  // ---- deck metadata -------------------------------------------------------------------------
  const organizations = list(deck.organization).filter(isRecord).map((entry) => {
    const hasLogo = srcOf(entry.logo) !== undefined;
    if (hasLogo) { useAsset(entry.logo); images.logos++; }
    return { id: str(entry.id) ?? '', name: str(entry.name) ?? '', role: str(entry.role), hasLogo };
  });
  const speakers = list(deck.speaker).filter(isRecord).map((entry) => {
    const hasPhoto = srcOf(entry.photo) !== undefined;
    if (hasPhoto) { useAsset(entry.photo); images.speakerPhotos++; }
    return { id: str(entry.id) ?? '', name: str(entry.name) ?? '', title: str(entry.title), organizationId: str(entry.organizationId), hasPhoto };
  });
  designAssets(design, 'deck');
  for (const variable of Object.values(isRecord(deck.variables) ? deck.variables : {})) if (isRecord(variable) && variable.type === 'image') useAsset(variable.value);

  const narrative = reference(deck.narrative);
  const deckFacts: PresentationStats['deck'] = {
    name: str(deck.name),
    description: typeof deck.description === 'string' && deck.description !== '',
    filename: str(deck.filename),
    author: list(deck.author).filter((entry): entry is string => typeof entry === 'string'),
    language: reference(deck.language),
    slideSize: slideSize(deck),
    template: deck.template === true,
    tags: Array.isArray(deck.tags) ? deck.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    takeaways: list(deck.takeaway).filter((entry) => typeof entry === 'string').length,
    declaredMinutes: typeof deck.duration === 'number' ? deck.duration : null,
    design: { theme: reference(design.theme), colorScheme: reference(design.colorScheme), fontScheme: reference(design.fontScheme) },
    audience: list(deck.audience).flatMap((entry) => reference(entry) ?? []),
    purpose: reference(deck.purpose),
    tone: reference(deck.tone),
    narrative: narrative ? { ...narrative, beats: isRecord(deck.narrative) && Array.isArray(deck.narrative.beats) ? deck.narrative.beats.length : 0 } : null,
  };

  // ---- datasets ------------------------------------------------------------------------------
  const datasetRecords: [string, Rec][] = isRecord(deck.datasets) ? (Object.entries(deck.datasets).filter(([, value]) => isRecord(value)) as [string, Rec][]) : [];
  const datasetUse = new Map<string, number>();

  // ---- slides --------------------------------------------------------------------------------
  const payloadCounts = { text: 0, items: 0, bullets: 0, quote: 0, metric: 0, code: 0, timeline: 0, chart: 0, table: 0, image: 0, video: 0, blocks: 0, regions: 0, groups: 0, maxDepth: 0 };
  const layouts = new Map<string, number>(), chartTypes = new Map<string, number>(), extensions = new Set<string>();
  const chartData = { inline: 0, dataset: 0, source: 0 };
  const tableItems: TableFact[] = [];
  let tableRows = 0, tableColumns = 0, datasetBackedTables = 0, chartTotal = 0, captions = 0;
  const hidden: StatsSlideRef[] = [], withoutNotes: StatsSlideRef[] = [], sections: PresentationStats['slides']['sections'] = [];
  let withTitle = 0, withBeat = 0, unsectioned = 0, withoutLayout = 0, withOwnDesign = 0, withNotes = 0, contentWords = 0, notesWords = 0;
  const headerOverrides = { header: 0, headerSuppressed: 0, footer: 0, footerSuppressed: 0 };
  const total: Tally = { words: 0, citations: 0, footnotes: 0, links: 0, cited: new Set(), families: new Set() };
  const perSlide: SlideStats[] = [];
  const contentPerSlide: number[] = [];
  const schemeReferences: unknown[] = [];
  const deckTheme = themeRecord(deck, design.theme ?? 'minimal');
  schemeReferences.push(design.fontScheme ?? deckTheme.fontScheme ?? DEFAULT_FONT_SCHEME);

  slides.forEach((slide, index) => {
    const id = str(slide.id);
    const ref: StatsSlideRef = { index, id };
    const slideDesign = isRecord(slide.design) ? slide.design : undefined;
    const slideTally: Tally = { words: 0, citations: 0, footnotes: 0, links: 0, cited: new Set(), families: new Set() };
    const kinds = new Set<string>();
    let slideImages = 0, slideCharts = 0, slideTables = 0;

    const count = (text: string) => { slideTally.words += wordCount(text); };
    const run = (value: unknown) => visitRuns(value, (entry) => {
      count(entry.text as string);
      if (typeof entry.link === 'string' && entry.link !== '') slideTally.links++;
      if (entry.cite !== undefined) {
        slideTally.citations++;
        for (const cite of list(entry.cite)) if (typeof cite === 'string') slideTally.cited.add(cite);
      }
      if (entry.footnote !== undefined) slideTally.footnotes++;
      if (typeof entry.fontFamily === 'string' && entry.fontFamily !== '') slideTally.families.add(entry.fontFamily);
    });
    const caption = (node: Rec) => { if (node.caption !== undefined) { captions++; run(node.caption); } };

    const visitNode = (node: Rec, path: string, depth: number, kind: 'root' | 'block' | 'region') => {
      if (kind === 'block') payloadCounts.blocks++;
      if (kind === 'region') payloadCounts.regions++;
      if (kind !== 'root' && Array.isArray(node.blocks)) payloadCounts.groups++;
      if (depth > payloadCounts.maxDepth) payloadCounts.maxDepth = depth;
      for (const key of KIND_ORDER) if (node[key] !== undefined) { payloadCounts[key]++; kinds.add(key); }
      if (isRecord(node.extensions)) for (const key of Object.keys(node.extensions)) extensions.add(key);
      run(node.text); run(node.items); run(node.bullets);
      caption(node);
      if (node.quote !== undefined) { const quote = node.quote; if (isRecord(quote)) { run(quote.text); run(quote.attribution); run(quote.source); } else run(quote); }
      if (isRecord(node.metric)) { run(node.metric.value); run(node.metric.label); run(node.metric.description); run(node.metric.unit); run(node.metric.delta); }
      if (node.timeline !== undefined) {
        const timeline = node.timeline, events = Array.isArray(timeline) ? timeline : isRecord(timeline) && Array.isArray(timeline.events) ? timeline.events : [];
        if (isRecord(timeline)) { run(timeline.name); run(timeline.description); }
        for (const event of events) if (isRecord(event)) { run(event.when); run(event.what); run(event.description); }
      }
      if (node.image !== undefined) slideImages += contentImage(node.image);
      if (node.video !== undefined) { useAsset(node.video); images.videos++; }
      if (isRecord(node.chart)) {
        chartTotal++; slideCharts++;
        bump(chartTypes, str(node.chart.type) ?? 'unknown');
        const data = node.chart.data;
        if (isRecord(data)) {
          if (typeof data.dataset === 'string') { chartData.dataset++; bump(datasetUse, data.dataset); }
          else if (Array.isArray(data.columns) || Array.isArray(data.rows)) chartData.inline++;
          else if (typeof data.src === 'string') { chartData.source++; useAsset(data.src); }
        }
      }
      if (isRecord(node.table)) {
        slideTables++;
        const table = node.table;
        let rows = 0, columns = 0, dataset: string | null = null;
        if (typeof table.dataset === 'string') {
          dataset = table.dataset; datasetBackedTables++; bump(datasetUse, dataset);
          const source: Rec | undefined = isRecord(deck.datasets) && isRecord(deck.datasets[dataset]) ? (deck.datasets[dataset] as Rec) : undefined;
          rows = Array.isArray(source?.rows) ? source.rows.length : 0;
          columns = Array.isArray(table.fields) ? table.fields.length : Array.isArray(source?.columns) ? source.columns.length : 0;
        } else {
          const body = Array.isArray(table.rows) ? table.rows : [];
          rows = body.length;
          columns = Array.isArray(table.columns) ? table.columns.length : body.reduce((widest: number, row: unknown) => Math.max(widest, Array.isArray(row) ? row.length : 0), 0);
          run(table.columns);
          for (const row of body) run(row);
        }
        tableRows += rows; tableColumns += columns;
        tableItems.push({ slide: index, path: `${path}/table`, rows, columns, dataset });
      }
    };

    // The slide is its own root payload; blocks and regions below it are walked by the shared content walk.
    run(slide.title); run(slide.subtitle); run(slide.tag);
    const slidePath = `/slides/${index}`;
    visitNode(slide, slidePath, 0, 'root');
    visitContentPayloads(slide, slidePath, (node, path) => {
      // `blocks/0`, `blocks/0/blocks/1`, `left/blocks/2` are blocks (depth = nesting of `blocks`); `left`, `top:center` are regions.
      const relative = path.slice(slidePath.length + 1);
      visitNode(node, path, (relative.match(/(^|\/)blocks\//g) ?? []).length, /(^|\/)blocks\/\d+$/.test(relative) ? 'block' : 'region');
    });

    const notes = typeof slide.notes === 'string' ? slide.notes : '';
    const noteWords = wordCount(notes);
    const hasNotes = notes.trim() !== '';
    if (hasNotes) withNotes++; else withoutNotes.push(ref);
    notesWords += noteWords;
    contentWords += slideTally.words;
    contentPerSlide.push(slideTally.words);
    total.citations += slideTally.citations; total.footnotes += slideTally.footnotes; total.links += slideTally.links;
    for (const cite of slideTally.cited) total.cited.add(cite);
    for (const family of slideTally.families) total.families.add(family);

    const title = typeof slide.title === 'string' && slide.title.trim() !== '' ? slide.title : null;
    if (title) withTitle++;
    if (slide.beat !== undefined) withBeat++;
    if (slide.hidden === true) hidden.push(ref);
    const layout = str(slide.layout);
    if (layout) bump(layouts, layout); else withoutLayout++;
    const section = str(slide.section);
    if (section !== null && section !== '') {
      const last = sections.at(-1);
      if (last && last.name === section && last.firstSlide + last.slides === index) last.slides++;
      else sections.push({ name: section, slides: 1, firstSlide: index });
    } else unsectioned++;
    if (slideDesign) {
      withOwnDesign++;
      designAssets(slideDesign, 'slide');
      for (const kind of ['header', 'footer'] as const) {
        if (slideDesign[kind] === false) headerOverrides[`${kind}Suppressed`]++;
        else if (isRecord(slideDesign[kind])) headerOverrides[kind]++;
      }
      // A slide's own scheme wins; its own theme supplies one only when the deck names no scheme (slide design overrides deck design per field).
      if (slideDesign.fontScheme !== undefined) schemeReferences.push(slideDesign.fontScheme);
      else if (slideDesign.theme !== undefined && design.fontScheme === undefined) schemeReferences.push(themeRecord(deck, slideDesign.theme).fontScheme ?? DEFAULT_FONT_SCHEME);
    }

    if (options.perSlide)
      perSlide.push({
        index, id, title, layout, section: section === '' ? null : section, hidden: slide.hidden === true,
        payloads: KIND_ORDER.filter((kind) => kinds.has(kind)),
        words: { content: slideTally.words, notes: noteWords },
        hasNotes,
        speakingSeconds: Math.round((noteWords / wordsPerMinute) * 60),
        images: slideImages, charts: slideCharts, tables: slideTables, citations: slideTally.citations,
      });
  });
  if (isRecord(deck.extensions)) for (const key of Object.keys(deck.extensions)) extensions.add(key);

  // ---- datasets, references, variables, fonts --------------------------------------------------
  const datasetItems: DatasetFact[] = datasetRecords.map(([id, value]) => ({
    id,
    title: str(value.title),
    columns: Array.isArray(value.columns) ? value.columns.length : 0,
    rows: Array.isArray(value.rows) ? value.rows.length : 0,
    source: isRecord(value.source) ? str(value.source.src) : null,
    referencedBy: datasetUse.get(id) ?? 0,
  }));
  const references = Array.isArray(deck.references) ? deck.references.filter(isRecord) : [];
  const referenceIds = references.map((entry) => str(entry.id)).filter((entry): entry is string => entry !== null);
  const cited = referenceIds.filter((entry) => total.cited.has(entry));

  const variables = listVariables(deck, isRecord(options.values) ? options.values : {});
  const byKind = new Map<string, number>();
  for (const variable of variables) bump(byKind, variable.kind as VariableKind);
  const variableFacts: PresentationStats['variables'] = {
    declared: variables.length,
    byKind: sortedCounts(byKind),
    required: variables.filter((variable) => variable.required).length,
    optional: variables.filter((variable) => !variable.required).length,
    filled: variables.filter((variable) => variable.filled).length,
    unfilled: variables.filter((variable) => !variable.filled).map((variable) => variable.id),
    unfilledRequired: variables.filter((variable) => !variable.filled && variable.required).map((variable) => variable.id),
    unused: variables.filter((variable) => variable.uses.length === 0).map((variable) => variable.id),
  };

  const families = new Set<string>(total.families), schemeIds = new Set<string>(), unresolved = new Set<string>();
  const addScheme = (value: unknown) => {
    const resolved = resolveFontSchemeReference(value, (id) => lookup(deck, 'fontSchemes', id));
    if (resolved.diagnostic) unresolved.add(resolved.diagnostic.id);
    const id = typeof value === 'string' ? value : isRecord(value) && typeof value.id === 'string' ? value.id : undefined;
    if (id !== undefined) schemeIds.add(id);
    const scheme = resolved.scheme;
    const named = resolveFontFamilies(scheme);
    families.add(named.heading); families.add(named.body);
    if (scheme.code !== undefined) families.add(named.code);
    if (named.accent) families.add(named.accent);
  };
  for (const entry of schemeReferences) addScheme(entry);

  // Inline catalogs are records the deck carries; a deck can also hold unused ones, so only counts are reported.
  const catalogOverrides: PresentationStats['catalogOverrides'] = {};
  if (isRecord(deck.catalogs))
    for (const kind of Object.keys(deck.catalogs).sort()) {
      const entry = deck.catalogs[kind];
      if (isRecord(entry)) catalogOverrides[kind] = { records: Array.isArray(entry.records) ? entry.records.length : 0, source: str(entry.source) };
    }

  const colorVariables = variables.filter((variable) => variable.kind === 'color').map((variable) => ({ id: variable.id, value: typeof variable.value === 'string' ? variable.value : null, uses: variable.uses.length }));
  const contentMean = slides.length ? decimals(contentWords / slides.length, 1) : 0;

  const result: PresentationStats = {
    deck: deckFacts,
    people: { organizations, speakers },
    slides: {
      total: slides.length, hidden, withTitle, withoutTitle: slides.length - withTitle, withBeat, sections, unsectioned,
      layouts: sortedCounts(layouts), withoutLayout, withOwnDesign,
    },
    payloads: payloadCounts,
    words: {
      content: contentWords, notes: notesWords, total: contentWords + notesWords,
      perSlide: { min: contentPerSlide.length ? Math.min(...contentPerSlide) : 0, max: contentPerSlide.length ? Math.max(...contentPerSlide) : 0, mean: contentMean },
    },
    notes: { withNotes, withoutNotes },
    speakingTime: { basis: 'estimate', wordsPerMinute, notesWords, minutes: decimals(notesWords / wordsPerMinute, 1), declaredMinutes: deckFacts.declaredMinutes },
    images,
    charts: { total: chartTotal, byType: sortedCounts(chartTypes), data: chartData },
    tables: { total: tableItems.length, datasetBacked: datasetBackedTables, rows: tableRows, columns: tableColumns, items: tableItems },
    datasets: { count: datasetItems.length, withSource: datasetItems.filter((item) => item.source !== null).length, items: datasetItems },
    citations: { references: references.length, cited, citations: total.citations, footnotes: total.footnotes, captions, links: total.links },
    variables: variableFacts,
    assets: { registry: registryFacts, uses, embeddedBytes: embeddedTotal },
    headerFooter: {
      header: furniture(design.header),
      footer: furniture(design.footer),
      slides: { headerOverrides: headerOverrides.header, headerSuppressed: headerOverrides.headerSuppressed, footerOverrides: headerOverrides.footer, footerSuppressed: headerOverrides.footerSuppressed },
    },
    fonts: { families: sorted(families), schemeIds: sorted(schemeIds), unresolvedSchemeIds: sorted(unresolved), runOverrides: sorted(total.families) },
    colors: { variables: colorVariables },
    extensions: sorted(extensions),
    catalogOverrides,
  };
  if (options.perSlide) result.perSlide = perSlide;
  return result;
}
