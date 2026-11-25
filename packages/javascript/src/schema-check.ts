import type { ErrorObject, ValidateFunction } from "ajv/dist/2020.js";

import type { Catalog } from "./catalog-refs.js";
import { catalogSchemaNames, type CatalogRecordKind } from "./catalog-schemas.js";
import { resolveDesignRecords } from "./design-records.js";
import { chartOptionTarget, resolveChartOptions } from "./chart-options.js";
import { dataSourceDiagnostics, provenanceDiagnostics } from "./data-source-checks.js";
import { datasetDiagnostics, isDatasetRef, resolveChartData, resolveTableData, type DataDiagnostic } from "./chart-data.js";
import { chartDrawDiagnostics } from "./chart-fallback.js";
import { resolveMetric, type MetricDataDiagnostic } from "./metric-data.js";
import { MAX_COMPOSITION_DEPTH, resolveCanvasDimensions, resolveSlideDirection } from "./composition.js";
import { layoutTemplateIssues } from "./layout-template.js";
import { annotationIssues } from "./annotation-validation.js";
import { slideLinkIssues } from "./slide-links.js";
import { isShapeBlock, shapeIssues, SHAPE_BLOCK_KEYS } from "./shape-block.js";
import { PositionRangeError, connectorAdjustPreset, isOverlayConnector, overlayIssues, representablePositionBox } from "./overlay-shapes.js";
import { codeHighlightLines } from "./code-highlight.js";
import { entryId, isRecord, pathFor, visitContentPayloads, visitPayloadItems } from "./content-walk.js";
import { gridCellSpan, isGridCell, nearestGridCell } from "./grid-cells.js";
import {rowCells, tableGrid} from "./table.js";
import { numberingFindings } from "./numbering.js";
import { schemaEngine } from "#schema-engine";
import { schemas, type SchemaName } from "./schemas.js";
import { bestMatchErrors, collapseRepeats, type UnionError } from "./union-errors.js";
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
  /** The date the data is checked as of (an ISO 8601 date or date-time), for the `dataset-stale` warning. Without one no data is reported stale. */
  asOf?: string;
  /** See `ValidateOptions.slideLinks`. */
  slideLinks?: false | readonly string[];
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

export { gridCells } from "./grid-cells.js";

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
  "shape",
  "path",
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
  | "timeline"
  | "diagram"
  | "shape";

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
    // SH-02: an image block's `shape` is its frame's mask.
    fields: ["image", "shape"],
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
  diagram: {
    fields: ["diagram"],
    required: ["diagram"],
  },
  // SH-02: a preset (`shape` without `image`) or a custom `path`, with its `text` inside.
  shape: {
    fields: ["shape", "path", "text"],
    required: [],
    requireAny: ["shape", "path"],
  },
};

// RR-34: payload kinds whose blocks may carry a caption.
const captionableKinds = new Set<ContentKind>(["image", "chart", "table", "video", "diagram"]);
// FA-22: fit, focus, the image treatments and placement belong to image payloads only (LH-132: and a person's `portrait`).
const imageOptionFields = ["fit", "focus", "aspectRatio", "shape", "adjust", "stroke", "opacity", "recolor", "overlay", "placement", "portrait"] as const;
// SH-02: the image options a shape block also takes, and the keys only a shape block takes.
const shapeImageFields = new Set<string>(["aspectRatio", "shape", "adjust", "stroke", "opacity"]);
const shapeOptionFields = SHAPE_BLOCK_KEYS.filter((field) => field !== "path");

function isSchemaName(value: unknown): value is SchemaName {
  return typeof value === "string" && hasOwn(schemas, value);
}

function isCatalogKind(value: unknown): value is CatalogRecordKind {
  return typeof value === "string" && hasOwn(schemaNameByCatalogKind, value);
}

function resolveValidator(schemaOrKind: SchemaOrKind): {
  validate: ValidateFunction;
  schemaName: SchemaName;
  catalogKind?: CatalogRecordKind;
} {
  if (isSchemaName(schemaOrKind)) {
    return { validate: schemaEngine().root(schemaOrKind), schemaName: schemaOrKind };
  }

  if (isCatalogKind(schemaOrKind)) {
    const schemaName = schemaNameByCatalogKind[schemaOrKind];
    return { validate: schemaEngine().root(schemaName), schemaName, catalogKind: schemaOrKind };
  }

  throw new TypeError(`Unknown schema or catalog kind ${JSON.stringify(schemaOrKind)}.`);
}

