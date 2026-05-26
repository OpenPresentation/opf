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

const PLACEHOLDER_COMPATIBILITY = Object.freeze({
  text: ["text", "body"],
  list: ["list", "body", "text"],
  image: ["picture", "image", "body"],
  video: ["media", "video", "body"],
  chart: ["chart", "body"],
  table: ["table", "body"],
  code: ["code", "body", "text"],
  metric: ["body", "text", "metric"],
  quote: ["body", "text", "quote"],
  timeline: ["body", "text", "timeline"]
});

const DIMENSIONS = Object.freeze({
  widescreen: Object.freeze({ width: 1280, height: 720 }),
  "16:9": Object.freeze({ width: 1280, height: 720 }),
  "16:10": Object.freeze({ width: 1280, height: 800 }),
  standard: Object.freeze({ width: 1024, height: 768 }),
  "4:3": Object.freeze({ width: 1024, height: 768 })
});

const DEFAULT_DIMENSIONS = DIMENSIONS.widescreen;
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

function resolveDimensions(value) {
  if (typeof value === "string") return DIMENSIONS[value] ?? DEFAULT_DIMENSIONS;
  if (isPlainObject(value)) {
    if (typeof value.preset === "string" && DIMENSIONS[value.preset]) return DIMENSIONS[value.preset];
    if (typeof value.width === "number" && typeof value.height === "number") {
      return {
        width: Math.max(1, Math.round(value.width)),
        height: Math.max(1, Math.round(value.height))
      };
    }
  }
  return DEFAULT_DIMENSIONS;
}

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
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(trimmed)) return trimmed.toUpperCase();
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

