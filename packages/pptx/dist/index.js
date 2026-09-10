import {importTableFrames} from './table-import.js';
import {attachCodeTags, codeManifest, importCodeGroups, nativeShapeParagraphs, nativeTextShapes} from './code-provenance.js';
import {importImageOrientation} from './image-import.js';
import {nativeBackgroundFill} from './background.js';
import {importBackground} from './background-import.js';
import { webpToPng } from '#image-fallback';
import { rasterMetadata, pictureTransform, normalizeImageOrientation } from './image-geometry.js';
import { layoutTable, composeSlide, fitText, fitRichText, textWidthMeasurer, resolveCanvasDimensions, resolveFontFamilies, resolveTextStyle } from "@openpresentation/opf/composition";
import PptxGenJS from "../vendor/pptxgenjs/pptxgen.es.js";
import { unzipSync, zipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
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
// fflate derives the DOS zip date from local-time fields, so build this from
// local components: a UTC instant rolls back to 1979 west of UTC (below
// fflate's 1980 floor) and would otherwise yield timezone-dependent bytes.
const FIXED_ZIP_DATE = new Date(1980, 0, 1, 0, 0, 0);
const DEFAULT_SEED = 0x4f504658;
const CANONICAL_SCHEMA = "https://openpresentation.org/schema/opf/v1";
const EMUS_PER_INCH = 914400;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: false
});

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
  if (options.imageFormat !== undefined && !['compatible', 'preserve'].includes(options.imageFormat)) {
    throw new OPFPptxError('invalid-image-format', 'imageFormat must be compatible or preserve.', {path: 'options.imageFormat'});
  }
  const presentation = parseInput(input);
  assertValidBoundary(presentation);

  const context = resolvePresentationContext(presentation, {...options,textMeasurement:undefined});
  context.listMarkers = new Map();
  context.tableHeaders = new Map();
  context.tableCells = new Map();
  context.imagePlacements = new Map();
  context.backgroundFills = new Map();
  context.codeTags = new Map();
  context.imageFormat = options.imageFormat ?? "compatible";
  const pptx = new PptxGenJS();
  configurePresentation(pptx, presentation, {...context,fonts:resolveSlideContext(presentation,presentation.slides[0],context,options).fonts});

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

export async function fromPptx(input, options = {}) {
  const entries = readPptxZip(input);
  const presentationDoc = parseRequiredXml(entries, "ppt/presentation.xml");
  const presentationRoot = presentationDoc["p:presentation"];
  if (!presentationRoot) {
    throw new OPFPptxError("invalid-pptx", "PPTX is missing ppt/presentation.xml.");
  }

  const presentationRels = parseRelationships(entries, "ppt/presentation.xml");
  const slidePaths = resolveSlidePaths(entries, presentationRoot, presentationRels);
  if (slidePaths.length === 0) {
    throw new OPFPptxError("invalid-pptx", "PPTX does not contain any slides.");
  }

  const core = readCoreProperties(entries);
  const dimensions = dimensionsFromPresentation(presentationRoot);
  const imported = {
    $schema: options.schema ?? CANONICAL_SCHEMA,
    name: core.title || options.fallbackName || "Imported PPTX",
    slides: []
  };

  if (core.description) imported.description = core.description;
  if (core.author) imported.author = core.author;
  if (dimensions) imported.design = { dimensions };

  for (let index = 0; index < slidePaths.length; index += 1) {
    imported.slides.push(importSlide(entries, slidePaths[index], index, dimensions, options));
  }

  const result = validatePresentation(imported);
  if (!result.valid) {
    throw new OPFPptxError("invalid-import-opf", "Imported PPTX did not produce valid OPF.", {
      issues: result.errors,
      result
    });
  }

  return imported;
}

function readPptxZip(input) {
  let bytes;
  if (input instanceof Uint8Array) {
    bytes = input;
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    throw new OPFPptxError("invalid-input", "PPTX input must be a Uint8Array or ArrayBuffer.");
  }

  try {
    return unzipSync(bytes);
  } catch (error) {
    throw new OPFPptxError("invalid-pptx", "PPTX input is not a readable ZIP archive.", {
      cause: errorMessage(error)
    });
  }
}

function parseRequiredXml(entries, path, parser = xmlParser) {
  const bytes = entries[path];
  if (!bytes) {
    throw new OPFPptxError("invalid-pptx", `PPTX is missing ${path}.`, { path });
  }
  try {
    return parser.parse(decodeText(bytes));
  } catch (error) {
    throw new OPFPptxError("invalid-pptx", `PPTX XML part could not be parsed: ${path}.`, {
      path,
      cause: errorMessage(error)
    });
  }
}

function parseOptionalXml(entries, path) {
  if (!entries[path]) return null;
  return parseRequiredXml(entries, path);
}

function parseRelationships(entries, sourcePartPath) {
  const relsPath = relationshipsPathForPart(sourcePartPath);
  const doc = parseOptionalXml(entries, relsPath);
  const relationships = asArray(doc?.Relationships?.Relationship);
  const map = new Map();
  for (const relationship of relationships) {
    if (!relationship?.Id) continue;
    map.set(relationship.Id, {
      id: relationship.Id,
      type: relationship.Type ?? "",
      target: relationship.Target ?? "",
      targetMode: relationship.TargetMode ?? "Internal",
      path: resolveRelationshipTarget(sourcePartPath, relationship.Target ?? "")
    });
  }
  return map;
}

function relationshipsPathForPart(partPath) {
  const slash = partPath.lastIndexOf("/");
  const dir = slash >= 0 ? partPath.slice(0, slash + 1) : "";
  const file = slash >= 0 ? partPath.slice(slash + 1) : partPath;
  return `${dir}_rels/${file}.rels`;
}

