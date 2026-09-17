import { layoutTable, fitList, fitRichText, composeSlide, resolveCanvasDimensions, resolveFontFamilies, resolveTextStyle, textWidthMeasurer, fitText, textColorForFill, chartColorForFill } from "@openpresentation/opf/composition";
import {
  catalogs as bundledCatalogs,
  validatePresentation
} from "@openpresentation/opf";

export const packageName = "@openpresentation/opf-render";

export const releaseLane = Object.freeze({
  githubRepository: "OpenPresentation/opf-render",
  npmPackage: "@openpresentation/opf-render",
  compatibilityPackage: "@openpresentation/opf"
});

export const runtimePolicy = Object.freeze({
  hostedServiceInCriticalPath: false,
  telemetry: false,
  commercialSdkInCriticalPath: false,
  requiredNetworkCalls: false,
  deterministicLocalExecution: true
});

export const engineDefaults = Object.freeze({
  catalogs: Object.freeze({
    narratives: Object.freeze({ source: "https://www.pptx.gallery/narratives" }),
    themes: Object.freeze({ source: "https://www.pptx.gallery/themes" }),
    colorSchemes: Object.freeze({ source: "https://www.pptx.gallery/color-schemes" }),
    fontSchemes: Object.freeze({ source: "https://www.pptx.gallery/font-schemes" }),
    languages: Object.freeze({ source: "https://www.pptx.gallery/languages" }),
    layouts: Object.freeze({ source: "https://www.pptx.gallery/layouts" }),
    chartTypes: Object.freeze({ source: "https://www.pptx.gallery/chart-types" }),
    tones: Object.freeze({ source: "https://www.pptx.gallery/tones" }),
    audiences: Object.freeze({ source: "https://www.pptx.gallery/audiences" }),
    socialPlatforms: Object.freeze({ source: "https://www.pptx.gallery/social-platforms" })
  }),
  theme: "minimal",
  colorScheme: "cool-horizon",
  language: "english",
  narrative: "classic-story",
  tone: "formal",
  audience: "executives",
  fontScheme: Object.freeze({
    pptx: Object.freeze({ latin: "aptos", ea: "microsoft-yahei", cs: "nirmala-ui" }),
    google: Object.freeze({ latin: "roboto", ea: "noto-sans-sc", cs: "noto-sans" })
  }),
  chartTypes: Object.freeze([
    "stacked-column-3x",
    "stacked-area-3x",
    "line-with-markers-3x"
  ])
});

export class OPFRenderError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "OPFRenderError";
    this.code = code;
    this.details = details;
    if (details.issues) this.issues = details.issues;
    if (details.path) this.path = details.path;
  }
}

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

const TITLE_PLACEHOLDERS = new Set(["title", "subtitle", "tag"]);

const FIELD_TYPE = Object.freeze({
  text: "text",
  items: "list",
  bullets: "list",
  image: "image",
  video: "video",
  chart: "chart",
  table: "table",
  code: "code",
  metric: "metric",
  quote: "quote",
  timeline: "timeline"
});

const DEFAULT_DIMENSIONS = { width: 1280, height: 720 };
const DEFAULT_SOURCE_PREFIX = "https://www.pptx.gallery/";


function parseInput(input) {
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch (error) {
      throw new OPFRenderError("invalid-json", "OPF input is not valid JSON.", {
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (input instanceof Uint8Array) {
    return parseInput(new TextDecoder().decode(input));
  }

  if (input && typeof input === "object") {
    return input;
  }

  throw new OPFRenderError("invalid-input", "OPF input must be a parsed object, JSON string, or Uint8Array.");
}

function assertValidBoundary(presentation) {
  const result = validatePresentation(presentation);
  if (!result.valid) {
    throw new OPFRenderError("invalid-opf", "OPF validation failed.", {
      issues: result.errors,
      result
    });
  }
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function cloneWithSortedKeys(value) {
  if (Array.isArray(value)) return value.map((item) => cloneWithSortedKeys(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, cloneWithSortedKeys(value[key])]));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function referenceId(reference) {
  if (typeof reference === "string") return reference;
  if (isPlainObject(reference) && typeof reference.id === "string") return reference.id;
  return null;
}

function normalizeSourceRecords(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.records)) return value.records;
  return [];
}

function findById(records, id) {
  return records.find((record) => record && record.id === id) ?? null;
}

function defaultCatalogFor(kind) {
  return Array.isArray(bundledCatalogs[kind]) ? bundledCatalogs[kind] : [];
}

function sourceRecordsFor(kind, source, options) {
  if (!source) return [];
  const bySource = options.catalogSources?.[source];
  if (bySource) return normalizeSourceRecords(bySource);
  if (source.startsWith(DEFAULT_SOURCE_PREFIX) || source.startsWith("pkg:@openpresentation/opf/")) {
    return defaultCatalogFor(kind);
  }
  return [];
}

function engineDefaultId(kind) {
  if (kind === "fontSchemes") return engineDefaults.fontScheme.google.latin;
  if (kind === "chartTypes") return engineDefaults.chartTypes[0];
  const key = kind.endsWith("s") ? kind.slice(0, -1) : kind;
  return engineDefaults[key];
}

function resolveCatalogRecord(kind, reference, context, path, fallbackId = engineDefaultId(kind)) {
  const id = referenceId(reference) ?? fallbackId;
  const documentCatalog = context.presentation.catalogs?.[kind];
  const documentRecords = normalizeSourceRecords(documentCatalog);
  const injectedRecords = normalizeSourceRecords(context.options.catalogs?.[kind]);
  const documentSource = documentCatalog?.source;
  const sourceRecords = sourceRecordsFor(kind, documentSource, context.options);
  const defaultSource = engineDefaults.catalogs[kind]?.source;
  const engineSourceRecords = sourceRecordsFor(kind, defaultSource, context.options);
  const defaultRecords = defaultCatalogFor(kind);

  const record =
    (id ? findById(documentRecords, id) : null) ??
    (id ? findById(sourceRecords, id) : null) ??
    (id ? findById(injectedRecords, id) : null) ??
    (id ? findById(engineSourceRecords, id) : null) ??
    (id ? findById(defaultRecords, id) : null);

  if (record) {
    return isPlainObject(reference)
      ? cloneWithSortedKeys({ ...record, ...reference })
      : cloneWithSortedKeys(record);
  }

  if (isPlainObject(reference)) {
    return cloneWithSortedKeys(reference);
  }

  throw new OPFRenderError("catalog-resolution-failed", `Could not resolve ${kind} reference '${id}'.`, {
    kind,
    id,
    path,
    source: documentSource ?? defaultSource ?? null
  });
}

const resolveDimensions = resolveCanvasDimensions;

function colorFromScheme(scheme, slot, fallback) {
  if (!slot) return fallback;
  if (typeof slot === "string") {
    if (slot.startsWith("#")) return normalizeColor(slot, fallback);
    return normalizeColor(scheme[slot], fallback);
  }
  if (isPlainObject(slot)) {
    if (slot.type === "theme") return normalizeColor(scheme[slot.slot], fallback);
    if (slot.type === "solid") return normalizeColor(slot.color, fallback);
  }
  return fallback;
}

function normalizeColor(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) return "#" + [...trimmed.slice(1)].map(char => char + char).join("").toUpperCase();
  if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(trimmed)) return trimmed.toUpperCase();
  return fallback;
}

function resolveBackground(background, colorScheme) {
  if (!background) return colorFromScheme(colorScheme, "light1", "#FFFFFF");
  if (typeof background === "string") return colorFromScheme(colorScheme, background, "#FFFFFF");
  if (background.type === "theme") return colorFromScheme(colorScheme, background.slot, "#FFFFFF");
  if (background.type === "solid") return normalizeColor(background.color, "#FFFFFF");
  if (background.type === "gradient") return null;
  if (background.type === "pattern") return normalizeColor(background.pattern?.backgroundColor, "#FFFFFF");
  return colorFromScheme(colorScheme, "light1", "#FFFFFF");
}