function fontFamily(fontScheme, role) {
  const roleValue = fontScheme?.[role];
  if (isPlainObject(roleValue) && typeof roleValue.family === "string") return roleValue.family;
  if (role === "heading" && typeof fontScheme?.major === "string") return fontScheme.major;
  if (role === "code" && typeof fontScheme?.code === "string") return fontScheme.code;
  if (role === "code") return "Consolas";
  if (typeof fontScheme?.minor === "string") return fontScheme.minor;
  if (typeof fontScheme?.major === "string") return fontScheme.major;
  if (typeof fontScheme?.name === "string") return fontScheme.name;
  return "Roboto";
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

  return {
    theme,
    colorScheme,
    fontScheme,
    dimensions,
    background: backgroundDefinition,
    backgroundColor: resolveBackground(backgroundDefinition, colorScheme),
    colors: {
      background: colorFromScheme(colorScheme, "light1", "#FFFFFF"),
      surface: colorFromScheme(colorScheme, "light2", "#F8FAFC"),
      text: colorFromScheme(colorScheme, "dark1", "#111827"),
      mutedText: colorFromScheme(colorScheme, "dark2", "#334155"),
      primary: normalizeColor(colorScheme.primary, null) ?? colorFromScheme(colorScheme, "accent1", "#2563EB"),
      secondary: normalizeColor(colorScheme.secondary, null) ?? colorFromScheme(colorScheme, "accent2", "#0F766E"),
      accent: normalizeColor(colorScheme.accent, null) ?? colorFromScheme(colorScheme, "accent3", "#F59E0B"),
      border: colorFromScheme(colorScheme, "accent5", "#CBD5E1")
    },
    fonts: {
      heading: fontFamily(fontScheme, "heading"),
      body: fontFamily(fontScheme, "body"),
      code: fontFamily(fontScheme, "code")
    }
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
  if (slide.code) return "code-1x";
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

  return {
    index,
    path: slidePath,
    slide,
    layout,
    design: resolveDesign(presentation, slide, context),
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
  const bound = resolved.slides[slideIndex];
  const { width, height } = bound.design.dimensions;
  const title = bound.slide.title ?? resolved.presentation.name ?? `Slide ${slideIndex + 1}`;
  const children = [
    renderBackground(bound, width, height, options),
    ...renderSlideContent(bound, width, height, options),
    renderFooter(bound, resolved.presentation, width, height, options)
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
    const stopTags = stops.map((stop, index) => tag("stop", {
      offset: stableNumber((stop.position ?? index / Math.max(1, stops.length - 1)) * 100) + "%",
      "stop-color": normalizeColor(stop.color, bound.design.colors.background)
    }));
    return [
      tag("defs", traceAttrs(options, `${bound.path}.design.background`), tag("linearGradient", {
        id,
        x1: "0%",
        x2: "100%",
        y1: "0%",
        y2: "100%"
      }, stopTags.join(""))),
      tag("rect", {
        x: 0,
        y: 0,
        width,
        height,
        fill: `url(#${id})`,
        ...traceAttrs(options, `${bound.path}.design.background`)
      })
    ].join("\n");
  }

  return tag("rect", {
    x: 0,
    y: 0,
    width,
    height,
    fill: bound.design.backgroundColor ?? bound.design.colors.background,
    ...traceAttrs(options, `${bound.path}.design.background`)
  });
}

function renderSlideContent(bound, width, height, options) {
  const titleArea = titleAreas(bound, width, height);
  const contentArea = contentBounds(titleArea, width, height);
  const parts = [];

  for (const binding of bound.titleBindings) {
    const box = titleArea[binding.slot];
    if (box) parts.push(renderPayload(binding, box, bound, options));
  }

  const regionItems = bound.contentItems.filter((item) => item.regionKey);
  const normalItems = bound.contentItems.filter((item) => !item.regionKey);

  for (const item of regionItems) {
    parts.push(renderPayload(item, regionBox(item.regionKey, contentArea), bound, options));
  }

  if (bound.blocks.length) {
    parts.push(...renderGridItems(bound.blocks, contentArea, bound, options));
  } else {
    parts.push(...renderBoundPlaceholders(normalItems, bound, contentArea, options));
  }

  if (!parts.length) {
    const fallback = {
      type: "text",
      field: "title",
      value: bound.slide.title ?? "",
      path: `${bound.path}.title`
    };
    if (fallback.value) parts.push(renderPayload(fallback, contentArea, bound, options));
  }

  return parts;
}

function titleAreas(bound, width, height) {
  const placeholders = bound.layout.placeholders ?? [];
  const hasTitle = placeholders.some((placeholder) => placeholder?.type === "title") || Boolean(bound.slide.title);
  const hasSubtitle = placeholders.some((placeholder) => placeholder?.type === "subtitle") || Boolean(bound.slide.subtitle);
  const marginX = Math.round(width * 0.07);
  const top = Math.round(height * 0.075);
  const titleHeight = hasSubtitle ? Math.round(height * 0.12) : Math.round(height * 0.15);
  const subtitleHeight = Math.round(height * 0.07);

  return {
    tag: { x: marginX, y: top - 28, width: width - marginX * 2, height: 24 },
    title: { x: marginX, y: top, width: width - marginX * 2, height: hasTitle ? titleHeight : 0 },
    subtitle: {
      x: marginX,
      y: top + titleHeight,
      width: width - marginX * 2,
      height: hasSubtitle ? subtitleHeight : 0
    }
  };
}

function contentBounds(titleArea, width, height) {
  const marginX = Math.round(width * 0.07);
  const marginBottom = Math.round(height * 0.08);
  const titleBottom = Math.max(
    titleArea.title.y + titleArea.title.height,
    titleArea.subtitle.y + titleArea.subtitle.height
  );
  const y = titleBottom + Math.round(height * 0.035);
  return {
    x: marginX,
    y,
    width: width - marginX * 2,
    height: Math.max(80, height - y - marginBottom)
  };
}

function renderBoundPlaceholders(items, bound, contentArea, options) {
  if (!items.length) return [];
  const placeholders = (bound.layout.placeholders ?? [])
    .map((placeholder, index) => ({ type: placeholder.type, index }))
    .filter((placeholder) => !TITLE_PLACEHOLDERS.has(placeholder.type));

  if (!placeholders.length) {
    return renderGridItems(items, contentArea, bound, options);
  }

  const boxes = placeholderBoxes(placeholders, contentArea);
  const remaining = new Map(placeholders.map((placeholder) => [placeholder.index, placeholder]));
  const rendered = [];
  const unbound = [];

  for (const item of items) {
    const placeholder = takeCompatiblePlaceholder(item, remaining);
    if (!placeholder) {
      unbound.push(item);
      continue;
    }
    rendered.push(renderPayload(item, boxes.get(placeholder.index), bound, options));
  }

  if (unbound.length) {
    rendered.push(...renderGridItems(unbound, contentArea, bound, options));
  }

  return rendered;
}

function takeCompatiblePlaceholder(item, remaining) {
  const wanted = [item.slot, item.type, ...(PLACEHOLDER_COMPATIBILITY[item.type] ?? [])].filter(Boolean);
  for (const slot of wanted) {
    for (const [index, placeholder] of remaining) {
      if (placeholder.type === slot) {
        remaining.delete(index);
        return placeholder;
      }
    }
  }
  const first = remaining.entries().next().value;
  if (!first) return null;
  remaining.delete(first[0]);
  return first[1];
}

function placeholderBoxes(placeholders, area) {
  const map = new Map();
  const boxes = gridBoxes(placeholders.length, area);
  placeholders.forEach((placeholder, index) => map.set(placeholder.index, boxes[index]));
  return map;
}

function renderGridItems(items, area, bound, options) {
  const boxes = gridBoxes(items.length, area);
  return items.map((item, index) => renderPayload(item, boxes[index], bound, options));
}

function gridBoxes(count, area) {
  if (count <= 0) return [];
  const columns = count <= 3 ? count : Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const gap = 24;
  const cellWidth = (area.width - gap * (columns - 1)) / columns;
  const cellHeight = (area.height - gap * (rows - 1)) / rows;
  const boxes = [];

  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    boxes.push({
      x: Math.round(area.x + column * (cellWidth + gap)),
      y: Math.round(area.y + row * (cellHeight + gap)),
      width: Math.round(cellWidth),
      height: Math.round(cellHeight)
    });
  }

  return boxes;
}

function regionBox(regionKey, area) {
  const [rowKey, columnKey] = regionKey.includes(":") ? regionKey.split(":") : [null, regionKey];
  const rowSpan = span(rowKey, ["top", "middle", "bottom"]);
  const columnSpan = span(columnKey, ["left", "center", "right"]);
  const gap = 20;
  const colWidth = (area.width - gap * 2) / 3;
  const rowHeight = (area.height - gap * 2) / 3;
  const firstColumn = columnSpan[0];
  const lastColumn = columnSpan[columnSpan.length - 1];
  const firstRow = rowSpan[0];
  const lastRow = rowSpan[rowSpan.length - 1];

  return {
    x: Math.round(area.x + firstColumn * (colWidth + gap)),
    y: Math.round(area.y + firstRow * (rowHeight + gap)),
    width: Math.round((lastColumn - firstColumn + 1) * colWidth + (lastColumn - firstColumn) * gap),
    height: Math.round((lastRow - firstRow + 1) * rowHeight + (lastRow - firstRow) * gap)
  };
}

function span(key, values) {
  if (!key) return [0, 1, 2];
  const pieces = key.split("+");
  const indexes = pieces.map((piece) => values.indexOf(piece)).filter((index) => index >= 0);
  return indexes.length ? indexes : [0, 1, 2];
}

function renderPayload(item, box, bound, options) {
  if (!box) return "";
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
  return renderTextBox(flattenText(item.value), box, bound, {
    path: item.path,
    fontSize: item.field === "title" ? 54 : item.field === "subtitle" ? 25 : 25,
    fontFamily: item.field === "title" ? bound.design.fonts.heading : bound.design.fonts.body,
    fontWeight: item.field === "title" ? 700 : 400,
    fill: bound.design.colors.text,
    options
  });
}

function renderList(item, box, bound, options) {
  const values = normalizeList(item.value);
  if (!values.length) return "";
  const lines = values.flatMap((entry) => {
    const marker = entry.level > 0 ? "-" : "*";
    const text = `${"  ".repeat(Math.min(3, entry.level))}${marker} ${entry.text}`;
    return entry.description ? [text, `   ${entry.description}`] : [text];
  });
  return renderTextBox(lines.join("\n"), box, bound, {
    path: item.path,
    fontSize: 23,
    fontFamily: bound.design.fonts.body,
    fontWeight: 400,
    fill: bound.design.colors.text,
    options
  });
}

function renderImage(item, box, bound, options) {
  const asset = normalizeAsset(item.value);
  const fill = bound.design.colors.surface;
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
      ...traceAttrs(options, item.path)
    }),
    renderTextBox(asset.alt || asset.title || asset.src || "Image", inset(box, 24), bound, {
      path: item.path,
      fontSize: 20,
      fontFamily: bound.design.fonts.body,
      fontWeight: 600,
      fill: bound.design.colors.mutedText,
      options,
      align: "center",
      verticalAlign: "middle"
    })
  ];

  return tag("g", traceAttrs(options, item.path), children.join("\n"));
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
  const code = typeof item.value === "string" ? item.value : item.value?.source ?? stableJson(item.value);
  const label = typeof item.value === "object" && item.value?.language ? String(item.value.language) : "code";
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
    }),
    tag("text", {
      x: box.x + 18,
      y: box.y + 28,
      fill: "#93C5FD",
      "font-family": bound.design.fonts.code,
      "font-size": 14,
      "font-weight": 700,
      ...traceAttrs(options, item.path)
    }, escapeText(label.toUpperCase())),
    renderTextBox(code, { x: box.x + 18, y: box.y + 46, width: box.width - 36, height: box.height - 64 }, bound, {
      path: item.path,
      fontSize: 18,
      fontFamily: bound.design.fonts.code,
      fontWeight: 400,
      fill: "#E5E7EB",
      options,
      preserveNewlines: true
    })
  ];
  return tag("g", traceAttrs(options, item.path), children.join("\n"));
}

