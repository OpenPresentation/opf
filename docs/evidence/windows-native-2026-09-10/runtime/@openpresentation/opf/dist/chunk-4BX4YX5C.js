import { MAX_COMPOSITION_DEPTH, tableGrid } from './chunk-PA4UHUYO.js';
import { schemas } from './chunk-GQSK3T7X.js';
import { catalogSchemaNames } from './chunk-TWMRZ43O.js';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// src/generated/catalog-ids.ts
var catalogIds = {
  audiences: [
    "executives",
    "board",
    "engineering-team",
    "investors",
    "customers",
    "sales-team",
    "marketing-team",
    "all-hands",
    "candidates",
    "regulators"
  ],
  purposes: [
    "inform",
    "decide",
    "align",
    "persuade",
    "educate",
    "report",
    "pitch",
    "sell",
    "plan"
  ],
  tones: [
    "formal",
    "casual",
    "inspirational",
    "technical",
    "persuasive",
    "authoritative",
    "conversational"
  ],
  themes: [
    "bold",
    "classic",
    "dark",
    "minimal"
  ],
  layouts: [
    "blank",
    "chart-1x",
    "chart-2x",
    "chart-3x",
    "code-1x",
    "image-1x",
    "image-2x",
    "image-3x",
    "image-bleed",
    "list-1x",
    "list-2x",
    "list-3x",
    "list-4x",
    "list-5x",
    "list-6x",
    "media-1x",
    "number-1x",
    "number-2x",
    "number-3x",
    "number-4x",
    "number-5x",
    "number-6x",
    "table-1x",
    "text-1x",
    "text-2x",
    "text-3x",
    "title",
    "title-subtitle"
  ],
  chartTypes: [
    "100pct-bullet-bar",
    "100pct-bullet-bar-2x",
    "100pct-bullet-bar-3x",
    "100pct-bullet-column",
    "100pct-bullet-column-2x",
    "100pct-bullet-column-3x",
    "100pct-progress-bar",
    "100pct-stacked-area-2x",
    "100pct-stacked-area-3x",
    "100pct-stacked-bar-2x",
    "100pct-stacked-bar-3x",
    "100pct-stacked-column-2x",
    "100pct-stacked-column-3x",
    "area",
    "australia",
    "bar",
    "box-and-whisker",
    "box-and-whisker-2x",
    "box-and-whisker-3x",
    "bullet-bar",
    "bullet-bar-2x",
    "bullet-bar-3x",
    "bullet-column",
    "bullet-column-2x",
    "bullet-column-3x",
    "canada",
    "clustered-bar-2x",
    "clustered-column",
    "column",
    "dot-plot",
    "dot-plot-2x",
    "dot-plot-3x",
    "dot-plot-4x",
    "dot-plot-5x",
    "dot-plot-6x",
    "doughnut",
    "dumbbell",
    "filled-radar",
    "funnel",
    "histogram",
    "line",
    "line-2x",
    "line-3x",
    "line-with-high-low",
    "line-with-high-low-and-markers",
    "line-with-markers",
    "line-with-markers-2x",
    "line-with-markers-3x",
    "pareto",
    "pie",
    "radar",
    "radar-with-markers",
    "scatter",
    "sparkline",
    "sparkline-2x",
    "sparkline-3x",
    "sparkline-4x",
    "sparkline-5x",
    "sparkline-6x",
    "stacked-area-2x",
    "stacked-area-3x",
    "stacked-bar-2x",
    "stacked-bar-3x",
    "stacked-column-2x",
    "stacked-column-3x",
    "stacked-line-2x",
    "stacked-line-3x",
    "stacked-line-with-markers-2x",
    "stacked-line-with-markers-3x",
    "treemap",
    "treemap-2x",
    "treemap-3x",
    "united-kingdom",
    "united-states",
    "waterfall",
    "world"
  ],
  narratives: [
    "problem-solution",
    "scqa",
    "strategic-narrative",
    "golden-circle",
    "conference-talk",
    "transformation-arc",
    "pitch-deck",
    "early-startup-pitch",
    "venture-pitch",
    "persuasive-sales",
    "company-intro",
    "marketing-strategy",
    "product-launch",
    "strategic-advisory",
    "challenge-resolution",
    "project-proposal",
    "failure-analysis",
    "classic-story",
    "business-narrative",
    "rags-to-riches",
    "underdog-victory",
    "survival-story",
    "educate",
    "persuade",
    "reveal",
    "justice",
    "innovation",
    "focus",
    "qbr",
    "business-review",
    "board-meeting",
    "weekly-progress",
    "status-update",
    "performance-review",
    "survey-analysis",
    "trend-analysis",
    "employee-review",
    "performance-improvement-plan",
    "capacity-planning"
  ],
  socialPlatforms: [
    "linkedin",
    "x",
    "github",
    "youtube",
    "instagram",
    "facebook",
    "tiktok",
    "threads",
    "mastodon",
    "bluesky"
  ],
  languages: [
    "afrikaans",
    "albanian",
    "amharic",
    "arabic",
    "armenian",
    "aymara",
    "azerbaijani",
    "bengali",
    "berber-latin",
    "bosnian-latin",
    "bulgarian",
    "catalan",
    "cebuano",
    "chinese-simplified",
    "chinese-traditional",
    "chittagonian",
    "croatian",
    "czech",
    "danish",
    "dutch",
    "english",
    "english-au",
    "english-ca",
    "english-gb",
    "english-in",
    "english-us",
    "estonian",
    "filipino",
    "finnish",
    "french",
    "fulfulde",
    "galician",
    "georgian",
    "german",
    "greek",
    "gujarati",
    "hausa",
    "hebrew",
    "hindi",
    "hungarian",
    "igbo",
    "indonesian",
    "italian",
    "japanese",
    "kannada",
    "kazakh",
    "khmer",
    "kinyarwanda",
    "korean",
    "kurmanji",
    "latvian",
    "lithuanian",
    "macedonian",
    "malagasy",
    "malay",
    "malayalam",
    "maori",
    "marathi",
    "mongolian",
    "nepali",
    "norwegian",
    "odia",
    "oromo",
    "pashto",
    "persian",
    "polish",
    "portuguese",
    "punjabi-gurmukhi",
    "punjabi-shahmukhi",
    "romanian",
    "russian",
    "serbian-cyrillic",
    "serbian-latin",
    "shona",
    "slovak",
    "slovenian",
    "somali",
    "spanish",
    "swahili",
    "swedish",
    "tagalog",
    "tajik",
    "tamil",
    "telugu",
    "thai",
    "turkish",
    "ukrainian",
    "urdu",
    "uzbek-latin",
    "vietnamese-quoc-ngu",
    "xhosa",
    "yoruba",
    "zulu"
  ],
  colorSchemes: [
    "black-and-white",
    "bold-red",
    "boost",
    "burnt-orange",
    "cool-horizon",
    "corporate-blue",
    "deep-purple",
    "forest-green",
    "golden-yellow",
    "luxury",
    "pastel-red",
    "slate-gray",
    "steel-blue",
    "vibes"
  ],
  fontSchemes: [
    "angsana-new",
    "aparajita",
    "aptos",
    "arabic-typesetting",
    "arial",
    "batang",
    "bookman",
    "calibri",
    "century-schoolbook",
    "consolas",
    "constantia",
    "courier-new",
    "daunpenh",
    "david",
    "dilleniaupc",
    "fangsong",
    "garamond",
    "gautami",
    "georgia",
    "gisha",
    "grandview",
    "gungsuh",
    "impact",
    "kalinga",
    "kartika",
    "khmer-ui",
    "latha",
    "lucida-sans",
    "malgun-gothic",
    "mangal",
    "meiryo",
    "microsoft-jhenghei",
    "microsoft-yahei",
    "mingliu",
    "miriam",
    "montserrat",
    "ms-mincho",
    "nirmala-ui",
    "noto-naksh-arabic",
    "noto-nastaliq-urdu",
    "noto-sans",
    "noto-sans-arabic",
    "noto-sans-armenian",
    "noto-sans-bengali",
    "noto-sans-devangari",
    "noto-sans-ethiopic",
    "noto-sans-georgian",
    "noto-sans-gujarati",
    "noto-sans-gurmukhi",
    "noto-sans-hebrew",
    "noto-sans-jp",
    "noto-sans-kannada",
    "noto-sans-khmer",
    "noto-sans-kr",
    "noto-sans-malayalam",
    "noto-sans-mongolian",
    "noto-sans-oriya",
    "noto-sans-sc",
    "noto-sans-tamil",
    "noto-sans-tc",
    "noto-sans-telugu",
    "noto-sans-thai",
    "nyala",
    "open-sans",
    "pmingliu",
    "poppins",
    "pt-serif",
    "raavi",
    "raleway",
    "roboto",
    "rockwell",
    "sakkal-majalla",
    "seaford",
    "segoe-ui",
    "segoe-ui-light",
    "shonar-bangla",
    "shruti",
    "simsun",
    "skeena",
    "sylfaen",
    "tahoma",
    "tenorite",
    "times-new-roman",
    "traditional-arabic",
    "trebuchet-ms",
    "tunga",
    "verdana",
    "vrinda",
    "yu-gothic"
  ]
};

