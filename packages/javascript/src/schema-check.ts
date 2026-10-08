import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import type { Catalog } from "./catalog-refs.js";
import { catalogSchemaNames, type CatalogRecordKind } from "./catalog-schemas.js";
import { resolveDesignRecords } from "./design-records.js";
import { chartOptionTarget, resolveChartOptions } from "./chart-options.js";
import { datasetDiagnostics, resolveChartData, resolveTableData, type DataDiagnostic } from "./chart-data.js";
import { MAX_COMPOSITION_DEPTH, resolveCanvasDimensions } from "./composition.js";
import { annotationIssues } from "./annotation-validation.js";
import { codeHighlightLines } from "./code-highlight.js";
import { isRecord, pathFor, promotedRegionKeys, visitContentPayloads } from "./content-walk.js";
import {tableGrid} from "./table.js";
import { numberingFindings } from "./numbering.js";
import { schemas, type SchemaName } from "./schemas.js";
import { rememberValidationDefinition } from './validation-definitions.js';
import type { ValidationIssue } from "./generated/types/finding.js";
import { VARIABLE_KINDS, hasContentVariables, instantiateForValidation, isTemplate, type VariableValues } from "./variables.js";

/**
 * The schema and semantic engine behind `validate`. Internal: it reports raw issues, and `validator.ts` turns
 * them into findings. It is the only code that runs Ajv, so everything that needs "is this well-formed OPF" goes
 * through `validate(value, { only: ["format"] })`.
 */
export type { ValidationIssue };

export interface SchemaCheckOptions {
  /** Validate as a template (true) or a normal deck (false), overriding the root `template` marker. */
  template?: boolean;
  /** Values to fill variables with before checking, keyed by variable id. */
  values?: VariableValues;
  /** Registered catalogs, for the checks that read a resolved theme (slide-theme-dimensions). */
  catalogs?: readonly Catalog[];
}

export interface SchemaCheckResult {
  /** True when `errors` is empty. A required variable with no value is in `unfilled`, not in `errors`. */
  valid: boolean;
  errors: ValidationIssue[];
  /** Advisory issues such as adapted chart options. Warnings never affect `valid`. */
  warnings: ValidationIssue[];
  schemaName?: SchemaName;
  catalogKind?: CatalogRecordKind;
  /**
   * Presentations only, when the document declares content variables or is a template: whether it was checked as a
   * template, and which required variables have no value.
   */
  template?: boolean;
  unfilledVariables?: string[];
  /** Required variables with no value in a normal deck, one issue each (`code: "variable-unfilled"`). Empty for a template. */
  unfilled: ValidationIssue[];
}

export type SchemaOrKind = SchemaName | CatalogRecordKind;

const schemaNameByCatalogKind: Readonly<Record<CatalogRecordKind, SchemaName>> = catalogSchemaNames;

let ajv: Ajv2020 | undefined;

export { promotedRegionKeys } from "./content-walk.js";

const promotedRegionKeySet = new Set<string>(promotedRegionKeys);

const rootPayloadFields = [
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
  "blocks",
] as const;

type ContentKind =
  | "text"
  | "list"
  | "image"
  | "chart"
  | "table"
  | "video"
  | "code"
  | "metric"
  | "quote"
  | "timeline";

interface ContentKindSpec {
  fields: readonly string[];
  required: readonly string[];
  requireAny?: readonly string[];
}

const contentKindSpecs: Record<ContentKind, ContentKindSpec> = {
  text: {
    fields: ["text", "bullets"],
    required: [],
    requireAny: ["text", "bullets"],
  },
  list: {
    fields: ["items"],
    required: ["items"],
  },
  image: {
    fields: ["image"],
    required: ["image"],
  },
  chart: {
    fields: ["chart"],
    required: ["chart"],
  },
  table: {
    fields: ["table"],
    required: ["table"],
  },
  video: {
    fields: ["video"],
    required: ["video"],
  },
  code: {
    fields: ["code"],
    required: ["code"],
  },
  metric: {
    fields: ["metric"],
    required: ["metric"],
  },
  quote: {
    fields: ["quote"],
    required: ["quote"],
  },
  timeline: {
    fields: ["timeline"],
    required: ["timeline"],
  },
};

// RR-34: payload kinds whose blocks may carry a caption.
const captionableKinds = new Set<ContentKind>(["image", "chart", "table", "video"]);

const columnSpans: Record<string, readonly number[]> = {
  left: [0],
  center: [1],
  right: [2],
  "left+center": [0, 1],
  "center+right": [1, 2],
  "left+center+right": [0, 1, 2],
};

const rowSpans: Record<string, readonly number[]> = {
  top: [0],
  middle: [1],
  bottom: [2],
  "top+middle": [0, 1],
  "middle+bottom": [1, 2],
  "top+middle+bottom": [0, 1, 2],
};

function getAjv(): Ajv2020 {
  if (ajv) {
    return ajv;
  }

  const instance = new Ajv2020({
    allErrors: true,
    verbose: true,
    strict: false,
    allowUnionTypes: true,
  });
  addFormats(instance);

  for (const schema of Object.values(schemas)) {
    instance.addSchema(schema);
  }

  ajv = instance;
  return instance;
}

function isSchemaName(value: unknown): value is SchemaName {
  return typeof value === "string" && value in schemas;
}

