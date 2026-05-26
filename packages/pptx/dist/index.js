import PptxGenJS from "pptxgenjs";
import { unzipSync, zipSync } from "fflate";
import {
  catalogs as bundledCatalogs,
  validatePresentation
} from "@openpresentation/opf";

export const packageName = "@openpresentation/opf-pptx";

export const releaseLane = Object.freeze({
  githubRepository: "OpenPresentation/opf-pptx",
  npmPackage: "@openpresentation/opf-pptx",
  compatibilityPackage: "@openpresentation/opf",
  rendererPackage: "@openpresentation/opf-render"
});

export const runtimePolicy = Object.freeze({
  hostedServiceInCriticalPath: false,
  telemetry: false,
  commercialSdkInCriticalPath: false,
  requiredAiDependency: false,
  requiredLibreOfficeDependency: false,
  requiredNetworkCalls: false,
  deterministicLocalExecution: true
});

export class OPFPptxError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "OPFPptxError";
    this.code = code;
    this.details = details;
    if (details.issues) this.issues = details.issues;
    if (details.path) this.path = details.path;
  }
}

const FIXED_TIMESTAMP = "1980-01-01T00:00:00Z";
const FIXED_ZIP_DATE = new Date(FIXED_TIMESTAMP);
const DEFAULT_SEED = 0x4f504658;

const ROOT_PAYLOAD_FIELDS = [
  "text",
  "items",
  "bullets",
  "image",
  "video",
  "chart",
  "table",
  "code",
  "metric",
  "quote",
  "timeline"
];

const PROMOTED_REGION_KEYS = [
  "left",
  "center",
  "right",
  "left+center",
  "center+right",
  "left+center+right",
  "top",
  "middle",
  "bottom",
  "top+middle",
  "middle+bottom",
  "top+middle+bottom",
  "top:left",
  "top:center",
  "top:right",
  "top:left+center",
  "top:center+right",
  "top:left+center+right",
  "middle:left",
  "middle:center",
  "middle:right",
  "middle:left+center",
  "middle:center+right",
  "middle:left+center+right",
  "bottom:left",
  "bottom:center",
  "bottom:right",
  "bottom:left+center",
  "bottom:center+right",
  "bottom:left+center+right",
  "top+middle:left",
  "top+middle:center",
  "top+middle:right",
  "top+middle:left+center",
  "top+middle:center+right",
  "top+middle:left+center+right",
  "middle+bottom:left",
  "middle+bottom:center",
  "middle+bottom:right",
  "middle+bottom:left+center",
  "middle+bottom:center+right",
  "middle+bottom:left+center+right",
  "top+middle+bottom:left",
  "top+middle+bottom:center",
  "top+middle+bottom:right",
  "top+middle+bottom:left+center",
  "top+middle+bottom:center+right",
  "top+middle+bottom:left+center+right"
];

const DIMENSION_PRESETS = Object.freeze({
  widescreen: Object.freeze({ widthInches: 13.333333, heightInches: 7.5 }),
  "16:9": Object.freeze({ widthInches: 13.333333, heightInches: 7.5 }),
  standard: Object.freeze({ widthInches: 10, heightInches: 7.5 }),
  "4:3": Object.freeze({ widthInches: 10, heightInches: 7.5 }),
  "16:10": Object.freeze({ widthInches: 10, heightInches: 6.25 }),
  letter: Object.freeze({ widthInches: 11, heightInches: 8.5 }),
  a4: Object.freeze({ widthInches: 11.69, heightInches: 8.27 })
});

const DEFAULTS = Object.freeze({
  theme: "minimal",
  colorScheme: "cool-horizon",
  fontScheme: "aptos"
});

const CHART_COLORS = [
  "2874A6",
  "1B4F72",
  "5499C7",
  "7BDBB2",
  "3AC67A",
  "24A89E",
  "F59E0B",
  "EF4444",
  "8B5CF6",
  "14B8A6",
  "0F172A",
  "64748B"
];

export async function toPptx(input, options = {}) {
  const presentation = parseInput(input);
  assertValidBoundary(presentation);

  const context = resolvePresentationContext(presentation, options);
  const pptx = new PptxGenJS();
  configurePresentation(pptx, presentation, context);

  for (let index = 0; index < presentation.slides.length; index += 1) {
    await addSlide(pptx, presentation, presentation.slides[index], index, context, options);
  }

  let raw;
  try {
    raw = await withDeterministicRandom(context.seed, () => pptx.write({
      outputType: "uint8array",
      compression: true
    }));
  } catch (error) {
    throw new OPFPptxError("pptxgen-failed", "PPTX generation failed.", {
      cause: errorMessage(error)
    });
  }

  return normalizePptxZip(asUint8Array(raw), context);
}

