/**
 * PPTX.dev Open Source Presentation Format (OPF) v1.0
 *
 * A JSON-based file format for describing PowerPoint presentations.
 * Agents describe narratives, content, audience, and design intent —
 * the engine handles the OOXML complexity.
 *
 * Licensed under MIT
 */

// ─── Top-Level Document ──────────────────────────────────────────────

export interface OPFDocument {
  /** Identifies the OPF schema version for validators and editors */
  $schema: "https://pptx.dev/schema/opf/v1";

  /** High-level presentation metadata */
  meta: OPFMeta;

  /** Design system: colors, fonts, spacing, brand */
  design: OPFDesign;

  /** Ordered array of slides */
  slides: OPFSlide[];

  /** Optional custom data passthrough for agent workflows */
  extensions?: Record<string, unknown>;
}

// ─── Metadata ────────────────────────────────────────────────────────

export interface OPFMeta {
  title: string;
  /**
   * Free-form prose describing what this presentation is about. Used by
   * agents and humans as a deck-level summary; complements `meta.purpose`
   * (the goal) and `meta.narrative` (the structured storyline).
   */
  description?: string;
  /**
   * Optional base filename for exports (without extension). The engine
   * silently normalizes whitespace, drops a trailing `.`, and strips one
   * trailing recognized export extension (`.pptx`, `.pdf`, `.png`, `.svg`,
   * case-insensitive) before appending the target format's extension.
   * When omitted, the engine slugifies `meta.title`.
   */
  filename?: string;
  subtitle?: string;
  /**
   * Organizations associated with the presentation (presenting company,
   * host, partners, clients, sponsors). The primary organization
   * (`role: "primary"`, or first item if no role is set) drives default
   * branding such as cover-slide logo.
   */
  organizations?: OPFOrganization[];
  /**
   * People presenting the deck. Used for cover slides, bio slides,
   * footers, and panel attribution.
   */
  speakers?: OPFSpeaker[];
  /**
   * Optional credit list for people who authored or contributed to the
   * deck, distinct from speakers. Use when the writer and presenter
   * differ (e.g., analyst-written, exec-presented).
   */
  authors?: string[];
  /**
   * Intended audience. Free-form description or a catalog id resolved
   * against `catalogs.audiences` (default: https://www.pptx.gallery/audiences).
   */
  audience?: string;
  purpose?: string;
  /**
   * Structured storyline. String shorthand (catalog id, URL, or `pkg:`
   * reference) for the common case; object form for inline overrides or
   * fully custom narratives. Object shape mirrors
   * https://pptx.dev/schema/opf-narrative/v1 (sans `$schema`).
   */
  narrative?: string | OPFNarrative;
  /**
   * Language for the presentation content. BCP-47 tag or catalog id
   * resolved against `catalogs.languages`.
   */
  language?: string;
  /**
   * Desired tone. Resolves to the `id` of a `tones` catalog record.
   * Historical enum values (`formal`, `casual`, `inspirational`,
   * `technical`, `persuasive`) are valid catalog ids.
   */
  tone?: string;
  /** Key messages the presentation should convey. */
  keyMessages?: string[];
  /** Target presentation duration in minutes. */
  durationMinutes?: number;
  /**
   * Free-form labels used for categorization, search, and filtering.
   * Lowercase kebab-case is recommended for consistency.
   */
  tags?: string[];
}

/**
 * An organization associated with the presentation — typically the
 * presenting company, but also hosts, partners, clients, or sponsors.
 * Surfaced on cover slides, footers, and brand bars; the primary
 * organization's logo is the default for `design.brand.logo` unless
 * overridden.
 */