function isCatalogKind(value: unknown): value is CatalogRecordKind {
  return typeof value === "string" && value in schemaNameByCatalogKind;
}

function resolveValidator(schemaOrKind: SchemaOrKind): {
  validate: ValidateFunction;
  schemaName: SchemaName;
  catalogKind?: CatalogRecordKind;
} {
  const instance = getAjv();

  if (isSchemaName(schemaOrKind)) {
    const schema = schemas[schemaOrKind];
    const validator = instance.getSchema(schema.$id as string) ?? instance.compile(schema);
    return { validate: validator, schemaName: schemaOrKind };
  }

  if (isCatalogKind(schemaOrKind)) {
    const schemaName = schemaNameByCatalogKind[schemaOrKind];
    const schema = schemas[schemaName];
    const validator = instance.getSchema(schema.$id as string) ?? instance.compile(schema);
    return { validate: validator, schemaName, catalogKind: schemaOrKind };
  }

  throw new TypeError(`Unknown schema or catalog kind ${JSON.stringify(schemaOrKind)}.`);
}

// SlideDesign is Design plus `not: { required: ["dimensions"] }` (schemaPath "…/allOf/1/not" on a design object); Ajv says "must NOT be valid".
const slideDimensionsSchemaPath = /\/allOf\/1\/not$/;
const designInstancePath = /\/design$/;
function toIssue(error: ErrorObject): ValidationIssue {
  const slideDimensions = error.keyword === "not" && slideDimensionsSchemaPath.test(error.schemaPath) && designInstancePath.test(error.instancePath);
  const issue: ValidationIssue = {
    path: error.instancePath || "/",
    message: slideDimensions
      ? "a slide's design cannot set 'dimensions': a PPTX has one slide size, so set design.dimensions on the deck (or its theme)"
      : error.message ?? "failed validation",
    keyword: error.keyword,
    schemaPath: error.schemaPath,
    params: error.params as Record<string, unknown>,
  };
  rememberValidationDefinition(issue, error.parentSchema, error.keyword);
  return issue;
}

function semanticIssue(path: string, message: string, params: Record<string, unknown> = {}): ValidationIssue {
  return {
    path,
    message,
    keyword: "opf",
    schemaPath: "#/x-opf-semantics",
    params,
  };
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(value, key);
}

function isEnUkTag(value: unknown): boolean {
  return typeof value === "string" && value.toLowerCase() === "en-uk";
}

function presentFields(value: Record<string, unknown>, fields: readonly string[]): string[] {
  return fields.filter((field) => hasOwn(value, field));
}

function isContentKind(value: unknown): value is ContentKind {
  return typeof value === "string" && value in contentKindSpecs;
}

