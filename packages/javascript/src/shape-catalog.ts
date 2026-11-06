/**
 * The shape catalog (shapes SH-06): the 187 DrawingML presets as PowerPoint's Insert > Shapes gallery groups them, with the Aspose.Slides
 * `ShapeType` name of each and the common words people search by. Pure data and functions, no geometry: the editor's shape picker and the MCP's
 * `search_shapes` draw their thumbnails from `presetGeometry` (`@openpresentation/opf/shape-geometry`) and `shapeThumbnail` here.
 * Edge-safe (no Node import). The names are DrawingML's own (ECMA-376 `ST_ShapeType`); Aspose's are a mapping for readers who know that API.
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
  /** Aspose.Slides's `ShapeType` name for it (a mapping for readers of that API; OPF does not use it). */
  aspose: string;
  category: ShapeCategoryId;
  /** Common words people search by ('speech bubble', 'cylinder', 'cog'), besides the words of the two names. */
  keywords: readonly string[];
}

// [name, Aspose ShapeType, category, keywords], in the order of PowerPoint's gallery.
const ROWS: readonly (readonly [string, string, ShapeCategoryId] | readonly [string, string, ShapeCategoryId, string])[] = [
  ["line", "Line", "lines", "straight line"],
  ["lineInv", "LineInverse", "lines", "straight line inverse diagonal"],
  ["straightConnector1", "StraightConnector1", "lines", "connector line arrow straight"],
  ["bentConnector2", "BentConnector2", "lines", "elbow connector corner"],
  ["bentConnector3", "BentConnector3", "lines", "elbow connector"],
  ["bentConnector4", "BentConnector4", "lines", "elbow connector"],
  ["bentConnector5", "BentConnector5", "lines", "elbow connector"],
  ["curvedConnector2", "CurvedConnector2", "lines", "curve connector"],
  ["curvedConnector3", "CurvedConnector3", "lines", "curve connector s curve"],
  ["curvedConnector4", "CurvedConnector4", "lines", "curve connector"],
  ["curvedConnector5", "CurvedConnector5", "lines", "curve connector"],
  ["rect", "Rectangle", "rectangles", "box square"],
  ["roundRect", "RoundCornerRectangle", "rectangles", "rounded rectangle button card box"],
  ["snip1Rect", "OneSnipCornerRectangle", "rectangles", "cut corner"],
  ["snip2SameRect", "TwoSamesideSnipCornerRectangle", "rectangles", "cut corners"],
  ["snip2DiagRect", "TwoDiagonalSnipCornerRectangle", "rectangles", "cut corners"],
  ["snipRoundRect", "OneSnipOneRoundCornerRectangle", "rectangles", "cut round corner"],
  ["round1Rect", "OneRoundCornerRectangle", "rectangles", "rounded corner"],
  ["round2SameRect", "TwoSamesideRoundCornerRectangle", "rectangles", "rounded corners tab"],
  ["round2DiagRect", "TwoDiagonalRoundCornerRectangle", "rectangles", "rounded corners"],
  ["ellipse", "Ellipse", "basic", "circle oval round"],
  ["triangle", "Triangle", "basic", "isosceles triangle"],
  ["rtTriangle", "RightTriangle", "basic", "right triangle"],
  ["parallelogram", "Parallelogram", "basic", "slanted rhomboid"],
  ["trapezoid", "Trapezoid", "basic", "trapezium"],
  ["nonIsoscelesTrapezoid", "NonIsoscelesTrapezoid", "basic", "trapezium"],
  ["diamond", "Diamond", "basic", "rhombus"],
  ["pentagon", "Pentagon", "basic", "five sides regular polygon"],
  ["hexagon", "Hexagon", "basic", "six sides polygon honeycomb"],
  ["heptagon", "Heptagon", "basic", "seven sides polygon"],
  ["octagon", "Octagon", "basic", "eight sides polygon stop sign"],
  ["decagon", "Decagon", "basic", "ten sides polygon"],
  ["dodecagon", "Dodecagon", "basic", "twelve sides polygon"],
  ["pie", "Pie", "basic", "pie slice sector wedge"],
  ["pieWedge", "PieWedge", "basic", "quarter pie slice"],
  ["chord", "Chord", "basic", "circle segment"],
  ["teardrop", "Teardrop", "basic", "drop water tear"],
  ["frame", "Frame", "basic", "border picture frame"],
  ["halfFrame", "HalfFrame", "basic", "corner frame"],
  ["corner", "Corner", "basic", "l shape bracket"],
  ["diagStripe", "DiagonalStripe", "basic", "diagonal stripe band"],
  ["plus", "Plus", "basic", "cross add medical"],
  ["plaque", "Plaque", "basic", "badge label"],
  ["can", "Can", "basic", "cylinder database storage"],
  ["cube", "Cube", "basic", "box 3d block"],
  ["bevel", "Bevel", "basic", "button raised"],
  ["donut", "Donut", "basic", "ring circle hole"],
  ["noSmoking", "NoSmoking", "basic", "prohibited forbidden ban not allowed"],
  ["blockArc", "BlockArc", "basic", "arc ring half circle rainbow"],
  ["foldedCorner", "FoldedCorner", "basic", "note page sticky paper"],
  ["smileyFace", "SmileyFace", "basic", "smile emoji happy"],
  ["heart", "Heart", "basic", "love like favorite"],
  ["lightningBolt", "LightningBolt", "basic", "lightning flash energy power electric"],
  ["sun", "Sun", "basic", "sunny day weather"],
  ["moon", "Moon", "basic", "crescent night"],
  ["cloud", "Cloud", "basic", "weather cloud computing"],
  ["arc", "Arc", "basic", "curve arch"],
  ["bracketPair", "BracketPair", "basic", "brackets square"],
  ["bracePair", "BracePair", "basic", "braces curly"],
  ["leftBracket", "LeftBracket", "basic", "square bracket"],
  ["rightBracket", "RightBracket", "basic", "square bracket"],
  ["leftBrace", "LeftBrace", "basic", "curly brace"],
  ["rightBrace", "RightBrace", "basic", "curly brace"],
  ["gear6", "Gear6", "basic", "cog settings"],
  ["gear9", "Gear9", "basic", "cog settings"],
  ["funnel", "Funnel", "basic", "filter"],
  ["cornerTabs", "CornerTabs", "basic", "corner marks"],
  ["squareTabs", "SquareTabs", "basic", "corner marks"],
  ["plaqueTabs", "PlaqueTabs", "basic", "corner marks"],
  ["chartPlus", "ChartPlus", "basic", "chart marker"],
  ["chartStar", "ChartStar", "basic", "chart marker"],
  ["chartX", "ChartX", "basic", "chart marker"],
  ["rightArrow", "RightArrow", "blockArrows", "arrow next forward"],
  ["leftArrow", "LeftArrow", "blockArrows", "arrow back previous"],
  ["upArrow", "UpArrow", "blockArrows", "arrow"],
  ["downArrow", "DownArrow", "blockArrows", "arrow"],
  ["leftRightArrow", "LeftRightArrow", "blockArrows", "double arrow horizontal"],
  ["upDownArrow", "UpDownArrow", "blockArrows", "double arrow vertical"],
  ["quadArrow", "QuadArrow", "blockArrows", "four way arrow move"],
  ["leftRightUpArrow", "LeftRightUpArrow", "blockArrows", "three way arrow"],
  ["bentArrow", "BentArrow", "blockArrows", "turn arrow"],
  ["uturnArrow", "UTurnArrow", "blockArrows", "u turn arrow return"],
  ["leftUpArrow", "LeftUpArrow", "blockArrows", "bent arrow"],
  ["bentUpArrow", "BentUpArrow", "blockArrows", "turn arrow"],
  ["curvedRightArrow", "CurvedRightArrow", "blockArrows", "curve arrow"],
  ["curvedLeftArrow", "CurvedLeftArrow", "blockArrows", "curve arrow"],
  ["curvedUpArrow", "CurvedUpArrow", "blockArrows", "curve arrow"],
  ["curvedDownArrow", "CurvedDownArrow", "blockArrows", "curve arrow"],
  ["stripedRightArrow", "StripedRightArrow", "blockArrows", "arrow dashed"],
  ["notchedRightArrow", "NotchedRightArrow", "blockArrows", "arrow notch"],
  ["homePlate", "HomePlate", "blockArrows", "pentagon arrow step"],
  ["chevron", "Chevron", "blockArrows", "arrow step process"],
  ["rightArrowCallout", "CalloutRightArrow", "blockArrows", "arrow label"],
  ["downArrowCallout", "CalloutDownArrow", "blockArrows", "arrow label"],
  ["leftArrowCallout", "CalloutLeftArrow", "blockArrows", "arrow label"],
  ["upArrowCallout", "CalloutUpArrow", "blockArrows", "arrow label"],
  ["leftRightArrowCallout", "CalloutLeftRightArrow", "blockArrows", "arrow label"],
  ["upDownArrowCallout", "CalloutUpDownArrow", "blockArrows", "arrow label"],
  ["quadArrowCallout", "CalloutQuadArrow", "blockArrows", "arrow label"],
  ["circularArrow", "CircularArrow", "blockArrows", "cycle refresh loop arrow"],
  ["leftCircularArrow", "LeftCircularArrow", "blockArrows", "cycle refresh loop arrow"],
  ["leftRightCircularArrow", "LeftRightCircularArrow", "blockArrows", "cycle refresh loop arrow"],
  ["swooshArrow", "SwooshArrow", "blockArrows", "swoosh arrow growth"],
  ["mathPlus", "MathPlus", "equations", "add plus equation"],
  ["mathMinus", "MathMinus", "equations", "subtract minus equation"],
  ["mathMultiply", "MathMultiply", "equations", "times multiply cross equation"],
  ["mathDivide", "MathDivide", "equations", "divide equation"],
  ["mathEqual", "MathEqual", "equations", "equals equation"],
  ["mathNotEqual", "MathNotEqual", "equations", "not equal unequal equation"],
  ["flowChartAlternateProcess", "FlowChartAlternateProcess", "flowchart", "rounded step"],
  ["flowChartCollate", "FlowChartCollate", "flowchart", "hourglass"],
  ["flowChartConnector", "FlowChartConnector", "flowchart", "circle join"],
  ["flowChartDecision", "FlowChartDecision", "flowchart", "diamond choice branch if"],
  ["flowChartDelay", "FlowChartDelay", "flowchart", "wait"],
  ["flowChartDisplay", "FlowChartDisplay", "flowchart", "screen monitor"],
  ["flowChartDocument", "FlowChartDocument", "flowchart", "page report"],
  ["flowChartExtract", "FlowChartExtract", "flowchart", "triangle"],
  ["flowChartInputOutput", "FlowChartInputOutput", "flowchart", "data parallelogram"],
  ["flowChartInternalStorage", "FlowChartInternalStorage", "flowchart", "storage"],
  ["flowChartMagneticDisk", "FlowChartMagneticDisk", "flowchart", "database disk cylinder"],
  ["flowChartMagneticDrum", "FlowChartMagneticDrum", "flowchart", "drum storage"],
  ["flowChartMagneticTape", "FlowChartMagneticTape", "flowchart", "tape"],
  ["flowChartManualInput", "FlowChartManualInput", "flowchart", "keyboard input"],
  ["flowChartManualOperation", "FlowChartManualOperation", "flowchart", "manual step"],
  ["flowChartMerge", "FlowChartMerge", "flowchart", "triangle join"],
  ["flowChartMultidocument", "FlowChartMultidocument", "flowchart", "pages reports"],
  ["flowChartOfflineStorage", "FlowChartOfflineStorage", "flowchart", "storage triangle"],
  ["flowChartOffpageConnector", "FlowChartOffpageConnector", "flowchart", "page reference"],
  ["flowChartOnlineStorage", "FlowChartOnlineStorage", "flowchart", "storage"],
  ["flowChartOr", "FlowChartOr", "flowchart", "or circle"],
  ["flowChartPredefinedProcess", "FlowChartPredefinedProcess", "flowchart", "subprocess subroutine"],
  ["flowChartPreparation", "FlowChartPreparation", "flowchart", "hexagon setup"],
  ["flowChartProcess", "FlowChartProcess", "flowchart", "rectangle step"],
  ["flowChartPunchedCard", "FlowChartPunchedCard", "flowchart", "card"],
  ["flowChartPunchedTape", "FlowChartPunchedTape", "flowchart", "tape"],
  ["flowChartSort", "FlowChartSort", "flowchart", "diamond order"],
  ["flowChartSummingJunction", "FlowChartSummingJunction", "flowchart", "sum circle cross"],
  ["flowChartTerminator", "FlowChartTerminator", "flowchart", "start end stop oval"],
  ["irregularSeal1", "IrregularSeal1", "starsBanners", "burst explosion bang"],
  ["irregularSeal2", "IrregularSeal2", "starsBanners", "burst explosion bang"],
  ["star4", "FourPointedStar", "starsBanners", "four point star sparkle"],
  ["star5", "FivePointedStar", "starsBanners", "five point star favorite rating"],
  ["star6", "SixPointedStar", "starsBanners", "six point star david"],
  ["star7", "SevenPointedStar", "starsBanners", "seven point star"],
  ["star8", "EightPointedStar", "starsBanners", "eight point star"],
  ["star10", "TenPointedStar", "starsBanners", "ten point star"],
  ["star12", "TwelvePointedStar", "starsBanners", "twelve point star seal badge"],
  ["star16", "SixteenPointedStar", "starsBanners", "sixteen point star seal badge"],
  ["star24", "TwentyFourPointedStar", "starsBanners", "twenty four point star seal badge"],
  ["star32", "ThirtyTwoPointedStar", "starsBanners", "thirty two point star seal badge"],
  ["ribbon2", "Ribbon2", "starsBanners", "banner up ribbon"],
  ["ribbon", "Ribbon", "starsBanners", "banner down ribbon"],
  ["ellipseRibbon2", "EllipseRibbon2", "starsBanners", "banner curved up ribbon"],
  ["ellipseRibbon", "EllipseRibbon", "starsBanners", "banner curved down ribbon"],
  ["leftRightRibbon", "LeftRightRibbon", "starsBanners", "banner ribbon"],
  ["verticalScroll", "VerticalScroll", "starsBanners", "scroll paper banner"],
  ["horizontalScroll", "HorizontalScroll", "starsBanners", "scroll paper banner"],
  ["wave", "Wave", "starsBanners", "banner flag water"],
  ["doubleWave", "DoubleWave", "starsBanners", "banner flag water"],
  ["wedgeRectCallout", "RectangularCallout", "callouts", "speech bubble comment tooltip"],
  ["wedgeRoundRectCallout", "RoundedRectangularCallout", "callouts", "speech bubble comment tooltip"],
  ["wedgeEllipseCallout", "OvalCallout", "callouts", "speech bubble comment thought oval"],
  ["cloudCallout", "CloudCallout", "callouts", "thought bubble cloud comment"],
  ["borderCallout1", "Callout1WithBorder", "callouts", "line callout annotation"],
  ["borderCallout2", "Callout2WithBorder", "callouts", "line callout annotation"],
  ["borderCallout3", "Callout3WithBorder", "callouts", "line callout annotation"],
  ["accentCallout1", "Callout1WithAccent", "callouts", "line callout annotation"],
  ["accentCallout2", "Callout2WithAccent", "callouts", "line callout annotation"],
  ["accentCallout3", "Callout3WithAccent", "callouts", "line callout annotation"],
  ["callout1", "Callout1", "callouts", "line callout annotation"],
  ["callout2", "Callout2", "callouts", "line callout annotation"],
  ["callout3", "Callout3", "callouts", "line callout annotation"],
  ["accentBorderCallout1", "Callout1WithBorderAndAccent", "callouts", "line callout annotation"],
  ["accentBorderCallout2", "Callout2WithBorderAndAccent", "callouts", "line callout annotation"],
  ["accentBorderCallout3", "Callout3WithBorderAndAccent", "callouts", "line callout annotation"],
  ["actionButtonBackPrevious", "BackOrPreviousButton", "actionButtons", "back previous button"],
  ["actionButtonBeginning", "BeginningButton", "actionButtons", "first start button"],
  ["actionButtonBlank", "BlankButton", "actionButtons", "empty button"],
  ["actionButtonDocument", "DocumentButton", "actionButtons", "file page button"],
  ["actionButtonEnd", "EndButton", "actionButtons", "last finish button"],
  ["actionButtonForwardNext", "ForwardOrNextButton", "actionButtons", "forward next button"],
  ["actionButtonHelp", "HelpButton", "actionButtons", "question mark button"],
  ["actionButtonHome", "HomeButton", "actionButtons", "house button"],
  ["actionButtonInformation", "InformationButton", "actionButtons", "info button"],
  ["actionButtonMovie", "MovieButton", "actionButtons", "video film button"],
  ["actionButtonReturn", "ReturnButton", "actionButtons", "back return button"],
  ["actionButtonSound", "SoundButton", "actionButtons", "audio speaker volume button"],
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
  ROWS.map((row) => Object.freeze({ name: row[0], aspose: row[1], category: row[2], keywords: Object.freeze(row[3] ? row[3].split(" ") : []) })),
);

