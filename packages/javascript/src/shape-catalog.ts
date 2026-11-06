/**
 * The shape catalog (shapes SH-06): the 187 DrawingML presets as PowerPoint's Insert > Shapes gallery groups them, with the common words people search by. Pure data and functions, no geometry: the editor's shape picker and the MCP's
 * `search_shapes` draw their thumbnails from `presetGeometry` (`@openpresentation/opf/shape-geometry`) and `shapeThumbnail` here.
 * Edge-safe (no Node import). The names are DrawingML's own (ECMA-376 `ST_ShapeType`).
 */
import type { ShapeGeometry } from "./shape-geometry.js";

/** The groups of PowerPoint's Insert > Shapes gallery, in its order (Recently Used is a host's own list). */
export const SHAPE_CATEGORIES = [
  { id: "lines", title: "Lines" },
  { id: "rectangles", title: "Rectangles" },
  { id: "basic", title: "Basic Shapes" },
  { id: "blockArrows", title: "Block Arrows" },
  { id: "equations", title: "Equation Shapes" },
  { id: "flowchart", title: "Flowchart" },
  { id: "starsBanners", title: "Stars and Banners" },
  { id: "callouts", title: "Callouts" },
  { id: "actionButtons", title: "Action Buttons" },
] as const;
export type ShapeCategoryId = (typeof SHAPE_CATEGORIES)[number]["id"];

export interface ShapeCatalogEntry {
  /** The DrawingML preset name, the value of a shape block's `shape`. */
  name: string;
  category: ShapeCategoryId;
  /** Common words people search by ('speech bubble', 'cylinder', 'cog'), besides the words of the two names. */
  keywords: readonly string[];
}

