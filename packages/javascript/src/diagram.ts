// Diagram payloads: Mermaid source laid out and drawn by pele (https://pele.run), a synchronous, DOM-free Mermaid renderer
// with no runtime dependencies. Core owns the whole drawing so every engine shows the same one: `layoutDiagram` lays the
// source out with the host's text measurement at the largest type size that fits the block, and `paintDiagram` turns
// pele's CSS-variable SVG into a self-contained SVG in the slide's resolved colors and fonts, which a browser, resvg and
// PowerPoint all draw alike (none of the last two reads CSS custom properties).
import type { TextMeasurer } from 'pele';
// The engine is chosen by export condition (package.json "imports"): every type registered at load in Node and edge runtimes, pele's
// core with each type loaded on demand in browsers (diagram-engine-eager.ts, diagram-engine-lazy.ts).
import { PeleError, detectType, loadDiagramType, parse as parseMermaid, registered, render as renderMermaid } from '#diagram-engine';
import { chartColorForFill, chartPaletteForFill, chartSeriesPalette, colorContrast, normalizeHexColor, textColorForFill, type ChartColorContext } from './color.js';

/** The syntaxes a diagram's `source` can be written in. */
export const DIAGRAM_SYNTAXES = ['mermaid'] as const;
export type DiagramSyntax = typeof DIAGRAM_SYNTAXES[number];

/** A diagram payload in its object form: the string shorthand is `{ source }`. */
export interface DiagramPayload {
  source: string;
  syntax: DiagramSyntax;
  alt?: string;
}

/** Why a diagram cannot be drawn: pele's error, with its 1-based position in `source` where it has one. */
export interface DiagramIssue {
  /** `diagram-unloaded`: in a browser, the diagram's type has not been loaded yet (ensureDiagrams); not a problem of the document. */
  code: 'diagram-empty' | 'diagram-syntax' | 'diagram-unsupported' | 'diagram-limit' | 'diagram-unloaded';
  message: string;
  line?: number;
  column?: number;
}

/** The object form of a `diagram` value, or undefined when the value is neither a string nor an object with a string source. */
export function diagramPayload(value: unknown): DiagramPayload | undefined {
  if (typeof value === 'string') return { source: value, syntax: 'mermaid' };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.source !== 'string') return undefined;
  return { source: record.source, syntax: 'mermaid', ...(typeof record.alt === 'string' && record.alt.trim() ? { alt: record.alt } : {}) };
}

/** The share of the readability floor the smallest secondary label of a diagram keeps (its node labels keep the whole floor). */
export const DIAGRAM_SECONDARY_FLOOR = 0.75;

/**
 * SH-07: the diagram types (pele's names, ComposedDiagram.type) the PPTX export writes as native shapes and connectors with
 * `diagrams: "shapes"`: each passed its comparison of PowerPoint's drawing with the preview (docs/diagrams.md#exports). Every other type
 * stays a picture there and reports the info finding `diagram-shapes-unavailable`.
 */
export const DIAGRAM_SHAPE_FAMILIES: readonly string[] = Object.freeze(['agentflow', 'architecture', 'block', 'c4', 'class', 'cynefin', 'er', 'eventmodeling', 'flowchart', 'gantt', 'gitGraph', 'ishikawa', 'journey', 'kanban', 'mindmap', 'packet', 'pie', 'quadrantChart', 'radar', 'railroad', 'requirement', 'sankey', 'sequence', 'state', 'swimlane', 'timeline', 'treeView', 'treemap', 'usecase', 'venn', 'wardley', 'xychart']);

/** The diagram's own size limits, below pele's defaults: a slide holds one readable drawing, not a document. */
export const DIAGRAM_SOURCE_LIMIT = 20000;
export const DIAGRAM_MAX_EDGES = 500;

function issueOf(error: unknown): DiagramIssue {
  if (error instanceof PeleError) {
    const code = error.code === 'syntax' || error.code === 'semantic' ? 'diagram-syntax' : error.code === 'limit' ? 'diagram-limit' : 'diagram-unsupported';
    // A parse error's message is "Parse error on line N:", the source line, a caret under it and what was expected. The finding
    // gives the position separately, so it keeps what was expected.
    const lines = error.message.split('\n').map(line => line.trim()).filter(Boolean);
    const message = (lines.length > 1 && /^Parse error on line \d+:?$/.test(lines[0]!) ? lines.at(-1)! : lines[0]) || 'The diagram source cannot be read.';
    return { code, message, ...(error.line > 0 ? { line: error.line, column: error.column } : {}) };
  }
  return { code: 'diagram-syntax', message: error instanceof Error ? error.message : String(error) };
}