export interface OPFOrganization {
  /** Stable identifier, referenced by `OPFSpeaker.organizationId`. Must be unique within the deck. */
  id: string;
  /** Display name shown on slides. */
  name: string;
  /** Optional legal entity name when it differs from the display name. */
  legalName?: string;
  /**
   * Source for the organization's logo image. Accepts an HTTPS URL,
   * data URI, relative path, or asset reference. The primary
   * organization's logo is used by default for cover-slide and footer
   * branding; `design.brand.logo` overrides both source and rendering.
   */
  logo?: string;
  /** Bare internet domain (e.g., "acme.com"). */
  domain?: string;
  /** General contact email (e.g., "hello@acme.com"). */
  email?: string;
  /**
   * Main contact phone number. E.164 format is recommended
   * (e.g., "+14155551234").
   */
  phone?: string;
  /** Short tagline rendered alongside the organization name. */
  tagline?: string;
  /**
   * Role of the organization relative to the presentation. When omitted,
   * the first organization in the array is treated as primary.
   */
  role?: "primary" | "partner" | "client" | "sponsor" | "host";
  socials?: OPFSocials;
}

/**
 * A person presenting the deck. Used for cover slides, bio/intro slides,
 * footer attribution, and panel formats with multiple presenters.
 */
export interface OPFSpeaker {
  /** Stable identifier for cross-references within the deck. Must be unique within the deck. */
  id: string;
  /** Display name. */
  name: string;
  /** Role or title (e.g., "VP of Engineering"). */
  title?: string;
  /** URL or asset reference for the speaker's headshot. */
  photo?: string;
  /** Contact email. */
  email?: string;
  /**
   * Contact phone number. E.164 format is recommended
   * (e.g., "+14155551234").
   */
  phone?: string;
  /** Short biographical paragraph for bio slides. */
  bio?: string;
  /** Reference to an `OPFOrganization.id` in `meta.organizations`. */
  organizationId?: string;
  socials?: OPFSocials;
}

/**
 * Social media handles or URLs, keyed by platform id from the `socials`
 * catalog (https://pptx.dev/schema/opf-social/v1 — default catalog at
 * https://www.pptx.gallery/socials). Each value is a string — either a
 * full URL or a platform handle (e.g., "@acme"). The catalog record for
 * each platform carries the URL pattern, handle prefix, brand color, and
 * themed icons used by renderers. Used both for organizations and
 * speakers.
 *
 * Common platform ids: `linkedin`, `x`, `github`, `youtube`, `instagram`,
 * `facebook`, `tiktok`, `threads`, `mastodon`, `bluesky`. Unknown ids
 * render with engine fallbacks.
 */
export type OPFSocials = Record<string, string>;

/**
 * Structured storyline used by AI to shape generated content. Mirrors the
 * OPF Narrative Template record at https://pptx.dev/schema/opf-narrative/v1
 * (sans `$schema`), so a library record and an inline narrative are
 * interchangeable.
 *
 * When `id` matches a record in the resolved `narratives` catalog, the
 * inline fields override matching fields on the catalog record (beats merge
 * by beat `id`). When `id` doesn't match, this object defines a fully
 * custom inline narrative.
 *
 * Deck-level concerns that aren't part of the storyline (audience, tone,
 * key messages, duration) live as siblings on `meta` rather than inside
 * this object.
 */
export interface OPFNarrative {
  /**
   * Stable slug identifying this narrative. Resolves to the `id` of a
   * `narratives` catalog record when it matches; otherwise this is a
   * fully custom inline narrative. Lowercase kebab-case.
   */
  id?: string;
  /** Human-readable narrative name. */
  name?: string;
  /** One-sentence description of when and why to use this narrative. */
  summary?: string;
  /**
   * Longer prose describing the narrative arc. Used by AI-driven
   * generation to seed deck-level direction.
   */
  description?: string;
  /** Audiences this narrative works well for. */
  audienceFit?: string[];
  /** Typical talk-length window this narrative suits. */
  durationRange?: { minMinutes?: number; maxMinutes?: number };
  /** Free-form labels for filtering and search. */
  tags?: string[];
  /** Visual previews used by picker UIs and inline rendering. */
  preview?: { src?: string; thumbnailSrc?: string; vectorSrc?: string };
  /**
   * Ordered list of beats that make up the narrative arc. When `id`
   * matches a catalog record, beats here override or extend matching
   * catalog beats by their own `id`. Beat IDs must be unique within the
   * narrative.
   */
  beats?: OPFNarrativeBeat[];
}