function renderMetric(item, box, bound, options) {
  const metric = isPlainObject(item.value) ? item.value : { value: item.value };
  const children = [
    renderTextBox(String(metric.value ?? ""), { ...box, height: box.height * 0.45 }, bound, {
      path: `${item.path}.value`,
      fontSize: Math.min(76, box.height * 0.28),
      fontFamily: bound.design.fonts.heading,
      fontWeight: 800,
      fill: bound.design.colors.primary,
      options
    }),
    renderTextBox([metric.label, metric.description, metric.delta].filter(Boolean).join("\n"), {
      x: box.x,
      y: box.y + box.height * 0.45,
      width: box.width,
      height: box.height * 0.55
    }, bound, {
      path: item.path,
      fontSize: 23,
      fontFamily: bound.design.fonts.body,
      fontWeight: 500,
      fill: bound.design.colors.text,
      options
    })
  ];
  return tag("g", traceAttrs(options, item.path), children.join("\n"));
}

function renderQuote(item, box, bound, options) {
  const quote = isPlainObject(item.value) ? item.value : { text: item.value };
  const children = [
    renderTextBox(`"${quote.text ?? ""}"`, inset(box, 18), bound, {
      path: `${item.path}.text`,
      fontSize: 28,
      fontFamily: bound.design.fonts.heading,
      fontWeight: 600,
      fill: bound.design.colors.text,
      options
    }),
    renderTextBox([quote.attribution, quote.source].filter(Boolean).join(" - "), {
      x: box.x + 18,
      y: box.y + box.height - 58,
      width: box.width - 36,
      height: 40
    }, bound, {
      path: item.path,
      fontSize: 17,
      fontFamily: bound.design.fonts.body,
      fontWeight: 500,
      fill: bound.design.colors.mutedText,
      options
    })
  ];
  return tag("g", traceAttrs(options, item.path), children.join("\n"));
}