const checked = new Map<string, { type: string } | DiagramIssue>();

/**
 * Whether a diagram value can be drawn: its diagram type (pele's name, such as `flowchart` or `sequence`) or the issue that stops
 * it. Parsing only: no text is measured. Results are cached by source.
 */
export function checkDiagram(value: unknown): { ok: true; type: string } | { ok: false; issue: DiagramIssue } {
  const payload = diagramPayload(value);
  if (!payload || !payload.source.trim()) return { ok: false, issue: { code: 'diagram-empty', message: 'The diagram has no source.' } };
  const unloaded = unloadedType(payload.source);
  if (unloaded) return { ok: false, issue: { code: 'diagram-unloaded', message: `The ${unloaded} diagram type is still loading.` } };
  let result = checked.get(payload.source);
  if (!result) {
    try {
      result = { type: String(parseMermaid(payload.source, { limit: DIAGRAM_SOURCE_LIMIT, maxEdges: DIAGRAM_MAX_EDGES }).type) };
    } catch (error) {
      result = issueOf(error);
    }
    if (checked.size >= 2000) checked.clear();
    checked.set(payload.source, result);
  }
  return 'type' in result ? { ok: true, type: result.type } : { ok: false, issue: result };
}

/** The diagram type of a source when it is one this engine has not loaded yet (only in a browser). */
function unloadedType(source: string): string | undefined {
  try {
    const type = detectType(source);
    return type !== null && !registered(type) ? type : undefined;
  } catch {
    return undefined;
  }
}

/** Every diagram value in a document, a slide or any part of one: the values of its `diagram` fields at any depth. */
function diagramSources(input: unknown, found: string[] = [], depth = 0): string[] {
  if (depth > 64 || !input || typeof input !== 'object') return found;
  if (Array.isArray(input)) { for (const entry of input) diagramSources(entry, found, depth + 1); return found; }
  for (const [key, value] of Object.entries(input)) {
    const payload = key === 'diagram' ? diagramPayload(value) : undefined;
    if (payload) found.push(payload.source);
    else diagramSources(value, found, depth + 1);
  }
  return found;
}

/**
 * The diagram types a document (or a slide, or any part of one) draws that are not loaded yet, in first-use order. Always empty in
 * Node and edge runtimes, where every type is loaded; in a browser, `ensureDiagrams` loads them.
 */
export function diagramsPending(input: unknown): string[] {
  const pending = new Set<string>();
  for (const source of diagramSources(input)) {
    const type = unloadedType(source);
    if (type) pending.add(type);
  }
  return [...pending];
}

/**
 * Load the diagram types a document draws, so composition can lay its diagrams out synchronously; resolves with the types it
 * loaded. Cheap when nothing is pending. The renderer's browser fonts handle calls it from `ensure`, and opf-pptx's `toPptx`
 * before it composes, so hosts that wait for fonts or export need no call of their own.
 */
export async function ensureDiagrams(input: unknown): Promise<string[]> {
  const pending = diagramsPending(input);
  await Promise.all(pending.map(type => loadDiagramType(type)));
  return pending;
}

/** How the host measures diagram text: `mono` is the code family, the rest the body family. */
export type DiagramMeasure = (text: string, fontSize: number, style: { bold: boolean; italic: boolean; mono: boolean }) => number;

export interface DiagramLayoutOptions {
  /** The area the diagram may take, in canvas pixels. */
  width: number;
  height: number;
  /**
   * The largest base type size (the size of node labels), and the readability floor, both in canvas pixels. The base size stays at or
   * above `floor`, and the smallest secondary label (an edge label, a score, an axis tick) at or above DIAGRAM_SECONDARY_FLOOR of it.
   */
  nominal: number;
  floor: number;
  measure: DiagramMeasure;
  /** Prefix of the ids inside the drawing (gradients), unique on the slide. */
  idPrefix: string;
  /** The host's font-size grid: the base size is snapped down to it (the floor's bound up), so the drawn size is one the host can set. */
  grid?: { down: (size: number) => number; up: (size: number) => number };
}