function colorLuminance(color) {
  const hex = normalizeColor(color, "#FFFFFF").replace("#", "");
  const channels = [0, 2, 4].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function resolveDesign(presentation, slide, context) {
  const deckDesign = presentation.design ?? {};
  const slideDesign = slide.design ?? {};

  const theme = resolveCatalogRecord(
    "themes",
    slideDesign.theme ?? deckDesign.theme ?? engineDefaults.theme,
    context,
    "design.theme"
  );
  const colorScheme = resolveCatalogRecord(
    "colorSchemes",
    slideDesign.colorScheme ?? deckDesign.colorScheme ?? theme.colorScheme ?? engineDefaults.colorScheme,
    context,
    "design.colorScheme"
  );
  const fontScheme = resolveCatalogRecord(
    "fontSchemes",
    slideDesign.fontScheme ?? deckDesign.fontScheme ?? theme.fontScheme ?? engineDefaults.fontScheme.google.latin,
    context,
    "design.fontScheme"
  );
  const dimensions = resolveDimensions(slideDesign.dimensions ?? deckDesign.dimensions ?? theme.dimensions);
  const backgroundDefinition = slideDesign.background ?? deckDesign.background ?? theme.background;
  const backgroundColor = resolveBackground(backgroundDefinition, colorScheme);
  const darkBackground = colorLuminance(backgroundColor ?? "#FFFFFF") < 0.179;
  const textColor = colorFromScheme(colorScheme, darkBackground ? "light1" : "dark1", darkBackground ? "#FFFFFF" : "#111827");

  return {
    ...deckDesign,
    ...slideDesign,
    theme,
    colorScheme,
    fontScheme,
    dimensions,
    background: backgroundDefinition,
    backgroundColor,
    colors: {
      background: colorFromScheme(colorScheme, "light1", "#FFFFFF"),
      surface: colorFromScheme(colorScheme, darkBackground ? "dark2" : "light2", darkBackground ? "#1E293B" : "#F8FAFC"),
      text: textColor,
      mutedText: colorFromScheme(colorScheme, darkBackground ? "light2" : "dark2", darkBackground ? "#E2E8F0" : "#334155"),
      primary: normalizeColor(colorScheme.primary, null) ?? colorFromScheme(colorScheme, "accent1", "#2563EB"),
      secondary: normalizeColor(colorScheme.secondary, null) ?? colorFromScheme(colorScheme, "accent2", "#0F766E"),
      accent: normalizeColor(colorScheme.accent, null) ?? colorFromScheme(colorScheme, "accent3", "#F59E0B"),
      border: colorFromScheme(colorScheme, "accent5", "#CBD5E1")
    },
    fonts: resolveFontFamilies(fontScheme)
  };
}

function inferLayoutId(slide) {
  if (slide.layout) return slide.layout;
  if (slide.blocks?.length) return "blank";
  if (PROMOTED_REGION_KEYS.some((key) => key in slide)) return "blank";
  if (slide.chart) return "chart-1x";
  if (slide.table) return "table-1x";
  if (slide.image) return "image-1x";
  if (slide.video) return "media-1x";
  // Unspecified code layout uses the same automatic flow as core pagination
  // and PPTX export. An explicit code-1x preset still reserves its own slots.
  if (slide.code !== undefined) return "blank";
  if (slide.items || slide.bullets) return "list-1x";
  if (slide.text || slide.metric || slide.quote || slide.timeline) return "text-1x";
  if (slide.subtitle) return "title-subtitle";
  return "title";
}

function resolveLayout(slide, context, index) {
  const layoutId = inferLayoutId(slide);
  try {
    return resolveCatalogRecord("layouts", layoutId, context, `slides.${index}.layout`);
  } catch (error) {
    if (error instanceof OPFRenderError && isPlainObject(slide.layout)) return slide.layout;
    throw error;
  }
}

function contentPayloadFromHost(host, path, slot) {
  if (!isPlainObject(host)) {
    return { type: "text", field: "text", value: host, slot: slot ?? "text", path };
  }

  for (const field of ROOT_PAYLOAD_FIELDS) {
    if (host[field] !== undefined) {
      return {
        type: host.type ?? FIELD_TYPE[field],
        field,
        value: host[field],
        slot: host.slot ?? slot ?? host.type ?? FIELD_TYPE[field],
        path: `${path}.${field}`
      };
    }
  }

  return {
    type: "text",
    field: "text",
    value: stableJson(host),
    slot: slot ?? "text",
    path
  };
}

function slideRootContent(slide, slidePath) {
  const items = [];
  for (const field of ROOT_PAYLOAD_FIELDS) {
    if (slide[field] !== undefined) {
      items.push({
        type: slide.type ?? FIELD_TYPE[field],
        field,
        value: slide[field],
        slot: slide.type ?? FIELD_TYPE[field],
        path: `${slidePath}.${field}`
      });
    }
  }
  return items;
}

function promotedRegionContent(slide, slidePath) {
  const items = [];
  for (const key of PROMOTED_REGION_KEYS) {
    if (slide[key] !== undefined) {
      const payload = contentPayloadFromHost(slide[key], `${slidePath}.${key}`, key);
      items.push({ ...payload, slot: key, regionKey: key });
    }
  }
  return items;
}

function blockContent(slide, slidePath) {
  if (!Array.isArray(slide.blocks)) return [];
  return slide.blocks.map((block, index) => contentPayloadFromHost(block, `${slidePath}.blocks.${index}`, "body"));
}

function normalizeFutureContent(slide, slidePath) {
  if (!Array.isArray(slide.content)) return [];
  return slide.content.map((item, index) => {
    const payload = contentPayloadFromHost(item, `${slidePath}.content.${index}`, item.slot);
    return { ...payload, slot: item.slot ?? payload.slot, path: `${slidePath}.content.${index}` };
  });
}

function bindSlide(presentation, slide, layout, index, context) {
  const slidePath = `slides.${index}`;
  const placeholders = Array.isArray(layout.placeholders) ? layout.placeholders : [];
  const titleBindings = [];

  for (let i = 0; i < placeholders.length; i += 1) {
    const type = placeholders[i]?.type;
    if (!TITLE_PLACEHOLDERS.has(type)) continue;
    const value = slide[type] ?? presentation[type] ?? "";
    if (value) {
      titleBindings.push({
        type: "text",
        field: type,
        slot: type,
        value,
        placeholderIndex: i,
        path: `${slidePath}.${type}`
      });
    }
  }

  const contentItems = [
    ...normalizeFutureContent(slide, slidePath),
    ...slideRootContent(slide, slidePath),
    ...promotedRegionContent(slide, slidePath)
  ];
  const blocks = blockContent(slide, slidePath);

  const design = resolveDesign(presentation, slide, context);
  for (const role of ["heading","body","code"]) design.fonts[role] = resolveTextStyle({fontFamily:design.fonts[role],fontWeight:role === "heading" ? 700 : 400},context.options.textMeasurement).fontFamily;
  const geometry = composeSlide(slide, { ...design.dimensions, layout, slideIndex: index, fonts: design.fonts, contentAlignment:design.contentAlignment, titleAlignment:design.titleAlignment, textRasterPadding:context.options.textRasterPadding, contentBox:design.contentBox, textMeasurement: context.options.textMeasurement });
  return {
    geometry,
    assets: presentation.assets ?? {},
    index,
    path: slidePath,
    slide,
    layout,
    design,
    titleBindings,
    contentItems,
    blocks
  };
}

export function resolvePresentation(input, options = {}) {
  const presentation = parseInput(input);
  assertValidBoundary(presentation);

  const context = { presentation, options };
  const slides = presentation.slides.map((slide, index) => {
    const layout = resolveLayout(slide, context, index);
    return bindSlide(presentation, slide, layout, index, context);
  });

  return {
    presentation,
    engineDefaults,
    slides
  };
}

export function renderSvg(input, options = {}) {
  const resolved = resolvePresentation(input, options);
  const slideIndex = options.slideIndex ?? 0;
  if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex >= resolved.slides.length) {
    throw new OPFRenderError("slide-index-out-of-range", `Slide index ${slideIndex} is out of range.`, {
      slideIndex,
      slideCount: resolved.slides.length
    });
  }
  return renderResolvedSlide(resolved, slideIndex, options);
}

export function renderSvgDeck(input, options = {}) {
  const resolved = resolvePresentation(input, options);
  return resolved.slides.map((_, index) => renderResolvedSlide(resolved, index, options));
}