function inferredKinds(value: Record<string, unknown>): ContentKind[] {
  const kinds: ContentKind[] = [];

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

function isImplicitBlocksComposition(
  value: Record<string, unknown>,
  inferred: readonly ContentKind[],
  options: { slideRoot?: boolean },
): boolean {
  if (options.slideRoot !== true || hasOwn(value, "blocks")) {
    return false;
  }

  return inferred.length > 1;
}

function validateContentPayload(
  value: Record<string, unknown>,
  path: string,
  options: { slideRoot?: boolean } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const explicitType = value.type;
  const payloadFields = presentFields(value, rootPayloadFields);
  const hasBlocks = hasOwn(value, "blocks");
  // RR-34: a caption belongs to exactly one image, chart, table or video payload of this host.
  const captionIssue = (reason: string, params: Record<string, unknown> = {}) => semanticIssue(pathFor(path, "caption"), `caption is only valid on an image, chart, table or video payload; ${reason}`, { code: "caption-unsupported-payload", ...params });
  if (hasBlocks || explicitType === "group") {
    if (hasOwn(value, "caption")) issues.push(captionIssue("a group cannot carry one"));
    if (explicitType !== undefined && explicitType !== "group") issues.push(semanticIssue(path, "a group must use type 'group' or omit type"));
    const incompatible = payloadFields.filter(field => field !== "blocks" && field !== "type");
    if (incompatible.length) issues.push(semanticIssue(path, "blocks cannot be mixed with leaf payload fields", { fields: incompatible }));
    if (!Array.isArray(value.blocks) || (value.blocks.length === 0 && !options.slideRoot)) issues.push(semanticIssue(pathFor(path, "blocks"), "a group requires at least one block"));
    if (Array.isArray(value.blocks)) value.blocks.forEach((block, index) => {
      if (isRecord(block)) issues.push(...validateContentPayload(block, `${pathFor(path, "blocks")}/${index}`));
    });
    return issues;
  }
  if (hasOwn(value, "composition") && !options.slideRoot) issues.push(semanticIssue(pathFor(path, "composition"), "composition is only valid on a group containing blocks"));

  if (explicitType !== undefined && !isContentKind(explicitType)) {
    return issues;
  }

  const kind = isContentKind(explicitType) ? explicitType : undefined;
  const inferred = kind ? [kind] : inferredKinds(value);

  if (!kind && inferred.length === 0) {
    if (payloadFields.length > 0 || path !== "/") {
      issues.push(semanticIssue(path, "content payload must include concrete content fields", {
        fields: payloadFields,
      }));
    }
    return issues;
  }

  if (!kind && inferred.length > 1) {
    if (isImplicitBlocksComposition(value, inferred, options)) {
      if (hasOwn(value, "caption")) issues.push(captionIssue("a slide root with several payloads cannot carry one; put the caption on a block", { inferredTypes: inferred }));
      return issues;
    }

    issues.push(semanticIssue(path, "content payload mixes fields from incompatible content types", {
      inferredTypes: inferred,
    }));
    return issues;
  }

  const resolvedKind = inferred[0];
  if (!resolvedKind) {
    return issues;
  }
  const spec = contentKindSpecs[resolvedKind];
  if (hasOwn(value, "caption") && !captionableKinds.has(resolvedKind)) issues.push(captionIssue(`this payload is '${resolvedKind}'`, { type: resolvedKind }));
  const allowedFields = new Set<string>([
    "type",
    ...spec.fields,
  ]);

  for (const required of spec.required) {
    if (!hasOwn(value, required)) {
      issues.push(semanticIssue(path, `content payload type '${resolvedKind}' requires '${required}'`, {
        type: resolvedKind,
        required,
      }));
    }
  }

  if (spec.requireAny && presentFields(value, spec.requireAny).length === 0) {
    issues.push(semanticIssue(path, `content payload type '${resolvedKind}' requires one of: ${spec.requireAny.join(", ")}`, {
      type: resolvedKind,
      requiredAny: spec.requireAny,
    }));
  }

  const incompatible = payloadFields.filter((field) => !allowedFields.has(field));
  if (incompatible.length > 0) {
    issues.push(semanticIssue(path, `content payload type '${resolvedKind}' cannot include incompatible fields: ${incompatible.join(", ")}`, {
      type: resolvedKind,
      incompatible,
    }));
  }

  return issues;
}

interface SlideRegion {
  rows: readonly number[];
  columns: readonly number[];
}

function slideRegion(key: string): SlideRegion | undefined {
  if (key.includes(":")) {
    const [rowPart, columnPart] = key.split(":");
    if (!rowPart || !columnPart) return undefined;
    const rows = rowSpans[rowPart];
    const columns = columnSpans[columnPart];
    return rows && columns ? { rows, columns } : undefined;
  }

  if (key in columnSpans) {
    const columns = columnSpans[key];
    return columns ? { rows: [0, 1, 2], columns } : undefined;
  }

  if (key in rowSpans) {
    const rows = rowSpans[key];
    return rows ? { rows, columns: [0, 1, 2] } : undefined;
  }

  return undefined;
}

function intersects(left: readonly number[], right: readonly number[]): boolean {
  return left.some((value) => right.includes(value));
}

function regionsOverlap(left: SlideRegion, right: SlideRegion): boolean {
  return intersects(left.rows, right.rows) && intersects(left.columns, right.columns);
}

function validateSlideRegions(slide: Record<string, unknown>, slidePath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const regionKeys = Object.keys(slide).filter((key) => promotedRegionKeySet.has(key));
  const rootFields = presentFields(slide, rootPayloadFields);

  if (regionKeys.length > 0 && rootFields.length > 0) {
    issues.push(semanticIssue(slidePath, "root content payload fields cannot be mixed with promoted region keys", {
      rootFields,
      regionKeys,
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
          regionKeys: [leftKey, rightKey],
        }));
      }
    }
  }

  return issues;
}

// Speaker and organization ids are cross-referenced (Speaker.organizationId) and addressed by built-in variables
// (`speaker.<id>.name`), so each set must be unique and a reference must resolve.
function deckMetadataIssues(value: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const entries = (key: "speaker" | "organization"): { entry: Record<string, unknown>; path: string }[] => {
    const field = value[key];
    if (Array.isArray(field)) return field.flatMap((entry, index) => (isRecord(entry) ? [{ entry, path: `/${key}/${index}` }] : []));
    return isRecord(field) ? [{ entry: field, path: `/${key}` }] : [];
  };
  const organizationIds = new Set<string>();
  for (const key of ["organization", "speaker"] as const) {
    const seen = new Set<string>();
    for (const { entry, path } of entries(key)) {
      if (typeof entry.id !== "string") continue;
      if (seen.has(entry.id)) issues.push(semanticIssue(`${path}/id`, `${key} ids must be unique within a presentation`, { id: entry.id }));
      seen.add(entry.id);
      if (key === "organization") organizationIds.add(entry.id);
    }
  }
  for (const { entry, path } of entries("speaker")) {
    if (typeof entry.organizationId === "string" && !organizationIds.has(entry.organizationId)) {
      issues.push(semanticIssue(`${path}/organizationId`, `organizationId '${entry.organizationId}' names no organization in the presentation; use the id of an entry in organization`, { id: entry.organizationId }));
    }
  }
  return issues;
}