export async function fromPptx() {
  throw new OPFPptxError(
    "unsupported-operation",
    "fromPptx is intentionally out of scope for the OPF-to-PPTX export phase."
  );
}

function parseInput(input) {
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch (error) {
      throw new OPFPptxError("invalid-json", "OPF input is not valid JSON.", {
        cause: errorMessage(error)
      });
    }
  }

  if (input instanceof Uint8Array) {
    return parseInput(new TextDecoder().decode(input));
  }

  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input;
  }

  throw new OPFPptxError("invalid-input", "OPF input must be a parsed object, JSON string, or Uint8Array.");
}

function assertValidBoundary(presentation) {
  const result = validatePresentation(presentation);
  if (!result.valid) {
    throw new OPFPptxError("invalid-opf", "OPF validation failed.", {
      issues: result.errors,
      result
    });
  }
}

function resolvePresentationContext(presentation, options) {
  const design = presentation.design ?? {};
  const theme = resolveCatalogRecord(presentation, "themes", design.theme, DEFAULTS.theme);
  const colorScheme = resolveDesignRecord(
    presentation,
    "colorSchemes",
    design.colorScheme ?? theme?.colorScheme,
    DEFAULTS.colorScheme
  );
  const fontScheme = resolveDesignRecord(
    presentation,
    "fontSchemes",
    design.fontScheme ?? theme?.fontScheme,
    DEFAULTS.fontScheme
  );
  const dimensions = resolveDimensions(design.dimensions ?? theme?.dimensions);
  const background = resolveBackground(design.background ?? theme?.background, colorScheme);
  const fonts = resolveFonts(fontScheme);
  const textColor = readableTextColor(background, colorScheme);

  return {
    seed: Number.isInteger(options.seed) ? options.seed : DEFAULT_SEED,
    timestamp: options.timestamp ?? FIXED_TIMESTAMP,
    zipDate: options.zipDate ? new Date(options.zipDate) : FIXED_ZIP_DATE,
    compressionLevel: Number.isInteger(options.compressionLevel) ? options.compressionLevel : 6,
    layoutName: "OPF_CANVAS",
    dimensions,
    colorScheme,
    fonts,
    colors: {
      background,
      text: textColor,
      mutedText: normalizeHex(colorScheme.textSecondary ?? colorScheme.dark2 ?? "#475569"),
      accent: normalizeHex(colorScheme.primary ?? colorScheme.accent1 ?? "#2874A6"),
      surface: normalizeHex(colorScheme.surface ?? colorScheme.light2 ?? "#F8FAFC"),
      border: normalizeHex(colorScheme.accent3 ?? "#CBD5E1")
    }
  };
}

function configurePresentation(pptx, presentation, context) {
  pptx.defineLayout({
    name: context.layoutName,
    width: context.dimensions.widthInches,
    height: context.dimensions.heightInches
  });
  pptx.layout = context.layoutName;
  pptx.author = normalizeAuthor(presentation.author) ?? "OpenPresentation";
  pptx.company = "OpenPresentation";
  pptx.subject = presentation.description ?? "";
  pptx.title = presentation.name ?? presentation.filename ?? "OPF Presentation";
  pptx.revision = "1";
  pptx.theme = {
    headFontFace: context.fonts.heading,
    bodyFontFace: context.fonts.body
  };
}

async function addSlide(pptx, presentation, opfSlide, slideIndex, context, options) {
  const slide = pptx.addSlide();
  const slideContext = resolveSlideContext(presentation, opfSlide, context);
  slide.background = { color: slideContext.colors.background };
  slide.color = slideContext.colors.text;
  if (opfSlide.hidden === true) slide.hidden = true;

  const { widthInches, heightInches } = slideContext.dimensions;
  const margin = 0.55;
  let y = 0.34;

  if (opfSlide.tag) {
    slide.addText(String(opfSlide.tag), {
      x: margin,
      y,
      w: widthInches - margin * 2,
      h: 0.24,
      margin: 0,
      fontFace: slideContext.fonts.body,
      fontSize: 9,
      bold: true,
      color: slideContext.colors.accent,
      fit: "shrink"
    });
    y += 0.32;
  }

  const title = opfSlide.title ?? presentation.title ?? presentation.name;
  if (title) {
    slide.addText(String(title), {
      x: margin,
      y,
      w: widthInches - margin * 2,
      h: 0.58,
      margin: 0,
      fontFace: slideContext.fonts.heading,
      fontSize: 28,
      bold: true,
      color: slideContext.colors.text,
      fit: "shrink",
      breakLine: false
    });
    y += 0.68;
  }

  const subtitle = opfSlide.subtitle ?? presentation.subtitle;
  if (subtitle) {
    slide.addText(String(subtitle), {
      x: margin,
      y,
      w: widthInches - margin * 2,
      h: 0.34,
      margin: 0,
      fontFace: slideContext.fonts.body,
      fontSize: 14,
      color: slideContext.colors.mutedText,
      fit: "shrink"
    });
    y += 0.48;
  }

  const contentTop = Math.max(y + 0.08, title || subtitle || opfSlide.tag ? 1.25 : 0.55);
  const contentArea = {
    x: margin,
    y: contentTop,
    w: widthInches - margin * 2,
    h: Math.max(0.7, heightInches - contentTop - 0.48)
  };
  const bindings = collectSlideBindings(opfSlide, slideIndex);

  for (let index = 0; index < bindings.length; index += 1) {
    const binding = bindings[index];
    const region = binding.regionKey
      ? regionFromPromotedKey(binding.regionKey, contentArea)
      : regionFromIndex(index, bindings.length, contentArea);
    await addPayload(slide, presentation, binding.payload, insetRegion(region, 0.08), binding.path, slideContext, options);
  }

  if (opfSlide.notes) slide.addNotes(String(opfSlide.notes));
}

