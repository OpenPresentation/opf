/**
 * A finding in plain words (`describeFinding`): what is wrong, where it matters, and what could come next.
 *
 * `validate` returns findings written for tools (an Ajv sentence such as "must be equal to one of the allowed values", a rule's own sentence, `help`
 * text for agents). An editor, the CLI or an agent that shows them to a person wants the sentence of artifacts/source-editor/VALIDATOR-HINTS.md:
 *
 *     `titleAlignment` must be left, center or right, but is `middle`.      (message)
 *     did you mean `center`?                                                (next)
 *
 * The text is written from the structured data a finding already carries (the schema keyword and its parameters, the suggestions, the measured
 * numbers, the path and the document), never by guessing at prose. Every `opf/*` rule has a `next` line (`finding-text-rules.ts`), as do the YAML and
 * Markdown reader's findings (`finding-text-source.ts`); a finding from another producer keeps its sentence and the first sentence of its `help`.
 *
 * Pure and browser-safe. The reader of the text (a person) is addressed in American English, with fields in backticks.
 */
import type { Finding } from "./generated/types/finding.js";
import { chartShapeHelp } from "./chart-shape.js";
import { RULE_TEXT } from "./finding-text-rules.js";
import { SOURCE_TEXT } from "./finding-text-source.js";
import {
  type FindingText,
  type FindingTextContext,
  type TextHelpers,
  KIND_EXAMPLES,
  KIND_WORDS,
  asNext,
  cap,
  code,
  containerName,
  describeKind,
  describeValue,
  fieldLabel,
  firstSentence,
  isRecord,
  nearest,
  readAt,
  segmentsOf,
  typeWords,
  valueList,
  WORDS,
} from "./finding-text-util.js";
import { type JsonSchema, catalogKindAt, createSchemaValue, schemaAtPath, schemaVariants } from "./schema-navigation.js";

export type { FindingText, FindingTextContext } from "./finding-text-util.js";

/** What a regular expression of the schemas means in words: "a hex color like `#1F4E79` (3, 6 or 8 hex digits)". Keyed by the pattern's source. */
export interface PatternPhrase {
  /** The thing the value should be, after "must be": `a hex color like \`#1F4E79\``. */
  what: string;
  /** What to write instead, after "Next:": `write the color as #RRGGBB.` */
  next: string;
}

const ID = "an id of lowercase letters, digits and hyphens that starts with a letter, like `my-layout`";
const ID_NEXT = "use lowercase letters, digits and hyphens, and start with a letter.";
const LANGUAGE = "a language tag like `en-US` or `de`";

/**
 * Every `pattern` of the published schemas, in words. A test walks the schemas and fails when a pattern has no entry here, so a new pattern needs
 * its phrase in the same change. The catalog reference pattern is written per catalog kind by `describeFinding` and is listed for completeness.
 */
