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
  author?: string;
  company?: string;
  audience?: string;
  purpose?: string;
  narrative?: OPFNarrative;
  language?: string;
  createdAt?: string;
  tags?: string[];
}

/**
 * Structured storyline metadata used by AI to shape generated content.
 *
 * Narrative declares the deck's intended story arc; slides may opt into beats
 * via `Slide.beat`. The narrative does not constrain slide structure —
 * validators warn on drift (orphan slides, unused beats) but never error.
 * Slides are the source of truth; narrative is intent that travels with the deck.
 */
export interface OPFNarrative {
  /**
   * Reference a named narrative template from the pptx.dev library, e.g.
   * "problem-solution", "scqa", "pitch-deck", "qbr". Unknown template IDs
   * produce a validation warning, not an error.
   */
  template?: string;
  /** Free-form narrative description for AI-driven generation */
  description?: string;
  /** Key messages to convey */
  keyMessages?: string[];
  /** Desired tone: "formal" | "casual" | "inspirational" | "technical" | "persuasive" */
  tone?: string;
  /** Target duration in minutes */
  durationMinutes?: number;
  /**
   * Inline narrative beats. When provided alongside a `template`, beats here
   * override or extend matching template beats by `id`. Without `template`,
   * this defines a fully custom narrative arc. Beat IDs must be unique
   * within the document.
   */
  beats?: OPFNarrativeBeat[];
}

/**
 * A single narrative beat — a labeled segment of the story arc with a
 * specific dramatic purpose (e.g. "hook", "problem", "evidence", "ask").
 * Slides reference beats via `Slide.beat`.
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
  /**
   * Optional explicit slide count for this beat. Defaults to 1 when omitted;
   * values >1 are reserved for beats that intentionally span multiple slides.
   * Prefer decomposing a heavy beat into multiple beats over setting a high
   * slideCount. The validator emits a warning if the deck's actual count
   * differs significantly.
   */
  slideCount?: number;
  /** Suggested layout for the opening slide of this beat */
  layoutHint?: string;
}

// ─── Design System ───────────────────────────────────────────────────

export interface OPFDesign {
  /** Reference a named theme from pptx.gallery, or define inline */
  theme?: string;

  /** Color palette */
  colors?: OPFColorScheme;

  /** Typography */
  fonts?: OPFFontScheme;

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
  /** Named scheme from gallery, e.g. "ocean-depth", "corporate-blue" */
  scheme?: string;
  /** Override individual color roles */
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  surface?: string;
  text?: string;
  textSecondary?: string;
  /** Custom named colors for advanced use */
  custom?: Record<string, string>;
}

export interface OPFFontScheme {
  /** Named scheme from gallery, e.g. "modern-sans", "classic-serif" */
  scheme?: string;
  /** Override individual font roles */
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
  image?: { url: string; fit: "cover" | "contain" | "tile" };
  opacity?: number;
}

export interface OPFBrand {
  logo?: { url: string; position?: OPFPosition; widthInches?: number };
  watermark?: { url: string; opacity?: number };
  companyName?: string;
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
  chartType: "bar" | "column" | "line" | "pie" | "donut" | "area" | "scatter" | "radar" | "waterfall" | "funnel" | "treemap" | "combo";
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