// [name, category, keywords], in the order of PowerPoint's gallery.
const ROWS: readonly (readonly [string, ShapeCategoryId] | readonly [string, ShapeCategoryId, string])[] = [
  ["line", "lines", "straight line"],
  ["lineInv", "lines", "straight line inverse diagonal"],
  ["straightConnector1", "lines", "connector line arrow straight"],
  ["bentConnector2", "lines", "elbow connector corner"],
  ["bentConnector3", "lines", "elbow connector"],
  ["bentConnector4", "lines", "elbow connector"],
  ["bentConnector5", "lines", "elbow connector"],
  ["curvedConnector2", "lines", "curve connector"],
  ["curvedConnector3", "lines", "curve connector s curve"],
  ["curvedConnector4", "lines", "curve connector"],
  ["curvedConnector5", "lines", "curve connector"],
  ["rect", "rectangles", "box square"],
  ["roundRect", "rectangles", "rounded rectangle button card box"],
  ["snip1Rect", "rectangles", "cut corner"],
  ["snip2SameRect", "rectangles", "cut corners"],
  ["snip2DiagRect", "rectangles", "cut corners"],
  ["snipRoundRect", "rectangles", "cut round corner"],
  ["round1Rect", "rectangles", "rounded corner"],
  ["round2SameRect", "rectangles", "rounded corners tab"],
  ["round2DiagRect", "rectangles", "rounded corners"],
  ["ellipse", "basic", "circle oval round"],
  ["triangle", "basic", "isosceles triangle"],
  ["rtTriangle", "basic", "right triangle"],
  ["parallelogram", "basic", "slanted rhomboid"],
  ["trapezoid", "basic", "trapezium"],
  ["nonIsoscelesTrapezoid", "basic", "trapezium"],
  ["diamond", "basic", "rhombus"],
  ["pentagon", "basic", "five sides regular polygon"],
  ["hexagon", "basic", "six sides polygon honeycomb"],
  ["heptagon", "basic", "seven sides polygon"],
  ["octagon", "basic", "eight sides polygon stop sign"],
  ["decagon", "basic", "ten sides polygon"],
  ["dodecagon", "basic", "twelve sides polygon"],
  ["pie", "basic", "pie slice sector wedge"],
  ["pieWedge", "basic", "quarter pie slice"],
  ["chord", "basic", "circle segment"],
  ["teardrop", "basic", "drop water tear"],
  ["frame", "basic", "border picture frame"],
  ["halfFrame", "basic", "corner frame"],
  ["corner", "basic", "l shape bracket"],
  ["diagStripe", "basic", "diagonal stripe band"],
  ["plus", "basic", "cross add medical"],
  ["plaque", "basic", "badge label"],
  ["can", "basic", "cylinder database storage"],
  ["cube", "basic", "box 3d block"],
  ["bevel", "basic", "button raised"],
  ["donut", "basic", "ring circle hole"],
  ["noSmoking", "basic", "prohibited forbidden ban not allowed"],
  ["blockArc", "basic", "arc ring half circle rainbow"],
  ["foldedCorner", "basic", "note page sticky paper"],
  ["smileyFace", "basic", "smile emoji happy"],
  ["heart", "basic", "love like favorite"],
  ["lightningBolt", "basic", "lightning flash energy power electric"],
  ["sun", "basic", "sunny day weather"],
  ["moon", "basic", "crescent night"],
  ["cloud", "basic", "weather cloud computing"],
  ["arc", "basic", "curve arch"],
  ["bracketPair", "basic", "brackets square"],
  ["bracePair", "basic", "braces curly"],
  ["leftBracket", "basic", "square bracket"],
  ["rightBracket", "basic", "square bracket"],
  ["leftBrace", "basic", "curly brace"],
  ["rightBrace", "basic", "curly brace"],
  ["gear6", "basic", "cog settings"],
  ["gear9", "basic", "cog settings"],
  ["funnel", "basic", "filter"],
  ["cornerTabs", "basic", "corner marks"],
  ["squareTabs", "basic", "corner marks"],
  ["plaqueTabs", "basic", "corner marks"],
  ["chartPlus", "basic", "chart marker"],
  ["chartStar", "basic", "chart marker"],
  ["chartX", "basic", "chart marker"],
  ["rightArrow", "blockArrows", "arrow next forward"],
  ["leftArrow", "blockArrows", "arrow back previous"],
  ["upArrow", "blockArrows", "arrow"],
  ["downArrow", "blockArrows", "arrow"],
  ["leftRightArrow", "blockArrows", "double arrow horizontal"],
  ["upDownArrow", "blockArrows", "double arrow vertical"],
  ["quadArrow", "blockArrows", "four way arrow move"],
  ["leftRightUpArrow", "blockArrows", "three way arrow"],
  ["bentArrow", "blockArrows", "turn arrow"],
  ["uturnArrow", "blockArrows", "u turn arrow return"],
  ["leftUpArrow", "blockArrows", "bent arrow"],
  ["bentUpArrow", "blockArrows", "turn arrow"],
  ["curvedRightArrow", "blockArrows", "curve arrow"],
  ["curvedLeftArrow", "blockArrows", "curve arrow"],
  ["curvedUpArrow", "blockArrows", "curve arrow"],
  ["curvedDownArrow", "blockArrows", "curve arrow"],
  ["stripedRightArrow", "blockArrows", "arrow dashed"],
  ["notchedRightArrow", "blockArrows", "arrow notch"],
  ["homePlate", "blockArrows", "pentagon arrow step"],
  ["chevron", "blockArrows", "arrow step process"],
  ["rightArrowCallout", "blockArrows", "arrow label"],
  ["downArrowCallout", "blockArrows", "arrow label"],
  ["leftArrowCallout", "blockArrows", "arrow label"],
  ["upArrowCallout", "blockArrows", "arrow label"],
  ["leftRightArrowCallout", "blockArrows", "arrow label"],
  ["upDownArrowCallout", "blockArrows", "arrow label"],
  ["quadArrowCallout", "blockArrows", "arrow label"],
  ["circularArrow", "blockArrows", "cycle refresh loop arrow"],
  ["leftCircularArrow", "blockArrows", "cycle refresh loop arrow"],
  ["leftRightCircularArrow", "blockArrows", "cycle refresh loop arrow"],
  ["swooshArrow", "blockArrows", "swoosh arrow growth"],
  ["mathPlus", "equations", "add plus equation"],
  ["mathMinus", "equations", "subtract minus equation"],
  ["mathMultiply", "equations", "times multiply cross equation"],
  ["mathDivide", "equations", "divide equation"],
  ["mathEqual", "equations", "equals equation"],
  ["mathNotEqual", "equations", "not equal unequal equation"],
  ["flowChartAlternateProcess", "flowchart", "rounded step"],
  ["flowChartCollate", "flowchart", "hourglass"],
  ["flowChartConnector", "flowchart", "circle join"],
  ["flowChartDecision", "flowchart", "diamond choice branch if"],
  ["flowChartDelay", "flowchart", "wait"],
  ["flowChartDisplay", "flowchart", "screen monitor"],
  ["flowChartDocument", "flowchart", "page report"],
  ["flowChartExtract", "flowchart", "triangle"],
  ["flowChartInputOutput", "flowchart", "data parallelogram"],
  ["flowChartInternalStorage", "flowchart", "storage"],
  ["flowChartMagneticDisk", "flowchart", "database disk cylinder"],
  ["flowChartMagneticDrum", "flowchart", "drum storage"],
  ["flowChartMagneticTape", "flowchart", "tape"],
  ["flowChartManualInput", "flowchart", "keyboard input"],
  ["flowChartManualOperation", "flowchart", "manual step"],
  ["flowChartMerge", "flowchart", "triangle join"],
  ["flowChartMultidocument", "flowchart", "pages reports"],
  ["flowChartOfflineStorage", "flowchart", "storage triangle"],
  ["flowChartOffpageConnector", "flowchart", "page reference"],
  ["flowChartOnlineStorage", "flowchart", "storage"],
  ["flowChartOr", "flowchart", "or circle"],
  ["flowChartPredefinedProcess", "flowchart", "subprocess subroutine"],
  ["flowChartPreparation", "flowchart", "hexagon setup"],
  ["flowChartProcess", "flowchart", "rectangle step"],
  ["flowChartPunchedCard", "flowchart", "card"],
  ["flowChartPunchedTape", "flowchart", "tape"],
  ["flowChartSort", "flowchart", "diamond order"],
  ["flowChartSummingJunction", "flowchart", "sum circle cross"],
  ["flowChartTerminator", "flowchart", "start end stop oval"],
  ["irregularSeal1", "starsBanners", "burst explosion bang"],
  ["irregularSeal2", "starsBanners", "burst explosion bang"],
  ["star4", "starsBanners", "four point star sparkle"],
  ["star5", "starsBanners", "five point star favorite rating"],
  ["star6", "starsBanners", "six point star david"],
  ["star7", "starsBanners", "seven point star"],
  ["star8", "starsBanners", "eight point star"],
  ["star10", "starsBanners", "ten point star"],
  ["star12", "starsBanners", "twelve point star seal badge"],
  ["star16", "starsBanners", "sixteen point star seal badge"],
  ["star24", "starsBanners", "twenty four point star seal badge"],
  ["star32", "starsBanners", "thirty two point star seal badge"],
  ["ribbon2", "starsBanners", "banner up ribbon"],
  ["ribbon", "starsBanners", "banner down ribbon"],
  ["ellipseRibbon2", "starsBanners", "banner curved up ribbon"],
  ["ellipseRibbon", "starsBanners", "banner curved down ribbon"],
  ["leftRightRibbon", "starsBanners", "banner ribbon"],
  ["verticalScroll", "starsBanners", "scroll paper banner"],
  ["horizontalScroll", "starsBanners", "scroll paper banner"],
  ["wave", "starsBanners", "banner flag water"],
  ["doubleWave", "starsBanners", "banner flag water"],
  ["wedgeRectCallout", "callouts", "speech bubble comment tooltip"],
  ["wedgeRoundRectCallout", "callouts", "speech bubble comment tooltip"],
  ["wedgeEllipseCallout", "callouts", "speech bubble comment thought oval"],
  ["cloudCallout", "callouts", "thought bubble cloud comment"],
  ["borderCallout1", "callouts", "line callout annotation"],
  ["borderCallout2", "callouts", "line callout annotation"],
  ["borderCallout3", "callouts", "line callout annotation"],
  ["accentCallout1", "callouts", "line callout annotation"],
  ["accentCallout2", "callouts", "line callout annotation"],
  ["accentCallout3", "callouts", "line callout annotation"],
  ["callout1", "callouts", "line callout annotation"],
  ["callout2", "callouts", "line callout annotation"],
  ["callout3", "callouts", "line callout annotation"],
  ["accentBorderCallout1", "callouts", "line callout annotation"],
  ["accentBorderCallout2", "callouts", "line callout annotation"],
  ["accentBorderCallout3", "callouts", "line callout annotation"],
  ["actionButtonBackPrevious", "actionButtons", "back previous button"],
  ["actionButtonBeginning", "actionButtons", "first start button"],
  ["actionButtonBlank", "actionButtons", "empty button"],
  ["actionButtonDocument", "actionButtons", "file page button"],
  ["actionButtonEnd", "actionButtons", "last finish button"],
  ["actionButtonForwardNext", "actionButtons", "forward next button"],
  ["actionButtonHelp", "actionButtons", "question mark button"],
  ["actionButtonHome", "actionButtons", "house button"],
  ["actionButtonInformation", "actionButtons", "info button"],
  ["actionButtonMovie", "actionButtons", "video film button"],
  ["actionButtonReturn", "actionButtons", "back return button"],
  ["actionButtonSound", "actionButtons", "audio speaker volume button"],
];