export const PATTERN_PHRASES: Readonly<Record<string, PatternPhrase>> = Object.freeze({
  "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$": { what: "a hex color like `#1F4E79` (3, 6 or 8 hex digits)", next: "write the color as #RRGGBB." },
  "^[a-z][a-z0-9-]*$": { what: ID, next: ID_NEXT },
  "^[a-z0-9][a-z0-9-]*$": { what: "an id of lowercase letters, digits and hyphens, like `my-chart`", next: ID_NEXT },
  "^(?:[a-z][a-z0-9-]*:)?[a-z][a-z0-9-]*$": { what: "a catalog id like `pillars` or `acme:hero` (lowercase letters, digits and hyphens)", next: "use the id of a record, with the catalog group in front when it has one." },
  "^[a-zA-Z0-9][a-zA-Z0-9._-]*$": { what: "an id of letters, digits, dots, hyphens and underscores that starts with a letter or digit, like `logo-2`", next: "use letters, digits, dots, hyphens and underscores, without spaces." },
  "^[a-zA-Z0-9_-]+$": { what: "an id of letters, digits, hyphens and underscores, like `hero_1`", next: "remove spaces and other punctuation." },
  "^var:[a-z][a-z0-9-]*$": { what: "a variable reference like `var:brand`", next: "write `var:` and the id of a variable under `variables`." },
  "^var:organization(\\.[A-Za-z0-9_-]+)?\\.logo(\\.(full|stacked|icon|wordmark))?$": { what: "an organization logo reference like `var:organization.logo.full`", next: "write `var:organization.logo` and, if you want, `.full`, `.stacked`, `.icon` or `.wordmark`." },
  "^\\d{4}-\\d{2}-\\d{2}$": { what: "a date written year-month-day, like `2026-10-24`", next: "write the date as YYYY-MM-DD." },
  "^(?:https?://|mailto:|tel:)\\S+$": { what: "a web, email or phone address (`https://…`, `mailto:…` or `tel:…`)", next: "start with https://, mailto: or tel:, and leave out spaces." },
  "^(https?://|mailto:|tel:)\\S+$": { what: "a web, email or phone address (`https://…`, `mailto:…` or `tel:…`)", next: "start with https://, mailto: or tel:, and leave out spaces." },
  "^(asset:|https://|data:|\\./|\\.\\./)": { what: "a source that starts with `asset:`, `https://`, `data:`, `./` or `../`", next: "register the file under `assets` and write `asset:` and its id, or give an https:// address." },
  "^(?:https://[^\\s]+|pkg:[^\\s]+)$": { what: "an `https://` address or a `pkg:` reference", next: "write an address that starts with https:// or pkg:, without spaces." },
  "^(?:[A-Za-z]{2,3}|[iIxX])(?:-[A-Za-z0-9]{1,8})*$": { what: LANGUAGE, next: "write a language and, if needed, a region: `en-US`, `pt-BR`, `de`." },
  "^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$": { what: LANGUAGE, next: "write a language and, if needed, a region: `en-US`, `pt-BR`, `de`." },
  "^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$": { what: LANGUAGE, next: "write a language and, if needed, a region: `en-US`, `pt-BR`, `de`." },
  "^[0-9a-f]{64}$": { what: "a 64-character lowercase hex digest", next: "paste the SHA-256 digest in lowercase hex." },
  "^[^/]+\\.json$": { what: "a file name that ends in `.json`, without folders", next: "write a plain file name such as `pillars.json`." },
  "^[a-z][a-z0-9-]*\\.svg$": { what: "a file name like `pillars.svg`", next: "write the record id and `.svg`." },
  "^[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9][A-Za-z0-9._-]*$": { what: "a rule id of two parts like `opf/text-contrast`", next: "write the producer, a slash and the rule name." },
});

const hasHex = (pattern: unknown): boolean => typeof pattern === "string" && /^\^#\(\?:\[0-9a-fA-F\]/.test(pattern);

/** The helpers a rule's text reads the document through. */
export function helpersFor(finding: Finding, context: FindingTextContext): TextHelpers {
  const segments = segmentsOf(finding.path);
  return {
    segments,
    valueAt: (path) => (context.valueAt ? context.valueAt([...path]) : readAt(context.document, path)),
    get: (path) => (context.valueAt ? context.valueAt([...path]) : readAt(context.document, path)),
    chord: context.chord ?? "Ctrl+Space",
    format: context.format ?? "json",
  };
}

const attempt = <T>(run: () => T, fallback: T): T => {
  try {
    return run();
  } catch {
    return fallback;
  }
};

/** The names of the properties the schema allows in the object at `segments` (every variant of a union). */
function schemaKeys(segments: string[], context: FindingTextContext): string[] {
  if (context.keysOf) return context.keysOf(segments);
  return attempt(() => [...new Set(schemaVariants(schemaAtPath(context.document, segments)).flatMap((variant: JsonSchema) => Object.keys(variant.properties ?? {})))], []);
}

/** The text of a value to write for a missing property, as a person would type it: `"acme"`, `{ … }`, `[ … ]`. */
function starterText(schema: JsonSchema | undefined, property: string, format: "json" | "yaml" | "md"): string {
  const example = (schema?.examples as unknown[] | undefined)?.find((value) => typeof value === "string" && !value.includes("..."));
  const type = Array.isArray(schema?.type) ? schema?.type[0] : schema?.type;
  if (example !== undefined) return format === "json" ? JSON.stringify(example) : String(example);
  if (type === "object") return "{ … }";
  if (type === "array") return "[ … ]";
  if (type === "number" || type === "integer") return "0";
  if (type === "boolean") return "false";
  if (property === "id") return format === "json" ? '"acme"' : "acme";
  return format === "json" ? '"…"' : "…";
}