/** A diagram laid out for its block. The drawing is pele's, in diagram units, with its colors still CSS variables (paintDiagram). */
export interface ComposedDiagram {
  /** pele's diagram type, such as `flowchart`, `sequence` or `mindmap`. */
  type: string;
  /** pele's SVG at diagram units: draw it through paintDiagram. */
  svg: string;
  /** Size of the drawing in diagram units. */
  width: number;
  height: number;
  /** Canvas pixels per diagram unit. */
  scale: number;
  /** The base type size the diagram is drawn at, and its smallest label, in canvas pixels. */
  fontSize: number;
  smallestText: number;
  /** Text alternative: the authored `alt`, else one built from the diagram's labels. */
  alt: string;
  /** True when the diagram only fits below the readability floor: it is drawn smaller to stay inside its block. */
  overflow?: boolean;
}

/** pele draws at 16 diagram units per em; the layout scales that to the chosen type size. */
const BASE = 16;
const STYLE_BOLD = 1, STYLE_ITALIC = 2, STYLE_MONO = 4, STYLE_SUB = 8, STYLE_SUP = 16;
// A gantt chart marks today; a fixed time keeps two drawings of one deck the same. It is before any date a deck plans for, so
// no marker is drawn.
const NOW = Date.UTC(1970, 0, 1);

function smallestFontSize(svg: string): number {
  let smallest = BASE;
  for (const [, size] of svg.matchAll(/font-size(?:="|:\s*)([\d.]+)/g)) smallest = Math.min(smallest, Number(size));
  return smallest;
}

/**
 * Labels of a pele drawing without repeats, for the default text alternative: the shapes' labels in drawing order, then the labels of
 * connectors (pele draws connectors first, so their labels would otherwise lead).
 */
function labelsOf(svg: string): string[] {
  const textOf = (inner: string) => decodeXml(inner.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const edgeLabels = /<g class="pele-edge-labels"[\s\S]*?<\/g><\/g>/.exec(svg)?.[0] ?? '';
  const seen = new Set<string>(), shapes: string[] = [], connectors: string[] = [];
  const collect = (markup: string, into: string[]) => {
    for (const [, inner] of markup.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)) {
      const text = textOf(inner!);
      if (text && !seen.has(text)) { seen.add(text); into.push(text); }
    }
  };
  collect(edgeLabels ? svg.replace(edgeLabels, '') : svg, shapes);
  collect(edgeLabels, connectors);
  return [...shapes, ...connectors];
}

function decodeXml(text: string): string {
  return text.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[\da-f]+);/gi, (_, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower === 'lt') return '<';
    if (lower === 'gt') return '>';
    if (lower === 'quot') return '"';
    if (lower === 'apos') return "'";
    if (lower === 'amp') return '&';
    const code = lower.startsWith('#x') ? Number.parseInt(lower.slice(2), 16) : Number(lower.slice(1));
    return Number.isFinite(code) ? String.fromCodePoint(code) : '';
  });
}

// pele's diagram types (its registry), as a reader would name them.
const TYPE_NAMES: Readonly<Record<string, string>> = { agentflow: 'Agent flow', architecture: 'Architecture diagram', block: 'Block diagram', c4: 'C4 diagram', class: 'Class diagram', cynefin: 'Cynefin diagram', er: 'Entity relationship diagram', eventmodeling: 'Event model', flowchart: 'Flowchart', gantt: 'Gantt chart', gitGraph: 'Git graph', info: 'Diagram', ishikawa: 'Ishikawa diagram', journey: 'User journey', kanban: 'Kanban board', mindmap: 'Mind map', packet: 'Packet diagram', pie: 'Pie chart', quadrantChart: 'Quadrant chart', radar: 'Radar chart', railroad: 'Railroad diagram', requirement: 'Requirement diagram', sankey: 'Sankey diagram', sequence: 'Sequence diagram', state: 'State diagram', swimlane: 'Swimlane diagram', timeline: 'Timeline', treeView: 'Tree view', treemap: 'Treemap', usecase: 'Use case diagram', venn: 'Venn diagram', wardley: 'Wardley map', xychart: 'XY chart' };

/** The default text alternative of a drawing: its kind, then its labels, at most 400 characters. */
function derivedAlt(type: string, svg: string): string {
  const name = TYPE_NAMES[type] ?? 'Diagram';
  const labels = labelsOf(svg);
  if (!labels.length) return name;
  let alt = `${name}: ${labels.join(', ')}`;
  if (alt.length > 400) alt = `${alt.slice(0, 397).replace(/[,\s]+\S*$/, '')}…`;
  return alt;
}