function renderResolvedSlide(resolved, slideIndex, options) {
  options = { ...options, _diagnosticPaths: new Set() };
  const bound = resolved.slides[slideIndex];
  const { width, height } = bound.design.dimensions;
  const title = bound.slide.title ?? resolved.presentation.name ?? `Slide ${slideIndex + 1}`;
  const children = [
    renderEmbeddedFonts(options.embeddedFonts),
    renderBackground(bound, width, height, options),
    renderBranding(bound, resolved.presentation, width, height, options),
    ...renderSlideContent(bound, width, height, options),
    renderFurniture(bound, resolved.presentation, width, height, options, "header"),
    renderFurniture(bound, resolved.presentation, width, height, options, "footer")
  ].filter(Boolean);

  return tag(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      role: "img",
      "aria-label": title,
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      ...traceAttrs(options, bound.path)
    },
    `\n${children.join("\n")}\n`
  );
}

function renderBackground(bound, width, height, options) {
  const background = bound.design.background;
  if (isPlainObject(background) && background.type === "gradient") {
    const id = `opf-s${bound.index + 1}-background`;
    const stops = Array.isArray(background.gradient?.stops) ? background.gradient.stops : [];
    const angle=(Number(background.gradient?.angle??0)*Math.PI)/180;
    const dx=Math.cos(angle)*50,dy=Math.sin(angle)*50;
    const stopTags = stops.map((stop, index) => tag("stop", {
      offset: stableNumber((stop.position ?? index / Math.max(1, stops.length - 1)) * 100) + "%",
      "stop-color": normalizeColor(stop.color, bound.design.colors.background)
    }));
    return [
      tag("defs", traceAttrs(options, `${bound.path}.design.background`), tag("linearGradient", {
        id,
        x1: `${50-dx}%`,
        x2: `${50+dx}%`,
        y1: `${50-dy}%`,
        y2: `${50+dy}%`
      }, stopTags.join(""))),
      tag("rect", {
        x: 0,
        y: 0,
        width,
        height,
        fill: `url(#${id})`,
        opacity: background.opacity ?? 1,
        ...traceAttrs(options, `${bound.path}.design.background`)
      })
    ].join("\n");
  }

  if(isPlainObject(background) && background.type==='image'){
    const imageItem={value:background.image,path:`${bound.path}.design.background.image`};
    if(background.image.fit==='tile'){
      const size=Math.min(width,height)/4,id=`opf-s${bound.index+1}-image-tile`;
      return tag('g',{opacity:background.opacity??1},tag('defs',{},tag('pattern',{id,width:size,height:size,patternUnits:'userSpaceOnUse'},renderImage(imageItem,{x:0,y:0,width:size,height:size},bound,options)))+tag('rect',{width,height,fill:`url(#${id})`}));
    }
    return tag('g',{opacity:background.opacity??1},renderImage(imageItem,{x:0,y:0,width,height},bound,{...options,imageFit:background.image.fit??'cover'}));
  }
  if(isPlainObject(background) && background.type==='pattern'){
    const pattern=background.pattern??{},id=`opf-s${bound.index+1}-pattern`,color=normalizeColor(pattern.foregroundColor,bound.design.colors.text),preset=pattern.preset;
    const mark=preset==='ltHorz'?tag('path',{d:'M0 4H8',stroke:color,'stroke-width':1}):preset==='diagStripe'?tag('path',{d:'M-2 2L2 -2M0 8L8 0M6 10L10 6',stroke:color,'stroke-width':2}):preset==='pct5'?tag('circle',{cx:2,cy:2,r:.8,fill:color}):'';
    if(!mark)reportDiagnostic({code:'unsupported-pattern',path:`${bound.path}.design.background.pattern.preset`,message:`Pattern ${preset} is not implemented by the SVG preview.`},options);
    return tag('g',{opacity:background.opacity??1},tag('rect',{width,height,fill:normalizeColor(pattern.backgroundColor,'#FFFFFF')})+tag('defs',{},tag('pattern',{id,width:8,height:8,patternUnits:'userSpaceOnUse'},mark))+tag('rect',{width,height,fill:`url(#${id})`}));
  }
  return tag("rect", {
    x: 0,
    y: 0,
    width,
    height,
    opacity: typeof background==='object'?background?.opacity??1:1,
    fill: bound.design.backgroundColor ?? bound.design.colors.background,
    ...traceAttrs(options, `${bound.path}.design.background`)
  });
}

function renderSlideContent(bound, width, height, options) {
  for (const diagnostic of bound.geometry.diagnostics) reportDiagnostic(diagnostic, options);
  return bound.geometry.items.map(item => {
    const frame=item.frameBox;
    const surface=frame ? tag('rect',{x:frame.x,y:frame.y,width:frame.width,height:frame.height,rx:8*Math.min(width,height)/720,fill:bound.design.colors.surface,stroke:bound.design.colors.border}) : '';
    return surface+renderPayload(item, item.box, { ...bound, composition: item.composition }, options);
  });
}

function reportDiagnostic(diagnostic, options) {
  const key = `${diagnostic.code}:${diagnostic.path}:${diagnostic.reason ?? ''}`;
  if (options._diagnosticPaths.has(key)) return;
  options._diagnosticPaths.add(key);
  options.onDiagnostic?.(diagnostic);
}

function renderPayload(item, box, bound, options) {
  if (!box) return "";
  if (item.field === "items" || item.field === "bullets") return renderList(item, box, bound, options);
  switch (item.type) {
    case "chart":
      return renderChart(item, box, bound, options);
    case "table":
      return renderTable(item, box, bound, options);
    case "image":
      return renderImage(item, box, bound, options);
    case "video":
      return renderMedia(item, box, bound, options);
    case "code":
      return renderCode(item, box, bound, options);
    case "metric":
      return renderMetric(item, box, bound, options);
    case "quote":
      return renderQuote(item, box, bound, options);
    case "timeline":
      return renderTimeline(item, box, bound, options);
    case "list":
      return renderList(item, box, bound, options);
    default:
      return renderTextPayload(item, box, bound, options);
  }
}

function renderTextPayload(item, box, bound, options) {
  return (Array.isArray(item.value) ? renderRichTextBox : renderTextBox)(Array.isArray(item.value) ? item.value : flattenText(item.value), box, bound, {
    path: item.path,
    align: item.field === "title" ? bound.design.titleAlignment : bound.design.contentAlignment,
    fontSize: item.field === "title" ? 54 : item.field === "tag" ? 16 : 25,
    fontFamily: item.field === "title" ? bound.design.fonts.heading : bound.design.fonts.body,
    fontWeight: item.field === "title" ? 700 : 400,
    fill: bound.design.colors.text,
    fit: item.text,
    textStyle: item.textStyle,
    diagnosticsHandled: Boolean(item.text),
    options
  });
}

function renderList(item, box, bound, options) {
  const scale=Math.min(bound.design.dimensions.width,bound.design.dimensions.height)/720;
  const fit=item.text?.listEntries?item.text:fitList(item.value,box,25*scale,((bound.composition??bound.geometry.composition).minFontSize??16)*scale,{style:{fontFamily:bound.design.fonts.body,fontWeight:400,path:item.path},textMeasurement:options.textMeasurement});
  const children=[];
  for(const entry of fit.listEntries){
    children.push(tag('text',{x:stableNumber(entry.marker.x),y:stableNumber(entry.marker.y),'font-family':fontStack(entry.marker.style.fontFamily,bound.design.fontScheme.type),'font-size':stableNumber(entry.marker.fontSize),fill:bound.design.colors.text,'aria-hidden':'true'},escapeText(entry.marker.text)));
    const config={path:entry.textPath,align:'left',fill:bound.design.colors.text,rich:Array.isArray(entry.value),options};
    children.push(renderRichLines(typeof entry.value==='string'?[entry.value]:entry.value,entry.text,entry.textBox,bound,config));
    if(entry.description)children.push(renderRichLines(typeof entry.descriptionValue==='string'?[entry.descriptionValue]:entry.descriptionValue,entry.description,entry.descriptionBox,bound,{...config,path:entry.descriptionPath,rich:Array.isArray(entry.descriptionValue),fill:bound.design.colors.mutedText}));
  }
  return tag('g',{...traceAttrs(options,item.path),...(fit.overflow?{'data-opf-overflow':'true'}:{})},children.join('\n'));
}