function resolveSlideContext(presentation, slide, baseContext) {
  if (!slide.design) return baseContext;
  const design = slide.design;
  const colorScheme = resolveDesignRecord(
    presentation,
    "colorSchemes",
    design.colorScheme,
    baseContext.colorScheme.id ?? DEFAULTS.colorScheme
  );
  const fontScheme = resolveDesignRecord(
    presentation,
    "fontSchemes",
    design.fontScheme,
    baseContext.fonts.id ?? DEFAULTS.fontScheme
  );
  const background = design.background
    ? resolveBackground(design.background, colorScheme)
    : baseContext.colors.background;
  const fonts = design.fontScheme ? resolveFonts(fontScheme) : baseContext.fonts;

  return {
    ...baseContext,
    colorScheme,
    fonts,
    colors: {
      ...baseContext.colors,
      background,
      text: readableTextColor(background, colorScheme),
      mutedText: normalizeHex(colorScheme.textSecondary ?? colorScheme.dark2 ?? baseContext.colors.mutedText),
      accent: normalizeHex(colorScheme.primary ?? colorScheme.accent1 ?? baseContext.colors.accent),
      surface: normalizeHex(colorScheme.surface ?? colorScheme.light2 ?? baseContext.colors.surface),
      border: normalizeHex(colorScheme.accent3 ?? baseContext.colors.border)
    }
  };
}

function collectSlideBindings(slide, slideIndex) {
  const promoted = PROMOTED_REGION_KEYS
    .filter((key) => slide[key] !== undefined)
    .map((key) => ({
      payload: slide[key],
      regionKey: key,
      path: `slides.${slideIndex}.${key}`
    }));

  if (promoted.length > 0) return promoted;

  if (Array.isArray(slide.blocks) && slide.blocks.length > 0) {
    return slide.blocks.map((payload, index) => ({
      payload,
      path: `slides.${slideIndex}.blocks.${index}`
    }));
  }

  return ROOT_PAYLOAD_FIELDS
    .filter((field) => slide[field] !== undefined)
    .map((field) => ({
      payload: { type: fieldToType(field), [field]: slide[field] },
      path: `slides.${slideIndex}.${field}`
    }));
}

function fieldToType(field) {
  if (field === "items") return "list";
  if (field === "bullets") return "text";
  return field;
}

async function addPayload(slide, presentation, payload, region, path, context, options) {
  const kind = inferPayloadKind(payload);
  switch (kind) {
    case "text":
      addTextPayload(slide, payload.text ?? payload.bullets, region, context);
      break;
    case "list":
      addListPayload(slide, payload.items ?? payload.bullets, region, context);
      break;
    case "image":
      await addImagePayload(slide, presentation, payload.image, region, path, context, options);
      break;
    case "video":
      addPlaceholderPayload(slide, "Video", payload.video, region, context);
      break;
    case "chart":
      addChartPayload(slide, payload.chart, region, context);
      break;
    case "table":
      addTablePayload(slide, payload.table, region, context);
      break;
    case "code":
      addCodePayload(slide, payload.code, region, context);
      break;
    case "metric":
      addMetricPayload(slide, payload.metric, region, context);
      break;
    case "quote":
      addQuotePayload(slide, payload.quote, region, context);
      break;
    case "timeline":
      addTimelinePayload(slide, payload.timeline, region, context);
      break;
    default:
      addPlaceholderPayload(slide, "Unsupported OPF payload", payload, region, context);
  }
}