/**
 * A single narrative beat — a labeled segment of the story arc with a
 * specific dramatic purpose (e.g. "hook", "problem", "evidence", "ask").
 * Slides reference beats via `Slide.beat`. Mirrors the Beat definition in
 * narrative.schema.json (https://pptx.dev/schema/opf-narrative/v1) so
 * library entries and inline OPF beats are interchangeable.
 */
export interface OPFNarrativeBeat {
  /**
   * Stable slug used by `Slide.beat` to reference this beat.
   * Lowercase kebab-case.
   */
  id: string;
  /** Human-readable beat name, e.g. "The Problem" */
  name: string;
  /**
   * What this beat should accomplish. Used as a prompt for AI-driven
   * generation of slides assigned to this beat.
   */
  description?: string;
  /** Short author-facing instruction for the beat — typically one phrase. */
  instructions?: string;
  /**
   * Optional explicit slide count for this beat. Defaults to 1 when omitted;
   * values >1 are reserved for beats that intentionally span multiple slides.
   * Prefer decomposing a heavy beat into multiple beats over setting a high
   * slideCount. The validator emits a warning if the deck's actual count
   * differs significantly.
   */
  slideCount?: number;
  /** Default content kind for the beat's slide. */
  slideType?: "text" | "image" | "chart" | "table" | "code";
  /** Suggested layout for the opening slide of this beat */
  layoutHint?: string;
  /** Optional speaker prompts or thinking cues attached to the beat. */
  thoughtCues?: string[];
}

// ─── Design System ───────────────────────────────────────────────────

export interface OPFDesign {
  /**
   * Theme reference. Resolves to the `id` of a `themes` catalog record
   * (default catalog: https://www.pptx.gallery/themes).
   */
  theme?: string;

  /**
   * Color palette. String shorthand (catalog id, URL, or `pkg:` reference)
   * for the common case; object form for the `scheme` ref plus slot/role
   * overrides. Slot fields mirror color-scheme.schema.json
   * (https://pptx.dev/schema/opf-color-scheme/v1).
   */
  colors?: string | OPFColorScheme;

  /**
   * Typography. String shorthand (catalog id, URL, or `pkg:` reference)
   * for the common case; object form for the `scheme` ref plus pair/role
   * overrides. Pair fields mirror font-scheme.schema.json
   * (https://pptx.dev/schema/opf-font-scheme/v1).
   */
  fonts?: string | OPFFontScheme;

  /** Slide dimensions */
  dimensions?: OPFDimensions;

  /** Background defaults */
  background?: OPFBackground;

  /** Logo / brand assets */
  brand?: OPFBrand;

  /** Layout preference hints */
  layoutPreferences?: OPFLayoutPreferences;
}

export interface OPFColorScheme {
  /**
   * Color scheme reference (OPF-specific; not part of the catalog record
   * schema). Resolves to the `id` of a `colorSchemes` catalog record.
   */
  scheme?: string;
  /** OOXML accent slots (mirror color-scheme.schema.json). */
  accent1?: string;
  accent2?: string;
  accent3?: string;
  accent4?: string;
  accent5?: string;
  accent6?: string;
  /** OOXML neutral slots. */
  dark1?: string;
  dark2?: string;
  light1?: string;
  light2?: string;
  /** OOXML hyperlink colors. */
  hyperlink?: string;
  followedHyperlink?: string;
  /** Abstract roles (OPF-specific authoring conveniences). */
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  surface?: string;
  text?: string;
  textSecondary?: string;
  /** Custom named colors for advanced use. */
  custom?: Record<string, string>;
}