function renderImage(item, box, bound, options) {
  let asset = normalizeAsset(item.value);
  const seen = new Set();
  let missingReference;
  while (asset.src?.startsWith("asset:")) {
    const id = asset.src.slice(6);
    if (seen.has(id)) throw new OPFRenderError("invalid-asset-reference", "Circular asset reference.", { path: item.path });
    seen.add(id);
    if (!Object.hasOwn(bound.assets,id)) { missingReference=id; break; }
    const {src:_source,...overrides}=asset;
    asset = {...normalizeAsset(bound.assets[id]),...overrides};
  }
  const source = options.imageResolver?.(asset.src, { asset, path: item.path }) ?? asset.src;
  if (typeof source === "string" && /^data:image\/(png|jpeg|gif|webp);base64,/i.test(source)) {
    return tag("image", { x: box.x, y: box.y, width: box.width, height: box.height,
      href: source, preserveAspectRatio: (options.imageFit ?? (bound.design.imageFill === "crop" ? "cover" : "contain")) === "cover" ? "xMidYMid slice" : "xMidYMid meet", role: "img", "aria-label": asset.alt ?? "Image",
      ...traceAttrs(options, item.path) });
  }
  const reason=missingReference?'missing-reference':!asset.src?'missing-source':'unsupported-source';
  const message=missingReference?`Image asset ${missingReference} is missing; supply the referenced asset or resolve it in the host.`:'Image requires an embedded raster data URI or a host imageResolver.';
  if (options.strictAssets) throw new OPFRenderError("unresolved-asset", message, { path: item.path,reason });
  const fill = bound.design.colors.surface;
  const scale=Math.min(bound.design.dimensions.width,bound.design.dimensions.height)/720;
  const padding=Math.min(24*scale,box.width*.06,box.height*.1),inner=inset(box,padding);
  const description=asset.alt??asset.title??'Image';
  const label=`Image unavailable\n${description}`;
  const style=resolveTextStyle({fontFamily:bound.design.fonts.body,fontWeight:600,path:item.path},options.textMeasurement);
  const fit=fitText(label,inner,20*scale,((bound.composition??bound.geometry.composition).minFontSize??16)*scale,textWidthMeasurer(style,options.textMeasurement));
  const textColor=textColorForFill(fill,bound.design.colors.text);
  reportDiagnostic({code:'unresolved-asset',path:item.path,message,reason,source:asset.src,assetId:missingReference,description,placeholder:fit.overflow?'icon':'label'},options);
  const children = [
    tag("rect", {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rx: 0,
      fill,
      stroke: bound.design.colors.border,
      "stroke-width": 1,
      "stroke-dasharray": "4 3",
      ...traceAttrs(options, item.path)
    })
  ];
  if(!fit.overflow)children.push(renderTextBox(label, inner, bound, {
      path: item.path,
      fontSize: 20,
      fontFamily: style.fontFamily,
      fontWeight: 600,
      textStyle:style,fit,diagnosticsHandled:true,
      fill: textColor,
      options,
      align: "center",
      verticalAlign: "middle"
    }));
  else {
    // This is a status indicator, not shortened authored content. The complete
    // description remains in the accessible name and the path-specific diagnostic.
    const size=Math.max(0,Math.min(inner.width,inner.height,24*scale)),icon=centeredBox(inner,size,size);
    children.push(tag('path',{d:`M ${icon.x} ${icon.y} L ${icon.x+size} ${icon.y+size} M ${icon.x+size} ${icon.y} L ${icon.x} ${icon.y+size}`,fill:'none',stroke:textColor,'stroke-width':Math.min(2*scale,size/8),'aria-hidden':'true'}));
  }
  return tag("g", {...traceAttrs(options,item.path),'data-opf-asset-status':'unresolved',role:'img','aria-label':`Image unavailable: ${description}`},children.join("\n"));
}

function renderMedia(item, box, bound, options) {
  const asset = normalizeAsset(item.value);
  const iconBox = centeredBox(box, 72, 72);
  const children = [
    tag("rect", {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      fill: bound.design.colors.surface,
      stroke: bound.design.colors.border,
      "stroke-width": 1,
      ...traceAttrs(options, item.path)
    }),
    tag("circle", {
      cx: iconBox.x + iconBox.width / 2,
      cy: iconBox.y + iconBox.height / 2,
      r: 36,
      fill: bound.design.colors.primary,
      ...traceAttrs(options, item.path)
    }),
    tag("path", {
      d: trianglePath(iconBox.x + 28, iconBox.y + 22, 28, 28),
      fill: "#FFFFFF",
      ...traceAttrs(options, item.path)
    }),
    renderTextBox(asset.title || asset.src || "Media", { ...box, y: iconBox.y + iconBox.height + 20, height: 50 }, bound, {
      path: item.path,
      fontSize: 18,
      fontFamily: bound.design.fonts.body,
      fontWeight: 600,
      fill: bound.design.colors.mutedText,
      options,
      align: "center"
    })
  ];
  return tag("g", traceAttrs(options, item.path), children.join("\n"));
}

function renderCode(item, box, bound, options) {
  const layout = item.codeLayout;
  if (!layout) throw new OPFRenderError('missing-code-layout', 'Code rendering requires a coordinated core build with shared code geometry.', {path:item.path});
  for (const part of layout.parts) {
    // XML 1.0 Char excludes controls and unpaired UTF-16 surrogates. The u flag
    // keeps valid supplementary characters (surrogate pairs) accepted.
    const invalid = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/u.exec(part.text);
    if (invalid) throw new OPFRenderError('invalid-code-text', `Code text contains U+${invalid[0].codePointAt(0).toString(16).toUpperCase().padStart(4,'0')} at UTF-16 offset ${invalid.index}, which XML cannot represent; edit that character before rendering.`, {path:part.path});
  }
  const children = [
    tag("rect", {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      fill: "#111827",
      stroke: "#334155",
      "stroke-width": 1,
      ...traceAttrs(options, item.path)
    })
  ];
  for (const part of layout.parts) {
    if (!part.fit) throw new OPFRenderError('layout-overflow', 'Code content has no usable internal space; increase its cell size before rendering.', {path:part.path,issues:layout.diagnostics});
    const lines=part.fit.sourceLines.map((line,index)=>tag('text',{
      x:stableNumber(part.box.x),y:stableNumber(part.box.y+part.fit.fontSize+index*part.fit.lineHeight),
      'text-anchor':'start','font-family':fontStack(part.style.fontFamily,'monospace'),
      'font-size':stableNumber(part.fit.fontSize),'font-weight':part.style.fontWeight,'font-style':part.style.italic?'italic':undefined,
      'xml:space':'preserve',style:'white-space:pre','text-rendering':'geometricPrecision',fill:part.role==='body'?'#E5E7EB':'#93C5FD',
      ...traceAttrs(options,part.path),...(options.trace?{'data-opf-code-role':part.role,'data-opf-generated':part.generated?'true':undefined,
        'data-opf-text-start':line.start,'data-opf-text-end':line.end,'data-opf-text-next-start':line.nextStart,'data-opf-line-boundary':line.boundary}:{}),
    },line.segments.map(segment=>tag('tspan',{
      x:stableNumber(part.box.x+segment.x),
      // SVG's CSS tab-size does not place literal tabs at their measured stops.
      ...(segment.kind==='tab'?{textLength:stableNumber(segment.width),lengthAdjust:'spacingAndGlyphs'}:{}),
      ...(options.trace?{'data-opf-segment':segment.kind,'data-opf-text-start':segment.start,'data-opf-text-end':segment.end}:{}),
    },escapeText(part.text.slice(segment.start,segment.end)))).join('')));
    children.push(tag('g',{...traceAttrs(options,part.path),...(options.trace?{'data-opf-code-role':part.role,'data-opf-generated':part.generated?'true':undefined,
      'data-opf-box-x':part.box.x,'data-opf-box-y':part.box.y,'data-opf-box-width':part.box.width,'data-opf-box-height':part.box.height}:{}),
      ...(part.fit.overflow?{'data-opf-overflow':'true'}:{})},lines.join('\n')));
  }
  return tag("g", {...traceAttrs(options,item.path),...(options.trace?{'data-opf-code-container':'true'}:{})}, children.join("\n"));
}