function inferPayloadKind(payload) {
  if (payload?.type === "list") return "list";
  if (payload?.type && ROOT_PAYLOAD_FIELDS.includes(payload.type)) return fieldToType(payload.type);
  if (payload?.items !== undefined) return "list";
  for (const field of ROOT_PAYLOAD_FIELDS) {
    if (payload?.[field] !== undefined) return fieldToType(field);
  }
  return "unknown";
}

function addTextPayload(slide, value, region, context) {
  if (Array.isArray(value)) {
    slide.addText(textRuns(value, context, 18), textBoxOptions(region, context, 18));
    return;
  }
  if (Array.isArray(value?.bullets)) {
    addListPayload(slide, value.bullets, region, context);
    return;
  }
  slide.addText(stringifyText(value), textBoxOptions(region, context, 18));
}

function addListPayload(slide, items, region, context) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    slide.addText("", textBoxOptions(region, context, 16));
    return;
  }

  const runs = [];
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    const level = isPlainObject(item) && Number.isInteger(item.level) ? item.level : 0;
    runs.push({
      text: stringifyText(isPlainObject(item) ? item.text : item),
      options: {
        bullet: { type: "bullet", indent: 14 + level * 14 },
        breakLine: index < list.length - 1 || Boolean(isPlainObject(item) && item.description),
        color: context.colors.text,
        fontFace: context.fonts.body,
        fontSize: 15,
        hanging: 4 + level * 10
      }
    });
    if (isPlainObject(item) && item.description) {
      runs.push({
        text: stringifyText(item.description),
        options: {
          breakLine: index < list.length - 1,
          color: context.colors.mutedText,
          fontFace: context.fonts.body,
          fontSize: 11,
          margin: [0, 0, 0, 18 + level * 14]
        }
      });
    }
  }

  slide.addText(runs, textBoxOptions(region, context, 15));
}

async function addImagePayload(slide, presentation, asset, region, path, context, options) {
  const resolved = await resolveImage(asset, presentation, options, path);
  if (!resolved) {
    addPlaceholderPayload(slide, "Image", asset, region, context);
    return;
  }
  slide.addImage({
    ...resolved,
    x: region.x,
    y: region.y,
    w: region.w,
    h: region.h,
    altText: assetAlt(asset, presentation)
  });
}

function addChartPayload(slide, chart, region, context) {
  const chartData = toPptxChartData(chart);
  if (!chartData) {
    addPlaceholderPayload(slide, "Chart", chart, region, context);
    return;
  }

  slide.addChart(chartData.type, chartData.series, {
    x: region.x,
    y: region.y,
    w: region.w,
    h: region.h,
    showLegend: chartData.series.length > 1,
    showTitle: false,
    chartColors: CHART_COLORS,
    catAxisLabelFontFace: context.fonts.body,
    catAxisLabelFontSize: 9,
    valAxisLabelFontFace: context.fonts.body,
    valAxisLabelFontSize: 9,
    showValue: false,
    valGridLine: { color: context.colors.border, transparency: 30, size: 1 },
    barDir: chartData.barDir,
    barGrouping: chartData.barGrouping
  });
}

function addTablePayload(slide, table, region, context) {
  const rows = [];
  if (Array.isArray(table?.columns) && table.columns.length > 0) {
    rows.push(table.columns.map((value) => ({
      text: stringifyText(value),
      options: {
        bold: true,
        color: context.colors.text,
        fill: { color: context.colors.surface }
      }
    })));
  }
  if (Array.isArray(table?.rows)) {
    for (const row of table.rows) {
      rows.push((Array.isArray(row) ? row : [row]).map((value) => ({
        text: stringifyText(value),
        options: { color: context.colors.text }
      })));
    }
  }

  if (rows.length === 0) {
    addPlaceholderPayload(slide, "Table", table, region, context);
    return;
  }

  slide.addTable(rows, {
    x: region.x,
    y: region.y,
    w: region.w,
    h: region.h,
    fontFace: context.fonts.body,
    fontSize: 10,
    color: context.colors.text,
    border: { type: "solid", color: context.colors.border, pt: 0.75 },
    margin: 0.05,
    valign: "mid",
    fit: "shrink"
  });
}

function addCodePayload(slide, value, region, context) {
  const code = typeof value === "string" ? { source: value } : value;
  const title = code?.filename ? `${code.filename}${code.language ? ` (${code.language})` : ""}` : code?.language;
  const body = [title, code?.source].filter(Boolean).join("\n");
  slide.addText(body, {
    ...textBoxOptions(region, context, 11),
    fontFace: context.fonts.code,
    fill: { color: context.colors.surface },
    line: { color: context.colors.border, pt: 0.75 },
    margin: 8,
    fit: "shrink"
  });
}