function presentationSemanticIssues(value: unknown): ValidationIssue[] {
  if (!isRecord(value) || !Array.isArray(value.slides)) {
    return [];
  }

  const issues: ValidationIssue[] = [];

  if (isEnUkTag(value.language)) {
    issues.push(semanticIssue("/language", "Use 'en-GB' for UK English; 'en-UK' is not a valid BCP-47 region tag", {
      replacement: "en-GB",
    }));
  } else if (isRecord(value.language) && isEnUkTag(value.language.bcp47)) {
    issues.push(semanticIssue("/language/bcp47", "Use 'en-GB' for UK English; 'en-UK' is not a valid BCP-47 region tag", {
      replacement: "en-GB",
    }));
  }

  issues.push(...deckMetadataIssues(value));
  // 'speakers' is the one built-in variable name without a dot, so a declared variable may not take it.
  if (isRecord(value.variables) && hasOwn(value.variables, "speakers")) {
    issues.push(semanticIssue("/variables/speakers", "'speakers' is reserved for the built-in list of speaker names; choose another variable id", { id: "speakers" }));
  }

  // Slide and payload ids share one namespace, so the origin of the id already
  // seen decides which message describes the collision truthfully.
  const documentIds = new Map<string, "slide" | "payload">();
  value.slides.forEach((slide, index) => {
    if (isRecord(slide)) {
      const slidePath = `/slides/${index}`;
      if (typeof slide.id === "string") {
        const seen = documentIds.get(slide.id);
        if (seen === "slide") issues.push(semanticIssue(`${slidePath}/id`, "slide ids must be unique within a presentation", { id: slide.id }));
        else if (seen === "payload") issues.push(semanticIssue(`${slidePath}/id`, "slide id duplicates a content payload id; ids must be unique among slide and payload ids within a presentation", { id: slide.id }));
        else documentIds.set(slide.id, "slide");
      }
      visitContentPayloads(slide, slidePath, (payload, path) => {
        if (typeof payload.id === "string") {
          if (documentIds.has(payload.id)) issues.push(semanticIssue(`${path}/id`, "content payload ids must be unique among slide and payload ids within a presentation", { id: payload.id }));
          else documentIds.set(payload.id, "payload");
        }
      });
      issues.push(...validateSlideRegions(slide, slidePath));
      const payloadTableIssues = (payload: Record<string, unknown>, path: string): void => {
        if (isRecord(payload.table)) for(const issue of tableGrid(payload.table).issues) issues.push(semanticIssue(pathFor(path,'table')+issue.path.slice(5).replaceAll('.','/'),issue.message));
      };
      payloadTableIssues(slide, slidePath);
      visitContentPayloads(slide, slidePath, payloadTableIssues);
      const payloadNumberingIssues = (payload: Record<string, unknown>, path: string): void => {
        for (const finding of numberingFindings(payload).errors) issues.push(semanticIssue(pathFor(path, finding.key), finding.message, finding.params));
      };
      payloadNumberingIssues(slide, slidePath);
      visitContentPayloads(slide, slidePath, payloadNumberingIssues);
    }
  });
  // RR-34: reference ids, cited ids and where cite/footnote may appear.
  issues.push(...annotationIssues(value));

  return issues;
}

function pushIfDefined(issues: ValidationIssue[], issue: ValidationIssue | undefined): void {
  if (issue) {
    issues.push(issue);
  }
}

function canvasSize(dimensions: unknown): string {
  try {
    const { width, height } = resolveCanvasDimensions(dimensions);
    return `${Math.round(width * 100) / 100}x${Math.round(height * 100) / 100} px`;
  } catch {
    return "invalid";
  }
}

// A PPTX has one slide size. A slide-level theme whose dimensions differ from the deck's is never what the author
// meant: the deck's own design.dimensions wins in every engine, and without one the exporter stops with
// mixed-slide-dimensions. Warn at the slide's theme.
function slideThemeDimensionsWarnings(
  document: Record<string, unknown>,
  slide: Record<string, unknown>,
  index: number,
  catalogs: readonly Catalog[] | undefined,
): ValidationIssue[] {
  const slidePath = `/slides/${index}`;
  const slideDesign = isRecord(slide.design) ? slide.design : undefined;
  if (!slideDesign || typeof slideDesign.theme !== "string") return [];
  const options = { catalogs: catalogs ?? [] };
  const slideTheme = resolveDesignRecords(document, index, options);
  // A slide theme that resolves nowhere has no dimensions of its own: opf/unresolved-reference reports it.
  if (slideTheme.diagnostics.some((diagnostic) => diagnostic.kind === "themes") || slideTheme.theme.dimensions === undefined) return [];
  const deckDesign = isRecord(document.design) ? document.design : {};
  const deckDimensions = deckDesign.dimensions ?? resolveDesignRecords(document, undefined, options).theme.dimensions;
  const slideSize = canvasSize(slideTheme.theme.dimensions);
  const deckSize = canvasSize(deckDimensions);
  if (slideSize === deckSize) return [];
  const explicit = deckDesign.dimensions !== undefined;
  return [semanticIssue(
    pathFor(pathFor(slidePath, "design"), "theme"),
    explicit
      ? `this slide's theme sets a slide size (${slideSize}) that differs from the deck's design.dimensions (${deckSize}); a PPTX has one slide size, so the deck's size is used`
      : `this slide's theme sets a slide size (${slideSize}) that differs from the deck's (${deckSize}); a PPTX has one slide size, so set design.dimensions on the deck`,
    { code: "slide-theme-dimensions", slideDimensions: slideSize, deckDimensions: deckSize },
  )];
}