const split = (text: string): string[] =>
  text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([A-Za-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** The catalog, in the order of PowerPoint's gallery (each group in turn). */
export const SHAPE_CATALOG: readonly ShapeCatalogEntry[] = Object.freeze(
  ROWS.map((row) => Object.freeze({ name: row[0], category: row[1], keywords: Object.freeze(row[2] ? row[2].split(" ") : []) })),
);

const BY_NAME = new Map(SHAPE_CATALOG.map((entry) => [entry.name, entry]));
const WORDS = new Map(
  SHAPE_CATALOG.map((entry) => {
    const category = SHAPE_CATEGORIES.find((item) => item.id === entry.category)!;
    return [
      entry.name,
      {
        name: split(entry.name),
        keywords: entry.keywords.flatMap(split),
        category: [...split(category.id), ...split(category.title)],
        joined: entry.name.toLowerCase(),
      },
    ] as const;
  }),
);

/** The catalog entry of a preset name, or undefined. */
export function shapeCatalogEntry(name: string): ShapeCatalogEntry | undefined {
  return BY_NAME.get(name);
}

/** The presets of one gallery group, in the gallery's order. */
export function shapesInCategory(category: ShapeCategoryId): ShapeCatalogEntry[] {
  return SHAPE_CATALOG.filter((entry) => entry.category === category);
}

export interface ShapeSearchOptions {
  /** Only this gallery group. */
  category?: ShapeCategoryId;
  /** At most this many results (default all). */
  limit?: number;
}
export interface ShapeSearchResult {
  entry: ShapeCatalogEntry;
  /** Higher ranks first; ties keep the gallery's order. */
  score: number;
}

const stems = (word: string): string[] => (word.length > 3 && word.endsWith("s") ? [word, word.slice(0, -1)] : [word]);

/** The best score of one query word against one entry, 0 when it matches nothing. */
function wordScore(word: string, fields: NonNullable<ReturnType<typeof WORDS.get>>): number {
  let best = 0;
  for (const form of stems(word)) {
    const score = (words: readonly string[], equal: number, prefix: number) => (words.includes(form) ? equal : words.some((item) => item.startsWith(form)) ? prefix : 0);
    best = Math.max(
      best,
      score(fields.name, 10, 6),
      score(fields.keywords, 5, 3),
      score(fields.category, 2, 1),
      fields.joined.includes(form) ? 1 : 0,
    );
  }
  return best;
}

/**
 * Search the presets by DrawingML name (`rightArrow`) and common words (`speech bubble`, `arrow`, `star`,
 * `flowchart`, `database`). Every word of the query must match: a whole name word ranks above a prefix, a name above a
 * keyword above the group's title, and a query that is a preset's own name comes first. A plural matches its singular. An empty query
 * lists the catalog (or the group) in the gallery's order.
 */
export function searchShapeCatalog(query = "", options: ShapeSearchOptions = {}): ShapeSearchResult[] {
  const typed = query.trim();
  const words = [...new Set(split(typed))];
  const joined = typed.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const found: ShapeSearchResult[] = [];
  for (const entry of SHAPE_CATALOG) {
    if (options.category && entry.category !== options.category) continue;
    const fields = WORDS.get(entry.name)!;
    let score = 0;
    if (words.length) {
      let total = 0;
      for (const word of words) {
        const one = wordScore(word, fields);
        if (!one) {
          total = 0;
          break;
        }
        total += one;
      }
      if (!total) continue;
      score = total;
      if (joined === fields.joined) score += 100;
      else if (joined.length > 2 && fields.joined.startsWith(joined)) score += 20;
    }
    found.push({ entry, score });
  }
  // Array.prototype.sort is stable: equal scores keep the gallery's order.
  found.sort((a, b) => b.score - a.score);
  return options.limit === undefined ? found : found.slice(0, Math.max(0, options.limit));
}

// --- thumbnails ------------------------------------------------------------------------------------------------------

export interface ShapeThumbnailPath {
  d: string;
  /** `solid` is the shape's fill, `light` and `dark` its shaded parts, `none` a stroke-only path. */
  fill: "solid" | "light" | "dark" | "none";
  stroke: boolean;
}
export interface ShapeThumbnail {
  /** The SVG `viewBox`: the frame, grown to hold an outline that reaches past it (a callout's tail, a brace). */
  viewBox: string;
  paths: ShapeThumbnailPath[];
}

const FILL_OF = { norm: "solid", none: "none", lighten: "light", lightenLess: "light", darken: "dark", darkenLess: "dark" } as const;

/**
 * A small drawing of a preset from its geometry (`presetGeometry(name, width, height)`): the paths with their fill role and the `viewBox` that
 * holds the frame and every outline. The geometry is in the frame's own units, so the thumbnail is as sharp at any size.
 */
export function shapeThumbnail(geometry: ShapeGeometry, width: number, height: number): ShapeThumbnail {
  let minX = 0;
  let minY = 0;
  let maxX = width;
  let maxY = height;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const path of geometry.paths) for (const command of path.commands) for (let at = 1; at < command.length; at += 2) grow(command[at] as number, command[at + 1] as number);
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    viewBox: `${round(minX)} ${round(minY)} ${round(maxX - minX)} ${round(maxY - minY)}`,
    paths: geometry.paths.map((path) => ({ d: path.d, fill: FILL_OF[path.fill], stroke: path.stroke })),
  };
}