/** The schema keywords of `opf/schema` findings, in plain words. Returns `undefined` for a keyword with no text of its own. */
function describeSchema(finding: Finding, context: FindingTextContext, helpers: TextHelpers): FindingText | undefined {
  const { keyword, params = {}, alternatives } = finding.validation ?? { keyword: "" };
  const segments = helpers.segments;
  const label = fieldLabel(segments);
  const actual = helpers.valueAt(segments);
  const chord = helpers.chord;
  const format = helpers.format;
  switch (keyword) {
    case "required": {
      const property = String(params.missingProperty ?? "");
      const where = containerName(segments);
      const shape = property === "data" ? chartShapeHelp(actual) : undefined;
      if (shape) return { message: shape.message, next: shape.next };
      const schema = context.schemaAt ? context.schemaAt([...segments, property]) : attempt(() => schemaAtPath(context.document, [...segments, property]), undefined);
      if (format === "json") {
        const sample = property === "slides" ? '[ { "title": "…" } ]' : starterText(schema, property, "json");
        return { message: `${cap(where)} is missing ${code(property)}.`, next: `add "${property}": ${sample}.` };
      }
      const sample = property === "slides" ? "slides:` with at least one `- title: …" : `${property}: ${starterText(schema, property, "yaml")}`;
      return { message: `${cap(where)} is missing ${code(property)}.`, next: `add \`${sample}\`.` };
    }
    case "type": {
      const expected = typeWords(params.type);
      const next =
        params.type === "array" && typeof actual === "string"
          ? `write [${JSON.stringify(actual)}].`
          : params.type === "string" && typeof actual === "number"
            ? `write ${JSON.stringify(String(actual))}.`
            : params.type === "string" && typeof actual === "boolean"
              ? `write ${JSON.stringify(String(actual))}.`
              : `write ${expected}.`;
      return { message: `${cap(label)} should be ${expected}, but it is ${describeKind(actual)}.`, next };
    }
    case "oneOf":
    case "anyOf": {
      const forms = (alternatives ?? []).map((entry) => String(entry).split(":")[0]?.trim() ?? "");
      const words = forms.length ? [...new Set(forms.map((form) => WORDS[form] ?? form))].slice(0, 3).join(" or ") : "a different kind of value";
      return { message: `${cap(label)} should be ${words}, but it is ${describeKind(actual)}.`, next: forms.length ? `write ${words}.` : "check the schema reference for this field." };
    }
    case "enum": {
      const values = (params.allowedValues as unknown[] | undefined) ?? finding.suggestions?.map((entry) => entry.value) ?? [];
      const guess = nearest(actual, values).close[0];
      const is = actual === undefined ? "" : `, but is ${describeValue(actual)}`;
      return {
        message: `${cap(label)} must be ${valueList(values)}${is}.`,
        next: guess !== undefined ? `did you mean ${code(guess)}?` : values.length > 5 ? `press ${chord} for the ${values.length} values.` : "choose one of these values.",
      };
    }
    case "const":
      return { message: `${cap(label)} must be exactly ${code(params.allowedValue)}.`, next: `write ${JSON.stringify(params.allowedValue)}.` };
    case "pattern": {
      const pattern = String(params.pattern ?? "");
      const kind = context.catalogKind ? context.catalogKind(segments) : attempt(() => catalogKindAt(segments, context.document), undefined);
      const is = actual === "" ? "it is empty" : `it is ${describeValue(actual)}`;
      if (kind) {
        const word = KIND_WORDS[kind] ?? "catalog";
        const count = context.catalogCount?.(kind);
        const ids = KIND_EXAMPLES[kind] ?? "`id` or `name:id`";
        const press = `press ${chord}${count ? ` for the ${count} ${word}s` : " for the available ids"}`;
        const orRemove = `, or remove it${kind === "layouts" ? " to let OPF pick" : ""}.`;
        // An empty value is plainly empty; any other is a name that is not an id.
        if (actual === "") return { message: `${cap(label)} is empty.`, next: `${press} (an id such as ${ids})${orRemove}` };
        return {
          message: `${cap(label)} must be a ${word} id such as ${ids} (lowercase letters, digits and hyphens), but it is ${describeValue(actual)}.`,
          next: `${press}${orRemove}`,
        };
      }
      const phrase = PATTERN_PHRASES[pattern];
      if (phrase) return { message: `${cap(label)} must be ${phrase.what}, but is ${describeValue(actual)}.`, next: phrase.next };
      if (hasHex(pattern)) return { message: `${cap(label)} must be a hex color like ${code("#1F4E79")} (3, 6 or 8 hex digits), but is ${describeValue(actual)}.`, next: "write the color as #RRGGBB." };
      return { message: `${cap(label)} does not match the expected format${typeof actual === "string" ? `: ${describeValue(actual)}` : ""}.`, next: "check the schema reference for this field." };
    }
    case "propertyNames": {
      const name = String(params.propertyName ?? "");
      return { message: `${code(name)} is not a valid name here.`, next: "use letters, digits, hyphens and underscores, and start with a letter." };
    }
    case "additionalProperties": {
      const name = String(params.additionalProperty ?? segments.at(-1) ?? "");
      const parent = segments.slice(0, -1);
      const allowed = schemaKeys(parent, context);
      const hint = nearest(name, allowed).close[0];
      return {
        message: `${code(name)} is not a property of ${containerName(parent)}.`,
        next: `${hint ? `did you mean ${code(hint)}? ` : ""}To keep custom data, put it under ${code("extensions")}.`.trim(),
      };
    }
    case "minItems":
      return { message: `${cap(label)} needs at least ${params.limit} item${params.limit === 1 ? "" : "s"}.`, next: label === "`slides`" ? "add a slide." : "add an item." };
    case "maxItems":
      return { message: `${cap(label)} can hold at most ${params.limit} items.`, next: "remove the extra ones." };
    case "minProperties":
      return { message: `${cap(label)} needs at least ${params.limit} propert${params.limit === 1 ? "y" : "ies"}.`, next: "add one, or remove the empty object." };
    case "uniqueItems":
      return { message: `${cap(label)} repeats an entry.`, next: "remove the repeated entry." };
    case "minLength":
      return { message: `${cap(label)} is empty.`, next: "write some text, or remove the key." };
    case "maxLength":
      return { message: `${cap(label)} is longer than ${params.limit} characters.`, next: "shorten it." };
    case "minimum":
    case "exclusiveMinimum":
    case "maximum":
    case "exclusiveMaximum": {
      const bound = /minimum/i.test(keyword) ? "at least" : "at most";
      return {
        message: `${cap(label)} must be ${keyword.startsWith("exclusive") ? (bound === "at least" ? "greater than" : "less than") : bound} ${params.limit}, but is ${describeValue(actual)}.`,
        next: `write ${params.limit}${keyword.startsWith("exclusive") ? " or a different number" : ""}.`,
      };
    }
    case "format":
      return { message: `${cap(label)} must be a ${params.format === "uri" ? "web address like https://example.com" : params.format}.`, next: "check the value." };
    default:
      return undefined;
  }
}