function addMetricPayload(slide, value, region, context) {
  const metric = isPlainObject(value) ? value : { value };
  slide.addText(String(metric.value ?? ""), {
    x: region.x,
    y: region.y,
    w: region.w,
    h: Math.min(region.h, 0.68),
    margin: 0,
    fontFace: context.fonts.heading,
    fontSize: 30,
    bold: true,
    color: context.colors.accent,
    fit: "shrink"
  });
  slide.addText([metric.label, metric.description, metric.delta].filter(Boolean).join("\n"), {
    x: region.x,
    y: region.y + 0.76,
    w: region.w,
    h: Math.max(0.3, region.h - 0.78),
    margin: 0,
    fontFace: context.fonts.body,
    fontSize: 12,
    color: context.colors.text,
    fit: "shrink"
  });
}

function addQuotePayload(slide, value, region, context) {
  const quote = typeof value === "string" ? { text: value } : value;
  const attribution = quote?.attribution ? `\n- ${quote.attribution}` : "";
  slide.addText(`${quote?.text ?? ""}${attribution}`, {
    ...textBoxOptions(region, context, 17),
    italic: true,
    color: context.colors.text,
    fit: "shrink"
  });
}

function addTimelinePayload(slide, value, region, context) {
  const timeline = Array.isArray(value) ? { events: value } : value;
  const events = Array.isArray(timeline?.events) ? timeline.events : [];
  const lines = events.map((event) => {
    const when = event.when ? `${event.when}: ` : "";
    const detail = event.description ? ` - ${event.description}` : "";
    return `${when}${event.what ?? ""}${detail}`;
  });
  slide.addText(lines.join("\n"), textBoxOptions(region, context, 13));
}

function addPlaceholderPayload(slide, label, value, region, context) {
  slide.addShape("rect", {
    x: region.x,
    y: region.y,
    w: region.w,
    h: region.h,
    fill: { color: context.colors.surface, transparency: 10 },
    line: { color: context.colors.border, pt: 0.75 }
  });
  slide.addText(`${label}\n${summarizeValue(value)}`, {
    x: region.x + 0.12,
    y: region.y + 0.12,
    w: Math.max(0.2, region.w - 0.24),
    h: Math.max(0.2, region.h - 0.24),
    margin: 0,
    fontFace: context.fonts.body,
    fontSize: 11,
    color: context.colors.mutedText,
    fit: "shrink",
    valign: "mid",
    align: "center"
  });
}

function textBoxOptions(region, context, fontSize) {
  return {
    x: region.x,
    y: region.y,
    w: region.w,
    h: region.h,
    margin: 4,
    fontFace: context.fonts.body,
    fontSize,
    color: context.colors.text,
    breakLine: false,
    fit: "shrink",
    valign: "mid"
  };
}

function textRuns(value, context, fallbackFontSize) {
  const runs = Array.isArray(value) ? value : [value];
  return runs.map((run) => {
    if (typeof run === "string") {
      return {
        text: run,
        options: {
          color: context.colors.text,
          fontFace: context.fonts.body,
          fontSize: fallbackFontSize
        }
      };
    }
    return {
      text: String(run?.text ?? ""),
      options: {
        bold: run?.bold,
        italic: run?.italic,
        underline: run?.underline ? { color: normalizeHex(run.color ?? context.colors.text) } : undefined,
        strike: run?.strikethrough ? "sngStrike" : undefined,
        color: normalizeHex(run?.color ?? context.colors.text),
        fontFace: run?.fontFamily ?? context.fonts.body,
        fontSize: run?.fontSize ?? fallbackFontSize,
        hyperlink: run?.link ? { url: run.link } : undefined
      }
    };
  });
}

function toPptxChartData(chart) {
  const data = chart?.data;
  if (!data || !Array.isArray(data.columns) || !Array.isArray(data.rows)) return null;
  if (data.columns.length < 2 || data.rows.length === 0) return null;

  const labels = data.rows.map((row) => stringifyText(row?.[0]));
  const series = data.columns.slice(1).map((name, seriesIndex) => ({
    name: stringifyText(name),
    labels,
    values: data.rows.map((row) => numericValue(row?.[seriesIndex + 1]))
  }));
  const mapped = mapChartType(chart.type);

  return { ...mapped, series };
}

function mapChartType(type) {
  const normalized = String(type ?? "").toLowerCase();
  if (normalized.includes("pie")) return { type: "pie" };
  if (normalized.includes("doughnut") || normalized.includes("donut")) return { type: "doughnut" };
  if (normalized.includes("area")) return { type: "area" };
  if (normalized.includes("line") || normalized.includes("sparkline")) return { type: "line" };
  if (normalized.includes("scatter")) return { type: "scatter" };
  if (normalized.includes("radar")) return { type: "radar" };
  if (normalized.includes("bar")) {
    return {
      type: "bar",
      barDir: "bar",
      barGrouping: normalized.includes("stacked") ? "stacked" : "clustered"
    };
  }
  return {
    type: "bar",
    barDir: "col",
    barGrouping: normalized.includes("stacked") ? "stacked" : "clustered"
  };
}