function renderMetric(item, box, bound, options) {
  const layout=item.metricLayout;
  if (!layout) throw new OPFRenderError('missing-metric-layout','Metric rendering requires coordinated core metric geometry.',{path:item.path});
  const children=[];
  for (const part of layout.parts) {
    const invalid=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/u.exec(part.text);
    if (invalid) throw new OPFRenderError('invalid-metric-text',`Metric text contains U+${invalid[0].codePointAt(0).toString(16).toUpperCase().padStart(4,'0')} at UTF-16 offset ${invalid.index}, which XML cannot represent; edit that character before rendering.`,{path:part.path});
    if (!part.visible) continue;
    if (!part.fit||part.linePositions?.length!==part.fit.sourceLines.length) throw new OPFRenderError('layout-overflow','Metric content has no accepted internal line positions; increase its cell size or coordinate package versions.',{path:part.path,issues:layout.diagnostics});
    const lines=part.fit.sourceLines.map((line,index)=>{
      const origin=part.linePositions[index];
      return tag('text',{x:stableNumber(origin.x),y:stableNumber(origin.baseline),'text-anchor':'start',
        'font-family':fontStack(part.style.fontFamily,bound.design.fontScheme.type),'font-size':stableNumber(part.fit.fontSize),
        'font-weight':part.style.fontWeight,'font-style':part.style.italic?'italic':undefined,
        'xml:space':'preserve',style:'white-space:pre','text-rendering':'geometricPrecision',fill:part.role==='value'?bound.design.colors.primary:bound.design.colors.text,
        ...traceAttrs(options,part.path),...(options.trace?{'data-opf-metric-role':part.role,'data-opf-text-start':line.start,
          'data-opf-text-end':line.end,'data-opf-text-next-start':line.nextStart,'data-opf-line-boundary':line.boundary}:{}),
      },line.segments.map(segment=>tag('tspan',{x:stableNumber(origin.x+segment.x),
        ...(segment.kind==='tab'?{textLength:stableNumber(segment.width),lengthAdjust:'spacingAndGlyphs'}:{}),
        ...(options.trace?{'data-opf-segment':segment.kind,'data-opf-text-start':segment.start,'data-opf-text-end':segment.end}:{}),
      },escapeText(part.text.slice(segment.start,segment.end)))).join(''));
    });
    children.push(tag('g',{...traceAttrs(options,part.path),...(options.trace?{'data-opf-metric-role':part.role,
      'data-opf-box-x':part.box.x,'data-opf-box-y':part.box.y,'data-opf-box-width':part.box.width,'data-opf-box-height':part.box.height}:{}),
      ...(part.fit.overflow?{'data-opf-overflow':'true'}:{})},lines.join('\n')));
  }
  return tag('g',{...traceAttrs(options,item.path),...(options.trace?{'data-opf-metric-container':'true'}:{})},children.join('\n'));
}

function renderQuote(item, box, bound, options) {
  const layout = item.quoteLayout;
  if (!layout) throw new OPFRenderError('missing-quote-layout', 'Quote rendering requires a coordinated core build with shared quote geometry.', {path:item.path});
  const children = layout.parts.map(part => {
    if (!part.fit) throw new OPFRenderError('layout-overflow', 'Quote content has no usable internal space; increase its cell size before rendering.', {path:part.path,issues:layout.diagnostics});
    return renderTextBox(part.text,part.box,bound,{
      path:part.path,fit:part.fit,textStyle:part.style,fontFamily:part.requestedStyle.fontFamily,
      fill:part.role==='footer'?bound.design.colors.mutedText:bound.design.colors.text,
      diagnosticsHandled:true,options,
    });
  });
  return tag("g", traceAttrs(options, item.path), children.join("\n"));
}

function renderTimeline(item, box, bound, options) {
  const timeline = Array.isArray(item.value) ? { events: item.value } : item.value;
  const events = Array.isArray(timeline?.events) ? timeline.events : [];
  if (!events.length) return "";
  const labelWidth = box.width / Math.max(2, events.length);
  const gap = (box.width - labelWidth) / Math.max(1, events.length - 1);
  const start = events.length === 1 ? box.x + box.width / 2 : box.x + labelWidth / 2;
  const end = events.length === 1 ? start : box.x + box.width - labelWidth / 2;
  const y = box.y + box.height * 0.46;
  const children = [
    tag("line", {
      x1: start,
      x2: end,
      y1: y,
      y2: y,
      stroke: bound.design.colors.border,
      "stroke-width": 3,
      ...traceAttrs(options, item.path)
    })
  ];

  events.forEach((event, index) => {
    const x = start + index * gap;
    const eventPath = `${item.path}.events.${index}`;
    children.push(tag("circle", {
      cx: x,
      cy: y,
      r: Math.min(9, labelWidth / 5, box.height * 0.04),
      fill: bound.design.colors.primary,
      ...traceAttrs(options, eventPath)
    }));
    children.push(renderTextBox([event.when, event.what, event.description].filter(Boolean).join("\n"), {
      x: x - labelWidth / 2,
      y: index % 2 === 0 ? box.y : y + 24,
      width: labelWidth,
      height: box.height * 0.38
    }, bound, {
      path: eventPath,
      fontSize: 16,
      fontFamily: bound.design.fonts.body,
      fontWeight: 500,
      fill: bound.design.colors.text,
      options,
      align: "center"
    }));
  });

  return tag("g", traceAttrs(options, item.path), children.join("\n"));
}

function renderTable(item, box, bound, options) {
  const scale = Math.min(bound.design.dimensions.width, bound.design.dimensions.height) / 720;
  const layout = layoutTable(item.value, box, {scale, minFontSize:(bound.composition ?? bound.geometry.composition).minFontSize, fontFamily:bound.design.fonts.body, textMeasurement:options.textMeasurement, path:item.path});
  const children = [];
  const separateBorders = layout.rows.some(row => row.cells.some(cell => cell.style?.borders));
  const defaultEdges = [], explicitEdges = [];
  for (const row of layout.rows) for (const cell of row.cells) {
    const style = cell.style ?? {};
    const fill = style.fill ?? (cell.header ? bound.design.colors.primary : bound.design.colors.surface);
    children.push(tag("rect", {
      x: stableNumber(cell.box.x), y: stableNumber(cell.box.y),
      width: stableNumber(cell.box.width), height: stableNumber(cell.box.height),
      fill,
      stroke: separateBorders ? undefined : bound.design.colors.border, "stroke-width":separateBorders ? undefined : 1,
      ...traceAttrs(options, cell.sourcePath ?? cell.path)
    }));
    if (separateBorders) {
      const {x, y, width, height} = cell.box;
      const edges = {top:[x,y,x+width,y],right:[x+width,y,x+width,y+height],bottom:[x,y+height,x+width,y+height],left:[x,y,x,y+height]};
      for (const [edge, coordinates] of Object.entries(edges)) {
        const border = style.borders?.[edge];
        (border ? explicitEdges : defaultEdges).push({coordinates, border, path:`${cell.sourcePath ?? cell.path}.style.borders.${edge}`});
      }
    }
    // Core layout has already applied vertical alignment to cell.textBox.y.
    children.push((cell.rich ? renderRichTextBox : renderTextBox)(cell.rich ? cell.value : flattenText(cell.value ?? ""), cell.textBox, bound, {
      path:cell.path, fontSize:15, fontFamily:bound.design.fonts.body,
      fontWeight:cell.header ? 700 : 400, textStyle:cell.textStyle, fit:cell.fit,
      fill:style.color ?? textColorForFill(fill, cell.header ? "#FFFFFF" : bound.design.colors.text), align:style.align, options
    }));
  }

  return tag("g", traceAttrs(options, item.path), [...children, ...renderTableBorders(defaultEdges, explicitEdges, scale, bound.design.colors.border, options)].join("\n"));
}