/** The text of a finding of this checker's own `opf/*` rules and readers, or `undefined`. */
function ruleText(finding: Finding, context: FindingTextContext, helpers: TextHelpers): FindingText | undefined {
  const handler = RULE_TEXT[finding.ruleId] ?? SOURCE_TEXT[finding.ruleId];
  return handler?.(finding, context, helpers);
}

/**
 * The message and the hint for a finding, in plain words. `message` says what is wrong (fields in backticks, no JSON Pointers, no Ajv keywords),
 * `next` what could come next (it continues the word "Next:" and starts in lower case; absent only when the finding says nothing more). The
 * schema findings are written from their keyword and parameters, every `opf/*` rule and every YAML and Markdown reader finding from a table,
 * and a finding from another producer keeps its own sentence and the first sentence of its `help`.
 *
 * `context.document` (the checked deck) makes the text quote the value that is there; without it the text still reads well. Never throws.
 */
export function describeFinding(finding: Finding, context: FindingTextContext = {}): FindingText {
  const helpers = helpersFor(finding, context);
  let described: FindingText | undefined;
  try {
    if (finding.ruleId === "opf/schema" && finding.validation?.keyword) described = describeSchema(finding, context, helpers);
    else described = ruleText(finding, context, helpers);
  } catch {
    described = undefined;
  }
  if (described) return described.next === undefined ? { message: described.message, ...fallbackNext(finding) } : described;
  return { message: finding.message, ...fallbackNext(finding) };
}

function fallbackNext(finding: Finding): { next?: string } {
  const help = firstSentence(finding.help);
  return help ? { next: asNext(help) } : {};
}

/** A starting value for a property the schema requires (`createSchemaValue` with the deck's slides and ids special-cased). */
export function starterValue(document: unknown, segments: readonly string[], property: string): unknown {
  if (property === "slides" && segments.length === 0) return [{ title: "Slide title" }];
  try {
    return createSchemaValue(schemaAtPath(document, [...segments, property]));
  } catch {
    return undefined;
  }
}

export { isRecord };