function chartTypeWarnings(
  payload: unknown,
  path: string,
): ValidationIssue[] {
  if (!isRecord(payload)) {
    return [];
  }

  const issues: ValidationIssue[] = [];
  if (isRecord(payload.chart)) {
    // RR-35: an axis title, legend or data label option the chart type cannot show is adapted by every engine; say so.
    for (const diagnostic of resolveChartOptions(payload.chart, chartOptionTarget(payload.chart.type)).diagnostics) {
      issues.push(semanticIssue(diagnostic.option.split(".").reduce(pathFor, pathFor(path, "chart")), diagnostic.message, { code: diagnostic.code, option: diagnostic.option, reason: diagnostic.reason }));
    }
  }
  if (Array.isArray(payload.blocks)) {
    payload.blocks.forEach((block, index) => {
      issues.push(...chartTypeWarnings(block, `${pathFor(path, "blocks")}/${index}`));
    });
  }
  return issues;
}

// RR-54: chart and table data. Errors: dataset-unknown, dataset-field-unknown, data-column-duplicate,
// chart-mapping-unknown-column, chart-highlight-unknown-name (FA-14), number-format-invalid. Warnings: chart-value-not-numeric (not for
// null, "" or a 'var:<id>' cell whose variable is a number), chart-mapping-adapted, chart-highlight-adapted.
function dataIssues(value: unknown): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const out = { errors: [] as ValidationIssue[], warnings: [] as ValidationIssue[] };
  if (!isRecord(value) || !Array.isArray(value.slides)) return out;
  const seen = new Set<string>();
  const add = (diagnostics: readonly DataDiagnostic[]) => {
    for (const diagnostic of diagnostics) {
      const key = `${diagnostic.code}|${diagnostic.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      (diagnostic.severity === "error" ? out.errors : out.warnings).push(semanticIssue(diagnostic.path, diagnostic.message, { code: diagnostic.code }));
    }
  };
  add(datasetDiagnostics(value));
  const payload = (node: Record<string, unknown>, path: string): void => {
    if (isRecord(node.chart)) add(resolveChartData(node.chart, value, { path: pathFor(path, "chart") }).diagnostics);
    if (isRecord(node.table)) add(resolveTableData(node.table, value, { path: pathFor(path, "table") }).diagnostics);
  };
  value.slides.forEach((slide, index) => {
    if (!isRecord(slide)) return;
    const slidePath = `/slides/${index}`;
    payload(slide, slidePath);
    visitContentPayloads(slide, slidePath, payload);
  });
  return out;
}

const cellBorderEdges = ["top", "right", "bottom", "left"] as const;

// Mirrors the id shape shared by ColorRef's 'var:<id>' form and the property
// names of the variables map: the one id an author could actually declare.
const variableIdPattern = /^[a-z][a-z0-9-]*$/;

// The forms TextRun.color documents. The schema keeps run colors open strings
// so imported decks with unrecognized colors stay valid (coordinated
// exporters fall back to the theme); the validator warns instead.
const hexColorPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const schemeColorNames = new Set([
  "accent1", "accent2", "accent3", "accent4", "accent5", "accent6",
  "dark1", "dark2", "light1", "light2", "hyperlink", "followedHyperlink",
  "primary", "secondary", "accent", "background", "surface", "text", "textSecondary",
]);

// Visit exactly the schema's ColorRef positions. A key-name walk would also
// reach 'color' keys the engine never resolves as a ColorRef — background and
// gradient colors, chart series colors — and 'extensions' passthrough data,
// whose shape and depth are the author's business, not the validator's.
function variableReferenceWarnings(value: Record<string, unknown>): ValidationIssue[] {
  if (!Array.isArray(value.slides)) {
    return [];
  }

  const variables = isRecord(value.variables) ? value.variables : {};
  const issues: ValidationIssue[] = [];

  const colorRef = (entry: unknown, path: string): void => {
    if (typeof entry !== "string" || !entry.startsWith("var:")) return;
    const id = entry.slice("var:".length);
    // A reference the schema rejects already reports an error; advising the
    // author to declare an id the variables map cannot hold would dead-end.
    if (!variableIdPattern.test(id) || hasOwn(variables, id)) return;
    issues.push(semanticIssue(path, `unknown variable '${id}'; declare it in the top-level variables map`, { id, code: "variable-reference-unknown" }));
  };
  // Run colors are open strings: warn on anything that is none of the
  // documented forms, since renderers will fall back to the theme color.
  const runColor = (entry: unknown, path: string): void => {
    if (typeof entry !== "string") return;
    if (hexColorPattern.test(entry) || schemeColorNames.has(entry)) return;
    if (entry.startsWith("var:") && variableIdPattern.test(entry.slice("var:".length))) {
      colorRef(entry, path);
      return;
    }
    issues.push(semanticIssue(
      path,
      `run color '${entry}' is not a hex color, a color-scheme name, or a 'var:' reference; renderers fall back to the theme color`,
      { color: entry, code: "run-color-unrecognized" },
    ));
  };
  // string | TextRun[]: only the object run form carries a color.
  const richText = (entry: unknown, path: string): void => {
    if (!Array.isArray(entry)) return;
    entry.forEach((run, index) => {
      if (isRecord(run)) runColor(run.color, `${path}/${index}/color`);
    });
  };
  const cellStyle = (style: unknown, path: string): void => {
    if (!isRecord(style)) return;
    colorRef(style.fill, pathFor(path, "fill"));
    colorRef(style.color, pathFor(path, "color"));
    if (!isRecord(style.borders)) return;
    const bordersPath = pathFor(path, "borders");
    for (const edge of cellBorderEdges) {
      const border = style.borders[edge];
      if (isRecord(border)) colorRef(border.color, `${pathFor(bordersPath, edge)}/color`);
    }
  };
  // TableCell/column label: scalar, TextRun[], or a StyledTableCell object.
  const tableCell = (cell: unknown, path: string): void => {
    if (Array.isArray(cell)) {
      richText(cell, path);
      return;
    }
    if (!isRecord(cell)) return;
    richText(cell.value, pathFor(path, "value"));
    cellStyle(cell.style, pathFor(path, "style"));
  };
  const table = (node: unknown, path: string): void => {
    if (!isRecord(node)) return;
    if (Array.isArray(node.columns)) {
      const columnsPath = pathFor(path, "columns");
      node.columns.forEach((column, index) => { tableCell(column, `${columnsPath}/${index}`); });
    }
    if (Array.isArray(node.rows)) {
      const rowsPath = pathFor(path, "rows");
      node.rows.forEach((row, rowIndex) => {
        if (!Array.isArray(row)) return;
        row.forEach((cell, cellIndex) => { tableCell(cell, `${rowsPath}/${rowIndex}/${cellIndex}`); });
      });
    }
  };
  // ListItem/BulletItem: string, TextRun[], or an object whose text and
  // (list items only) description may themselves be TextRun[].
  const textEntries = (entries: unknown, path: string): void => {
    if (!Array.isArray(entries)) return;
    entries.forEach((entry, index) => {
      const entryPath = `${path}/${index}`;
      if (Array.isArray(entry)) {
        richText(entry, entryPath);
        return;
      }
      if (!isRecord(entry)) return;
      richText(entry.text, pathFor(entryPath, "text"));
      richText(entry.description, pathFor(entryPath, "description"));
    });
  };
  // Solid, gradient-stop and pattern colors of a design's background are ColorRef positions.
  const backgroundColors = (background: unknown, path: string): void => {
    if (!isRecord(background)) return;
    colorRef(background.color, pathFor(path, "color"));
    const stops = isRecord(background.gradient) ? background.gradient.stops : undefined;
    if (Array.isArray(stops)) stops.forEach((stop, index) => { if (isRecord(stop)) colorRef(stop.color, `${path}/gradient/stops/${index}/color`); });
    if (isRecord(background.pattern)) {
      colorRef(background.pattern.foregroundColor, `${path}/pattern/foregroundColor`);
      colorRef(background.pattern.backgroundColor, `${path}/pattern/backgroundColor`);
    }
  };
  const designColors = (design: unknown, path: string): void => {
    if (!isRecord(design)) return;
    backgroundColors(design.background, pathFor(path, "background"));
    if (isRecord(design.theme)) backgroundColors(design.theme.background, `${path}/theme/background`);
  };
  designColors(value.design, "/design");
  const payload = (node: Record<string, unknown>, path: string): void => {
    richText(node.text, pathFor(path, "text"));
    textEntries(node.items, pathFor(path, "items"));
    textEntries(node.bullets, pathFor(path, "bullets"));
    table(node.table, pathFor(path, "table"));
  };

  value.slides.forEach((slide, index) => {
    if (!isRecord(slide)) return;
    const slidePath = `/slides/${index}`;
    designColors(slide.design, pathFor(slidePath, "design"));
    payload(slide, slidePath);
    visitContentPayloads(slide, slidePath, payload);
  });
  return issues;
}

function presentationReferenceWarnings(value: unknown, catalogs: readonly Catalog[] | undefined): ValidationIssue[] {
  if (!isRecord(value) || !Array.isArray(value.slides)) {
    return [];
  }

  const issues: ValidationIssue[] = [];

  issues.push(...variableReferenceWarnings(value));

  value.slides.forEach((slide, index) => {
    if (!isRecord(slide)) {
      return;
    }
    const slidePath = `/slides/${index}`;
    issues.push(...slideThemeDimensionsWarnings(value, slide, index, catalogs));
    issues.push(...chartTypeWarnings(slide, slidePath));
    const numberingWarnings = (payload: Record<string, unknown>, path: string): void => {
      for (const finding of numberingFindings(payload).warnings) issues.push(semanticIssue(pathFor(path, finding.key), finding.message, { ...finding.params, code: "numbering-start-ignored" }));
    };
    numberingWarnings(slide, slidePath);
    visitContentPayloads(slide, slidePath, numberingWarnings);
    // code.highlight: an entry past the last line, or a range written end before start, marks nothing.
    const highlightWarnings = (payload: Record<string, unknown>, path: string): void => {
      const code = payload.code;
      if (!isRecord(code) || !Array.isArray(code.highlight) || typeof code.source !== "string") return;
      for (const finding of codeHighlightLines(code.highlight, code.source).issues) {
        if (finding.code === "code-highlight-invalid") continue;
        issues.push(semanticIssue(pathFor(pathFor(pathFor(path, "code"), "highlight"), String(finding.index)), finding.message, { code: finding.code }));
      }
    };
    highlightWarnings(slide, slidePath);
    visitContentPayloads(slide, slidePath, highlightWarnings);
    for (const key of Object.keys(slide)) {
      if (promotedRegionKeySet.has(key)) {
        issues.push(...chartTypeWarnings(slide[key], pathFor(slidePath, key)));
      }
    }
  });

  return issues;
}

function validateLanguageSemantics(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [];
  }

  if (isEnUkTag(value.bcp47)) {
    return [semanticIssue("/bcp47", "Use 'en-GB' for UK English; 'en-UK' is not a valid BCP-47 region tag", {
      replacement: "en-GB",
    })];
  }

  return [];
}

// Guard recursive payloads before AJV or recursive semantic/reference traversal.
function contentDepthIssues(value: unknown): ValidationIssue[] {
  if (!isRecord(value) || !Array.isArray(value.slides)) return [];
  const stack: { value: unknown; path: string; depth: number; ancestors: unknown[] }[] = [];
  value.slides.forEach((slide, index) => {
    if (!isRecord(slide)) return;
    if (Array.isArray(slide.blocks)) slide.blocks.forEach((block, i) => { stack.push({ value: block, path: `/slides/${index}/blocks/${i}`, depth: 0, ancestors: [] }); });
    for (const key of promotedRegionKeys) if (hasOwn(slide, key)) stack.push({ value: slide[key], path: `/slides/${index}/${key}`, depth: 0, ancestors: [] });
  });
  while (stack.length) {
    const entry = stack.pop()!;
    if (!isRecord(entry.value) || !Array.isArray(entry.value.blocks)) continue;
    if (entry.ancestors.includes(entry.value) || entry.depth >= MAX_COMPOSITION_DEPTH) return [semanticIssue(entry.path, `content groups must be acyclic and nest at most ${MAX_COMPOSITION_DEPTH} levels`)];
    const ancestors = [...entry.ancestors, entry.value];
    entry.value.blocks.forEach((block, i) => { stack.push({ value: block, path: `${entry.path}/blocks/${i}`, depth: entry.depth + 1, ancestors }); });
  }
  return [];
}

const variableTypeList = VARIABLE_KINDS.join(", ");

function variableIssue(id: string, suffix: string, keyword: string, message: string, params: Record<string, unknown>): ErrorObject {
  return {
    instancePath: `/variables/${id.replaceAll("~", "~0").replaceAll("/", "~1")}${suffix}`,
    schemaPath: "#/$defs/Variable/oneOf",
    keyword,
    params,
    message,
  } as ErrorObject;
}

// Variable is a oneOf of a hex string and seven typed objects, so Ajv would report every
// branch. Replace its errors with those of the one branch the entry's own 'type' selects.
function typedVariableErrors(errors: ErrorObject[], value: unknown): ErrorObject[] {
  if (!isRecord(value) || !isRecord(value.variables)) return errors;
  if (!errors.some((error) => error.instancePath.startsWith("/variables/"))) return errors;
  const variables = value.variables;
  const kept = errors.filter((error) => !error.instancePath.startsWith("/variables/"));
  const schemaId = schemas.presentation.$id as string;
  for (const [id, entry] of Object.entries(variables)) {
    if (typeof entry === "string") {
      if (!hexColorPattern.test(entry)) kept.push(variableIssue(id, "", "type", "must be a hex color string or a variable object", {}));
      continue;
    }
    if (!isRecord(entry)) {
      kept.push(variableIssue(id, "", "type", "must be a hex color string or a variable object", {}));
      continue;
    }
    const kind = entry.type;
    if (typeof kind !== "string" || !(VARIABLE_KINDS as readonly string[]).includes(kind)) {
      kept.push(variableIssue(id, "/type", "enum", `must be one of: ${variableTypeList} (a hex string is shorthand for a color variable)`, { allowedValues: [...VARIABLE_KINDS] }));
      continue;
    }
    const definition = `${kind.charAt(0).toUpperCase()}${kind.slice(1)}Variable`;
    const check = getAjv().getSchema(`${schemaId}#/$defs/${definition}`);
    if (!check || check(entry) === true) continue;
    for (const error of check.errors ?? []) {
      kept.push({ ...error, instancePath: `/variables/${id.replaceAll("~", "~0").replaceAll("/", "~1")}${error.instancePath}`, schemaPath: `#/$defs/${definition}${error.schemaPath.replace(/^#/, "")}` });
    }
  }
  return kept;
}