export interface ShapeThumbnailSvgOptions {
  /** Outline color (default `currentColor`). */
  stroke?: string;
  /** Fill color (default `currentColor` at 18% opacity). */
  fill?: string;
  /** Outline width in the frame's units (default a fiftieth of the longer side). */
  strokeWidth?: number;
}

/** A standalone `<svg>` string of a thumbnail (the MCP's `search_shapes` returns it). No script, no external reference. */
export function shapeThumbnailSvg(geometry: ShapeGeometry, width: number, height: number, options: ShapeThumbnailSvgOptions = {}): string {
  const thumb = shapeThumbnail(geometry, width, height);
  const stroke = options.stroke ?? "currentColor";
  const fill = options.fill ?? "currentColor";
  const line = options.strokeWidth ?? Math.round((Math.max(width, height) / 50) * 100) / 100;
  const opacity = { solid: options.fill ? 1 : 0.18, light: options.fill ? 0.6 : 0.1, dark: options.fill ? 1 : 0.3, none: 0 } as const;
  const parts = thumb.paths.map((path) => `<path d="${path.d}" fill="${path.fill === "none" ? "none" : fill}"${path.fill === "none" ? "" : ` fill-opacity="${opacity[path.fill]}"`} stroke="${path.stroke ? stroke : "none"}"${path.stroke ? ` stroke-width="${line}" stroke-linejoin="round" stroke-linecap="round"` : ""}/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${thumb.viewBox}" role="img" aria-hidden="true">${parts.join("")}</svg>`;
}
