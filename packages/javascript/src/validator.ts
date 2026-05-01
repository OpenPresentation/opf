import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { catalogSchemaNames, type CatalogKind } from "./catalogs.js";
import type { JsonSchema } from "./json.js";
import { schemas, type SchemaName } from "./schemas.js";
import type { Presentation } from "./types.js";

export interface ValidationIssue {
  path: string;
  message: string;
  keyword: string;
  schemaPath: string;
  params: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  schemaName?: SchemaName;
  catalogKind?: CatalogKind;
}

export type SchemaOrKind = SchemaName | CatalogKind | JsonSchema;

export class OPFValidationError extends Error {
  readonly issues: ValidationIssue[];
  readonly result: ValidationResult;

  constructor(result: ValidationResult) {
    const first = result.errors[0];
    super(first ? `OPF validation failed at ${first.path}: ${first.message}` : "OPF validation failed");
    this.name = "OPFValidationError";
    this.issues = result.errors;
    this.result = result;
  }
}

const schemaNameByCatalogKind = catalogSchemaNames as Record<CatalogKind, SchemaName>;

let ajv: Ajv2020 | undefined;
const dynamicSchemaCache = new WeakMap<JsonSchema, ValidateFunction>();

const promotedRegionKeys = [
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
  "top+middle+bottom:left+center+right",
] as const;

const promotedRegionKeySet = new Set<string>(promotedRegionKeys);

const rootPayloadFields = [
  "type",
  "text",
  "runs",
  "items",
  "bullets",
  "src",
  "chartType",
  "data",
  "headers",
  "rows",
  "shape",
  "code",
  "language",
  "value",
  "label",
  "unit",
  "delta",
  "trend",
  "quote",
  "attribution",
  "source",
  "events",
  "children",
  "prompt",
  "expectedType",
] as const;

const contentMetaFields = ["children", "prompt", "expectedType"] as const;

type ContentKind =
  | "text"
  | "list"
  | "image"
  | "shape"
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
    fields: ["text", "runs", "bullets"],
    required: [],
    requireAny: ["text", "runs", "bullets"],
  },
  list: {
    fields: ["items"],
    required: ["items"],
  },
  image: {
    fields: ["src"],
    required: ["src"],
  },
  shape: {
    fields: ["shape"],
    required: ["shape"],
  },
  chart: {
    fields: ["chartType", "data"],
    required: ["chartType", "data"],
  },
  table: {
    fields: ["headers", "rows"],
    required: ["rows"],
  },
  video: {
    fields: ["src"],
    required: ["src"],
  },
  code: {
    fields: ["code", "language"],
    required: ["code"],
  },
  metric: {
    fields: ["value", "label", "unit", "delta", "trend"],
    required: ["value"],
  },
  quote: {
    fields: ["quote", "attribution", "source"],
    required: ["quote"],
  },
  timeline: {
    fields: ["events"],
    required: ["events"],
  },
};

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

function isCatalogKind(value: unknown): value is CatalogKind {
  return typeof value === "string" && value in schemaNameByCatalogKind;
}

function resolveValidator(schemaOrKind: SchemaOrKind): {
  validate: ValidateFunction;
  schemaName?: SchemaName;
  catalogKind?: CatalogKind;
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

  const cached = dynamicSchemaCache.get(schemaOrKind);
  if (cached) {
    return { validate: cached };
  }

  const validator = instance.compile(schemaOrKind);
  dynamicSchemaCache.set(schemaOrKind, validator);
  return { validate: validator };
}