export interface OPFFontScheme {
  /**
   * Font scheme reference (OPF-specific; not part of the catalog record
   * schema). Resolves to the `id` of a `fontSchemes` catalog record.
   */
  scheme?: string;
  /** OOXML majorFont (heading) family — mirrors font-scheme.schema.json. */
  major?: string;
  /** OOXML minorFont (body) family — mirrors font-scheme.schema.json. */
  minor?: string;
  /** High-level typographic class. */
  type?: "sans-serif" | "serif" | "monospace";
  /** Target application. */
  app?: "PowerPoint" | "Google Slides";
  /** OOXML font-language family. */
  languageFamily?: "latin" | "ea" | "cs";
  /** Abstract roles (OPF-specific authoring conveniences). */
  heading?: OPFFont;
  body?: OPFFont;
  accent?: OPFFont;
  code?: OPFFont;
}

export interface OPFFont {
  family: string;
  weight?: number;
  style?: "normal" | "italic";
  letterSpacing?: number;
}

export interface OPFDimensions {
  /** Preset: "16:9" | "4:3" | "16:10" | "letter" | "a4" */
  preset?: string;
  /** Custom width in inches */
  widthInches?: number;
  /** Custom height in inches */
  heightInches?: number;
}

export interface OPFBackground {
  type: "solid" | "gradient" | "image" | "pattern";
  color?: string;
  gradient?: { angle: number; stops: { color: string; position: number }[] };
  image?: { src: string; fit: "cover" | "contain" | "tile" };
  opacity?: number;
}

/**
 * Visual brand assets surfaced across slides. Organization identity
 * (name, primary logo) lives in `meta.organizations`; this object only
 * carries visual overrides and decorative marks. All logo / icon /
 * wordmark fields are bare source strings — placement and sizing are
 * determined by slide layouts, not by this object.
 *
 * The schema offers three asset types (logo, icon, wordmark) plus a
 * decorative watermark, and for each, two themed variants (Light, Dark).
 * The logo additionally supports a `Stacked` aspect (icon-over-wordmark,
 * suited to vertical / square slots). Naming follows brand-asset-library
 * convention:
 *
 * - `*Light` = light-colored variant (e.g., white SVG), intended for
 *   rendering on dark backgrounds.
 * - `*Dark` = dark-colored variant (e.g., black SVG), intended for
 *   rendering on light backgrounds.
 * - `Stacked` = vertical lockup (icon above wordmark); the unsuffixed
 *   forms are assumed to be horizontal lockups.
 * - The unsuffixed field (`logo` / `icon` / `wordmark` / `watermark`)
 *   is the default fallback when no themed variant is needed.
 *
 * Engine resolution: on a dark slide background, prefer the `*Light`
 * variant; on a light slide background, prefer the `*Dark` variant; for
 * vertical / square brand-mark slots, prefer the `logoStacked*` family
 * over the horizontal logo; otherwise fall back to the unsuffixed asset
 * and (for the logo) ultimately to `meta.organizations[primary].logo`.
 */
export interface OPFBrand {
  /**
   * Default full-lockup logo. Optional override of
   * `meta.organizations[primary].logo`.
   */
  logo?: string;
  /** Light-colored logo variant for dark backgrounds. */
  logoLight?: string;
  /** Dark-colored logo variant for light backgrounds. */
  logoDark?: string;
  /**
   * Stacked (vertical) lockup with the icon above the wordmark.
   * Suited to portrait / square brand-mark slots; falls back to `logo`
   * when not set.
   */
  logoStacked?: string;
  /** Light-colored stacked logo variant for dark backgrounds. */
  logoStackedLight?: string;
  /** Dark-colored stacked logo variant for light backgrounds. */
  logoStackedDark?: string;
  /** Default icon / mark / symbol (no wordmark). */
  icon?: string;
  /** Light-colored icon variant for dark backgrounds. */
  iconLight?: string;
  /** Dark-colored icon variant for light backgrounds. */
  iconDark?: string;
  /** Default wordmark — company name in branded typography, no icon. */
  wordmark?: string;
  /** Light-colored wordmark variant for dark backgrounds. */
  wordmarkLight?: string;
  /** Dark-colored wordmark variant for light backgrounds. */
  wordmarkDark?: string;
  /** Default decorative watermark applied across slides. */
  watermark?: OPFBrandWatermark;
  /** Light-colored watermark variant for dark backgrounds. */
  watermarkLight?: OPFBrandWatermark;
  /** Dark-colored watermark variant for light backgrounds. */
  watermarkDark?: OPFBrandWatermark;
}