async function resolveImage(asset, presentation, options, path) {
  const assetObject = dereferenceAsset(asset, presentation, path);
  const src = typeof assetObject === "string" ? assetObject : assetObject?.src;
  if (!src) {
    if (options.strictAssets) {
      throw new OPFPptxError("missing-asset", "Image asset is missing a source.", { path });
    }
    return null;
  }

  const resolvedByHost = options.imageResolver
    ? await options.imageResolver(src, { asset: assetObject, presentation, path })
    : null;
  if (resolvedByHost) return normalizeResolvedImage(resolvedByHost, assetObject);

  if (src.startsWith("data:")) return { data: src };
  if (/^https?:\/\//i.test(src)) {
    if (options.strictAssets) {
      throw new OPFPptxError("unsupported-asset", "Remote image assets require an imageResolver; network fetch is not used.", {
        path,
        src
      });
    }
    return null;
  }
  if (src.startsWith("asset:")) {
    if (options.strictAssets) {
      throw new OPFPptxError("missing-asset", "Image asset reference could not be resolved.", { path, src });
    }
    return null;
  }

  const pathValue = options.baseDir && !isAbsolutePath(src) ? joinPath(options.baseDir, src) : src;
  return { path: pathValue };
}

function normalizeResolvedImage(value, asset) {
  if (typeof value === "string") {
    if (value.startsWith("data:")) return { data: value };
    return { path: value };
  }
  if (value instanceof Uint8Array) {
    const mediaType = asset?.mediaType ?? "image/png";
    return { data: `data:${mediaType};base64,${bytesToBase64(value)}` };
  }
  if (value && typeof value === "object") {
    if (typeof value.data === "string") return { data: value.data };
    if (value.data instanceof Uint8Array) {
      const mediaType = value.mediaType ?? asset?.mediaType ?? "image/png";
      return { data: `data:${mediaType};base64,${bytesToBase64(value.data)}` };
    }
    if (typeof value.path === "string") return { path: value.path };
  }
  throw new OPFPptxError("invalid-image-resolution", "imageResolver must return a data URI, path, Uint8Array, or { data | path } object.");
}

function dereferenceAsset(asset, presentation, path, seen = new Set()) {
  const source = typeof asset === "string" ? asset : asset?.src;
  if (typeof source === "string" && source.startsWith("asset:")) {
    const id = source.slice("asset:".length);
    if (seen.has(id)) {
      throw new OPFPptxError("invalid-asset-reference", "Circular asset reference detected.", { path, assetId: id });
    }
    seen.add(id);
    const target = presentation.assets?.[id];
    if (!target) return asset;
    return dereferenceAsset(target, presentation, path, seen);
  }
  return asset;
}

function assetAlt(asset, presentation) {
  const resolved = dereferenceAsset(asset, presentation, "asset-alt");
  if (resolved && typeof resolved === "object" && !Array.isArray(resolved)) {
    return resolved.alt ?? resolved.title ?? resolved.description;
  }
  return undefined;
}

function resolveCatalogRecord(presentation, kind, reference, fallbackId) {
  const id = referenceId(reference) ?? fallbackId;
  const inlineRecords = normalizeRecords(presentation.catalogs?.[kind]);
  return findById(inlineRecords, id)
    ?? findById(defaultCatalog(kind), id)
    ?? findById(defaultCatalog(kind), fallbackId)
    ?? null;
}

function resolveDesignRecord(presentation, kind, reference, fallbackId) {
  const base = resolveCatalogRecord(presentation, kind, reference, fallbackId) ?? {};
  return {
    ...base,
    ...(isPlainObject(reference) ? withoutSchema(reference) : {})
  };
}

function referenceId(reference) {
  if (typeof reference === "string") return reference;
  if (isPlainObject(reference) && typeof reference.id === "string") return reference.id;
  return null;
}

function defaultCatalog(kind) {
  return Array.isArray(bundledCatalogs[kind]) ? bundledCatalogs[kind] : [];
}

function normalizeRecords(catalog) {
  if (!catalog) return [];
  if (Array.isArray(catalog)) return catalog;
  if (Array.isArray(catalog.records)) return catalog.records;
  return [];
}

function findById(records, id) {
  return records.find((record) => record?.id === id) ?? null;
}

function withoutSchema(value) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "$schema"));
}