interface Drawn { svg: string; width: number; height: number; type: string }
const drawings = new WeakMap<DiagramMeasure, Map<string, Drawn>>();

function draw(source: string, maxWidth: number, options: Pick<DiagramLayoutOptions, 'measure' | 'idPrefix'>): Drawn {
  let cache = drawings.get(options.measure);
  if (!cache) {
    cache = new Map();
    drawings.set(options.measure, cache);
  }
  const key = `${options.idPrefix}\u0000${Math.round(maxWidth * 4) / 4}\u0000${source}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const measurer: TextMeasurer = {
    width(text, size, style) {
      // pele measures sub- and superscripts at its `smaller` size.
      const effective = style & (STYLE_SUB | STYLE_SUP) ? size / 1.2 : size;
      return options.measure(text, effective, { bold: (style & STYLE_BOLD) !== 0, italic: (style & STYLE_ITALIC) !== 0, mono: (style & STYLE_MONO) !== 0 });
    },
  };
  const rendered = renderMermaid(source, {
    measurer, fontSize: BASE, maxWidth: Math.max(160, maxWidth), responsive: false, links: false, images: false, idPrefix: options.idPrefix,
    limit: DIAGRAM_SOURCE_LIMIT, maxEdges: DIAGRAM_MAX_EDGES, now: NOW,
  });
  const drawn = { svg: rendered.svg, width: rendered.width, height: rendered.height, type: String(rendered.type) };
  if (cache.size >= 500) cache.clear();
  cache.set(key, drawn);
  return drawn;
}

/**
 * Lay a diagram out for an area: the largest base type size, from `nominal` down, at which the drawing fits, its base size stays at
 * or above `floor` and its smallest label at or above DIAGRAM_SECONDARY_FLOOR of it. pele lays the diagram out for the width it has (a wide flowchart may turn to run down), so a
 * smaller size is a new layout, not a shrunken picture. When even the floor does not fit, the drawing at the floor is scaled
 * down to fit and marked `overflow`. Throws the diagram's issue (checkDiagram) when the source cannot be drawn.
 */
export function layoutDiagram(value: unknown, options: DiagramLayoutOptions): ComposedDiagram {
  const checkedValue = checkDiagram(value);
  if (!checkedValue.ok) throw Object.assign(new Error(checkedValue.issue.message), { diagramIssue: checkedValue.issue });
  const payload = diagramPayload(value)!;
  const width = Math.max(1, options.width), height = Math.max(1, options.height);
  const down = options.grid?.down ?? ((size: number) => size), up = options.grid?.up ?? ((size: number) => size);
  const at = (requested: number) => { const size = down(requested), scale = size / BASE; return { size, scale, drawn: draw(payload.source, width / scale, options) }; };
  const fits = (candidate: ReturnType<typeof at>) => candidate.drawn.width * candidate.scale <= width + .5 && candidate.drawn.height * candidate.scale <= height + .5;
  // The smallest label's share of the base size is the diagram type's; it bounds the base size from below.
  const probe = at(Math.max(options.floor, options.nominal));
  const share = smallestFontSize(probe.drawn.svg) / BASE;
  const lowest = up(Math.max(1, options.floor, options.floor * DIAGRAM_SECONDARY_FLOOR / share)), highest = Math.max(lowest, options.nominal);
  let chosen = fits(probe) && probe.size <= highest ? probe : undefined;
  if (!chosen) {
    const low = at(lowest);
    if (fits(low)) {
      // Bisect the base size between the floor and the nominal size, to a quarter of a canvas pixel.
      let lo = lowest, hi = highest, best = low;
      while (hi - lo > .25) {
        const mid = (lo + hi) / 2, candidate = at(mid);
        if (fits(candidate)) { best = candidate; lo = mid; } else hi = mid;
      }
      chosen = best;
    }
  }
  if (chosen) {
    return { type: chosen.drawn.type, svg: chosen.drawn.svg, width: chosen.drawn.width, height: chosen.drawn.height, scale: chosen.scale, fontSize: chosen.size, smallestText: chosen.size * share, alt: payload.alt ?? derivedAlt(chosen.drawn.type, chosen.drawn.svg) };
  }
  // Not even the floor fits: the floor's layout, scaled down into the area.
  const floor = at(lowest);
  const scale = down(BASE * Math.min(width / floor.drawn.width, height / floor.drawn.height, floor.scale)) / BASE;
  return { type: floor.drawn.type, svg: floor.drawn.svg, width: floor.drawn.width, height: floor.drawn.height, scale, fontSize: BASE * scale, smallestText: BASE * scale * share, alt: payload.alt ?? derivedAlt(floor.drawn.type, floor.drawn.svg), overflow: true };
}

/** The colors and fonts a diagram is painted in, all opaque #RRGGBB colors except the families. */
export interface DiagramPalette {
  /** The surface under the diagram: the slide background or the card it sits on. Label backings and line casings use it. */
  background: string;
  /** Text, and the color of icons. */
  text: string;
  /** Secondary text: axis labels, stereotypes, notes. */
  muted: string;
  /** Connectors and arrowheads. */
  line: string;
  /** Node fill, and the fill of the second level of nested groups. */
  surface: string;
  surfaceAlt: string;
  /** Node outlines. */
  border: string;
  /** The highlight color (the first accent). */
  accent: string;
  /** Data series, in the variant's accent order. */
  series: string[];
  /** Text on a light series fill and on a dark one. */
  textOnLight: string;
  textOnDark: string;
  /** What a diagram marks as critical (a gantt task). */
  critical: string;
  fontFamily: string;
  monoFamily: string;
}

export interface DiagramPaletteInput {
  /** The opaque color under the diagram. */
  surface: string;
  /** The slide's text and muted text colors (resolved roles). */
  text: string;
  mutedText?: string;
  /** The deck color scheme and what its ColorRefs resolve against, as for a chart (chartSeriesPalette). */
  colorScheme?: Record<string, unknown>;
  context?: ChartColorContext;
  /** The scheme's darkest and lightest text colors (`dark1`, `light1`), for text on series fills. */
  dark?: string;
  light?: string;
  fonts: { body: string; code: string };
}

const hexChannels = (hex: string): [number, number, number] => [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
/** `share` of `color` over `base`, as an opaque color. */
function mix(color: string, base: string, share: number): string {
  const a = hexChannels(color), b = hexChannels(base);
  return `#${a.map((channel, index) => Math.round(b[index]! + (channel - b[index]!) * share).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
/** The smallest share of `color` over `base`, from `start`, that reaches `contrast` against `base` (the whole color when none does). */
function mixFor(color: string, base: string, start: number, contrast: number): string {
  for (let share = start; share < 1; share += .02) {
    const mixed = mix(color, base, share);
    if ((colorContrast(mixed, base) ?? 21) >= contrast) return mixed;
  }
  return color;
}

/** Share of the accent in a node's fill, and in the fill of a nested group; enough to read as the accent's tint on any surface. */
export const DIAGRAM_SURFACE_MIX = 0.1, DIAGRAM_SURFACE_ALT_MIX = 0.18;
/** Smallest contrast a node outline keeps against the surface, and a connector line: visible structure, quieter than text. */
export const DIAGRAM_BORDER_MIN_CONTRAST = 1.8, DIAGRAM_LINE_MIN_CONTRAST = 3;

/**
 * The palette a diagram is painted in, from the slide's resolved design: nodes are tints of the variant's first accent over the
 * surface, outlines and connectors are mixed toward the accent and the text, data series are the chart series of the same slide
 * (chartSeriesPalette with chartPaletteForFill), and the text keeps 4.5:1 on every fill it is drawn on. A dark background or a
 * dark variant gives dark tints and light lines.
 */
export function diagramPalette(input: DiagramPaletteInput): DiagramPalette {
  const surface = normalizeHexColor(input.surface) ?? '#FFFFFF';
  const series = chartPaletteForFill(surface, chartSeriesPalette(input.colorScheme ?? {}, undefined, input.context ?? {}), { legible: Array(12).fill(true) }).slice(0, 8);
  const accent = chartColorForFill(surface, series[0] ?? '#4472C4');
  const nodeFill = mix(accent, surface, DIAGRAM_SURFACE_MIX), groupFill = mix(accent, surface, DIAGRAM_SURFACE_ALT_MIX);
  const preferredText = normalizeHexColor(input.text) ?? '#1F1F1F';
  const text = textColorForFill(groupFill, textColorForFill(surface, preferredText));
  const mutedPreferred = normalizeHexColor(input.mutedText) ?? mix(text, surface, .7);
  const muted = (colorContrast(mutedPreferred, surface) ?? 0) >= 4.5 ? mutedPreferred : mixFor(text, surface, .7, 4.5);
  const dark = normalizeHexColor(input.dark) ?? '#1F1F1F', light = normalizeHexColor(input.light) ?? '#FFFFFF';
  return {
    background: surface, text, muted,
    line: mixFor(text, surface, .6, DIAGRAM_LINE_MIN_CONTRAST),
    surface: nodeFill, surfaceAlt: groupFill,
    border: mixFor(accent, surface, .45, DIAGRAM_BORDER_MIN_CONTRAST),
    accent, series,
    textOnLight: (colorContrast(dark, '#FFFFFF') ?? 0) >= 7 ? dark : '#000000',
    textOnDark: (colorContrast(light, '#000000') ?? 0) >= 7 ? light : '#FFFFFF',
    critical: chartColorForFill(surface, '#D64545'),
    fontFamily: input.fonts.body, monoFamily: input.fonts.code,
  };
}

/** pele's public tokens, from a palette. */
function tokensOf(palette: DiagramPalette): Record<string, string> {
  const tokens: Record<string, string> = {
    '--pele-bg': palette.background, '--pele-fg': palette.text, '--pele-muted': palette.muted, '--pele-line': palette.line,
    '--pele-surface': palette.surface, '--pele-surface-alt': palette.surfaceAlt, '--pele-border': palette.border, '--pele-accent': palette.accent,
    '--pele-fg-on-light': palette.textOnLight, '--pele-fg-on-dark': palette.textOnDark, '--pele-critical': palette.critical,
    '--pele-font': familyList(palette.fontFamily, 'sans-serif'), '--pele-font-mono': familyList(palette.monoFamily, 'monospace'),
    '--pele-radius': '6px', '--pele-title-weight': 'bold', '--pele-heading-weight': 'bold', '--pele-bold-weight': 'bold',
  };
  palette.series.forEach((color, index) => { tokens[`--pele-series-${index + 1}`] = color; });
  return tokens;
}

/** A CSS font-family list naming `family` first, quoted when it is not a single identifier. */
function familyList(family: string, generic: string): string {
  const name = family.replace(/["'\\<>;{}]/g, '').trim();
  if (!name) return generic;
  return `${/^[A-Za-z][\w-]*$/.test(name) ? name : `'${name}'`}, ${generic}`;
}

// SVG presentation properties a `style` declaration can move to an attribute of the same name (CSS beats the attribute, so the
// declaration's value wins). Everything else in pele's styles is for browsers only (max-width, text-transform, direction).
const PRESENTATION = new Set(['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-decoration', 'rx', 'ry', 'stop-color', 'stop-opacity', 'letter-spacing', 'word-spacing']);
const DROPPED = new Set(['class', 'role', 'aria-roledescription', 'aria-labelledby', 'aria-describedby', 'style']);

function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === separator && depth === 0) { parts.push(value.slice(start, index)); start = index + 1; }
  }
  parts.push(value.slice(start));
  return parts;
}