function toIssue(error: ErrorObject): ValidationIssue {
  return {
    path: error.instancePath || "/",
    message: error.message ?? "failed validation",
    keyword: error.keyword,
    schemaPath: error.schemaPath,
    params: error.params as Record<string, unknown>,
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isEnUkTag(value: unknown): boolean {
  return typeof value === "string" && value.toLowerCase() === "en-uk";
}

function pathFor(parentPath: string, key: string): string {
  return parentPath === "/" ? `/${key}` : `${parentPath}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
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
  if (hasOwn(value, "src")) kinds.push("image");
  if (presentFields(value, contentKindSpecs.chart.fields).length > 0) kinds.push("chart");
  if (presentFields(value, contentKindSpecs.table.fields).length > 0) kinds.push("table");
  if (hasOwn(value, "shape")) kinds.push("shape");
  if (hasOwn(value, "code")) kinds.push("code");
  if (presentFields(value, contentKindSpecs.metric.fields).length > 0) kinds.push("metric");
  if (presentFields(value, contentKindSpecs.quote.fields).length > 0) kinds.push("quote");
  if (hasOwn(value, "events")) kinds.push("timeline");

  return kinds;
}

function validateContentPayload(value: Record<string, unknown>, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const explicitType = value.type;
  const payloadFields = presentFields(value, rootPayloadFields);
  const hasChildren = hasOwn(value, "children");
  const hasPrompt = hasOwn(value, "prompt");
  const hasExpectedType = hasOwn(value, "expectedType");

  if (explicitType !== undefined && !isContentKind(explicitType)) {
    return issues;
  }

  const kind = isContentKind(explicitType) ? explicitType : undefined;
  const inferred = kind ? [kind] : inferredKinds(value);

  if (!kind && inferred.length === 0) {
    if (hasExpectedType && !hasPrompt) {
      issues.push(semanticIssue(path, "content payload expectedType requires prompt when no concrete content fields are present", {
        fields: payloadFields,
      }));
    }
    if (!hasChildren && !hasPrompt && !hasExpectedType && (payloadFields.length > 0 || path !== "/")) {
      issues.push(semanticIssue(path, "content payload must include concrete content fields, children, or prompt", {
        fields: payloadFields,
      }));
    }
    if (Array.isArray(value.children)) {
      value.children.forEach((child, index) => {
        if (isRecord(child)) {
          issues.push(...validateContentPayload(child, `${pathFor(path, "children")}/${index}`));
        }
      });
    }
    return issues;
  }

  if (!kind && inferred.length > 1) {
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
  const allowedFields = new Set<string>(["type", ...spec.fields, ...contentMetaFields]);

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

  if (Array.isArray(value.children)) {
    value.children.forEach((child, index) => {
      if (isRecord(child)) {
        issues.push(...validateContentPayload(child, `${pathFor(path, "children")}/${index}`));
      }
    });
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
    issues.push(...validateContentPayload(slide, slidePath));
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

function validatePresentationSemantics(value: unknown): ValidationIssue[] {
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

  value.slides.forEach((slide, index) => {
    if (isRecord(slide)) {
      issues.push(...validateSlideRegions(slide, `/slides/${index}`));
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

export function validate(value: unknown, schemaOrKind: SchemaOrKind = "presentation"): ValidationResult {
  const resolved = resolveValidator(schemaOrKind);
  const valid = resolved.validate(value) === true;
  const errors = valid ? [] : (resolved.validate.errors ?? []).map(toIssue);

  if (resolved.schemaName === "presentation") {
    errors.push(...validatePresentationSemantics(value));
  } else if (resolved.schemaName === "language") {
    errors.push(...validateLanguageSemantics(value));
  }

  return {
    valid: errors.length === 0,
    errors,
    schemaName: resolved.schemaName,
    catalogKind: resolved.catalogKind,
  };
}

export function assertValid<T = unknown>(value: T, schemaOrKind: SchemaOrKind = "presentation"): T {
  const result = validate(value, schemaOrKind);
  if (!result.valid) {
    throw new OPFValidationError(result);
  }
  return value;
}

export function validatePresentation(value: unknown): ValidationResult {
  return validate(value, "presentation");
}

export function assertValidPresentation(value: unknown): asserts value is Presentation {
  assertValid(value, "presentation");
}

export function validateCatalogRecord(kind: CatalogKind, value: unknown): ValidationResult {
  return validate(value, kind);
}

export function assertValidCatalogRecord(kind: CatalogKind, value: unknown): void {
  assertValid(value, kind);
}