// src/validator.ts
var OPFValidationError = class extends Error {
  issues;
  result;
  constructor(result) {
    const first = result.errors[0];
    super(first ? `OPF validation failed at ${first.path}: ${first.message}` : "OPF validation failed");
    this.name = "OPFValidationError";
    this.issues = result.errors;
    this.result = result;
  }
};
var schemaNameByCatalogKind = catalogSchemaNames;
var ajv;
var dynamicSchemaCache = /* @__PURE__ */ new WeakMap();
var promotedRegionKeys = [
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
var promotedRegionKeySet = new Set(promotedRegionKeys);
var rootPayloadFields = [
  "type",
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
  "timeline",
  "blocks"
];
var contentKindSpecs = {
  text: {
    fields: ["text", "bullets"],
    required: [],
    requireAny: ["text", "bullets"]
  },
  list: {
    fields: ["items"],
    required: ["items"]
  },
  image: {
    fields: ["image"],
    required: ["image"]
  },
  chart: {
    fields: ["chart"],
    required: ["chart"]
  },
  table: {
    fields: ["table"],
    required: ["table"]
  },
  video: {
    fields: ["video"],
    required: ["video"]
  },
  code: {
    fields: ["code"],
    required: ["code"]
  },
  metric: {
    fields: ["metric"],
    required: ["metric"]
  },
  quote: {
    fields: ["quote"],
    required: ["quote"]
  },
  timeline: {
    fields: ["timeline"],
    required: ["timeline"]
  }
};
var columnSpans = {
  left: [0],
  center: [1],
  right: [2],
  "left+center": [0, 1],
  "center+right": [1, 2],
  "left+center+right": [0, 1, 2]
};
var rowSpans = {
  top: [0],
  middle: [1],
  bottom: [2],
  "top+middle": [0, 1],
  "middle+bottom": [1, 2],
  "top+middle+bottom": [0, 1, 2]
};
function getAjv() {
  if (ajv) {
    return ajv;
  }
  const instance = new Ajv2020({
    allErrors: true,
    strict: false,
    allowUnionTypes: true
  });
  addFormats(instance);
  for (const schema of Object.values(schemas)) {
    instance.addSchema(schema);
  }
  ajv = instance;
  return instance;
}
function isSchemaName(value) {
  return typeof value === "string" && value in schemas;
}
function isCatalogKind(value) {
  return typeof value === "string" && value in schemaNameByCatalogKind;
}
function resolveValidator(schemaOrKind) {
  const instance = getAjv();
  if (isSchemaName(schemaOrKind)) {
    const schema = schemas[schemaOrKind];
    const validator2 = instance.getSchema(schema.$id) ?? instance.compile(schema);
    return { validate: validator2, schemaName: schemaOrKind };
  }
  if (isCatalogKind(schemaOrKind)) {
    const schemaName = schemaNameByCatalogKind[schemaOrKind];
    const schema = schemas[schemaName];
    const validator2 = instance.getSchema(schema.$id) ?? instance.compile(schema);
    return { validate: validator2, schemaName, catalogKind: schemaOrKind };
  }
  const cached = dynamicSchemaCache.get(schemaOrKind);
  if (cached) {
    return { validate: cached };
  }
  const validator = instance.compile(schemaOrKind);
  dynamicSchemaCache.set(schemaOrKind, validator);
  return { validate: validator };
}
function toIssue(error) {
  return {
    path: error.instancePath || "/",
    message: error.message ?? "failed validation",
    keyword: error.keyword,
    schemaPath: error.schemaPath,
    params: error.params
  };
}
function semanticIssue(path, message, params = {}) {
  return {
    path,
    message,
    keyword: "opf",
    schemaPath: "#/x-opf-semantics",
    params
  };
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasOwn(value, key) {
  return Object.hasOwn(value, key);
}
function isEnUkTag(value) {
  return typeof value === "string" && value.toLowerCase() === "en-uk";
}
function pathFor(parentPath, key) {
  return parentPath === "/" ? `/${key}` : `${parentPath}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
}
function presentFields(value, fields) {
  return fields.filter((field) => hasOwn(value, field));
}
function isContentKind(value) {
  return typeof value === "string" && value in contentKindSpecs;
}
function inferredKinds(value) {
  const kinds = [];
  if (presentFields(value, contentKindSpecs.text.fields).length > 0) kinds.push("text");
  if (hasOwn(value, "items")) kinds.push("list");
  if (hasOwn(value, "image")) kinds.push("image");
  if (hasOwn(value, "video")) kinds.push("video");
  if (hasOwn(value, "chart")) kinds.push("chart");
  if (hasOwn(value, "table")) kinds.push("table");
  if (hasOwn(value, "code")) kinds.push("code");
  if (hasOwn(value, "metric")) kinds.push("metric");
  if (hasOwn(value, "quote")) kinds.push("quote");
  if (hasOwn(value, "timeline")) kinds.push("timeline");
  return kinds;
}
function isImplicitBlocksComposition(value, inferred, options) {
  if (options.slideRoot !== true || hasOwn(value, "blocks")) {
    return false;
  }
  return inferred.length > 1;
}
function validateContentPayload(value, path, options = {}) {
  const issues = [];
  const explicitType = value.type;
  const payloadFields = presentFields(value, rootPayloadFields);
  const hasBlocks = hasOwn(value, "blocks");
  if (hasBlocks || explicitType === "group") {
    if (explicitType !== void 0 && explicitType !== "group") issues.push(semanticIssue(path, "a group must use type 'group' or omit type"));
    const incompatible2 = payloadFields.filter((field) => field !== "blocks" && field !== "type");
    if (incompatible2.length) issues.push(semanticIssue(path, "blocks cannot be mixed with leaf payload fields", { fields: incompatible2 }));
    if (!Array.isArray(value.blocks) || value.blocks.length === 0 && !options.slideRoot) issues.push(semanticIssue(pathFor(path, "blocks"), "a group requires at least one block"));
    if (Array.isArray(value.blocks)) value.blocks.forEach((block, index) => {
      if (isRecord(block)) issues.push(...validateContentPayload(block, `${pathFor(path, "blocks")}/${index}`));
    });
    return issues;
  }
  if (hasOwn(value, "composition") && !options.slideRoot) issues.push(semanticIssue(pathFor(path, "composition"), "composition is only valid on a group containing blocks"));
  if (explicitType !== void 0 && !isContentKind(explicitType)) {
    return issues;
  }
  const kind = isContentKind(explicitType) ? explicitType : void 0;
  const inferred = kind ? [kind] : inferredKinds(value);
  if (!kind && inferred.length === 0) {
    if (payloadFields.length > 0 || path !== "/") {
      issues.push(semanticIssue(path, "content payload must include concrete content fields", {
        fields: payloadFields
      }));
    }
    return issues;
  }
  if (!kind && inferred.length > 1) {
    if (isImplicitBlocksComposition(value, inferred, options)) {
      return issues;
    }
    issues.push(semanticIssue(path, "content payload mixes fields from incompatible content types", {
      inferredTypes: inferred
    }));
    return issues;
  }
  const resolvedKind = inferred[0];
  if (!resolvedKind) {
    return issues;
  }
  const spec = contentKindSpecs[resolvedKind];
  const allowedFields = /* @__PURE__ */ new Set([
    "type",
    ...spec.fields
  ]);
  for (const required of spec.required) {
    if (!hasOwn(value, required)) {
      issues.push(semanticIssue(path, `content payload type '${resolvedKind}' requires '${required}'`, {
        type: resolvedKind,
        required
      }));
    }
  }
  if (spec.requireAny && presentFields(value, spec.requireAny).length === 0) {
    issues.push(semanticIssue(path, `content payload type '${resolvedKind}' requires one of: ${spec.requireAny.join(", ")}`, {
      type: resolvedKind,
      requiredAny: spec.requireAny
    }));
  }
  const incompatible = payloadFields.filter((field) => !allowedFields.has(field));
  if (incompatible.length > 0) {
    issues.push(semanticIssue(path, `content payload type '${resolvedKind}' cannot include incompatible fields: ${incompatible.join(", ")}`, {
      type: resolvedKind,
      incompatible
    }));
  }
  return issues;
}
function slideRegion(key) {
  if (key.includes(":")) {
    const [rowPart, columnPart] = key.split(":");
    if (!rowPart || !columnPart) return void 0;
    const rows = rowSpans[rowPart];
    const columns = columnSpans[columnPart];
    return rows && columns ? { rows, columns } : void 0;
  }
  if (key in columnSpans) {
    const columns = columnSpans[key];
    return columns ? { rows: [0, 1, 2], columns } : void 0;
  }
  if (key in rowSpans) {
    const rows = rowSpans[key];
    return rows ? { rows, columns: [0, 1, 2] } : void 0;
  }
  return void 0;
}
function intersects(left, right) {
  return left.some((value) => right.includes(value));
}
function regionsOverlap(left, right) {
  return intersects(left.rows, right.rows) && intersects(left.columns, right.columns);
}
function validateSlideRegions(slide, slidePath) {
  const issues = [];
  const regionKeys = Object.keys(slide).filter((key) => promotedRegionKeySet.has(key));
  const rootFields = presentFields(slide, rootPayloadFields);
  if (regionKeys.length > 0 && rootFields.length > 0) {
    issues.push(semanticIssue(slidePath, "root content payload fields cannot be mixed with promoted region keys", {
      rootFields,
      regionKeys
    }));
  }
  if (regionKeys.length === 0 && rootFields.length > 0) {
    issues.push(...validateContentPayload(slide, slidePath, { slideRoot: true }));
  }
  for (const key of regionKeys) {
    const value = slide[key];
    if (isRecord(value)) {
      issues.push(...validateContentPayload(value, pathFor(slidePath, key)));
    }
  }
  for (let leftIndex = 0; leftIndex < regionKeys.length; leftIndex += 1) {
    const leftKey = regionKeys[leftIndex];
    if (!leftKey) continue;
    const leftRegion = slideRegion(leftKey);
    if (!leftRegion) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < regionKeys.length; rightIndex += 1) {
      const rightKey = regionKeys[rightIndex];
      if (!rightKey) continue;
      const rightRegion = slideRegion(rightKey);
      if (!rightRegion) continue;
      if (regionsOverlap(leftRegion, rightRegion)) {
        issues.push(semanticIssue(slidePath, `promoted region keys '${leftKey}' and '${rightKey}' overlap`, {
          regionKeys: [leftKey, rightKey]
        }));
      }
    }
  }
  return issues;
}
function validatePresentationSemantics(value) {
  if (!isRecord(value) || !Array.isArray(value.slides)) {
    return [];
  }
  const issues = [];
  if (isEnUkTag(value.language)) {
    issues.push(semanticIssue("/language", "Use 'en-GB' for UK English; 'en-UK' is not a valid BCP-47 region tag", {
      replacement: "en-GB"
    }));
  } else if (isRecord(value.language) && isEnUkTag(value.language.bcp47)) {
    issues.push(semanticIssue("/language/bcp47", "Use 'en-GB' for UK English; 'en-UK' is not a valid BCP-47 region tag", {
      replacement: "en-GB"
    }));
  }
  const slideIds = /* @__PURE__ */ new Set();
  value.slides.forEach((slide, index) => {
    if (isRecord(slide)) {
      if (typeof slide.id === "string") {
        if (slideIds.has(slide.id)) issues.push(semanticIssue(`/slides/${index}/id`, "slide ids must be unique within a presentation", { id: slide.id }));
        slideIds.add(slide.id);
      }
      issues.push(...validateSlideRegions(slide, `/slides/${index}`));
      const visitTables = (node, path) => {
        if (isRecord(node.table)) for (const issue of tableGrid(node.table).issues) issues.push(semanticIssue(pathFor(path, "table") + issue.path.slice(5).replaceAll(".", "/"), issue.message));
        if (Array.isArray(node.blocks)) node.blocks.forEach((block, i) => {
          if (isRecord(block)) visitTables(block, `${path}/blocks/${i}`);
        });
        for (const key of promotedRegionKeys) if (isRecord(node[key])) visitTables(node[key], pathFor(path, key));
      };
      visitTables(slide, `/slides/${index}`);
    }
  });
  return issues;
}
var bareIdPattern = /^[a-z0-9][a-z0-9-]*$/;
function inlineCatalogEntry(context, kind) {
  const catalogsField = context.document.catalogs;
  if (!isRecord(catalogsField)) {
    return void 0;
  }
  const entry = catalogsField[kind];
  return isRecord(entry) ? entry : void 0;
}
function unknownIdWarning(kind, value, path, context) {
  if (typeof value !== "string" || !bareIdPattern.test(value)) {
    return void 0;
  }
  if (context) {
    const entry = inlineCatalogEntry(context, kind);
    if (entry) {
      if (Array.isArray(entry.records) && entry.records.some((record) => isRecord(record) && record.id === value)) {
        return void 0;
      }
      if (typeof entry.source === "string") {
        return void 0;
      }
    }
  }
  if (catalogIds[kind].includes(value)) {
    return void 0;
  }
  return semanticIssue(path, `unknown ${kind} catalog id '${value}'`, { kind, id: value });
}
function referenceObjectWarning(kind, value, path, context) {
  if (typeof value === "string") {
    return unknownIdWarning(kind, value, path, context);
  }
  if (isRecord(value)) {
    return unknownIdWarning(kind, value.id, pathFor(path, "id"), context);
  }
  return void 0;
}
function pushIfDefined(issues, issue) {
  if (issue) {
    issues.push(issue);
  }
}
function designReferenceWarnings(design, path, context) {
  if (!isRecord(design)) {
    return [];
  }
  const issues = [];
  pushIfDefined(issues, referenceObjectWarning("themes", design.theme, pathFor(path, "theme"), context));
  pushIfDefined(issues, referenceObjectWarning("colorSchemes", design.colorScheme, pathFor(path, "colorScheme"), context));
  pushIfDefined(issues, referenceObjectWarning("fontSchemes", design.fontScheme, pathFor(path, "fontScheme"), context));
  if (isRecord(design.theme)) {
    const themePath = pathFor(path, "theme");
    pushIfDefined(issues, referenceObjectWarning("colorSchemes", design.theme.colorScheme, pathFor(themePath, "colorScheme"), context));
    pushIfDefined(issues, referenceObjectWarning("fontSchemes", design.theme.fontScheme, pathFor(themePath, "fontScheme"), context));
  }
  return issues;
}
function chartTypeWarnings(payload, path, context) {
  if (!isRecord(payload)) {
    return [];
  }
  const issues = [];
  if (isRecord(payload.chart)) {
    pushIfDefined(issues, unknownIdWarning("chartTypes", payload.chart.type, `${pathFor(path, "chart")}/type`, context));
  }
  if (Array.isArray(payload.blocks)) {
    payload.blocks.forEach((block, index) => {
      issues.push(...chartTypeWarnings(block, `${pathFor(path, "blocks")}/${index}`, context));
    });
  }
  return issues;
}
function presentationReferenceWarnings(value) {
  if (!isRecord(value) || !Array.isArray(value.slides)) {
    return [];
  }
  const context = { document: value };
  const issues = [];
  if (typeof value.narrative === "string") {
    pushIfDefined(issues, unknownIdWarning("narratives", value.narrative, "/narrative", context));
  }
  issues.push(...designReferenceWarnings(value.design, "/design", context));
  value.slides.forEach((slide, index) => {
    if (!isRecord(slide)) {
      return;
    }
    const slidePath = `/slides/${index}`;
    issues.push(...designReferenceWarnings(slide.design, pathFor(slidePath, "design"), context));
    issues.push(...chartTypeWarnings(slide, slidePath, context));
    for (const key of Object.keys(slide)) {
      if (promotedRegionKeySet.has(key)) {
        issues.push(...chartTypeWarnings(slide[key], pathFor(slidePath, key), context));
      }
    }
  });
  return issues;
}
var catalogCrossLinkFields = {
  audience: { recommendedNarratives: "narratives", recommendedTones: "tones" },
  purpose: { recommendedNarratives: "narratives", recommendedTones: "tones" },
  tone: { recommendedNarratives: "narratives" }
};
function catalogCrossLinkWarnings(schemaName, value) {
  const fields = catalogCrossLinkFields[schemaName];
  if (!fields || !isRecord(value)) {
    return [];
  }
  const issues = [];
  for (const [field, kind] of Object.entries(fields)) {
    const links = value[field];
    if (!Array.isArray(links)) {
      continue;
    }
    links.forEach((link, index) => {
      pushIfDefined(issues, unknownIdWarning(kind, link, `${pathFor("/", field)}/${index}`));
    });
  }
  return issues;
}
function validateLanguageSemantics(value) {
  if (!isRecord(value)) {
    return [];
  }
  if (isEnUkTag(value.bcp47)) {
    return [semanticIssue("/bcp47", "Use 'en-GB' for UK English; 'en-UK' is not a valid BCP-47 region tag", {
      replacement: "en-GB"
    })];
  }
  return [];
}
function contentDepthIssues(value) {
  if (!isRecord(value) || !Array.isArray(value.slides)) return [];
  const stack = [];
  value.slides.forEach((slide, index) => {
    if (!isRecord(slide)) return;
    if (Array.isArray(slide.blocks)) slide.blocks.forEach((block, i) => {
      stack.push({ value: block, path: `/slides/${index}/blocks/${i}`, depth: 0, ancestors: [] });
    });
    for (const key of promotedRegionKeys) if (hasOwn(slide, key)) stack.push({ value: slide[key], path: `/slides/${index}/${key}`, depth: 0, ancestors: [] });
  });
  while (stack.length) {
    const entry = stack.pop();
    if (!isRecord(entry.value) || !Array.isArray(entry.value.blocks)) continue;
    if (entry.ancestors.includes(entry.value) || entry.depth >= MAX_COMPOSITION_DEPTH) return [semanticIssue(entry.path, `content groups must be acyclic and nest at most ${MAX_COMPOSITION_DEPTH} levels`)];
    const ancestors = [...entry.ancestors, entry.value];
    entry.value.blocks.forEach((block, i) => {
      stack.push({ value: block, path: `${entry.path}/blocks/${i}`, depth: entry.depth + 1, ancestors });
    });
  }
  return [];
}
function validate(value, schemaOrKind = "presentation") {
  const resolved = resolveValidator(schemaOrKind);
  if (resolved.schemaName === "presentation") {
    const errors2 = contentDepthIssues(value);
    if (errors2.length) return { valid: false, errors: errors2, warnings: [], schemaName: resolved.schemaName };
  }
  const valid = resolved.validate(value) === true;
  const errors = valid ? [] : (resolved.validate.errors ?? []).map(toIssue);
  const warnings = [];
  if (resolved.schemaName === "presentation") {
    errors.push(...validatePresentationSemantics(value));
    warnings.push(...presentationReferenceWarnings(value));
  } else if (resolved.schemaName === "language") {
    errors.push(...validateLanguageSemantics(value));
  }
  if (resolved.schemaName) {
    warnings.push(...catalogCrossLinkWarnings(resolved.schemaName, value));
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    schemaName: resolved.schemaName,
    catalogKind: resolved.catalogKind
  };
}
function assertValid(value, schemaOrKind = "presentation") {
  const result = validate(value, schemaOrKind);
  if (!result.valid) {
    throw new OPFValidationError(result);
  }
  return value;
}
function validatePresentation(value) {
  return validate(value, "presentation");
}
function assertValidPresentation(value) {
  assertValid(value, "presentation");
}
function validateCatalogRecord(kind, value) {
  return validate(value, kind);
}
function assertValidCatalogRecord(kind, value) {
  assertValid(value, kind);
}

export { OPFValidationError, assertValid, assertValidCatalogRecord, assertValidPresentation, validate, validateCatalogRecord, validatePresentation };