/** Replace every var() in a CSS value, innermost first; an unknown variable takes its fallback. */
function substitute(value: string, variables: Record<string, string>): string {
  let previous: string;
  let current = value;
  do {
    previous = current;
    current = current.replace(/var\(\s*(--[\w-]+)\s*(?:,([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (_, name: string, fallback?: string) => variables[name] ?? (fallback ?? '').trim());
  } while (current !== previous && current.includes('var('));
  return current.replace(/color-mix\(\s*in\s+srgb\s*,\s*(#[\da-f]{3,8})\s+([\d.]+)%\s*,\s*(#[\da-f]{3,8})\s*\)/gi, (_, a: string, share: string, b: string) => {
    const from = normalizeHexColor(a), to = normalizeHexColor(b);
    return from && to ? mix(from, to, Number(share) / 100) : a;
  });
}

function escapeAttribute(value: string): string {
  return value.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * A composed diagram as a self-contained SVG document in `palette`: every CSS variable and color-mix resolved, styles moved to
 * presentation attributes, classes and ARIA roles removed, sized `width` by `height` (the block's drawn size, in the units the
 * host draws in) over the drawing's own viewBox, with `alt` as its title. Labels stay text in the palette's fonts. With `classes`,
 * pele's classes stay on the elements (SH-07: the PPTX export tells nodes, edges and labels apart by them); the drawing is the same.
 */
export function paintDiagram(diagram: Pick<ComposedDiagram, 'svg' | 'width' | 'height' | 'alt'>, palette: DiagramPalette, size: { width: number; height: number }, options: { classes?: boolean } = {}): string {
  const { body, font } = paintedBody(diagram, palette, options.classes === true);
  const title = diagram.alt ? `<title>${escapeAttribute(diagram.alt)}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${diagram.width} ${diagram.height}" width="${round(size.width)}" height="${round(size.height)}" font-family="${font}" font-size="${BASE}" fill="${palette.text}">${title}${body}</svg>`;
}

/**
 * A composed diagram painted as an SVG group for a host's own SVG (a slide): the content of paintDiagram, translated to `box` and
 * scaled from diagram units to it. The group carries the font, size and fill the drawing inherits; it adds no title (the host labels
 * the picture).
 */
export function paintDiagramGroup(diagram: Pick<ComposedDiagram, 'svg' | 'width' | 'height'>, palette: DiagramPalette, box: { x: number; y: number; width: number; height: number }): string {
  const { body, font } = paintedBody(diagram, palette);
  const scale = box.width / Math.max(1e-9, diagram.width);
  return `<g transform="translate(${round(box.x)} ${round(box.y)}) scale(${Math.round(scale * 1e6) / 1e6})" font-family="${font}" font-size="${BASE}" fill="${palette.text}">${body}</g>`;
}

const round = (value: number) => Math.round(value * 100) / 100;

function paintedBody(diagram: Pick<ComposedDiagram, 'svg'>, palette: DiagramPalette, classes = false): { body: string; font: string } {
  const tokens = tokensOf(palette);
  const root = /^<svg\b[^>]*\bstyle="([^"]*)"/.exec(diagram.svg)?.[1] ?? '';
  // pele's private aliases (--_bg, --_fg, ...) are declared on the root and point at the public tokens; resolve them once.
  const variables: Record<string, string> = { ...tokens };
  for (const declaration of splitTopLevel(decodeXml(root), ';')) {
    const at = declaration.indexOf(':');
    const name = declaration.slice(0, at).trim();
    if (name.startsWith('--') && !(name in tokens)) variables[name] = declaration.slice(at + 1).trim();
  }
  for (const name of Object.keys(variables)) variables[name] = substitute(variables[name]!, variables);
  const body = diagram.svg.replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title\b[^>]*>[\s\S]*?<\/title>|<desc\b[^>]*>[\s\S]*?<\/desc>/g, '');
  // Only tags are rewritten: label text between them is never read as markup (pele escapes <, > and " in it).
  const painted = body.replace(/<([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g, (_, name: string, attributes: string, close: string) => {
    const kept = new Map<string, string>();
    let style = '';
    for (const [, attribute, raw] of attributes.matchAll(/\s+([\w:-]+)="([^"]*)"/g)) {
      if (attribute === 'style') { style = raw!; continue; }
      if (DROPPED.has(attribute!) && !(classes && attribute === 'class')) continue;
      kept.set(attribute!, raw!.includes('var(') || raw!.includes('color-mix(') ? escapeAttribute(substitute(decodeXml(raw!), variables)) : raw!);
    }
    for (const declaration of splitTopLevel(decodeXml(style), ';')) {
      const at = declaration.indexOf(':');
      if (at <= 0) continue;
      const property = declaration.slice(0, at).trim().toLowerCase();
      if (!PRESENTATION.has(property)) continue;
      let resolved = substitute(declaration.slice(at + 1).replace(/!important/gi, '').trim(), variables);
      if ((property === 'rx' || property === 'ry' || property === 'font-size' || property === 'stroke-width') && /^[\d.]+px$/.test(resolved)) resolved = resolved.slice(0, -2);
      if (resolved) kept.set(property, escapeAttribute(resolved));
    }
    const fill = kept.get('fill');
    if (fill === 'currentColor') kept.set('fill', palette.text);
    if (kept.get('stroke') === 'currentColor') kept.set('stroke', palette.text);
    let out = `<${name}`;
    for (const [attribute, value] of kept) out += ` ${attribute}="${value}"`;
    return `${out}${close ? '/' : ''}>`;
  });
  return { body: painted, font: escapeAttribute(tokens['--pele-font']!) };
}