// Explicit edges own their shared segment, including invisible/zero-width edges.
// Split implicit neighbors at merge boundaries so they cannot fill dashed gaps,
// cover alpha strokes, or reintroduce a border the author removed.
function renderTableBorders(defaultEdges, explicitEdges, scale, defaultColor, options) {
  const epsilon = 1e-7;
  const segment = ({coordinates:[x1,y1,x2,y2]}) => y1 === y2
    ? {horizontal:true, fixed:y1, start:x1, end:x2}
    : {horizontal:false, fixed:x1, start:y1, end:y2};
  const blockers = explicitEdges.map(segment);
  const defaults = defaultEdges.flatMap(edge => {
    const axis = segment(edge);
    let intervals = [[axis.start, axis.end]];
    for (const blocker of blockers) {
      if (axis.horizontal !== blocker.horizontal || Math.abs(axis.fixed - blocker.fixed) > epsilon) continue;
      intervals = intervals.flatMap(([start,end]) => {
        if (blocker.end <= start + epsilon || blocker.start >= end - epsilon) return [[start,end]];
        return [[start,Math.min(end,blocker.start)],[Math.max(start,blocker.end),end]].filter(([a,b]) => b-a > epsilon);
      });
    }
    return intervals.map(([start,end]) => ({...edge,coordinates:axis.horizontal
      ? [start,axis.fixed,end,axis.fixed] : [axis.fixed,start,axis.fixed,end]}));
  });
  return [...defaults,...explicitEdges].flatMap(({coordinates:[x1,y1,x2,y2],border,path}) => {
    const width = border ? border.width * scale : 1;
    if (width === 0) return [];
    return [tag('line', {
      x1:stableNumber(x1), y1:stableNumber(y1), x2:stableNumber(x2), y2:stableNumber(y2),
      stroke:border?.color ?? defaultColor, 'stroke-width':stableNumber(width),
      'stroke-dasharray':border?.dash === 'dash' ? `${width*4} ${width*3}` : border?.dash === 'dot' ? `${width} ${width*2}` : undefined,
      ...traceAttrs(options,path)
    })];
  });
}

function renderImportedChart(item, box, bound, options) {
  const chart=item.value, rows=chart.data?.rows??[], columns=chart.data?.columns??[];
  if(!rows.length||columns.length<2)return null;
  const kind=chart.type, circular=['pie','donut','doughnut'].includes(kind);
  const colors=[bound.design.colors.primary,bound.design.colors.secondary,'#9B6BCC','#D98944','#429B85','#CB5D79'].map(color=>chartColorForFill(bound.design.colors.surface,color));
  const children=[];
  const labelColor=textColorForFill(bound.design.colors.surface,bound.design.colors.text);
  const text=(value,rect,path,size=16,align='center')=>renderTextBox(String(value),rect,bound,{path,fontSize:size,fontFamily:bound.design.fonts.body,fontWeight:400,fill:labelColor,options,align,verticalAlign:'middle'});
  const number=value=>typeof value==='number'&&Number.isFinite(value)?value:typeof value==='string'&&value.trim()&&Number.isFinite(Number(value))?Number(value):null;
  const series=columns.slice(1).map((name,j)=>({name,values:rows.map(row=>number(row[j+1]))}));
  children.push(tag('rect',{x:box.x,y:box.y,width:box.width,height:box.height,fill:bound.design.colors.surface,stroke:bound.design.colors.border,...traceAttrs(options,item.path)}));
  if(circular){
    if(series.length!==1||series[0].values.some(v=>v!==null&&v<0)){
      children.push(text('Pie charts need one nonnegative series',box,item.path,18));return tag('g',traceAttrs(options,item.path),children.join('\n'));
    }
    const values=series[0].values,total=values.reduce((sum,v)=>sum+(v??0),0),cx=box.x+box.width*.35,cy=box.y+box.height*.5,r=Math.max(1,Math.min(box.width*.3,box.height*.42));
    if(!total){children.push(text('No positive chart values',box,item.path,18));return tag('g',traceAttrs(options,item.path),children.join('\n'));}
    let angle=-Math.PI/2;
    values.forEach((v,i)=>{
      const delta=(v??0)/total*Math.PI*2,end=angle+delta,color=colors[i%colors.length];
      if(delta>=Math.PI*2-1e-8)children.push(tag('circle',{cx,cy,r,fill:color,...traceAttrs(options,`${item.path}.data.rows.${i}.1`)}));
      else if(delta>0)children.push(tag('path',{d:`M ${cx} ${cy} L ${cx+r*Math.cos(angle)} ${cy+r*Math.sin(angle)} A ${r} ${r} 0 ${delta>Math.PI?1:0} 1 ${cx+r*Math.cos(end)} ${cy+r*Math.sin(end)} Z`,fill:color,...traceAttrs(options,`${item.path}.data.rows.${i}.1`)}));
      angle=end;
      const y=box.y+15+i*Math.min(30,(box.height-30)/rows.length);
      children.push(tag('rect',{x:box.x+box.width*.69,y:y+6,width:12,height:12,fill:color}));
      children.push(text(`${rows[i][0]}: ${v??'—'}`,{x:box.x+box.width*.69+20,y,width:box.width*.29-20,height:28},`${item.path}.data.rows.${i}`,14,'left'));
    });
    if(kind!=='pie')children.push(tag('circle',{cx,cy,r:r*.57,fill:bound.design.colors.surface}));
  }else{
    const horizontal=kind==='bar',legendHeight=series.length>1?34:8;
    const plot={x:box.x+(horizontal?100:64),y:box.y+legendHeight+14,width:Math.max(1,box.width-(horizontal?124:84)),height:Math.max(1,box.height-legendHeight-62)};
    const values=series.flatMap(s=>s.values).filter(v=>v!==null),min=Math.min(0,...values),rawMax=Math.max(0,...values),max=rawMax===min?min+1:rawMax,range=max-min;
    const xValue=v=>plot.x+(v-min)/range*plot.width,yValue=v=>plot.y+(max-v)/range*plot.height;
    const zero=horizontal?xValue(0):yValue(0);
    for(let tick=0;tick<=4;tick++){
      const value=min+range*tick/4,at=horizontal?xValue(value):yValue(value),label=Number(value.toPrecision(4));
      children.push(tag('line',{x1:horizontal?at:plot.x,x2:horizontal?at:plot.x+plot.width,y1:horizontal?plot.y:at,y2:horizontal?plot.y+plot.height:at,stroke:bound.design.colors.border,'stroke-width':1}));
      children.push(text(label,horizontal?{x:at-32,y:plot.y+plot.height+6,width:64,height:26}:{x:box.x+4,y:at-12,width:52,height:24},item.path,13,horizontal?'center':'right'));
    }
    if(series.length>1)series.forEach((s,j)=>{
      const width=(box.width-24)/series.length,x=box.x+12+j*width;
      children.push(tag('rect',{x,y:box.y+12,width:12,height:12,fill:colors[j%colors.length]}));
      children.push(text(s.name,{x:x+18,y:box.y+5,width:Math.max(1,width-22),height:28},`${item.path}.data.columns.${j+1}`,14,'left'));
    });
    const categorySize=(horizontal?plot.height:plot.width)/rows.length;
    rows.forEach((row,i)=>children.push(text(row[0],horizontal?{x:box.x+4,y:plot.y+i*categorySize,width:88,height:categorySize}:{x:plot.x+i*categorySize,y:plot.y+plot.height+7,width:categorySize,height:30},`${item.path}.data.rows.${i}.0`,14,horizontal?'right':'center')));
    series.forEach((s,j)=>{
      const color=colors[j%colors.length];
      if(kind==='line'||kind==='area'){
        let points=[];
        const flush=()=>{if(!points.length)return;const pairs=points.map(p=>p.join(',')).join(' ');if(kind==='area')children.push(tag('polygon',{points:`${points[0][0]},${zero} ${pairs} ${points.at(-1)[0]},${zero}`,fill:color,'fill-opacity':.18}));children.push(tag('polyline',{points:pairs,fill:'none',stroke:color,'stroke-width':3,...traceAttrs(options,`${item.path}.data`)}));points=[];};
        s.values.forEach((v,i)=>{if(v===null){flush();return;}const x=plot.x+(i+.5)*categorySize,y=yValue(v);points.push([x,y]);children.push(tag('circle',{cx:x,cy:y,r:4,fill:color,...traceAttrs(options,`${item.path}.data.rows.${i}.${j+1}`)}));});flush();
      }else{
        const bar=categorySize*.8/series.length;
        s.values.forEach((v,i)=>{if(v===null)return;const at=(horizontal?plot.y:plot.x)+i*categorySize+categorySize*.1+j*bar;
          children.push(tag('rect',horizontal?{x:Math.min(zero,xValue(v)),y:at,width:Math.abs(xValue(v)-zero),height:Math.max(.1,bar*.9),fill:color,...traceAttrs(options,`${item.path}.data.rows.${i}.${j+1}`)}:{x:at,y:Math.min(zero,yValue(v)),width:Math.max(.1,bar*.9),height:Math.abs(yValue(v)-zero),fill:color,...traceAttrs(options,`${item.path}.data.rows.${i}.${j+1}`)}));
        });
      }
    });
    children.push(tag('line',{x1:horizontal?zero:plot.x,x2:horizontal?zero:plot.x+plot.width,y1:horizontal?plot.y:zero,y2:horizontal?plot.y+plot.height:zero,stroke:labelColor,'stroke-width':1}));
  }
  return tag('g',traceAttrs(options,item.path),children.join('\n'));
}