function resolveDimensions(value) {
  if (typeof value === "string") return DIMENSION_PRESETS[value] ?? DIMENSION_PRESETS.widescreen;
  if (isPlainObject(value)) {
    const preset = DIMENSION_PRESETS[value.preset] ?? DIMENSION_PRESETS.widescreen;
    return {
      widthInches: value.widthInches ?? preset.widthInches,
      heightInches: value.heightInches ?? preset.heightInches
    };
  }
  return DIMENSION_PRESETS.widescreen;
}

function resolveBackground(value, colorScheme) {
  if (typeof value === "string") {
    if (value.startsWith("#")) return normalizeHex(value);
    return normalizeHex(colorScheme[value] ?? colorScheme.background ?? colorScheme.light1 ?? "#FFFFFF");
  }
  if (isPlainObject(value)) {
    if (value.type === "solid" && value.color) return normalizeHex(value.color);
    if (value.type === "theme" && value.slot) {
      return normalizeHex(colorScheme[value.slot] ?? colorScheme.light1 ?? "#FFFFFF");
    }
    if (value.backgroundColor) return normalizeHex(value.backgroundColor);
  }
  return normalizeHex(colorScheme.background ?? colorScheme.light1 ?? "#FFFFFF");
}

function resolveFonts(fontScheme) {
  const heading = fontFamily(fontScheme.heading) ?? fontScheme.major ?? "Aptos Display";
  const body = fontFamily(fontScheme.body) ?? fontScheme.minor ?? "Aptos";
  return {
    id: fontScheme.id,
    heading,
    body,
    code: fontFamily(fontScheme.code) ?? "Consolas"
  };
}

function fontFamily(value) {
  if (typeof value === "string") return value;
  if (isPlainObject(value) && typeof value.family === "string") return value.family;
  return null;
}

function readableTextColor(background, colorScheme) {
  return isDarkHex(background)
    ? normalizeHex(colorScheme.light1 ?? "#FFFFFF")
    : normalizeHex(colorScheme.text ?? colorScheme.dark1 ?? "#0F172A");
}

function normalizeHex(value) {
  if (typeof value !== "string") return "000000";
  const raw = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return raw.split("").map((char) => char + char).join("").toUpperCase();
  }
  if (/^[0-9a-fA-F]{6,8}$/.test(raw)) {
    return raw.slice(0, 6).toUpperCase();
  }
  return raw.toUpperCase();
}

function isDarkHex(value) {
  const hex = normalizeHex(value);
  if (!/^[0-9A-F]{6}$/.test(hex)) return false;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 < 128;
}

function regionFromPromotedKey(key, area) {
  const [first, second] = key.includes(":") ? key.split(":") : [key, null];
  const rowPart = second ? first : isRowPart(first) ? first : "top+middle+bottom";
  const colPart = second ? second : isColumnPart(first) ? first : "left+center+right";
  const rowSpan = span(rowPart, ["top", "middle", "bottom"]);
  const colSpan = span(colPart, ["left", "center", "right"]);
  const cellW = area.w / 3;
  const cellH = area.h / 3;

  return {
    x: area.x + colSpan.start * cellW,
    y: area.y + rowSpan.start * cellH,
    w: (colSpan.end - colSpan.start + 1) * cellW,
    h: (rowSpan.end - rowSpan.start + 1) * cellH
  };
}

function isRowPart(value) {
  return value.split("+").every((part) => ["top", "middle", "bottom"].includes(part));
}

function isColumnPart(value) {
  return value.split("+").every((part) => ["left", "center", "right"].includes(part));
}

function span(value, order) {
  const indexes = value.split("+").map((part) => order.indexOf(part)).filter((index) => index >= 0);
  if (indexes.length === 0) return { start: 0, end: order.length - 1 };
  return { start: Math.min(...indexes), end: Math.max(...indexes) };
}

function regionFromIndex(index, total, area) {
  if (total <= 1) return area;
  const columns = total === 2 ? 2 : Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / columns);
  const row = Math.floor(index / columns);
  const col = index % columns;
  return {
    x: area.x + (area.w / columns) * col,
    y: area.y + (area.h / rows) * row,
    w: area.w / columns,
    h: area.h / rows
  };
}

function insetRegion(region, amount) {
  return {
    x: region.x + amount,
    y: region.y + amount,
    w: Math.max(0.2, region.w - amount * 2),
    h: Math.max(0.2, region.h - amount * 2)
  };
}