/** Decorative watermark image and its rendering opacity. */
export interface OPFBrandWatermark {
  src: string;
  /** Opacity from 0 (fully transparent) to 1 (fully opaque). */
  opacity?: number;
}

export interface OPFLayoutPreferences {
  /** Default content density: "minimal" | "balanced" | "dense" */
  density?: string;
  /** Default alignment: "left" | "center" | "right" */
  alignment?: string;
  /** Use animations */
  animations?: boolean;
  /** Slide numbering */
  slideNumbers?: boolean;
}

// ─── Slides ──────────────────────────────────────────────────────────

export interface OPFSlide {
  /** Unique ID within the document */
  id: string;

  /** Layout type — references pptx.gallery layouts or custom */
  layout: string;

  /** Slide-level overrides to design */
  designOverrides?: Partial<OPFDesign>;

  /** Content elements on this slide */
  elements: OPFElement[];

  /** Speaker notes for this slide */
  notes?: string;

  /** Transition to this slide */
  transition?: OPFTransition;

  /** Whether this slide is hidden */
  hidden?: boolean;

  /** Section marker — groups slides in presenter view */
  section?: string;

  /**
   * Optional reference to one or more narrative beats (each value matches
   * an `id` from `meta.narrative.beats` or the resolved template). A single
   * string declares the slide's primary beat; an array declares that one
   * slide covers multiple beats — useful when shorter decks fold beats
   * together (e.g. `["problem", "why-now"]`). Declares the slide's role in
   * the story arc; does not constrain ordering or structure. Slides without
   * a beat are valid; multiple slides may share a beat.
   */
  beat?: string | string[];
}

export interface OPFTransition {
  type: "none" | "fade" | "slide" | "push" | "wipe" | "morph" | "zoom";
  duration?: number;
  direction?: "left" | "right" | "up" | "down";
}

// ─── Elements ────────────────────────────────────────────────────────

export type OPFElement =
  | OPFTextElement
  | OPFImageElement
  | OPFShapeElement
  | OPFChartElement
  | OPFTableElement
  | OPFVideoElement
  | OPFCodeElement
  | OPFGroupElement
  | OPFPlaceholderElement;

export interface OPFElementBase {
  id: string;
  type: string;
  position?: OPFPosition;
  size?: OPFSize;
  /** Animation on this element */
  animation?: OPFAnimation;
  /** Named slot from layout template, e.g. "title", "body", "image-right" */
  slot?: string;
}

export interface OPFPosition {
  x?: number;
  y?: number;
  /** Anchor to layout grid: "top-left" | "center" | "bottom-right" etc. */
  anchor?: string;
}

export interface OPFSize {
  width?: number;
  height?: number;
  /** Unit: "in" (inches), "%" (percentage of slide), "px" */
  unit?: "in" | "%" | "px";
}

export interface OPFAnimation {
  type: "appear" | "fadeIn" | "slideIn" | "zoomIn" | "typewriter" | "custom";
  delay?: number;
  duration?: number;
  order?: number;
}

// ─── Text ────────────────────────────────────────────────────────────

export interface OPFTextElement extends OPFElementBase {
  type: "text";
  content: OPFTextContent;
  style?: OPFTextStyle;
}

export interface OPFTextContent {
  /** Simple text string — for basic use */
  text?: string;
  /** Rich text with formatting runs */
  runs?: OPFTextRun[];
  /** Markdown source — converted to runs by engine */
  markdown?: string;
  /** Bullet list */
  bullets?: (string | OPFTextContent)[];
  /** Numbered list */
  numbered?: (string | OPFTextContent)[];
}