function pointerValue(root: unknown, pointer: string): unknown {
  let current = root;
  for (const token of pointer.split("/").slice(1)) {
    const key = token.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(current)) current = current[Number(key)];
    else if (isRecord(current) && hasOwn(current, key)) current = current[key];
    else return undefined;
  }
  return current;
}

// RR-54: 'chart.data' is a oneOf of ChartData and DatasetRef, and a table column header a oneOf of a
// string, runs, a StyledTableCell, a DataColumn and null, so Ajv reports the errors of every branch. When the value
// names its form ('dataset' or 'rows'; 'value' or 'name'), keep only the errors of that branch. The
// dataset/inline table exclusions ('if'/'then'/'else' with false schemas) get a message that names the field.
const datasetTableMessage = (field: string) => `'${field}' is not allowed on a dataset-backed table: it takes its headers, rows and column formats from the dataset`;
function dataUnionErrors(errors: ErrorObject[], value: unknown): ErrorObject[] {
  let kept = errors;
  const schemaId = schemas.presentation.$id as string;
  for (const union of errors) {
    if (union.keyword !== "oneOf") continue;
    const chartData = /\/chart\/data$/.test(union.instancePath) && /\/properties\/data\/oneOf$/.test(union.schemaPath);
    const header = /\/table\/columns\/\d+$/.test(union.instancePath) && /\/properties\/columns\/items\/oneOf$/.test(union.schemaPath);
    if (!chartData && !header) continue;
    const target = pointerValue(value, union.instancePath);
    if (!isRecord(target)) continue;
    const branch = chartData
      ? hasOwn(target, "dataset") ? "DatasetRef" : hasOwn(target, "rows") ? "ChartData" : undefined
      : hasOwn(target, "value") ? "StyledTableCell" : hasOwn(target, "name") ? "DataColumn" : undefined;
    const check = branch ? getAjv().getSchema(`${schemaId}#/$defs/${branch}`) : undefined;
    if (!check || check(target) === true) continue;
    const branchErrors = (check.errors ?? []).map((error) => ({ ...error, instancePath: `${union.instancePath}${error.instancePath}`, schemaPath: `#/$defs/${branch}${error.schemaPath.replace(/^#/, "")}` }));
    const prefix = `${union.instancePath}/`;
    kept = [...kept.filter((error) => error.instancePath !== union.instancePath && !error.instancePath.startsWith(prefix)), ...branchErrors];
  }
  const exclusions = kept.filter((error) => error.keyword === "false schema" && /\/table\/(rows|columns|fields)$/.test(error.instancePath) && /\/(then|else)\/properties\/(rows|columns|fields)\//.test(`${error.schemaPath}/`));
  if (!exclusions.length) return kept;
  const tables = new Set(exclusions.map((error) => error.instancePath.replace(/\/[^/]+$/, "")));
  return kept
    .filter((error) => !(error.keyword === "if" && tables.has(error.instancePath)))
    .map((error) => {
      if (!exclusions.includes(error)) return error;
      const field = error.instancePath.slice(error.instancePath.lastIndexOf("/") + 1);
      return { ...error, message: field === "fields" ? "'fields' applies only to a dataset-backed table; add 'dataset' or remove 'fields'" : datasetTableMessage(field) };
    });
}

export function validateAgainstSchema(value: unknown, schemaOrKind: SchemaOrKind = "presentation", options: SchemaCheckOptions = {}): SchemaCheckResult {
  const resolved = resolveValidator(schemaOrKind);
  if (resolved.schemaName === "presentation") {
    const errors = contentDepthIssues(value);
    if (errors.length) return { valid: false, errors, warnings: [], unfilled: [], schemaName: resolved.schemaName };
  }
  // A deck that declares content variables, or a template, is checked as the deck it
  // resolves to: tokens and 'var:' references are replaced by their value, example or a
  // type sample (the declarations stay), so paths match the source and a template is
  // an incomplete OPF file rather than an invalid one.
  const variableIssues: { errors: ValidationIssue[]; warnings: ValidationIssue[] } = { errors: [], warnings: [] };
  const unfilled: ValidationIssue[] = [];
  let subject: unknown = value;
  let template: boolean | undefined;
  let unfilledVariables: string[] | undefined;
  if (resolved.schemaName === "presentation" && isRecord(value) && (hasContentVariables(value) || options.values !== undefined || options.template !== undefined)) {
    template = options.template ?? isTemplate(value);
    const view = instantiateForValidation(value, options.values ?? {}, template);
    subject = view.presentation;
    unfilledVariables = view.unfilled;
    for (const entry of view.diagnostics) {
      if (entry.code === "variable-example-used" || entry.code === "variable-rich-flattened" || entry.code === "variable-unfilled") continue;
      const issue = semanticIssue(entry.path, entry.message, { id: entry.id, code: entry.code });
      (entry.severity === "error" ? variableIssues.errors : variableIssues.warnings).push(issue);
    }
    if (!template) {
      const declared = isRecord(value.variables) ? value.variables : {};
      for (const id of view.unfilled) {
        // A value the schema already rejects is reported there, not as a missing value.
        if (isRecord(declared[id]) && declared[id].value !== undefined) continue;
        unfilled.push(semanticIssue(`/variables/${id}`, `required variable '${id}' has no value; give it a value, fill it before use, or mark the document as a template ("template": true)`, { id, code: "variable-unfilled" }));
      }
    }
  }
  const valid = resolved.validate(subject) === true;
  const ajvErrors = valid ? [] : typedVariableErrors(resolved.validate.errors ?? [], subject);
  const errors = (resolved.schemaName === "presentation" ? dataUnionErrors(ajvErrors, subject) : ajvErrors).map(toIssue);
  const warnings: ValidationIssue[] = [];

  if (resolved.schemaName === "presentation") {
    errors.push(...presentationSemanticIssues(subject));
    errors.push(...variableIssues.errors);
    const data = dataIssues(subject);
    errors.push(...data.errors);
    warnings.push(...presentationReferenceWarnings(subject, options.catalogs));
    warnings.push(...data.warnings);
    warnings.push(...variableIssues.warnings);
  } else if (resolved.schemaName === "language") {
    errors.push(...validateLanguageSemantics(value));
  }


  return {
    valid: errors.length === 0,
    errors,
    warnings,
    unfilled,
    schemaName: resolved.schemaName,
    catalogKind: resolved.catalogKind,
    ...(template !== undefined ? { template, unfilledVariables } : {}),
  };
}