function renderChart(item, box, bound, options) {
  if (["column","bar","line","area","pie","donut","doughnut"].includes(item.value?.type)) {
    const rendered = renderImportedChart(item, box, bound, options);
    if (rendered) return rendered;
  }
  const chart = item.value ?? {};
  const chartType = chart.type ?? engineDefaults.chartTypes[0];
  const data = inlineChartRows(chart.data);
  const plot = inset(box, 28);
  const max = Math.max(1, ...data.map((row) => Math.abs(row.value)));
  const panelFill = bound.design.colors.surface;
  const labelColor = textColorForFill(panelFill, bound.design.colors.text);
  const primary = chartColorForFill(panelFill, bound.design.colors.primary);
  const secondary = chartColorForFill(panelFill, bound.design.colors.secondary);
  const children = [
    tag("rect", {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      fill: panelFill,
      stroke: bound.design.colors.border,
      "stroke-width": 1,
      ...traceAttrs(options, item.path)
    })
  ];

  if (!data.length) {
    children.push(renderTextBox("No chart data", plot, bound, {
      path: item.path,
      fontSize: 20,
      fontFamily: bound.design.fonts.body,
      fontWeight: 500,
      fill: labelColor,
      options,
      align: "center",
      verticalAlign: "middle"
    }));
    return tag("g", traceAttrs(options, item.path), children.join("\n"));
  }

  if (chartType.includes("line") || chartType.includes("area")) {
    const points = data.map((row, index) => {
      const x = plot.x + (data.length === 1 ? plot.width / 2 : (plot.width / (data.length - 1)) * index);
      const y = plot.y + plot.height - (Math.abs(row.value) / max) * plot.height;
      return [x, y];
    });
    children.push(tag("polyline", {
      points: points.map(([x, y]) => `${stableNumber(x)},${stableNumber(y)}`).join(" "),
      fill: "none",
      stroke: primary,
      "stroke-width": 4,
      ...traceAttrs(options, `${item.path}.data`)
    }));
    points.forEach(([x, y], index) => children.push(tag("circle", {
      cx: stableNumber(x),
      cy: stableNumber(y),
      r: 5,
      fill: primary,
      ...traceAttrs(options, `${item.path}.data.rows.${index}`)
    })));
  } else {
    const gap = 10;
    const barWidth = Math.max(6, (plot.width - gap * (data.length - 1)) / data.length);
    data.forEach((row, index) => {
      const barHeight = (Math.abs(row.value) / max) * plot.height;
      const x = plot.x + index * (barWidth + gap);
      const y = plot.y + plot.height - barHeight;
      children.push(tag("rect", {
        x: stableNumber(x),
        y: stableNumber(y),
        width: stableNumber(barWidth),
        height: stableNumber(barHeight),
        fill: index % 2 === 0 ? primary : secondary,
        ...traceAttrs(options, `${item.path}.data.rows.${index}`)
      }));
    });
  }

  children.push(renderTextBox(data.map((row) => row.label).join("  "), {
    x: plot.x,
    y: plot.y + plot.height + 8,
    width: plot.width,
    height: 24
  }, bound, {
    path: `${item.path}.data`,
    fontSize: 12,
    fontFamily: bound.design.fonts.body,
    fontWeight: 400,
    fill: labelColor,
    options,
    align: "center"
  }));

  return tag("g", traceAttrs(options, item.path), children.join("\n"));
}

function inlineChartRows(data) {
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  return rows.map((row, index) => {
    const cells = Array.isArray(row) ? row : [row];
    const value = cells.find((cell) => typeof cell === "number") ?? Number(cells.find((cell) => Number.isFinite(Number(cell))) ?? 0);
    return {
      label: flattenText(cells.find((cell) => typeof cell === "string") ?? `Row ${index + 1}`),
      value: Number.isFinite(value) ? value : 0
    };
  });
}

function renderFurniture(bound, presentation, width, height, options, kind) {
  const local=bound.slide.design?.[kind] !== undefined;
  const furniture=local?bound.slide.design[kind]:presentation.design?.[kind];
  if(!furniture)return "";
  const root=local?`${bound.path}.design.${kind}`:`design.${kind}`;
  const organizations=Array.isArray(presentation.organization)?presentation.organization:[presentation.organization];
  const organization=organizations.find(item=>item?.role==='primary')??organizations.find(Boolean);
  return tag('g',traceAttrs(options,root),['left','center','right'].map((zone,index)=>{
    const item=furniture[zone];if(!item)return '';
    const box={x:width*(.07+index*.3),y:kind==='header'?height*.025:height*.925,width:width*.26,height:height*.05};
    if(item.image)return renderImage({value:item.image,path:`${root}.${zone}.image`},box,bound,{...options,imageFit:'contain'});
    const pieces=[item.text,item.organization?organization?.name:null,item.section?bound.slide.section:null,item.slideNumber?String(bound.index+1):null,typeof item.date==='string'?item.date:null].filter(value=>value!==undefined&&value!==null&&value!=='');
    if(item.date===true)reportDiagnostic({code:'date-needs-value',path:`${root}.${zone}.date`,message:'Use a literal date string for a reproducible preview; the document does not define a presentation date.'},options);
    const anchor=['start','middle','end'][index],x=index===0?width*.07:index===1?width/2:width*.93;
    return tag('text',{x:stableNumber(x),y:stableNumber(kind==='header'?height*.05:height-28),'text-anchor':anchor,'font-family':fontStack(bound.design.fonts.body,bound.design.fontScheme.type),'font-size':13,fill:bound.design.colors.mutedText,...traceAttrs(options,`${root}.${zone}`)},escapeText(pieces.join(' · ')));
  }).join(''));
}
function renderBranding(bound,presentation,width,height,options) {
  const design={...presentation.design,...bound.slide.design}, pieces=[];
  const rootFor=key=>bound.slide.design?.[key]!==undefined?`${bound.path}.design.${key}`:`design.${key}`;
  if(design.watermark){
    pieces.push(tag('g',{opacity:typeof design.watermark==='object'?design.watermark.opacity??.08:.08},renderImage({value:design.watermark,path:rootFor('watermark')},{x:width*.3,y:height*.3,width:width*.4,height:height*.4},bound,{...options,imageFit:'contain'})));
  }
  return pieces.join('');
}

function fontStack(family, type) {
  const fallback = type === "serif" ? "serif" : type === "monospace" ? "monospace" : "sans-serif";
  return `${family}, ${fallback}`;
}