// SlideDesign is Design plus `not: { required: ["dimensions"] }` (schemaPath "…/allOf/1/not" on a design object); Ajv says "must NOT be valid".
const slideDimensionsSchemaPath = /\/allOf\/1\/not$/;
const designInstancePath = /\/design$/;
function toIssue(error: UnionError): ValidationIssue {
  const slideDimensions = error.keyword === "not" && slideDimensionsSchemaPath.test(error.schemaPath) && designInstancePath.test(error.instancePath);
  const issue: ValidationIssue = {
    path: error.instancePath || "/",
    message: slideDimensions
      ? "a slide's design cannot set 'dimensions': a PPTX has one slide size, so set design.dimensions on the deck (or its theme)"
      : error.message ?? "failed validation",
    keyword: error.keyword,
    schemaPath: error.schemaPath,
    params: error.params as Record<string, unknown>,
    ...(error.alternatives?.length ? { alternatives: error.alternatives } : {}),
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

const EN_UK_MESSAGE = "Use 'en-GB' for UK English; 'en-UK' is not a valid BCP-47 region tag";

// The deck and a slide author a language tag; 'en-UK' is the same schema error on both (a run's is reported by opf/language-tag, as an error).
function enUkIssues(language: unknown, path: string): ValidationIssue[] {
  const at = isEnUkTag(language) ? path : isRecord(language) && isEnUkTag(language.bcp47) ? `${path}/bcp47` : undefined;
  return at ? [semanticIssue(at, EN_UK_MESSAGE, { replacement: "en-GB" })] : [];
}

// 0.33 wrote an anchored overlay size in pixels under `width` and `height`; 0.34 reads fractions. A value above 4 (the format documents 1 and
// 1.08) and up to 8 (the schema's maximum) still validates and is taken for a pixel size; above 8 it is a schema error whose finding carries the
// same rename (check-document.ts, collapseAuthoringShapes).
function overlayAnchorSizeWarnings(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (isRecord(value) && Array.isArray(value.slides)) value.slides.forEach((slide, index) => {
    if (isRecord(slide) && Array.isArray(slide.shapes)) slide.shapes.forEach((entry, shapeIndex) => {
      const at = isRecord(entry) ? entry.at : undefined;
      if (isRecord(at)) for (const key of ["width", "height"]) {
        const size = at[key];
        if (typeof size === "number" && size > 4 && size <= 8 && !hasOwn(at, `${key}Px`))
          issues.push(semanticIssue(`/slides/${index}/shapes/${shapeIndex}/at/${key}`, `at.${key} is ${size}, a fraction; pixels are ${key}Px`, { code: "shape-anchor-size-unit", key, size }));
      }
    });
  });
  return issues;
}

function presentFields(value: Record<string, unknown>, fields: readonly string[]): string[] {
  return fields.filter((field) => hasOwn(value, field));
}

function isContentKind(value: unknown): value is ContentKind {
  return typeof value === "string" && hasOwn(contentKindSpecs, value);
}

function inferredKinds(value: Record<string, unknown>): ContentKind[] {
  const kinds: ContentKind[] = [];
  // SH-02: a shape block holds its own text; bullets beside it are a text payload of their own.
  const shape = isShapeBlock(value);

  if (shape) kinds.push("shape");
  if (presentFields(value, shape ? ["bullets"] : contentKindSpecs.text.fields).length > 0) kinds.push("text");
  if (hasOwn(value, "items")) kinds.push("list");
  if (hasOwn(value, "image")) kinds.push("image");
  if (hasOwn(value, "video")) kinds.push("video");
  if (hasOwn(value, "chart")) kinds.push("chart");
  if (hasOwn(value, "table")) kinds.push("table");
  if (hasOwn(value, "code")) kinds.push("code");
  if (hasOwn(value, "metric")) kinds.push("metric");
  if (hasOwn(value, "quote")) kinds.push("quote");
  if (hasOwn(value, "timeline")) kinds.push("timeline");
  if (hasOwn(value, "diagram")) kinds.push("diagram");

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
  options: { slideRoot?: boolean; topLevel?: boolean; canvas?: { width: number; height: number } } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const explicitType = value.type;
  const payloadFields = presentFields(value, rootPayloadFields);
  const hasBlocks = hasOwn(value, "blocks");
  // RR-34: a caption belongs to exactly one image, chart, table, video or diagram payload of this host.
  const captionIssue = (reason: string, params: Record<string, unknown> = {}) => semanticIssue(pathFor(path, "caption"), `caption is only valid on an image, chart, table, video or diagram payload; ${reason}`, { code: "caption-unsupported-payload", ...params });
  // FA-22: image options on anything but an image payload, and a placement anywhere but a top-level block.
  const imageOptionIssues = (reason: string, params: Record<string, unknown> = {}, except: ReadonlySet<string> = new Set()) => {
    for (const field of imageOptionFields) if (hasOwn(value, field) && !except.has(field)) issues.push(semanticIssue(pathFor(path, field), `${field} is only valid on an image payload; ${reason}`, { code: "image-option-unsupported-payload", field, ...params }));
  };
  // SH-02: shape options on anything but a shape block.
  const shapeOptionIssues = (reason: string, params: Record<string, unknown> = {}) => {
    // A slide's own `hidden` hides the slide.
    for (const field of shapeOptionFields) if (hasOwn(value, field) && !(field === "hidden" && options.slideRoot)) issues.push(semanticIssue(pathFor(path, field), `${field} is only valid on a shape block; ${reason}`, { code: "shape-option-unsupported-payload", field, ...params }));
  };
  if (hasOwn(value, "placement") && !options.topLevel && !hasBlocks && explicitType !== "group" && inferredKinds(value).includes("image")) {
    issues.push(semanticIssue(pathFor(path, "placement"), "placement is only valid on a top-level block (slides.N.blocks.I); a block inside a group cannot bleed to a slide edge", { code: "image-placement-invalid" }));
  }
  if (hasBlocks || explicitType === "group") {
    if (hasOwn(value, "caption")) issues.push(captionIssue("a group cannot carry one"));
    imageOptionIssues("a group cannot carry them");
    shapeOptionIssues("a group cannot carry them");
    if (explicitType !== undefined && explicitType !== "group") issues.push(semanticIssue(path, "a group must use type 'group' or omit type"));
    // SH-02: a group's `shape` is reported as an image option (image-option-unsupported-payload).
    const incompatible = payloadFields.filter(field => field !== "blocks" && field !== "type" && field !== "shape");
    if (incompatible.length) issues.push(semanticIssue(path, "blocks cannot be mixed with leaf payload fields", { fields: incompatible }));
    if (!Array.isArray(value.blocks) || (value.blocks.length === 0 && !options.slideRoot)) issues.push(semanticIssue(pathFor(path, "blocks"), "a group requires at least one block"));
    if (Array.isArray(value.blocks)) value.blocks.forEach((block, index) => {
      if (isRecord(block)) issues.push(...validateContentPayload(block, `${pathFor(path, "blocks")}/${index}`, { topLevel: options.slideRoot === true, ...(options.canvas ? { canvas: options.canvas } : {}) }));
    });
    // FA-22: at most one placed block per slide edge.
    if (options.slideRoot && Array.isArray(value.blocks)) {
      const edges = new Map<unknown, number>();
      value.blocks.forEach((block, index) => {
        const edge = isRecord(block) && isRecord(block.placement) ? block.placement.edge : undefined;
        if (edge === undefined) return;
        if (edges.has(edge)) issues.push(semanticIssue(`${pathFor(path, "blocks")}/${index}/placement/edge`, `blocks ${edges.get(edge)} and ${index} are both placed on the ${String(edge)} edge; a slide edge takes at most one placed image`, { code: "image-placement-invalid", edge, blocks: [edges.get(edge), index] }));
        else edges.set(edge, index);
      });
    }
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
  if (resolvedKind !== "image") imageOptionIssues(`this payload is '${resolvedKind}'`, { type: resolvedKind }, resolvedKind === "shape" ? shapeImageFields : undefined);
  if (resolvedKind !== "shape") shapeOptionIssues(`this payload is '${resolvedKind}'`, { type: resolvedKind });
  // SH-02: adjust names and ranges of the preset (an image's mask too), and a link on a hidden shape.
  if (resolvedKind === "shape" || resolvedKind === "image")
    for (const issue of shapeIssues(value, (...keys) => keys.reduce((at, key) => pathFor(at, key), path))) issues.push(semanticIssue(issue.path, issue.message, { code: issue.code, ...issue.params }));
  if (resolvedKind === "image" && isRecord(value.image) && Array.isArray(value.image.callouts)) {
    value.image.callouts.forEach((callout, index) => {
      if (!isRecord(callout)) return;
      for (const key of ['x', 'y']) if (typeof callout[key] === 'number' && !Number.isFinite(callout[key])) issues.push(semanticIssue(`${pathFor(path, 'image')}/callouts/${index}/${key}`, 'an image callout origin must be a finite signed fraction', {key}));
      // A finite origin too far away to be written as exact geometry is refused here, at its coordinate, as an overlay shape's is: a
      // picture's frame is never larger than the slide, so the slide's own size bounds every callout.
      const canvas = options.canvas;
      if (canvas && ['x', 'y', 'width', 'height'].every(key => typeof callout[key] === 'number' && Number.isFinite(callout[key]))) {
        const at = `${pathFor(path, 'image')}/callouts/${index}`, frame = callout as { x: number; y: number; width: number; height: number };
        try { representablePositionBox({ x: frame.x * canvas.width, y: frame.y * canvas.height, width: frame.width * canvas.width, height: frame.height * canvas.height }, at.replace(/^\//, '').replaceAll('/', '.')); }
        catch (error) {
          if (!(error instanceof PositionRangeError)) throw error;
          issues.push(semanticIssue(`${at}/${error.coordinate}`, error.message, { key: error.coordinate }));
        }
      }
    });
  }
  const allowedFields = new Set<string>([
    "type",
    ...spec.fields,
  ]);

  // `bullets` are talking points of a text payload: `type: "list"` beside them is one mistake with one fix, not a missing `items`
  // and an incompatible field.
  const listOfBullets = resolvedKind === "list" && hasOwn(value, "bullets") && !hasOwn(value, "items");
  for (const required of spec.required) {
    if (!hasOwn(value, required) && !listOfBullets) {
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
    issues.push(semanticIssue(path, listOfBullets && incompatible.length === 1 ? "'bullets' belongs to a text payload, so it cannot be a 'list': write the entries under 'items', or remove 'type'" : `content payload type '${resolvedKind}' cannot include incompatible fields: ${incompatible.join(", ")}`, {
      type: resolvedKind,
      incompatible,
    }));
  }

  return issues;
}

function validateSlideRoot(slide: Record<string, unknown>, slidePath: string, canvas?: { width: number; height: number }): ValidationIssue[] {
  return presentFields(slide, rootPayloadFields).length > 0 ? validateContentPayload(slide, slidePath, { slideRoot: true, ...(canvas ? { canvas } : {}) }) : [];
}

function intersects(left: readonly number[], right: readonly number[]): boolean {
  return left.some((value) => right.includes(value));
}

/**
 * OPF 0.35: the cells of a slide without a layout. A slide places every block in a cell or none, so a block that names none beside one
 * that does is an error; two blocks may name the same cell (they stack in it), but two different cells may not overlap, and a block in a
 * cell has no slide edge to bleed to (`placement`).
 */
function validateSlideCells(slide: Record<string, unknown>, slidePath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (slide.layout !== undefined || !Array.isArray(slide.blocks)) return issues;
  const blocks = slide.blocks.flatMap((block, index) => isRecord(block) ? [{ block, index }] : []);
  const placed = blocks.filter(({ block }) => isGridCell(block.region));
  if (!placed.length) return issues;
  const cells = [...new Set(placed.map(({ block }) => String(block.region)))];
  for (const { block, index } of blocks) {
    // A region written like a cell with a colon or a plus (`top:left`) fails the pattern, whose finding names the cell it means.
    if (isGridCell(block.region) || (typeof block.region === "string" && /[:+]/.test(block.region))) continue;
    const path = pathFor(pathFor(slidePath, "blocks"), String(index));
    const meant = typeof block.region === "string" ? nearestGridCell(block.region)?.cell : undefined;
    issues.push(semanticIssue(typeof block.region === "string" ? pathFor(path, "region") : path, typeof block.region === "string"
      ? `a slide places every block in a cell of its grid or none: '${block.region}' is no cell (${meant ? `write '${meant}': layout words follow the deck's direction` : `write one of the cells the other blocks use, such as '${cells[0]}', or give the slide a layout`})`
      : `a slide places every block in a cell of its grid or none: give this block a 'region' cell too (the other blocks use ${cells.map((cell) => `'${cell}'`).join(", ")})`, { cells }));
  }
  for (const { block, index } of placed) {
    if (hasOwn(block, "placement")) issues.push(semanticIssue(pathFor(pathFor(pathFor(slidePath, "blocks"), String(index)), "placement"), "placement is only valid on a top-level block of a slide whose blocks are not in cells; a block in a cell of the slide's grid cannot bleed to a slide edge", { code: "image-placement-invalid" }));
  }
  for (let left = 0; left < cells.length; left += 1) {
    for (let right = left + 1; right < cells.length; right += 1) {
      const a = gridCellSpan(cells[left]!), b = gridCellSpan(cells[right]!);
      if (!a || !b || !intersects(a.rows, b.rows) || !intersects(a.columns, b.columns)) continue;
      const at = placed.find(({ block }) => block.region === cells[right])!;
      issues.push(semanticIssue(pathFor(pathFor(pathFor(slidePath, "blocks"), String(at.index)), "region"), `cells '${cells[left]}' and '${cells[right]}' overlap`, { cells: [cells[left], cells[right]] }));
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

function presentationSemanticIssues(value: unknown, catalogs?: readonly Catalog[], slideLinks?: false | readonly string[]): ValidationIssue[] {
  if (!isRecord(value) || !Array.isArray(value.slides)) {
    return [];
  }

  const issues: ValidationIssue[] = [];

  issues.push(...enUkIssues(value.language, "/language"));

  issues.push(...deckMetadataIssues(value));
  // 'speakers' is the one built-in variable name without a dot, so a declared variable may not take it.
  if (isRecord(value.variables) && hasOwn(value.variables, "speakers")) {
    issues.push(semanticIssue("/variables/speakers", "'speakers' is reserved for the built-in list of speaker names; choose another variable id", { id: "speakers" }));
  }

  // Slide and payload ids share one namespace, so the origin of the id already
  // seen decides which message describes the collision truthfully.
  // FR-02: list items, bullets, timeline events and table rows join the same namespace (origin "entry").
  const documentIds = new Map<string, "slide" | "payload" | "entry">();
  let overlayCanvas: {width: number; height: number} | undefined, overlayCanvasResolved = false;
  // The deck's canvas, resolved once and only for a deck that positions something by fractions (an overlay shape or an image callout).
  const deckCanvas = () => {
    if (!overlayCanvasResolved) {
      overlayCanvasResolved = true;
      const design = isRecord(value.design) ? value.design : {};
      const dimensions = design.dimensions ?? resolveDesignRecords(value, undefined, {catalogs: catalogs ?? []}).theme.dimensions;
      try { overlayCanvas = resolveCanvasDimensions(dimensions); } catch { /* The authored dimensions have their own schema error. */ }
    }
    return overlayCanvas;
  };
  const canvasForOverlays = (slide: Record<string, unknown>, index: number) => {
    if (!Array.isArray(slide.shapes) || !slide.shapes.some(shape => isRecord(shape) && shape.connector === undefined && ['x', 'y', 'width', 'height'].every(key => typeof shape[key] === 'number' && Number.isFinite(shape[key])))) return undefined;
    const canvas = deckCanvas();
    return canvas ? {...canvas, rtl: resolveSlideDirection(value, index) === 'rtl'} : undefined;
  };
  const hasCallouts = (node: unknown, depth = 0): boolean => isRecord(node) && depth <= 34 && Object.entries(node).some(([key, entry]) => key === 'callouts' ? Array.isArray(entry) && entry.length > 0 : key === 'image' || key === 'blocks' ? (Array.isArray(entry) ? entry.some(item => hasCallouts(item, depth + 1)) : hasCallouts(entry, depth + 1)) : false);
  value.slides.forEach((slide, index) => {
    if (isRecord(slide)) {
      const slidePath = `/slides/${index}`;
      if (typeof slide.id === "string") {
        const seen = documentIds.get(slide.id);
        if (seen === "slide") issues.push(semanticIssue(`${slidePath}/id`, "slide ids must be unique within a presentation", { id: slide.id }));
        else if (seen === "payload") issues.push(semanticIssue(`${slidePath}/id`, "slide id duplicates a content payload id; ids must be unique among slide and payload ids within a presentation", { id: slide.id }));
        else if (seen === "entry") issues.push(semanticIssue(`${slidePath}/id`, "slide id duplicates a list item, bullet, timeline event or table row id; ids are unique across the whole presentation", { id: slide.id }));
        else documentIds.set(slide.id, "slide");
      }
      const claimEntries = (owner: Record<string, unknown>, path: string): void => visitPayloadItems(owner, path, (kind, entry, entryPath) => {
        const id = entryId(entry);
        if (id === undefined) return;
        if (documentIds.has(id)) issues.push(semanticIssue(`${entryPath}/id`, `${kind === "event" ? "timeline event" : kind === "row" ? "table row" : kind} ids must be unique among every slide, payload, overlay, list item, bullet, timeline event and table row id within a presentation`, { id }));
        else documentIds.set(id, "entry");
      });
      claimEntries(slide, slidePath);
      visitContentPayloads(slide, slidePath, (payload, path) => {
        if (typeof payload.id === "string") {
          if (documentIds.has(payload.id)) issues.push(semanticIssue(`${path}/id`, "content payload ids must be unique among slide and payload ids within a presentation", { id: payload.id }));
          else documentIds.set(payload.id, "payload");
        }
        claimEntries(payload, path);
      });
      // SH-04: overlay shapes and connectors share the namespace; a connector or an `at` names blocks and overlay shapes by id.
      if (Array.isArray(slide.shapes)) slide.shapes.forEach((entry, shapeIndex) => {
        if (!isRecord(entry)) return;
        const entryPath = `${slidePath}/shapes/${shapeIndex}`;
        if (typeof entry.id === "string") {
          if (documentIds.has(entry.id)) issues.push(semanticIssue(`${entryPath}/id`, "overlay ids must be unique among slide, payload and overlay ids within a presentation", { id: entry.id }));
          else documentIds.set(entry.id, "payload");
        }
        // SH-02's checks of a shape: adjust names and ranges, and a link on a hidden shape.
        const checked = isOverlayConnector(entry) ? (isRecord(entry.adjust) ? { shape: connectorAdjustPreset(entry), adjust: entry.adjust } : undefined) : entry;
        if (checked) for (const issue of shapeIssues(checked, (...keys) => keys.reduce((at, key) => pathFor(at, key), entryPath))) issues.push(semanticIssue(issue.path, issue.message, { code: issue.code, ...issue.params }));
      });
      for (const issue of overlayIssues(slide, slidePath, value, canvasForOverlays(slide, index))) issues.push(semanticIssue(issue.path, issue.message, { ...(issue.code ? { code: issue.code } : {}), ...issue.params }));
      issues.push(...enUkIssues(slide.language, `${slidePath}/language`));
      issues.push(...validateSlideRoot(slide, slidePath, hasCallouts(slide) ? deckCanvas() : undefined), ...validateSlideCells(slide, slidePath));
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
  // FR-03: a `slide:<id>` link names a slide of the document.
  if (slideLinks !== false) issues.push(...slideLinkIssues(value, slideLinks));

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

// ECMA-376 / ISO/IEC 29500-1 section 19.2.1.39 (p:sldSz) limits each side of the slide to 914400 to 51206400 EMU, which is
// 1 to 56 inches (ST_SlideSizeCoordinate, section 19.7.17). The schema accepts any positive custom size, so a deck can export a
// size PowerPoint rejects or clamps. The check reads the deck's resolved size (design.dimensions, else its theme's) in EMU the
// way the PPTX exporter writes it: Math.round(inches * 914400). Presets are all inside the range.
const SLIDE_SIDE_MIN_EMU = 914400;
const SLIDE_SIDE_MAX_EMU = 51206400;
const EMU_PER_INCH = 914400;
const EMU_PER_REFERENCE_PIXEL = EMU_PER_INCH / 96;

function slideSizeRangeWarnings(document: Record<string, unknown>, catalogs: readonly Catalog[] | undefined): ValidationIssue[] {
  const design = isRecord(document.design) ? document.design : {};
  const explicit = design.dimensions !== undefined;
  let dimensions: unknown = design.dimensions;
  if (!explicit) {
    const theme = resolveDesignRecords(document, undefined, { catalogs: catalogs ?? [] }).theme;
    dimensions = theme.dimensions;
    // No size in the deck or its theme is the widescreen default, which is in range.
    if (dimensions === undefined) return [];
  }
  let size: { width: number; height: number };
  try {
    size = resolveCanvasDimensions(dimensions);
  } catch {
    return [];
  }
  const sides = ([["width", size.width], ["height", size.height]] as const).map(([side, pixels]) => ({
    side,
    inches: pixels / 96,
    emu: Math.round(pixels * EMU_PER_REFERENCE_PIXEL),
  }));
  const outside = sides.filter(({ emu }) => emu < SLIDE_SIDE_MIN_EMU || emu > SLIDE_SIDE_MAX_EMU);
  if (outside.length === 0) return [];
  const inches = (value: number): string => String(Math.round(value * 10000) / 10000);
  const detail = outside.map(({ side, inches: value, emu }) => `${side} ${inches(value)} in (${emu} EMU) is ${emu < SLIDE_SIDE_MIN_EMU ? "below 1 in" : "above 56 in"}`).join(", ");
  const path = explicit ? "/design/dimensions" : typeof design.theme === "string" ? "/design/theme" : "/design";
  return [semanticIssue(
    path,
    `the slide size ${inches(sides[0]!.inches)} x ${inches(sides[1]!.inches)} in is outside PowerPoint's 1 to 56 inch range per side (${detail}); the PPTX p:sldSz allows 914400 to 51206400 EMU${explicit ? "" : ", and the size comes from the deck's theme"}`,
    {
      code: "slide-size-out-of-range",
      widthInches: sides[0]!.inches,
      heightInches: sides[1]!.inches,
      widthEmu: sides[0]!.emu,
      heightEmu: sides[1]!.emu,
      minEmu: SLIDE_SIDE_MIN_EMU,
      maxEmu: SLIDE_SIDE_MAX_EMU,
      sides: outside.map(({ side }) => side),
    },
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

// RR-54: chart and table data. Errors: dataset-unknown, dataset-field-unknown, datasource-unknown (FR-04), data-column-duplicate,
// chart-mapping-unknown-column, chart-highlight-unknown-name (FA-14), number-format-invalid. Warnings: datasource-credentials and dataset-stale (FR-04), chart-value-not-numeric (not for
// null, "" or a 'var:<id>' cell whose variable is a number), chart-mapping-adapted, chart-highlight-adapted, chart-series-dropped (LH-60).
function dataIssues(value: unknown, asOf?: string): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const out = { errors: [] as ValidationIssue[], warnings: [] as ValidationIssue[] };
  if (!isRecord(value) || !Array.isArray(value.slides)) return out;
  const seen = new Set<string>();
  const add = (diagnostics: readonly DataDiagnostic[]) => {
    for (const diagnostic of diagnostics) {
      const key = `${diagnostic.code}|${diagnostic.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const fix = (diagnostic as MetricDataDiagnostic).fix;
      (diagnostic.severity === "error" ? out.errors : out.warnings).push(semanticIssue(diagnostic.path, diagnostic.message, { code: diagnostic.code, ...(diagnostic.aggregate ? { aggregate: true } : {}), ...(fix ? { fix } : {}) }));
    }
  };
  add(datasetDiagnostics(value));
  // FR-04: the checks on data sources a `validate` makes and the browser-safe data entry does not carry (data-source-checks.ts).
  add(dataSourceDiagnostics(value));
  for (const [id, dataset] of Object.entries(isRecord(value.datasets) ? value.datasets : {})) add(provenanceDiagnostics(dataset, `/datasets/${id.replaceAll("~", "~0").replaceAll("/", "~1")}`, value, { asOf }));
  const payload = (node: Record<string, unknown>, path: string): void => {
    if (isRecord(node.chart)) {
      const resolved = resolveChartData(node.chart, value, { path: pathFor(path, "chart") });
      if (isRecord(node.chart.data) && !isDatasetRef(node.chart.data)) add(provenanceDiagnostics(node.chart.data, pathFor(pathFor(path, "chart"), "data"), value, { asOf }));
      add(resolved.diagnostics);
      // LH-60: a series the drawn chart type cannot plot is named (chart-series-dropped).
      add(chartDrawDiagnostics(node.chart, resolved, pathFor(path, "chart"), { language: typeof value.language === "string" ? value.language : undefined }));
    }
    if (isRecord(node.table)) add(resolveTableData(node.table, value, { path: pathFor(path, "table") }).diagnostics);
    // FR-06: a metric linked to data: its dataset and fields (errors), its aggregate, empty rows, change and stale literals (warnings).
    if (isRecord(node.metric)) add(resolveMetric(node.metric, value, { path: pathFor(path, "metric"), ...(typeof value.language === "string" ? { language: value.language } : {}) }).diagnostics);
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
    // SH-02: the lighter or darker form names its base in its color key.
    if (isRecord(entry) && entry.color !== undefined) { colorRef(entry.color, pathFor(path, "color")); return; }
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
    if (isRecord(entry)) { colorRef(entry, path); return; }
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
        const cellsPath = isRecord(row) ? `${rowsPath}/${rowIndex}/cells` : `${rowsPath}/${rowIndex}`;
        rowCells(row).forEach((cell, cellIndex) => { tableCell(cell, `${cellsPath}/${cellIndex}`); });
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
    if (isRecord(node.chart) && Array.isArray(node.chart.referenceLines)) node.chart.referenceLines.forEach((line, index) => {
      if (isRecord(line) && isRecord(line.stroke)) colorRef(line.stroke.color, `${path}/chart/referenceLines/${index}/stroke/color`);
    });
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
  issues.push(...slideSizeRangeWarnings(value, catalogs));

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
  });

  return issues;
}

function validateLanguageSemantics(value: unknown): ValidationIssue[] {
  return isRecord(value) ? enUkIssues(value.bcp47, "/bcp47") : [];
}

// Guard recursive payloads before AJV or recursive semantic/reference traversal.
function contentDepthIssues(value: unknown): ValidationIssue[] {
  if (!isRecord(value) || !Array.isArray(value.slides)) return [];
  const stack: { value: unknown; path: string; depth: number; ancestors: unknown[] }[] = [];
  value.slides.forEach((slide, index) => {
    if (!isRecord(slide)) return;
    if (Array.isArray(slide.blocks)) slide.blocks.forEach((block, i) => { stack.push({ value: block, path: `/slides/${index}/blocks/${i}`, depth: 0, ancestors: [] }); });
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
    const check = schemaEngine().definition("presentation", definition);
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
  // FR-02: a table row is an array of cells or an object { id, cells }. A row that writes one form is judged by that form alone, so the
  // errors of its cells read as they did before the object form existed, and the form it did not write is not offered as an alternative.
  for (const union of errors) {
    if (union.keyword !== "oneOf" || !/\/table\/rows\/\d+$/.test(union.instancePath) || !union.schemaPath.endsWith("/$defs/TableRow/oneOf")) continue;
    const target = pointerValue(value, union.instancePath);
    const other = Array.isArray(target) ? 1 : isRecord(target) ? 0 : undefined;
    if (other === undefined) continue;
    const prefix = `${union.instancePath}/`;
    const otherBranch = `/$defs/TableRow/oneOf/${other}/`;
    kept = kept.filter((error) => error !== union && !(error.schemaPath.includes(otherBranch) && (error.instancePath === union.instancePath || error.instancePath.startsWith(prefix))));
  }
  for (const union of kept) {
    if (union.keyword !== "oneOf") continue;
    const chartData = /\/chart\/data$/.test(union.instancePath) && /\/properties\/data\/oneOf$/.test(union.schemaPath);
    const header = /\/table\/columns\/\d+$/.test(union.instancePath) && /\/properties\/columns\/items\/oneOf$/.test(union.schemaPath);
    if (!chartData && !header) continue;
    const target = pointerValue(value, union.instancePath);
    if (!isRecord(target)) continue;
    const branch = chartData
      ? hasOwn(target, "dataset") ? "DatasetRef" : hasOwn(target, "rows") ? "ChartData" : undefined
      : hasOwn(target, "value") ? "StyledTableCell" : hasOwn(target, "name") ? "DataColumn" : undefined;
    const check = branch ? schemaEngine().definition("presentation", branch) : undefined;
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
      if (entry.code === "variable-example-used" || entry.code === "variable-rich-flattened" || entry.code === "variable-unfilled" || entry.code === "variable-translations-removed") continue;
      // A limit is read by the validator's own rule (opf/variable-overflow, which composes where a line limit needs it), not by the format check.
      if (entry.code === "variable-overflow") continue;
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
  const specific = resolved.schemaName === "presentation" ? dataUnionErrors(ajvErrors, subject) : ajvErrors;
  const mapped = collapseRepeats(bestMatchErrors(schemaEngine(), schemas[resolved.schemaName].$id as string, specific)).map(toIssue);
  const errors = mapped;
  // OPF 0.19: the template rules a schema cannot express (opf/layout-template, opf/layout-region), on a record the schema accepts.
  if (resolved.schemaName === "layout" && valid) for (const issue of layoutTemplateIssues(subject)) errors.push(semanticIssue(issue.path, issue.message, { code: issue.code }));
  const warnings: ValidationIssue[] = [];

  if (resolved.schemaName === "presentation") {
    errors.push(...presentationSemanticIssues(subject, options.catalogs, options.slideLinks));
    errors.push(...variableIssues.errors);
    const data = dataIssues(subject, options.asOf);
    errors.push(...data.errors);
    warnings.push(...presentationReferenceWarnings(subject, options.catalogs));
    warnings.push(...data.warnings);
    warnings.push(...overlayAnchorSizeWarnings(subject));
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