function normalizePptxZip(raw, context) {
  let entries;
  try {
    entries = unzipSync(raw);
  } catch (error) {
    throw new OPFPptxError("packaging-failed", "Generated PPTX could not be read back as a ZIP.", {
      cause: errorMessage(error)
    });
  }

  const output = {};
  const renameMaps = buildRenameMaps(Object.keys(entries));
  for (const path of Object.keys(entries).sort()) {
    const normalizedPath = normalizePartPath(path, renameMaps);
    const bytes = normalizePartBytes(path, entries[path], context, renameMaps);
    output[normalizedPath] = [bytes, {
      level: context.compressionLevel,
      mtime: context.zipDate
    }];
  }

  return zipSync(output, {
    level: context.compressionLevel,
    mtime: context.zipDate
  });
}

function normalizeCoreProperties(xml, timestamp) {
  return xml
    .replace(/<dcterms:created xsi:type="dcterms:W3CDTF">[^<]*<\/dcterms:created>/g, `<dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>`)
    .replace(/<dcterms:modified xsi:type="dcterms:W3CDTF">[^<]*<\/dcterms:modified>/g, `<dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>`);
}

function normalizePartBytes(path, bytes, context, renameMaps) {
  if (path.endsWith(".xlsx")) {
    return normalizeNestedZip(bytes, context);
  }
  if (path === "docProps/core.xml") {
    return encodeText(normalizePartReferences(normalizeCoreProperties(decodeText(bytes), context.timestamp), renameMaps));
  }
  if (isXmlPart(path)) {
    return encodeText(normalizePartReferences(decodeText(bytes), renameMaps));
  }
  return bytes;
}

function isXmlPart(path) {
  return path.endsWith(".xml") || path.endsWith(".rels") || path === "[Content_Types].xml";
}

function buildRenameMaps(paths) {
  return {
    charts: numberedFilenameMap(paths, /^ppt\/charts\/chart(\d+)\.xml$/),
    worksheets: numberedFilenameMap(paths, /^ppt\/embeddings\/Microsoft_Excel_Worksheet(\d+)\.xlsx$/)
  };
}

function numberedFilenameMap(paths, pattern) {
  const ids = [...new Set(paths.flatMap((path) => {
    const match = pattern.exec(path);
    return match ? [Number(match[1])] : [];
  }))].sort((a, b) => a - b);
  return new Map(ids.map((id, index) => [String(id), String(index + 1)]));
}

function normalizePartPath(path, renameMaps) {
  return normalizePartReferences(path, renameMaps);
}

function normalizePartReferences(value, renameMaps) {
  let output = value;
  for (const [oldId, newId] of renameMaps.charts) {
    output = output.replace(new RegExp(escapeRegExp(`chart${oldId}.xml`), "g"), `chart${newId}.xml`);
  }
  for (const [oldId, newId] of renameMaps.worksheets) {
    output = output.replace(
      new RegExp(escapeRegExp(`Microsoft_Excel_Worksheet${oldId}.xlsx`), "g"),
      `Microsoft_Excel_Worksheet${newId}.xlsx`
    );
  }
  return output;
}

function normalizeNestedZip(bytes, context) {
  const entries = unzipSync(bytes);
  const output = {};
  for (const path of Object.keys(entries).sort()) {
    const entryBytes = path === "docProps/core.xml"
      ? encodeText(normalizeCoreProperties(decodeText(entries[path]), context.timestamp))
      : entries[path];
    output[path] = [entryBytes, {
      level: context.compressionLevel,
      mtime: context.zipDate
    }];
  }
  return zipSync(output, {
    level: context.compressionLevel,
    mtime: context.zipDate
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function withDeterministicRandom(seed, callback) {
  const originalRandom = Math.random;
  let state = seed >>> 0;
  Math.random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  try {
    return await callback();
  } finally {
    Math.random = originalRandom;
  }
}

function asUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new OPFPptxError("invalid-output", "PPTX generator returned an unsupported output type.");
}

function stringifyText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(stringifyText).join("");
  if (isPlainObject(value)) {
    if (value.text !== undefined) return stringifyText(value.text);
    if (value.value !== undefined) return stringifyText(value.value);
    return JSON.stringify(value);
  }
  return String(value);
}

function numericValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function summarizeValue(value) {
  const text = stringifyText(value);
  if (text.length > 160) return `${text.slice(0, 157)}...`;
  return text;
}

function normalizeAuthor(author) {
  if (typeof author === "string") return author;
  if (Array.isArray(author)) return author.join("; ");
  return null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAbsolutePath(value) {
  return /^(?:[a-zA-Z]:[\\/]|\/)/.test(value);
}

function joinPath(base, relative) {
  return `${String(base).replace(/[\\/]+$/, "")}/${String(relative).replace(/^[\\/]+/, "")}`;
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function decodeText(bytes) {
  return new TextDecoder().decode(bytes);
}

function encodeText(value) {
  return new TextEncoder().encode(value);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