function resolveRelationshipTarget(sourcePartPath, target) {
  if (!target || /^https?:\/\//i.test(target)) return target;
  const raw = target.startsWith("/")
    ? target.slice(1)
    : `${sourcePartPath.slice(0, sourcePartPath.lastIndexOf("/") + 1)}${target}`;
  const parts = [];
  for (const part of raw.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join("/");
}

function resolveSlidePaths(entries, presentationRoot, relationships) {
  const slideIds = asArray(presentationRoot["p:sldIdLst"]?.["p:sldId"]);
  const paths = [];
  for (const slideId of slideIds) {
    const relId = slideId?.["r:id"];
    const relationship = relationships.get(relId);
    if (relationship?.type.endsWith("/slide") && entries[relationship.path]) {
      paths.push(relationship.path);
    }
  }

  if (paths.length > 0) return paths;
  return Object.keys(entries)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort(compareSlidePaths);
}

function compareSlidePaths(left, right) {
  return slideNumber(left) - slideNumber(right) || left.localeCompare(right);
}

function slideNumber(path) {
  return Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
}

function readCoreProperties(entries) {
  const doc = parseOptionalXml(entries, "docProps/core.xml");
  const core = doc?.["cp:coreProperties"] ?? {};
  return {
    title: scalarText(core["dc:title"]).trim(),
    description: scalarText(core["dc:description"] ?? core["dc:subject"]).trim(),
    author: scalarText(core["dc:creator"]).trim()
  };
}

function dimensionsFromPresentation(presentationRoot) {
  const size = presentationRoot["p:sldSz"];
  const width = emuToInches(size?.cx);
  const height = emuToInches(size?.cy);
  if (!width || !height) return null;
  return {
    widthInches: width,
    heightInches: height
  };
}

function importSlide(entries, slidePath, slideIndex, presentationDimensions, options) {
  const doc = parseRequiredXml(entries, slidePath);
  const slideRoot = doc["p:sld"];
  if (!slideRoot) {
    throw new OPFPptxError("invalid-pptx", `PPTX slide is not a PresentationML slide: ${slidePath}.`, {
      path: slidePath
    });
  }

  const relationships = parseRelationships(entries, slidePath);
  const dimensions = presentationDimensions ?? DIMENSION_PRESETS.widescreen;
  const slide = {};
  if (slideRoot.show === "0") slide.hidden = true;

  const background = importBackground(slidePath, resolveCanvasDimensions(dimensions), {
    part: (path, parser) => parseRequiredXml(entries, path, parser), relationships: path => parseRelationships(entries, path), bytes: path => entries[path]
  }, diagnostic => options.onDiagnostic?.({...diagnostic, path: `slides.${slideIndex}.design.background`}));
  if (background) slide.design = {background};

  const items = collectSlideItems(entries, slideRoot, slidePath, relationships, dimensions, options, slideIndex)
    .sort(comparePositionedItems);
  const titleItem = takeTitleItem(items, dimensions);
  if (titleItem) slide.title = titleItem.text;
  const subtitleItem = takeSubtitleItem(items, titleItem, dimensions);
  if (subtitleItem) slide.subtitle = subtitleItem.text;

  const blocks = mergeAdjacentBulletShapes(items)
    .map((item) => payloadFromSlideItem(item))
    .filter(Boolean);
  if (blocks.length > 0) slide.blocks = blocks;

  const notes = readSlideNotes(entries, relationships);
  if (notes) slide.notes = notes;

  return slide;
}

function collectSlideItems(entries, slideRoot, slidePath, relationships, dimensions, options, slideIndex) {
  const tree = slideRoot["p:cSld"]?.["p:spTree"];
  const items = [];
  const shapes = nativeTextShapes(tree);
  if (tree?.['p:grpSp']) options.onDiagnostic?.({code:'grouped-text-reflow',path:`slides.${slideIndex}`,message:'Grouped native text is retained, but group transforms and non-text group members are not reconstructed; review the reflowed OPF.'});
  const paragraphs = nativeShapeParagraphs(decodeText(entries[slidePath]));
  const code = importCodeGroups(shapes, paragraphs, relationships, entries, diagnostic => options.onDiagnostic?.({...diagnostic,path:`slides.${slideIndex}.code`}));
  for (const item of code.items) items.push({kind:'code',bounds:shapeBounds(item.shape['p:spPr']?.['a:xfrm']),payload:item.payload});
  for (const [index,shape] of shapes.entries()) {
    if (code.consumed.has(shape)) continue;
    const item = importShape(shape, dimensions, paragraphs[index]);
    if (item) items.push(item);
  }

  const frames = asArray(tree?.["p:graphicFrame"]);
  const tables = frames.some(frame => frame['a:graphic']?.['a:graphicData']?.['a:tbl'])
    ? importTableFrames(slidePath, {
      part: (path, parser) => parseRequiredXml(entries, path, parser), relationships: path => parseRelationships(entries, path), bytes: path => entries[path]
    }, relationships, (frame, cell, code, message) => options.onDiagnostic?.({code, message, path: `slides.${slideIndex}.tables.${frame}${cell ? '.' + cell : ''}`}), dimensions) : [];
  for (const [index, frame] of frames.entries()) {
    const item = importGraphicFrame(entries, frame, slidePath, relationships, tables[index]);
    if (item) items.push(item);
  }

  for (const [index, picture] of asArray(tree?.["p:pic"]).entries()) {
    const report = diagnostic => options.onDiagnostic?.({...diagnostic, path: `slides.${slideIndex}.pictures.${index}`});
    const item = importPicture(entries, picture, slidePath, relationships, report);
    if (item) items.push(item);
  }

  return items;
}

function importShape(shape, dimensions, paragraphs = readParagraphs(shape["p:txBody"])) {
  const text = paragraphs.map((paragraph) => paragraph.text).join("\n");
  const placeholder = shapePlaceholderType(shape);
  const bounds = shapeBounds(shape["p:spPr"]?.["a:xfrm"]);
  const name = scalarText(shape["p:nvSpPr"]?.["p:cNvPr"]?.name).trim();

  if (text) {
    return {
      kind: "text",
      text,
      paragraphs,
      bounds,
      placeholder,
      name,
      maxFontSize: Math.max(0, ...paragraphs.map((paragraph) => paragraph.maxFontSize))
    };
  }

  if (placeholder || !bounds || isFullSlide(bounds, dimensions)) return null;
  return {
    kind: "unknown",
    bounds,
    name,
    text: `PowerPoint shape: ${name || "unsupported shape"}`
  };
}

function importGraphicFrame(entries, frame, slidePath, relationships, importedTable) {
  const bounds = shapeBounds(frame["p:xfrm"]);
  const name = scalarText(frame["p:nvGraphicFramePr"]?.["p:cNvPr"]?.name).trim();
  const graphicData = frame["a:graphic"]?.["a:graphicData"];
  const table = graphicData?.["a:tbl"];
  if (table) {
    return {
      kind: "table",
      bounds,
      name,
      payload: {
        type: "table",
        table: importedTable
      }
    };
  }

  const chartRelId = graphicData?.["c:chart"]?.["r:id"];
  if (chartRelId) {
    const chart = chartFromRelationship(entries, slidePath, relationships, chartRelId);
    return {
      kind: "chart",
      bounds,
      name,
      payload: chart
        ? { type: "chart", chart }
        : { type: "text", text: `PowerPoint chart: ${name || chartRelId}` }
    };
  }

  return {
    kind: "unknown",
    bounds,
    name,
    text: `PowerPoint object: ${name || "unsupported object"}`
  };
}

function importPicture(entries, picture, slidePath, relationships, report) {
  const bounds = shapeBounds(picture["p:spPr"]?.["a:xfrm"]);
  const name = scalarText(picture["p:nvPicPr"]?.["p:cNvPr"]?.name).trim();
  const alt = scalarText(picture["p:nvPicPr"]?.["p:cNvPr"]?.descr).trim();
  const relId = picture["p:blipFill"]?.["a:blip"]?.["r:embed"];
  const relationship = relationships.get(relId);
  let bytes = relationship?.path ? entries[relationship.path] : null;
  if (!bytes) {
    return {
      kind: "unknown",
      bounds,
      name,
      text: `PowerPoint image: ${alt || name || "unresolved image"}`
    };
  }

  const crop = picture["p:blipFill"]?.["a:srcRect"];
  if (crop && ['l','r','t','b'].some(key => Number(crop[key] ?? 0) !== 0)) {
    report({code: 'unsupported-image-crop', message: 'Native picture crop is not represented by the imported OPF asset; the full image was retained.'});
  }
  bytes = importImageOrientation(bytes, picture["p:spPr"]?.["a:xfrm"], report);

  return {
    kind: "image",
    bounds,
    name,
    payload: {
      type: "image",
      image: {
        src: `data:${rasterMetadata(bytes)?.mediaType ?? mediaTypeForPath(relationship.path)};base64,${bytesToBase64(bytes)}`,
        ...(alt ? { alt } : {})
      }
    }
  };
}

function readParagraphs(txBody) {
  return asArray(txBody?.["a:p"])
    .map((paragraph) => {
      const runs = [
        ...asArray(paragraph?.["a:r"]),
        ...asArray(paragraph?.["a:fld"])
      ];
      const texts = [];
      const sizes = [];
      for (const run of runs) {
        const text = scalarText(run?.["a:t"]);
        if (text) texts.push(text);
        const size = Number(run?.["a:rPr"]?.sz);
        if (Number.isFinite(size)) sizes.push(size / 100);
      }
      return {
        text: texts.join(""),
        bullet: asArray(paragraph?.["a:pPr"]).some(props => props?.["a:buChar"] !== undefined || props?.["a:buAutoNum"] !== undefined),
        level: Number(asArray(paragraph?.["a:pPr"])[0]?.lvl ?? 0),
        maxFontSize: sizes.length > 0 ? Math.max(...sizes) : 0
      };
    });
}

function shapePlaceholderType(shape) {
  return shape["p:nvSpPr"]?.["p:nvPr"]?.["p:ph"]?.type ?? null;
}

function shapeBounds(xfrm) {
  if (!xfrm) return null;
  const x = emuToInches(xfrm["a:off"]?.x);
  const y = emuToInches(xfrm["a:off"]?.y);
  const w = emuToInches(xfrm["a:ext"]?.cx);
  const h = emuToInches(xfrm["a:ext"]?.cy);
  if ([x, y, w, h].some((value) => value === null)) return null;
  return { x, y, w, h };
}

function takeTitleItem(items, dimensions) {
  const explicitIndex = items.findIndex((item) => ["title", "ctrTitle"].includes(item.placeholder));
  if (explicitIndex >= 0) return items.splice(explicitIndex, 1)[0];

  const titleLimit = dimensions.heightInches * 0.28;
  const candidateIndex = items.findIndex((item) => {
    if (item.kind !== "text" || !item.text || item.paragraphs.some(p=>p.bullet)) return false;
    const y = item.bounds?.y ?? 0;
    return y <= titleLimit && (item.maxFontSize >= 20 || /^title\b/i.test(item.name ?? ""));
  });
  if (candidateIndex >= 0) return items.splice(candidateIndex, 1)[0];
  return null;
}

function takeSubtitleItem(items, titleItem, dimensions) {
  const explicitIndex = items.findIndex((item) => item.placeholder === "subTitle");
  if (explicitIndex >= 0) return items.splice(explicitIndex, 1)[0];
  if (!titleItem) return null;

  const titleBottom = (titleItem.bounds?.y ?? 0) + (titleItem.bounds?.h ?? 0);
  const subtitleLimit = Math.min(dimensions.heightInches * 0.34, 1.45);
  const candidateIndex = items.findIndex((item) => {
    if (item.kind !== "text" || !item.text || item.paragraphs.some(p=>p.bullet)) return false;
    const y = item.bounds?.y ?? 0;
    const h = item.bounds?.h ?? 0;
    return y >= titleBottom - 0.05
      && y <= subtitleLimit
      && h <= 0.75
      && item.paragraphs.length === 1
      && item.maxFontSize <= Math.max(22, titleItem.maxFontSize);
  });
  if (candidateIndex >= 0) return items.splice(candidateIndex, 1)[0];
  return null;
}

// Adjacent native bullet boxes on the same text column form one imported list.
// This is a geometry heuristic, not a lossless reconstruction of arbitrary PPTX.
function mergeAdjacentBulletShapes(items) {
  const result=[];
  for(const item of items){
    const previous=result.at(-1);
    const bullets=value=>value?.kind==='text'&&value.paragraphs.length&&value.paragraphs.every(p=>p.bullet);
    if(bullets(previous)&&bullets(item)&&previous.bounds&&item.bounds
      &&Math.abs(previous.bounds.x-item.bounds.x)<.05
      &&item.bounds.y>=previous.bounds.y+previous.bounds.h-.02
      &&item.bounds.y-(previous.bounds.y+previous.bounds.h)<.3){
      previous.paragraphs.push(...item.paragraphs);
      previous.text+='\n'+item.text;
      previous.bounds.h=item.bounds.y+item.bounds.h-previous.bounds.y;
    }else result.push({...item,paragraphs:item.paragraphs?[...item.paragraphs]:undefined,bounds:item.bounds?{...item.bounds}:undefined});
  }
  return result;
}

function payloadFromSlideItem(item) {
  if (item.payload) return item.payload;
  if (item.kind === "text") {
    if (item.paragraphs.some(p=>p.bullet)) {
      return {
        type: "list",
        items: item.paragraphs.map((paragraph) => (
          paragraph.level > 0
            ? { text: paragraph.text, level: paragraph.level }
            : paragraph.text
        ))
      };
    }
    return { type: "text", text: item.text };
  }
  if (item.kind === "unknown" && item.text) return { type: "text", text: item.text };
  return null;
}

function chartFromRelationship(entries, slidePath, relationships, relId) {
  const relationship = relationships.get(relId);
  if (!relationship?.path || !entries[relationship.path]) return null;
  const doc = parseRequiredXml(entries, relationship.path);
  const plotArea = doc["c:chartSpace"]?.["c:chart"]?.["c:plotArea"];
  if (!plotArea) return null;

  const chartNode = firstChartNode(plotArea);
  if (!chartNode) return null;
  const series = asArray(chartNode.node["c:ser"]);
  if (series.length === 0) return null;

  const labels = cachedValues(series[0]?.["c:cat"]);
  const names = series.map((entry, index) => firstCachedValue(entry?.["c:tx"]) || `Series ${index + 1}`);
  const values = series.map((entry) => cachedValues(entry?.["c:val"] ?? entry?.["c:yVal"]).map(numericValue));
  const rowCount = Math.max(labels.length, ...values.map((row) => row.length));
  if (rowCount === 0) return null;

  const rows = [];
  for (let index = 0; index < rowCount; index += 1) {
    rows.push([
      labels[index] ?? `Item ${index + 1}`,
      ...values.map((row) => row[index] ?? 0)
    ]);
  }

  return {
    type: chartNode.type,
    data: {
      columns: ["Category", ...names],
      rows
    }
  };
}

function firstChartNode(plotArea) {
  const candidates = [
    ["c:barChart", (node) => node?.["c:barDir"]?.val === "bar" ? "bar" : "column"],
    ["c:lineChart", () => "line"],
    ["c:pieChart", () => "pie"],
    ["c:doughnutChart", () => "doughnut"],
    ["c:areaChart", () => "area"],
    ["c:scatterChart", () => "scatter"],
    ["c:radarChart", () => "radar"]
  ];
  for (const [key, type] of candidates) {
    const node = asArray(plotArea[key])[0];
    if (node) return { node, type: type(node) };
  }
  return null;
}

function cachedValues(node) {
  const cache = node?.["c:strRef"]?.["c:strCache"]
    ?? node?.["c:numRef"]?.["c:numCache"]
    ?? node?.["c:multiLvlStrRef"]?.["c:multiLvlStrCache"]?.["c:lvl"]
    ?? node?.["c:numLit"]
    ?? node?.["c:strLit"];
  const points = asArray(cache?.["c:pt"]);
  if (points.length > 0) return points.map((point) => scalarText(point?.["c:v"]));
  const nestedPoints = asArray(cache)
    .flatMap((level) => asArray(level?.["c:pt"]))
    .map((point) => scalarText(point?.["c:v"]));
  return nestedPoints;
}

function firstCachedValue(node) {
  return cachedValues(node).find(Boolean) ?? "";
}

function readSlideNotes(entries, relationships) {
  const notesRel = [...relationships.values()].find((relationship) => relationship.type.endsWith("/notesSlide"));
  if (!notesRel?.path || !entries[notesRel.path]) return "";
  const doc = parseRequiredXml(entries, notesRel.path);
  const shapes = asArray(doc["p:notes"]?.["p:cSld"]?.["p:spTree"]?.["p:sp"]);
  const bodyNotes = shapes
    .filter((shape) => shapePlaceholderType(shape) === "body")
    .map((shape) => textFromTextBody(shape["p:txBody"]))
    .filter(Boolean);
  return bodyNotes.join("\n").trim();
}


function textFromTextBody(txBody) {
  return readParagraphs(txBody).map((paragraph) => paragraph.text).filter(Boolean).join("\n").trim();
}

function comparePositionedItems(left, right) {
  const leftY = left.bounds?.y ?? Number.MAX_SAFE_INTEGER;
  const rightY = right.bounds?.y ?? Number.MAX_SAFE_INTEGER;
  const leftX = left.bounds?.x ?? Number.MAX_SAFE_INTEGER;
  const rightX = right.bounds?.x ?? Number.MAX_SAFE_INTEGER;
  return leftY - rightY || leftX - rightX;
}

function firstLine(value) {
  return String(value ?? "").split(/\r?\n/).find((line) => line.trim())?.trim() ?? "";
}

function mediaTypeForPath(path) {
  const ext = path.toLowerCase().split(".").pop();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  return "image/png";
}

function isFullSlide(bounds, dimensions) {
  return bounds.x <= 0.02
    && bounds.y <= 0.02
    && bounds.w >= dimensions.widthInches - 0.04
    && bounds.h >= dimensions.heightInches - 0.04;
}

function emuToInches(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  // Keep native precision through layout/rendering. Rounding inches to six
  // decimals turns a 1280-pixel canvas into 1279.999968 and changes raster edges.
  return number / EMUS_PER_INCH;
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function scalarText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(scalarText).join("");
  if (typeof value === "object" && value["#text"] !== undefined) return scalarText(value["#text"]);
  return "";
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
  const theme = resolveDesignRecord(presentation, "themes", design.theme, DEFAULTS.theme);
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
  for (const role of ["heading","body","code"]) fonts[role] = resolveTextStyle({fontFamily:fonts[role],fontWeight:role === "heading" ? 700 : 400},options.textMeasurement).fontFamily;
  const textColor = readableTextColor(background, colorScheme);
  const darkBackground = isDarkHex(background);

  return {
    seed: Number.isInteger(options.seed) ? options.seed : DEFAULT_SEED,
    timestamp: options.timestamp ?? FIXED_TIMESTAMP,
    zipDate: options.zipDate ? new Date(options.zipDate) : FIXED_ZIP_DATE,
    compressionLevel: Number.isInteger(options.compressionLevel) ? options.compressionLevel : 6,
    layoutName: "OPF_CANVAS",
    dimensions,
    colorScheme,
    backgroundDefinition: design.background ?? theme?.background,
    fonts,
    colors: {
      background,
      text: textColor,
      mutedText: normalizeHex(colorScheme.textSecondary ?? (darkBackground ? colorScheme.light2 : colorScheme.dark2) ?? "#475569"),
      accent: normalizeHex(colorScheme.primary ?? colorScheme.accent1 ?? "#2874A6"),
      surface: normalizeHex(colorScheme.surface ?? (darkBackground ? colorScheme.dark2 : colorScheme.light2) ?? "#F8FAFC"),
      border: normalizeHex(colorScheme.accent5 ?? "#CBD5E1")
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
  const slideContext = resolveSlideContext(presentation, opfSlide, context, options);
  slide.background = { color: slideContext.colors.background };
  const backgroundFill = nativeBackgroundFill(slideContext.backgroundDefinition, {
    width: slideContext.dimensions.widthInches, height: slideContext.dimensions.heightInches
  }, slideContext.colors.background);
  if (backgroundFill) context.backgroundFills.set(`ppt/slides/slide${slideIndex + 1}.xml`, backgroundFill);
  slide.color = slideContext.colors.text;
  if (opfSlide.hidden === true) slide.hidden = true;

  const { widthInches, heightInches } = slideContext.dimensions;
  const layout = resolveCatalogRecord(presentation, "layouts", opfSlide.layout, "blank") ?? {};
  if (opfSlide.layout && layout.id !== opfSlide.layout) throw new OPFPptxError("catalog-resolution-failed", `Layout '${opfSlide.layout}' needs an inline or bundled catalog record.`, { path: `slides.${slideIndex}.layout` });
  const geometry = composeSlide(opfSlide, { width: widthInches * 96, height: heightInches * 96, layout, slideIndex, fonts: slideContext.fonts, textMeasurement: options.textMeasurement });
  for (const diagnostic of geometry.diagnostics) options.onDiagnostic?.(diagnostic);
  for (const item of geometry.items) {
    const region = { x: item.box.x / 96, y: item.box.y / 96, w: item.box.width / 96, h: item.box.height / 96 };
    if (["title", "subtitle", "tag"].includes(item.field)) {
      slide.addText(item.text.lines.join("\n"), {
        ...textBoxOptions(region, slideContext, item.text.fontSize * 0.75),
        fontFace: item.textStyle.fontFamily,
        bold: item.textStyle.fontWeight >= 600,
        italic: item.textStyle.italic,
        color: item.field === "tag" ? slideContext.colors.accent : slideContext.colors.text,
        breakLine: false
      });
    } else if ((item.field === "items" || item.field === "bullets") && item.text?.listEntries) {
      addMeasuredList(slide,item.text,slideContext);
    } else if (item.field === "text" && item.text?.richLines) {
      const alignment=opfSlide.design?.contentAlignment??presentation.design?.contentAlignment??'left';
      for(const line of item.text.richLines){
        const runs=line.fragments.map(fragment=>({text:fragment.text,options:{fontFace:fragment.style.fontFamily,fontSize:fragment.fontSize*.75,bold:fragment.style.fontWeight>=600,italic:fragment.style.italic,color:normalizeHex(fragment.run.color??slideContext.colors.text),underline:fragment.run.underline?{color:normalizeHex(fragment.run.color??slideContext.colors.text)}:undefined,strike:fragment.run.strikethrough?'sngStrike':undefined,baseline:fragment.baselineShift?-fragment.baselineShift/fragment.fontSize*2000:undefined,hyperlink:fragment.run.link&&/^(https?:|mailto:)/i.test(fragment.run.link)?{url:fragment.run.link}:undefined}}));
        if(runs.length)slide.addText(runs,{...textBoxOptions({...region,y:region.y+line.y/96,h:line.height/96},slideContext,item.text.fontSize*.75),align:alignment,fit:'none',wrap:false,lineSpacingMultiple:1});
      }
    } else if (item.field === "text" && typeof item.value === "string") {
      slide.addText(item.text.lines.join("\n"), {...textBoxOptions(region, slideContext, item.text.fontSize * 0.75),fontFace:item.textStyle.fontFamily,bold:item.textStyle.fontWeight>=600,italic:item.textStyle.italic});
    } else {
      await addPayload(slide, presentation, item.payload, region, item.path, { ...slideContext, composition: item.composition, contentAlignment: opfSlide.design?.contentAlignment ?? presentation.design?.contentAlignment ?? "left" }, options, item.quoteLayout, item.codeLayout);
    }
  }

  if (opfSlide.notes) slide.addNotes(String(opfSlide.notes));
}

function resolveSlideContext(presentation, slide, baseContext, options) {
  const effective = { ...presentation, design: { ...presentation.design, ...slide.design } };
  const resolved = resolvePresentationContext(effective, options);
  if (Math.abs(resolved.dimensions.widthInches - baseContext.dimensions.widthInches) > 1e-6
    || Math.abs(resolved.dimensions.heightInches - baseContext.dimensions.heightInches) > 1e-6) {
    throw new OPFPptxError("mixed-slide-dimensions", "PowerPoint requires one canvas size per presentation. Set dimensions on the deck or export this slide separately.");
  }
  return { ...baseContext, backgroundDefinition: resolved.backgroundDefinition, colorScheme: resolved.colorScheme, fonts: resolved.fonts, colors: resolved.colors, imageFill: effective.design.imageFill ?? "fit" };
}

function fieldToType(field) {
  return field === "items" || field === "bullets" ? "list" : field;
}

async function addPayload(slide, presentation, payload, region, path, context, options, quoteLayout, codeLayout) {
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
      addTablePayload(slide, payload.table, region, context, options, path);
      break;
    case "code":
      addCodePayload(slide, payload.code, codeLayout, region, context, path);
      break;
    case "metric":
      addMetricPayload(slide, payload.metric, region, context, options, path);
      break;
    case "quote":
      addQuotePayload(slide, quoteLayout, context, options, path);
      break;
    case "timeline":
      addTimelinePayload(slide, payload.timeline, region, context, options, path);
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

function richLineRuns(line,color) {
  return line.fragments.map(fragment=>({text:fragment.text,options:{fontFace:fragment.style.fontFamily,fontSize:fragment.fontSize*.75,bold:fragment.style.fontWeight>=600,italic:fragment.style.italic,color:normalizeHex(fragment.run.color??color),underline:fragment.run.underline?{color:normalizeHex(fragment.run.color??color)}:undefined,strike:fragment.run.strikethrough?'sngStrike':undefined,baseline:fragment.baselineShift?-fragment.baselineShift/fragment.fontSize*2000:undefined,hyperlink:fragment.run.link&&/^(https?:|mailto:)/i.test(fragment.run.link)?{url:fragment.run.link}:undefined}}));
}
function addMeasuredList(slide,fit,context) {
  for(const entry of fit.listEntries){
    const addLines=(text,box,color,withBullet)=>{
      text.richLines.forEach((line,index)=>{
        const first=withBullet&&index===0,level=Math.min(8,entry.level),inset=first?entry.marker.indent*(level+1):0;
        const region={x:(box.x-inset)/96,y:(box.y+line.y)/96,w:(box.width+inset)/96,h:line.height/96};
        const objectName=first?`OPF list paragraph ${context.listMarkers.size+1}`:undefined;
        if(first)context.listMarkers.set(objectName,{fontFamily:entry.marker.style.fontFamily,fontSize:entry.marker.fontSize*.75,color:normalizeHex(context.colors.text)});
        const paragraph=first?{bullet:{characterCode:entry.marker.text.codePointAt(0).toString(16).padStart(4,'0'),indent:entry.marker.indent*.75},indentLevel:level}:{bullet:false};
        const runs=richLineRuns(line,color);
        if(!runs.length)runs.push({text:'',options:{}});
        // Keep paragraph intent identical across runs. ZIP normalization below
        // removes the duplicate paragraph-property nodes emitted by PptxGenJS.
        for(const run of runs)Object.assign(run.options,paragraph);
        slide.addText(runs,{...textBoxOptions(region,context,text.fontSize*.75),fontFace:entry.marker.style.fontFamily,objectName,align:'left',fit:'none',wrap:false,lineSpacingMultiple:1,...paragraph});
      });
    };
    addLines(entry.text,entry.textBox,context.colors.text,true);
    if(entry.description)addLines(entry.description,entry.descriptionBox,context.colors.mutedText,false);
  }
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
  const objectName = `OPF image ${context.imagePlacements.size + 1}`;
  context.imagePlacements.set(objectName, { region, mode: context.imageFill, path });
  slide.addImage({
    ...resolved,
    objectName,
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
    catAxisLabelColor: context.colors.text,
    valAxisLabelFontFace: context.fonts.body,
    valAxisLabelFontSize: 9,
    valAxisLabelColor: context.colors.text,
    legendColor: context.colors.text,
    showValue: false,
    valGridLine: { color: context.colors.border, transparency: 30, size: 1 },
    barDir: chartData.barDir,
    barGrouping: chartData.barGrouping
  });
}

function addTablePayload(slide, table, region, context, options, path) {
  const scale = Math.min(context.dimensions.widthInches * 96, context.dimensions.heightInches * 96) / 720;
  const hasHeaders = Array.isArray(table?.columns) && table.columns.length > 0;
  const sourceRows = [...(hasHeaders ? [table.columns] : []), ...(table?.rows ?? [])];
  if (sourceRows.length === 0) {
    addPlaceholderPayload(slide, "Table", table, region, context);
    return;
  }

  const layout = layoutTable(table, {x:region.x*96,y:region.y*96,width:region.w*96,height:region.h*96}, {
    scale, minFontSize:context.composition?.minFontSize, fontFamily:context.fonts.body, textMeasurement:options.textMeasurement, path
  });
  const columnCount = layout.columnCount;
  const rows = layout.rows.map(row => row.cells.map(cell => {
    const {header,rich,fit} = cell;
    const cellStyle = cell.style ?? {};
    const baseColor = (cellStyle.color ?? (header ? '#FFFFFF' : '#' + context.colors.text)).replace(/^#/, '');
    const baseFill = (cellStyle.fill ?? (header ? '#' + context.colors.accent : '#' + context.colors.surface)).replace(/^#/, '');
    const alpha = value => value.length === 8 ? (1 - parseInt(value.slice(6), 16) / 255) * 100 : 0;
    const text = stringifyText(cell.value), style = cell.textStyle;
    const fragments = rich ? fit.richLines.flatMap(line => line.fragments) : [];
    const runs = rich ? cell.value.flatMap((value, index) => {
      const run = typeof value === 'string' ? {text:value} : value;
      const fragment = fragments.find(item => item.runIndex === index);
      const runStyle = fragment?.style ?? resolveTextStyle({...style,fontFamily:run.fontFamily ?? style.fontFamily,fontWeight:run.bold === undefined ? style.fontWeight : run.bold ? 700 : 400,italic:run.italic ?? style.italic}, options.textMeasurement);
      const rawColor = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(run.color ?? '') ? run.color.slice(1) : baseColor;
      const color = normalizeHex(rawColor), transparency = rawColor.length === 8 ? (1 - parseInt(rawColor.slice(6), 16) / 255) * 100 : 0;
      const runOptions = {
        fontFace:runStyle.fontFamily,fontSize:fragment ? fragment.fontSize * .75 : fit.fontSize * .75,
        bold:runStyle.fontWeight >= 600,italic:runStyle.italic,
        underline:run.underline ? {color} : undefined,strike:run.strikethrough ? 'sngStrike' : undefined,
        color,transparency,baseline:fragment?.baselineShift ? -fragment.baselineShift / fragment.fontSize * 2000 : undefined,
        hyperlink:run.link && /^(https?:|mailto:)/i.test(run.link) ? {url:run.link} : undefined,
      };
      // PptxGenJS marks every part of a newline-containing run as a paragraph
      // break, including its final part. Split explicitly so the next styled
      // run stays on that final line, and preserve empty/trailing lines.
      const parts = run.text.split(/\r*\n/);
      return parts.map((text, part) => ({text,options:{...runOptions,breakLine:part < parts.length - 1}}));
    }) : null;
    return {
      // Keep native wrapping and the original cell value: inserting measured
      // soft wraps into the text would change a later import or copy operation.
      text: rich ? runs : text,
      options: {
        fontFace: style.fontFamily,
        fontSize: fit.fontSize * 0.75,
        // PptxGenJS fills falsy run options from cell defaults. Rich runs
        // carry their resolved weight, so a bold header default must not turn
        // an explicit bold:false run back on.
        bold: rich ? false : style.fontWeight >= 600,
        italic: rich ? false : style.italic,
        lineSpacing: fit.lineHeight * 0.75,
        paraSpaceAfter: 0,
        align: cellStyle.align ?? context.contentAlignment,
        valign: cellStyle.verticalAlign ?? 'top',
        ...(cell.colSpan > 1 ? {colspan:cell.colSpan} : {}),
        ...(cell.rowSpan > 1 ? {rowspan:cell.rowSpan} : {}),
        color: normalizeHex(baseColor),
        // Rich runs carry resolved alpha. A translucent cell default would
        // overwrite an explicit opaque run because PptxGenJS inherits falsy 0.
        ...(cellStyle.color && !rich ? {transparency:alpha(baseColor)} : {}),
        fill: { color: normalizeHex(baseFill), ...(cellStyle.fill ? {transparency:alpha(baseFill)} : {}) },
      },
    };
  }));
  const objectName = `OPF table ${context.tableHeaders.size + 1}`;
  context.tableHeaders.set(objectName, hasHeaders);
  if (layout.rows.some(row => row.cells.some(cell => Object.keys(cell.style ?? {}).length))) context.tableCells.set(objectName, {layout, scale, defaultBorder:{color:"#"+context.colors.border,width:1/scale}});
  slide.addTable(rows, {
    objectName,
    x: region.x,
    y: region.y,
    w: region.w,
    h: layout.height / 96,
    rowH: layout.rows.map(row => row.box.height / 96),
    colW: Array(columnCount).fill(region.w / columnCount),
    autoPage: false,
    fontFace: context.fonts.body,
    fontSize: 15 * scale * 0.75,
    color: context.colors.text,
    border: { type: "solid", color: context.colors.border, pt: 0.75 },
    margin: [6 * scale, 7.5 * scale, 3 * scale, 7.5 * scale],
    valign: "top"
  });
}

function pixelBox(region) {
  return {x: region.x * 96, y: region.y * 96, width: region.w * 96, height: region.h * 96};
}

// Match the published renderer's payload geometry and shared core text fitting.
// Each fitted line remains native editable text, without PowerPoint rewrapping it.
function addMeasuredPayloadText(slide, text, box, context, options, config) {
  const scale = Math.min(context.dimensions.widthInches, context.dimensions.heightInches) * 96 / 720;
  const style = config.textStyle ?? resolveTextStyle({fontFamily: config.fontFamily ?? context.fonts.body, fontWeight: config.fontWeight ?? 400, path: config.path}, options.textMeasurement);
  const fit = config.fit ?? fitText(String(text ?? ''), box, config.fontSize * scale, (context.composition?.minFontSize ?? 16) * scale, textWidthMeasurer(style, options.textMeasurement));
  if (fit.overflow && !config.diagnosticsHandled) {
    const diagnostic = {code: 'text-overflow', path: config.path, message: 'Text exceeds its cell at the minimum font size; shorten it, increase its space, or split the slide.'};
    options.onDiagnostic?.(diagnostic);
    if (context.composition?.overflow === 'error') throw new OPFPptxError('layout-overflow', diagnostic.message, {path: config.path, issues: [diagnostic]});
  }
  for (const [index, line] of fit.lines.entries()) {
    if (!line) continue;
    slide.addText(line, {
      ...textBoxOptions({x: box.x / 96, y: (box.y + index * fit.lineHeight) / 96, w: box.width / 96, h: fit.lineHeight / 96}, context, fit.fontSize * .75),
      fontFace: style.fontFamily, bold: style.fontWeight >= 600, italic: style.italic,
      color: normalizeHex(config.color ?? context.colors.text), align: config.align ?? context.contentAlignment ?? 'left',
      fit: 'none', wrap: false, lineSpacingMultiple: 1,
    });
  }
}

function addCodePayload(slide, value, layout, region, context, path) {
  if (!layout) throw new OPFPptxError('missing-code-layout', 'Code export requires a coordinated core build with shared code geometry.', {path});
  for (const part of layout.parts) {
    // XML 1.0 Char excludes controls and unpaired UTF-16 surrogates. The u flag
    // keeps valid supplementary characters (surrogate pairs) accepted.
    const invalid = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/u.exec(part.text);
    if (invalid) throw new OPFPptxError('invalid-code-text', `Code text contains U+${invalid[0].codePointAt(0).toString(16).toUpperCase().padStart(4,'0')} at UTF-16 offset ${invalid.index}, which XML cannot represent; edit that character before exporting.`, {path:part.path});
  }
  const group = String(context.codeTags.size + 1), panelName = `OPF code ${group} panel`;
  for (const part of layout.parts) if (!part.fit) throw new OPFPptxError('layout-overflow', 'Code content has no usable internal space; increase its cell size before exporting.', {path:part.path,issues:layout.diagnostics});
  context.codeTags.set(panelName,codeManifest(value,layout,group));
  slide.addShape('rect', {...region, fill: {color: '111827'}, line: {color: '334155', pt: .75}, objectName:panelName});
  for (const [partIndex,part] of layout.parts.entries()) {
    if (!part.fit) throw new OPFPptxError('layout-overflow', 'Code content has no usable internal space; increase its cell size before exporting.', {path:part.path,issues:layout.diagnostics});
    for (const [index,line] of part.fit.sourceLines.entries()) {
      const tabStops=line.segments.filter(segment=>segment.kind==='tab').map(segment=>({position:(segment.x+segment.width)/96,alignment:'l'}));
      const objectName = `OPF code ${group} ${part.role} line ${index+1}`;
      context.codeTags.set(objectName,{v:1,group,role:'line',part:partIndex,line:index});
      slide.addText(part.text.slice(line.start,line.end),{
        ...textBoxOptions({x:part.box.x/96,y:(part.box.y+index*part.fit.lineHeight)/96,w:part.box.width/96,h:part.fit.lineHeight/96},context,part.fit.fontSize*.75),
        fontFace:part.style.fontFamily,bold:part.style.fontWeight>=600,italic:part.style.italic,
        color:part.role==='body'?'E5E7EB':'93C5FD',align:'left',fit:'none',wrap:false,lineSpacingMultiple:1,
        tabStops:tabStops.length?tabStops:undefined,objectName,
      });
    }
  }
}

function addMetricPayload(slide, value, region, context, options, path) {
  const metric = isPlainObject(value) ? value : {value}, box = pixelBox(region);
  addMeasuredPayloadText(slide, metric.value, {...box, height: box.height * .45}, context, options, {path: path + '.value', fontSize: Math.min(76, box.height * .28), fontFamily: context.fonts.heading, fontWeight: 800, color: context.colors.accent});
  addMeasuredPayloadText(slide, [metric.label, metric.description, metric.delta].filter(Boolean).join('\n'), {x: box.x, y: box.y + box.height * .45, width: box.width, height: box.height * .55}, context, options, {path, fontSize: 23, fontWeight: 500});
}

function addQuotePayload(slide, layout, context, options, path) {
  if (!layout) throw new OPFPptxError('missing-quote-layout', 'Quote export requires a coordinated core build with shared quote geometry.', {path});
  for (const part of layout.parts) {
    if (!part.fit) throw new OPFPptxError('layout-overflow', 'Quote content has no usable internal space; increase its cell size before exporting.', {path:part.path,issues:layout.diagnostics});
    addMeasuredPayloadText(slide,part.text,part.box,context,options,{
      path:part.path,fit:part.fit,textStyle:part.style,diagnosticsHandled:true,
      color:part.role==='footer'?context.colors.mutedText:context.colors.text,
    });
  }
}

function addTimelinePayload(slide, value, region, context, options, path) {
  const timeline = Array.isArray(value) ? {events: value} : value;
  const events = Array.isArray(timeline?.events) ? timeline.events : [];
  if (!events.length) return;
  const box = pixelBox(region), labelWidth = box.width / Math.max(2, events.length);
  const gap = (box.width - labelWidth) / Math.max(1, events.length - 1);
  const start = events.length === 1 ? box.x + box.width / 2 : box.x + labelWidth / 2;
  const end = events.length === 1 ? start : box.x + box.width - labelWidth / 2;
  const y = box.y + box.height * .46, radius = Math.min(9, labelWidth / 5, box.height * .04);
  slide.addShape('line', {x: start / 96, y: y / 96, w: (end - start) / 96, h: 0, line: {color: context.colors.border, pt: 3 * .75}});
  for (const [index, event] of events.entries()) {
    const x = start + index * gap;
    slide.addShape('ellipse', {x: (x - radius) / 96, y: (y - radius) / 96, w: radius * 2 / 96, h: radius * 2 / 96, fill: {color: context.colors.accent}, line: {transparency: 100}});
    addMeasuredPayloadText(slide, [event.when, event.what, event.description].filter(Boolean).join('\n'), {x: x - labelWidth / 2, y: index % 2 === 0 ? box.y : y + 24, width: labelWidth, height: box.height * .38}, context, options, {path: `${path}.events.${index}`, fontSize: 16, fontWeight: 500, align: 'center'});
  }
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
    margin: 0,
    paraSpaceAfter: 0,
    lineSpacingMultiple: 1.22,
    fontFace: context.fonts.body,
    fontSize,
    color: context.colors.text,
    breakLine: false,
    fit: "shrink",
    valign: "top"
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
        superscript: run?.superscript,
        subscript: !run?.superscript && run?.subscript,
        hyperlink: run?.link && /^(https?:|mailto:)/i.test(run.link) ? { url: run.link } : undefined
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
  const { width, height } = resolveCanvasDimensions(value);
  return { widthInches: width / 96, heightInches: height / 96 };
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
  return {id:fontScheme.id,...resolveFontFamilies(fontScheme)};
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

async function normalizePptxZip(raw, context) {
  let entries;
  try {
    entries = unzipSync(raw);
  } catch (error) {
    throw new OPFPptxError("packaging-failed", "Generated PPTX could not be read back as a ZIP.", {
      cause: errorMessage(error)
    });
  }

  attachCodeTags(entries, context.codeTags);
  const imageSources = new Map();
  for (const [part, bytes] of Object.entries(entries)) {
    if (!/^ppt\/slides\/slide\d+\.xml$/.test(part)) continue;
    const relationships = parseRelationships(entries, part);
    for (const [picture] of decodeText(bytes).matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)) {
      const placement = context.imagePlacements.get(picture.match(/name="(OPF image \d+)"/)?.[1]);
      const id = picture.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1];
      if (placement) imageSources.set(relationships.get(id)?.path, placement.path);
    }
  }
  const imageMetadata = new Map();
  for (const [part, bytes] of Object.entries(entries)) {
    if (!part.startsWith('ppt/media/')) continue;
    let metadata = rasterMetadata(bytes);
    if (metadata?.mediaType === 'image/webp' && context.imageFormat === 'compatible') {
      try {
        if (metadata.width * metadata.height > 40_000_000) throw new Error('Image dimensions exceed the 40 megapixel conversion limit.');
        const png = await webpToPng(bytes);
        metadata = rasterMetadata(png);
        if (metadata?.mediaType !== 'image/png') throw new Error('The local decoder did not return a PNG.');
        entries[part] = png;
      } catch (error) {
        throw new OPFPptxError('image-conversion-failed', 'WebP could not be converted to a compatible PNG.', {path: imageSources.get(part) ?? part, cause: errorMessage(error)});
      }
    }
    imageMetadata.set(part, metadata);
  }
  const output = {};
  const renameMaps = buildRenameMaps(Object.keys(entries));
  // The host may transform assets or supply a filename/MIME hint that no
  // longer matches its bytes. Native package metadata must describe the bytes.
  renameMaps.media = new Map();
  for (const [path, metadata] of imageMetadata) {
    if (!metadata) continue;
    const extension = metadata.mediaType.slice('image/'.length);
    const currentExtension = path.split('.').at(-1).toLowerCase();
    if (currentExtension === extension || (extension === 'jpeg' && currentExtension === 'jpg')) continue;
    const target = path.replace(/\.[^/.]+$/, `.${extension}`);
    if (target !== path && Object.hasOwn(entries, target)) throw new OPFPptxError('packaging-failed', 'Normalized image paths collide.', {path, target});
    renameMaps.media.set(path, target);
  }
  for (const path of Object.keys(entries).sort()) {
    const normalizedPath = normalizePartPath(path, renameMaps);
    const bytes = normalizePartBytes(path, entries[path], context, renameMaps, entries, imageMetadata);
    output[normalizedPath] = [bytes, {
      level: context.compressionLevel,
      mtime: context.zipDate
    }];
  }

  // Sort after chart/worksheet renaming; source counters can cross digit widths.
  const sortedOutput = Object.fromEntries(Object.keys(output).sort().map(path => [path, output[path]]));
  return zipSync(sortedOutput, {
    level: context.compressionLevel,
    mtime: context.zipDate
  });
}

function normalizeCoreProperties(xml, timestamp) {
  return xml
    .replace(/<dcterms:created xsi:type="dcterms:W3CDTF">[^<]*<\/dcterms:created>/g, `<dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>`)
    .replace(/<dcterms:modified xsi:type="dcterms:W3CDTF">[^<]*<\/dcterms:modified>/g, `<dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>`);
}

function normalizePartBytes(path, bytes, context, renameMaps, entries, imageMetadata) {
  if (imageMetadata.has(path)) return normalizeImageOrientation(bytes, imageMetadata.get(path));
  if (path.endsWith(".xlsx")) {
    return normalizeNestedZip(bytes, context);
  }
  if (path === "docProps/core.xml") {
    return encodeText(normalizePartReferences(normalizeCoreProperties(decodeText(bytes), context.timestamp), renameMaps));
  }
  if (isXmlPart(path)) {
    let xml=decodeText(bytes);
    if (path === '[Content_Types].xml') {
      // Explicit per-part types also correct PptxGenJS's image/jpg default.
      const overrides = [...imageMetadata].filter(([, metadata]) => metadata).map(([part, metadata]) =>
        `<Override PartName="/${part}" ContentType="${metadata.mediaType}"/>`).join('');
      xml = xml.replace('</Types>', `${overrides}</Types>`);
    }
    if (/^ppt\/slides\/slide\d+\.xml$/.test(path)) {
      const fill = context.backgroundFills.get(path);
      if (fill) xml = xml.replace(/<p:bg>[\s\S]*?<\/p:bg>/, `<p:bg><p:bgPr>${fill}<a:effectLst/></p:bgPr></p:bg>`);
      // PptxGenJS table IDs can collide with other objects on the same slide.
      // Preserve existing IDs and allocate unused IDs only for duplicates. This
      // export path creates no connector attachments or animation ID references.
      const objectIds = [...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(match => Number(match[1]));
      let nextObjectId = Math.max(0, ...objectIds) + 1;
      const seenObjectIds = new Set();
      xml = xml.replace(/(<p:cNvPr\b[^>]*\bid=")(\d+)(")/g, (node, before, rawId, after) => {
        const id = Number(rawId);
        if (seenObjectIds.has(id)) return `${before}${nextObjectId++}${after}`;
        seenObjectIds.add(id);
        return node;
      });
      // PptxGenJS 4 has no firstRow option. Set the native flag explicitly so
      // viewers and later imports distinguish column labels from data rows.
      xml = xml.replace(/<p:graphicFrame>([\s\S]*?)<\/p:graphicFrame>/g, frame => {
        const name = frame.match(/name="(OPF table \d+)"/)?.[1];
        if (!context.tableHeaders.has(name)) return frame;
        frame = frame.replace('<a:tblPr/>', `<a:tblPr firstRow="${context.tableHeaders.get(name) ? 1 : 0}"/>`);
        const table = context.tableCells.get(name);
        if (!table) return frame;
        const anchors = table.layout.rows.flatMap(row => row.cells);
        const ownerAt = (row,column) => anchors.find(anchor => row >= anchor.row && row < anchor.row + anchor.rowSpan && column >= anchor.column && column < anchor.column + anchor.colSpan);
        let rowIndex = 0;
        return frame.replace(/<a:tr\b[^>]*>[\s\S]*?<\/a:tr>/g, rowXml => {
          const currentRow = rowIndex++;
          const cells = table.layout.rows[currentRow].cells;
          let column = 0;
          return rowXml.replace(/<a:tc\b[^>]*>[\s\S]*?<\/a:tc>/g, cellXml => {
            const currentColumn = column++;
            const cell = cells.find(cell => cell.column === currentColumn);
            const owner = cell ?? ownerAt(currentRow,currentColumn);
            if (!owner) return cellXml;
            // PowerPoint reads each physical continuation's perimeter border.
            // Anchor-only styling truncates dashes and restores hidden segments.
            const perimeter = {left:currentColumn === owner.column, right:currentColumn === owner.column + owner.colSpan - 1,
              top:currentRow === owner.row, bottom:currentRow === owner.row + owner.rowSpan - 1};
            const style = cell ? {...cell.style} : {borders:Object.fromEntries(Object.keys(perimeter).map(edge => [edge,perimeter[edge] ? owner.style?.borders?.[edge] ?? table.defaultBorder : {color:'#000000',width:0}]))};
            style.borders = {...style.borders};
            // Native shared-edge precedence can let an implicit neighbor cover
            // an explicit merge border. Give both physical sides that border.
            for (const [edge,opposite,dr,dc] of [['left','right',0,-1],['right','left',0,1],['top','bottom',-1,0],['bottom','top',1,0]]) {
              if (!perimeter[edge] || style.borders[edge] || owner.rowSpan > 1 || owner.colSpan > 1) continue;
              const neighbor = ownerAt(currentRow+dr,currentColumn+dc);
              if (neighbor?.style?.borders?.[opposite]) style.borders[edge] = neighbor.style.borders[opposite];
            }
            cellXml = cellXml.replace(/<a:tcPr\b([^>]*)\/>/, '<a:tcPr$1></a:tcPr>');
            return cellXml.replace(/<a:tcPr\b([^>]*)>([\s\S]*?)<\/a:tcPr>/, (properties, attributes, contents) => {
              if (style.padding) {
                const padding = {top:8, right:10, bottom:4, left:10, ...style.padding};
                for (const [edge, key] of [['top','marT'],['right','marR'],['bottom','marB'],['left','marL']]) {
                  attributes = attributes.replace(new RegExp(` ${key}="[^"]*"`), '');
                  attributes += ` ${key}="${Math.round(padding[edge] * table.scale * 9525)}"`;
                }
              }
              for (const [edge, native] of [['left','lnL'],['right','lnR'],['top','lnT'],['bottom','lnB']]) {
                const border = style.borders?.[edge];
                if (!border) continue;
                const fill = border.width === 0 ? '<a:noFill/>' : nativeBackgroundFill({type:'solid',color:border.color},{width:1,height:1});
                const dash = {solid:'solid',dash:'dash',dot:'sysDot'}[border.dash ?? 'solid'];
                const line = `<a:${native} w="${Math.round(border.width * table.scale * 9525)}" cap="flat" cmpd="sng" algn="ctr">${fill}<a:prstDash val="${dash}"/></a:${native}>`;
                const existing = new RegExp(`<a:${native}\\b[^>]*>[\\s\\S]*?<\\/a:${native}>`);
                contents = existing.test(contents) ? contents.replace(existing, line) : contents + line;
              }
              return `<a:tcPr${attributes}>${contents}</a:tcPr>`;
            });
          });
        });
      });
      // Image data is already resolved and embedded by PptxGenJS. Read those
      // exact bytes instead of fetching or resolving the source a second time.
      const relationships = parseRelationships(entries, path);
      xml = xml.replace(/<p:pic>([\s\S]*?)<\/p:pic>/g, picture => {
        const placement = context.imagePlacements.get(picture.match(/name="(OPF image \d+)"/)?.[1]);
        if (!placement) return picture;
        const id = picture.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1];
        const dimensions = imageMetadata.get(relationships.get(id)?.path);
        if (!dimensions) throw new OPFPptxError("unsupported-image-dimensions", "Image fitting requires readable PNG, JPEG, GIF or WebP dimensions. Supply a supported raster image through imageResolver.", { path: placement.path });
        const fitted = pictureTransform(dimensions, placement.region, placement.mode);
        const emu = value => Math.round(value * EMUS_PER_INCH);
        const transformAttrs = `${fitted.rotation ? ` rot="${fitted.rotation * 60000}"` : ''}${fitted.flipH ? ' flipH="1"' : ''}${fitted.flipV ? ' flipV="1"' : ''}`;
        picture = picture.replace(/<a:xfrm\b[^>]*>[\s\S]*?<\/a:xfrm>/, `<a:xfrm${transformAttrs}><a:off x="${emu(fitted.x)}" y="${emu(fitted.y)}"/><a:ext cx="${emu(fitted.w)}" cy="${emu(fitted.h)}"/></a:xfrm>`);
        if (fitted.crop) {
          const attrs = Object.entries(fitted.crop).map(([key, value]) => `${key}="${value}"`).join(' ');
          picture = picture.replace('<a:stretch>', `<a:srcRect ${attrs}/><a:stretch>`);
        }
        return picture;
      });
      // Native bullets otherwise inherit the first rich run's size, font and
      // color, which can differ from the measured list marker.
      xml=xml.replace(/<p:sp>([\s\S]*?)<\/p:sp>/g,(shape)=>{
        const marker=context.listMarkers.get(shape.match(/name="(OPF list paragraph \d+)"/)?.[1]);
        if(!marker)return shape;
        const family=marker.fontFamily.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
        return shape.replace(/<a:buSzPct val="100000"\/>/g,`<a:buClr><a:srgbClr val="${marker.color}"/></a:buClr><a:buSzPts val="${Math.round(marker.fontSize*100)}"/><a:buFont typeface="${family}"/>`);
      });
      // PptxGenJS 4 emits pPr before each rich run. OOXML allows one pPr,
      // before all runs. Paragraph options belong to the first run.
      xml=xml.replace(/<a:p>([\s\S]*?)<\/a:p>/g,(_,body)=>{
        let properties='';
        const content=body.replace(/<a:pPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:pPr>)/g,node=>{properties ||= node;return '';});
        return `<a:p>${properties}${content}</a:p>`;
      });
    }
    return encodeText(normalizePartReferences(xml, renameMaps));
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
  return normalizePartReferences(renameMaps.media?.get(path) ?? path, renameMaps);
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
  // Rewrite package references only, not user-visible text containing paths.
  output = output.replace(/\b(Target|PartName)="([^"]+)"/g, (attribute, name, value) => {
    const prefix = value.startsWith('../media/') ? '../' : value.startsWith('/ppt/media/') ? '/ppt/' : null;
    if (!prefix) return attribute;
    const part = 'ppt/' + value.slice(prefix.length);
    const target = renameMaps.media?.get(part);
    return target ? `${name}="${prefix}${target.slice('ppt/'.length)}"` : attribute;
  });
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