function renderEmbeddedFonts(fonts = []) {
  if (!fonts.length) return "";
  const css = fonts.map(font => {
    if (typeof font.family !== "string" || /[\u0000-\u001f"'\\<>;]/.test(font.family) || !/^data:font\/(ttf|otf|woff|woff2);base64,[A-Za-z0-9+/=]+$/.test(font.dataUrl) || !Number.isInteger(font.weight) || font.weight < 1 || font.weight > 1000) throw new OPFRenderError("invalid-embedded-font", "Embedded fonts require a plain family name, valid weight, and a font data URI.");
    return `@font-face{font-family:"${font.family}";font-weight:${font.weight};font-style:${font.italic ? "italic" : "normal"};src:url("${font.dataUrl}")}`;
  }).join("\n");
  const licenses = [...new Set(fonts.map(font=>font.license).filter(Boolean))];
  return tag("style",{},css) + (licenses.length ? tag("metadata",{},escapeText(licenses.join("\n\n"))) : "");
}

function renderRichTextBox(value, box, bound, config) {
  const scale=Math.min(bound.design.dimensions.width,bound.design.dimensions.height)/720;
  const fit=config.fit??fitRichText(value,box,config.fontSize*scale,((bound.composition??bound.geometry.composition).minFontSize??16)*scale,{style:{fontFamily:config.fontFamily,fontWeight:config.fontWeight??400,path:config.path},textMeasurement:config.options.textMeasurement});
  if(fit.overflow&&!config.diagnosticsHandled){const diagnostic={code:'text-overflow',path:config.path,message:'Mixed-style text exceeds its cell at the minimum font size.'};reportDiagnostic(diagnostic,config.options);if((bound.composition??bound.geometry.composition).overflow==='error')throw new OPFRenderError('layout-overflow',diagnostic.message,{issues:[diagnostic]});}
  return renderRichLines(value,fit,box,bound,config);
}

function renderRichLines(value,fit,box,bound,config) {
  const alignment=fit.placement?.alignment??config.align??bound.design.contentAlignment;
  let textOffset=0;
  const runOffsets=value.map(run=>{const start=textOffset;textOffset+=(typeof run==='string'?run:run.text).length;return start;});
  const content=fit.richLines.flatMap((line,lineIndex)=>line.fragments.map(fragment=>{
    const run=fragment.run,offset=alignment==='right'?box.width-line.width:alignment==='center'?(box.width-line.width)/2:0;
    const placed=fit.placement?.lines[lineIndex];
    const rendered=tag('text',{...(config.options.trace?{'data-opf-text-start':runOffsets[fragment.runIndex]+fragment.start,'data-opf-text-end':runOffsets[fragment.runIndex]+fragment.end}:{}),x:stableNumber((placed?.x??box.x+offset)+fragment.x),y:stableNumber((placed?.baseline??box.y+line.baseline)+fragment.baselineShift),'xml:space':'preserve','font-family':fontStack(fragment.style.fontFamily,bound.design.fontScheme.type),'font-size':stableNumber(fragment.fontSize),'font-weight':fragment.style.fontWeight,'font-style':fragment.style.italic?'italic':undefined,'text-decoration':[run.underline?'underline':'',run.strikethrough?'line-through':''].filter(Boolean).join(' ')||undefined,fill:/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(run.color??'')?run.color:config.fill},escapeText(fragment.text));
    if(run.link&&/^(https?:|mailto:)/i.test(run.link))return tag('a',{href:run.link,target:'_blank',rel:'noopener noreferrer'},rendered);
    return rendered;
  }));
  let cursor=0;
  const whole=value.map(run=>typeof run==='string'?run:run.text).join('');
  const lineTrace=config.options.trace?fit.richLines.map((line,index)=>{
    if(index){const newline=/^(\r\n|\r|\n)/.exec(whole.slice(cursor));if(newline)cursor+=newline[0].length;}
    const start=cursor;cursor+=(fit.lines[index]??'').length;
    const offset=alignment==='right'?box.width-line.width:alignment==='center'?(box.width-line.width)/2:0;
    const placed=fit.placement?.lines[index];
    return {start,end:cursor,x:placed?.x??box.x+offset,y:placed?.y??box.y+line.y,height:placed?.height??line.height};
  }):undefined;
  return tag('g',{...traceAttrs(config.options,config.path),...(config.options.trace?{'data-opf-box-width':box.width,'data-opf-rich-text':config.rich===false?undefined:'true','data-opf-rich-lines':JSON.stringify(lineTrace)}:{}),...(fit.overflow?{'data-opf-overflow':'true'}:{})},content.join('\n'));
}

function renderTextBox(text, box, bound, config) {
  const scale = Math.min(bound.design.dimensions.width, bound.design.dimensions.height) / 720;
  const style = config.textStyle ?? resolveTextStyle({fontFamily:config.fontFamily,fontWeight:config.fontWeight ?? 400,italic:config.italic ?? false,path:config.path},config.options.textMeasurement);
  const fit = config.fit ?? fitText(String(text ?? ""), box, config.fontSize * scale,
    ((bound.composition ?? bound.geometry.composition).minFontSize ?? 16) * scale, textWidthMeasurer(style,config.options.textMeasurement));
  if (fit.overflow && !config.diagnosticsHandled) {
    const diagnostic = { code: "text-overflow", path: config.path,
      message: "Text exceeds its cell at the minimum font size; shorten it, increase its space, or split the slide." };
    reportDiagnostic(diagnostic, config.options);
    if ((bound.composition ?? bound.geometry.composition).overflow === "error") throw new OPFRenderError("layout-overflow", diagnostic.message, { path: diagnostic.path, issues: [diagnostic] });
  }
  const size = fit.fontSize;
  const totalHeight = fit.lines.length * fit.lineHeight;
  const startY = config.verticalAlign === "middle"
    ? box.y + Math.max(0, (box.height - totalHeight) / 2) + size : box.y + size;
  const alignment=fit.placement?.alignment??config.align??bound.design.contentAlignment;
  const anchor = alignment === "center" ? "middle" : alignment === "right" ? "end" : "start";
  const x = alignment === "center" ? box.x + box.width / 2 : alignment === "right" ? box.x + box.width : box.x;
  const lines = fit.lines.map((line, index) => tag("text", {
    x: stableNumber(fit.placement?fit.placement.lines[index].x+fit.placement.lines[index].width*(alignment==='right'?1:alignment==='center'?.5:0):x), y: stableNumber(fit.placement?.lines[index].baseline??startY + index * fit.lineHeight),
    "text-anchor": anchor, "font-family": fontStack(style.fontFamily, config.fontFamily === bound.design.fonts.code ? "monospace" : bound.design.fontScheme.type),
    "font-size": stableNumber(size), "font-weight": style.fontWeight, "font-style": style.italic ? "italic" : undefined, fill: config.fill,
    ...traceAttrs(config.options, config.path)
  }, escapeText(line)));
  return tag("g", { ...traceAttrs(config.options, config.path),
    ...(fit.overflow ? { "data-opf-overflow": "true" } : {}) }, lines.join("\n"));
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [{ text: flattenText(value), level: 0 }];
  return value.map((item) => {
    if (Array.isArray(item)) return { text: flattenText(item), level: 0 };
    if (isPlainObject(item)) {
      return {
        text: flattenText(item.text ?? item.value ?? ""),
        description: item.description ? flattenText(item.description) : "",
        level: Number.isInteger(item.level) ? item.level : 0
      };
    }
    return { text: flattenText(item), level: 0 };
  });
}

function flattenText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => flattenText(item)).join("");
  if (isPlainObject(value)) {
    if (value.text !== undefined) return flattenText(value.text);
    if (value.value !== undefined) return flattenText(value.value);
    if (value.source !== undefined) return flattenText(value.source);
  }
  return stableJson(value);
}

function normalizeAsset(value) {
  if (typeof value === "string") return { src: value };
  if (isPlainObject(value)) return value;
  return { src: "" };
}

function inset(box, padding) {
  return {
    x: box.x + padding,
    y: box.y + padding,
    width: Math.max(1, box.width - padding * 2),
    height: Math.max(1, box.height - padding * 2)
  };
}

function centeredBox(box, width, height) {
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height
  };
}

function trianglePath(x, y, width, height) {
  return `M ${stableNumber(x)} ${stableNumber(y)} L ${stableNumber(x)} ${stableNumber(y + height)} L ${stableNumber(x + width)} ${stableNumber(y + height / 2)} Z`;
}

function traceAttrs(options, path) {
  return options.trace ? { "data-opf-path": path } : {};
}

function stableNumber(value) {
  if (Number.isInteger(value)) return String(value);
  return Number(value).toFixed(3).replace(/\.?0+$/, "");
}

function escapeText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeText(value).replaceAll('"', "&quot;");
}

function tag(name, attrs = {}, children = "") {
  const serializedAttrs = Object.keys(attrs)
    .filter((key) => attrs[key] !== undefined && attrs[key] !== null && attrs[key] !== false)
    .sort()
    .map((key) => ` ${key}="${escapeAttr(attrs[key])}"`)
    .join("");
  if (children === "") return `<${name}${serializedAttrs}/>`;
  return `<${name}${serializedAttrs}>${children}</${name}>`;
}