const BY_NAME = new Map(SHAPE_CATALOG.map((entry) => [entry.name, entry]));
const WORDS = new Map(
  SHAPE_CATALOG.map((entry) => {
    const category = SHAPE_CATEGORIES.find((item) => item.id === entry.category)!;
    return [
      entry.name,
      {
        name: split(entry.name),
        aspose: split(entry.aspose),
        keywords: entry.keywords.flatMap(split),
        category: [...split(category.id), ...split(category.title)],
        joined: entry.name.toLowerCase(),
        asposeJoined: entry.aspose.toLowerCase(),
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
      score(fields.aspose, 8, 5),
      score(fields.keywords, 5, 3),
      score(fields.category, 2, 1),
      fields.joined.includes(form) || fields.asposeJoined.includes(form) ? 1 : 0,
    );
  }
  return best;
}

/**
 * Search the presets by DrawingML name (`rightArrow`), Aspose name (`RectangularCallout`) and common words (`speech bubble`, `arrow`, `star`,
 * `flowchart`, `database`). Every word of the query must match: a whole name word ranks above a prefix, a name above an Aspose name above a
 * keyword above the group's title, and a query that is a preset's own name (either) comes first. A plural matches its singular. An empty query
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
      else if (joined === fields.asposeJoined) score += 90;
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