function renderTimeline(item, box, bound, options) {
  const timeline = Array.isArray(item.value) ? { events: item.value } : item.value;
  const events = Array.isArray(timeline?.events) ? timeline.events : [];
  if (!events.length) return "";
  const gap = box.width / Math.max(1, events.length - 1);
  const y = box.y + box.height * 0.46;
  const children = [
    tag("line", {
      x1: box.x + 20,
      x2: box.x + box.width - 20,
      y1: y,
      y2: y,
      stroke: bound.design.colors.border,
      "stroke-width": 3,
      ...traceAttrs(options, item.path)
    })
  ];

  events.forEach((event, index) => {
    const x = events.length === 1 ? box.x + box.width / 2 : box.x + index * gap;
    const eventPath = `${item.path}.events.${index}`;
    children.push(tag("circle", {
      cx: x,
      cy: y,
      r: 9,
      fill: bound.design.colors.primary,
      ...traceAttrs(options, eventPath)
    }));
    children.push(renderTextBox([event.when, event.what, event.description].filter(Boolean).join("\n"), {
      x: x - box.width / Math.max(2, events.length) / 2,
      y: index % 2 === 0 ? box.y : y + 24,
      width: box.width / Math.max(2, events.length),
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
  const table = item.value ?? {};
  const columns = Array.isArray(table.columns) ? table.columns : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const allRows = columns.length ? [columns, ...rows] : rows;
  const columnCount = Math.max(1, ...allRows.map((row) => Array.isArray(row) ? row.length : 1));
  const rowCount = Math.max(1, allRows.length);
  const cellWidth = box.width / columnCount;
  const cellHeight = Math.min(54, box.height / rowCount);
  const children = [];

  allRows.forEach((row, rowIndex) => {
    const cells = Array.isArray(row) ? row : [row];
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const x = box.x + columnIndex * cellWidth;
      const y = box.y + rowIndex * cellHeight;
      const cellPath = `${item.path}.rows.${Math.max(0, rowIndex - (columns.length ? 1 : 0))}.${columnIndex}`;
      children.push(tag("rect", {
        x: stableNumber(x),
        y: stableNumber(y),
        width: stableNumber(cellWidth),
        height: stableNumber(cellHeight),
        fill: rowIndex === 0 && columns.length ? bound.design.colors.primary : "#FFFFFF",
        stroke: bound.design.colors.border,
        "stroke-width": 1,
        ...traceAttrs(options, cellPath)
      }));
      children.push(renderTextBox(flattenText(cells[columnIndex] ?? ""), {
        x: x + 10,
        y: y + 8,
        width: cellWidth - 20,
        height: cellHeight - 12
      }, bound, {
        path: cellPath,
        fontSize: 15,
        fontFamily: bound.design.fonts.body,
        fontWeight: rowIndex === 0 && columns.length ? 700 : 400,
        fill: rowIndex === 0 && columns.length ? "#FFFFFF" : bound.design.colors.text,
        options
      }));
    }
  });

  return tag("g", traceAttrs(options, item.path), children.join("\n"));
}

function renderChart(item, box, bound, options) {
  const chart = item.value ?? {};
  const chartType = chart.type ?? engineDefaults.chartTypes[0];
  const data = inlineChartRows(chart.data);
  const plot = inset(box, 28);
  const max = Math.max(1, ...data.map((row) => Math.abs(row.value)));
  const children = [
    tag("rect", {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      fill: "#FFFFFF",
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
      fill: bound.design.colors.mutedText,
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
      stroke: bound.design.colors.primary,
      "stroke-width": 4,
      ...traceAttrs(options, `${item.path}.data`)
    }));
    points.forEach(([x, y], index) => children.push(tag("circle", {
      cx: stableNumber(x),
      cy: stableNumber(y),
      r: 5,
      fill: bound.design.colors.primary,
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
        fill: index % 2 === 0 ? bound.design.colors.primary : bound.design.colors.secondary,
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
    fill: bound.design.colors.mutedText,
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

function renderFooter(bound, presentation, width, height, options) {
  const footer = bound.slide.design?.footer ?? presentation.design?.footer;
  if (!footer) return "";
  const pieces = [];
  if (footer.left?.text) pieces.push({ text: footer.left.text, x: width * 0.07, anchor: "start", path: `${bound.path}.design.footer.left` });
  if (footer.center?.text) pieces.push({ text: footer.center.text, x: width / 2, anchor: "middle", path: `${bound.path}.design.footer.center` });
  if (footer.right?.text || footer.right?.slideNumber) {
    pieces.push({
      text: footer.right?.slideNumber ? String(bound.index + 1) : footer.right.text,
      x: width * 0.93,
      anchor: "end",
      path: `${bound.path}.design.footer.right`
    });
  }

  return tag("g", traceAttrs(options, `${bound.path}.design.footer`), pieces.map((piece) => tag("text", {
    x: stableNumber(piece.x),
    y: height - 28,
    "text-anchor": piece.anchor,
    "font-family": bound.design.fonts.body,
    "font-size": 13,
    fill: bound.design.colors.mutedText,
    ...traceAttrs(options, piece.path)
  }, escapeText(flattenText(piece.text)))).join("\n"));
}

function renderTextBox(text, box, bound, config) {
  const rawLines = config.preserveNewlines
    ? String(text ?? "").split(/\r?\n/)
    : flattenText(text).replace(/\s+/g, " ").trim().split(/\r?\n/);
  const size = fitFontSize(rawLines, box, config.fontSize, config.fontFamily, config.fontWeight);
  const wrapped = rawLines.flatMap((line) => wrapLine(line, box.width, size));
  const lineHeight = size * 1.22;
  const totalHeight = wrapped.length * lineHeight;
  const startY = config.verticalAlign === "middle"
    ? box.y + Math.max(0, (box.height - totalHeight) / 2) + size
    : box.y + size;
  const anchor = config.align === "center" ? "middle" : "start";
  const x = config.align === "center" ? box.x + box.width / 2 : box.x;

  const lines = wrapped.slice(0, Math.floor(box.height / lineHeight) || 1).map((line, index) => tag("text", {
    x: stableNumber(x),
    y: stableNumber(startY + index * lineHeight),
    "text-anchor": anchor,
    "font-family": config.fontFamily,
    "font-size": stableNumber(size),
    "font-weight": config.fontWeight,
    fill: config.fill,
    ...traceAttrs(config.options, config.path)
  }, escapeText(line)));

  return tag("g", traceAttrs(config.options, config.path), lines.join("\n"));
}

function fitFontSize(lines, box, requestedSize) {
  let size = requestedSize;
  while (size > 10) {
    const wrapped = lines.flatMap((line) => wrapLine(line, box.width, size));
    if (wrapped.length * size * 1.22 <= box.height + 0.1) return size;
    size -= 1;
  }
  return size;
}

function wrapLine(line, width, fontSize) {
  const words = String(line ?? "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (measureText(next, fontSize) <= width || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function measureText(text, fontSize) {
  let units = 0;
  for (const character of String(text)) {
    if (character === " ") units += 0.32;
    else if (/[A-Z0-9]/.test(character)) units += 0.62;
    else if (character.charCodeAt(0) > 0x2e80) units += 1;
    else units += 0.54;
  }
  return units * fontSize;
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