export interface OPFTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  link?: string;
  superscript?: boolean;
  subscript?: boolean;
}

export interface OPFTextStyle {
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  alignment?: "left" | "center" | "right" | "justify";
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  verticalAlignment?: "top" | "middle" | "bottom";
}

// ─── Image ───────────────────────────────────────────────────────────

export interface OPFImageElement extends OPFElementBase {
  type: "image";
  src: string;
  alt?: string;
  fit?: "cover" | "contain" | "fill" | "none";
  borderRadius?: number;
  shadow?: boolean;
  caption?: string;
}

// ─── Shape ───────────────────────────────────────────────────────────

export interface OPFShapeElement extends OPFElementBase {
  type: "shape";
  shape: "rectangle" | "circle" | "ellipse" | "triangle" | "arrow" | "line" | "star" | "callout" | "custom";
  fill?: string;
  stroke?: { color: string; width: number };
  cornerRadius?: number;
  text?: OPFTextContent;
  /** SVG path for custom shapes */
  path?: string;
}

// ─── Chart ───────────────────────────────────────────────────────────

export interface OPFChartElement extends OPFElementBase {
  type: "chart";
  /**
   * Generic chart variant. Engine-agnostic alternative to `chartPreset`;
   * for finer control, use `chartPreset` instead.
   */
  chartType?: "bar" | "column" | "line" | "pie" | "donut" | "area" | "scatter" | "radar" | "waterfall" | "funnel" | "treemap" | "combo" | string;
  /**
   * Chart preset reference. Resolves to the `id` of a `charts` catalog
   * record (default catalog: https://www.pptx.gallery/charts). When set,
   * the engine sources the visual template from the resolved preset and
   * uses `data` to populate it. At least one of `chartType` or
   * `chartPreset` must be set.
   */
  chartPreset?: string;
  data: OPFChartData;
  options?: OPFChartOptions;
}

export interface OPFChartData {
  labels?: string[];
  datasets: OPFChartDataset[];
}

export interface OPFChartDataset {
  label: string;
  values: number[];
  color?: string;
  /** For combo charts */
  type?: string;
}

export interface OPFChartOptions {
  title?: string;
  legend?: boolean | { position: "top" | "bottom" | "left" | "right" };
  showValues?: boolean;
  showGrid?: boolean;
  stacked?: boolean;
  /** Y-axis config */
  yAxis?: { label?: string; min?: number; max?: number; format?: string };
  /** X-axis config */
  xAxis?: { label?: string; format?: string };
}

// ─── Table ───────────────────────────────────────────────────────────

export interface OPFTableElement extends OPFElementBase {
  type: "table";
  headers?: string[];
  rows: (string | number | OPFTextContent)[][];
  style?: OPFTableStyle;
}

export interface OPFTableStyle {
  headerBackground?: string;
  headerColor?: string;
  stripedRows?: boolean;
  borderColor?: string;
  compact?: boolean;
}

// ─── Video ───────────────────────────────────────────────────────────

export interface OPFVideoElement extends OPFElementBase {
  type: "video";
  src: string;
  poster?: string;
  autoplay?: boolean;
}

// ─── Code ────────────────────────────────────────────────────────────

export interface OPFCodeElement extends OPFElementBase {
  type: "code";
  code: string;
  language?: string;
  theme?: "dark" | "light";
  showLineNumbers?: boolean;
}

// ─── Group ───────────────────────────────────────────────────────────

export interface OPFGroupElement extends OPFElementBase {
  type: "group";
  children: OPFElement[];
}

// ─── Placeholder ─────────────────────────────────────────────────────

export interface OPFPlaceholderElement extends OPFElementBase {
  type: "placeholder";
  /** AI instruction for what to generate */
  prompt: string;
  /** Expected content type */
  expectedType?: "text" | "image" | "chart" | "table";
}
