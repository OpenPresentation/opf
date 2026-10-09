import { isRecord } from "./content-walk.js";
import type { FurnitureField } from "./furniture-fields.js";
import { parseLogoName, resolveOrganizationLogo } from "./logos.js";

/**
 * Slide-scoped built-in variables (FA-31): `{{slide.number}}`, `{{slide.section}}` and `{{deck.slideCount}}`.
 *
 * Their values depend on the slide being composed and on the deck after pagination, so the deck-wide
 * `resolveVariables` leaves them as written (with an escaped `\{{slide.number}}` kept escaped) and they resolve
 * here, per output slide: `resolveSlideVariables` for a slide's own strings and `substituteSlideTokens` for
 * header and footer text, which `layoutFurniture` substitutes so it can mark each slide number as a live field.
 * The organization logo references (`var:organization.logo.icon`, RR-71) are slide-scoped too, because the
 * `onLight`/`onDark` choice follows each slide's background: `resolveSlideVariables` resolves them in a slide's own
 * fields when it is given the presentation, and `layoutFurniture` in zone images.
 * Pure: no clock, locale or I/O. See docs/templates-and-variables.md.
 */

/** The slide-scoped built-in names, in picker order. */
export const SLIDE_SCOPED_BUILTINS = ["slide.number", "slide.section", "deck.slideCount"] as const;
export type SlideScopedBuiltin = (typeof SLIDE_SCOPED_BUILTINS)[number];

/** True for `slide.number`, `slide.section` and `deck.slideCount`. */
export function isSlideScopedBuiltin(name: string): name is SlideScopedBuiltin {
  return (SLIDE_SCOPED_BUILTINS as readonly string[]).includes(name);
}

/** True for any name under the reserved `slide.` prefix, and for `deck.slideCount`. */
export function isSlideScopedName(name: string): boolean {
  return name === "deck.slideCount" || name.startsWith("slide.");
}

/**
 * The body of a slide-scoped token after its opening braces: a `slide.` name (known or not) or `deck.slideCount`,
 * an optional `|format` (ignored, as for every text built-in), and the closing braces.
 */
export const SLIDE_TOKEN_BODY = String.raw`\s*(?:slide(?:\.[A-Za-z0-9_-]+){1,2}|deck\.slideCount)\s*(?:\|[^{}]*)?\}\}`;
const slideTokenAhead = new RegExp(`^${SLIDE_TOKEN_BODY}`);
/** The escape `\{{` in front of a slide-scoped token, or a known slide-scoped token. */
const slideTokenPattern = new RegExp(String.raw`\\\{\{(?=${SLIDE_TOKEN_BODY})|\{\{\s*(slide\.number|slide\.section|deck\.slideCount)\s*(?:\|[^{}]*)?\}\}`, "g");
/** A whole slide-scoped token, escaped or not: a page break never falls inside one. */
const slideTokenSpanPattern = new RegExp(String.raw`\\?\{\{${SLIDE_TOKEN_BODY}`, "g");
const quickCheck = /\{\{\s*(?:slide\.|deck\.slideCount)/;

/** True when the text right after a `\{{` escape is a slide-scoped token (the escape is then kept for the per-slide pass). */
export function slideTokenFollows(text: string): boolean {
  return slideTokenAhead.test(text);
}

export interface SlideVariableValues {
  /** One-based displayed slide number, after pagination. */
  slideNumber: number;
  /** Number of slides in the rendered or exported deck, after pagination. Without it `{{deck.slideCount}}` stays as written. */
  slideCount?: number;
  /** The slide's `section`; missing or empty resolves `{{slide.section}}` to empty text. */
  section?: unknown;
}

function checkValues(values: SlideVariableValues): void {
  if (!isRecord(values)) throw new TypeError("Slide variable values must be an object with slideNumber and slideCount.");
  if (!Number.isSafeInteger(values.slideNumber) || values.slideNumber < 1) throw new RangeError("slideNumber must be a positive safe integer.");
  if (values.slideCount !== undefined && (!Number.isSafeInteger(values.slideCount) || values.slideCount < 1)) throw new RangeError("slideCount must be a positive safe integer.");
}

/**
 * Substitute the slide-scoped tokens in one string. `fields` holds one `slideNumber` entry per substituted
 * `{{slide.number}}`, as half-open UTF-16 offsets into the returned text. An escaped `\{{slide.number}}` becomes the
 * literal text `{{slide.number}}`; other escapes and tokens are left as written.
 */
export function substituteSlideTokens(text: string, values: SlideVariableValues): { text: string; fields: FurnitureField[]; changed: boolean } {
  if (!text.includes("{{")) return { text, fields: [], changed: false };
  const fields: FurnitureField[] = [];
  let out = "";
  let last = 0;
  let changed = false;
  slideTokenPattern.lastIndex = 0;
  for (let match = slideTokenPattern.exec(text); match; match = slideTokenPattern.exec(text)) {
    const name = match[1] as SlideScopedBuiltin | undefined;
    let value: string;
    if (name === undefined) value = "{{";
    else if (name === "slide.number") value = String(values.slideNumber);
    else if (name === "deck.slideCount") {
      if (values.slideCount === undefined) continue;
      value = String(values.slideCount);
    } else value = typeof values.section === "string" ? values.section : "";
    out += text.slice(last, match.index);
    if (name === "slide.number") fields.push({ type: "slideNumber", start: out.length, end: out.length + value.length });
    out += value;
    last = match.index + match[0].length;
    changed = true;
  }
  if (!changed) return { text, fields, changed };
  return { text: out + text.slice(last), fields, changed };
}

/** The UTF-16 spans of every slide-scoped token (escaped or not) in a string, so a text split never cuts one. */
export function slideTokenSpans(text: string): [number, number][] {
  if (!text.includes("{{")) return [];
  return Array.from(text.matchAll(slideTokenSpanPattern), (match) => [match.index, match.index + match[0].length] as [number, number]);
}

const skippedKeys = new Set(["extensions"]);
/** A whole-field organization reference that may be a logo (`var:organization.logo.icon`). */
const logoReferencePattern = /^var:organization(?:.[A-Za-z0-9_-]+){1,3}$/;
const OMIT = Symbol("omit");

/** What the slide-scoped logo references need: the deck (its organizations) and the slide's background. */
interface LogoContext {
  presentation?: unknown;
  darkBackground?: boolean;
}

function clone<T>(value: T): T {
  return typeof value === "object" && value !== null ? (structuredClone(value) as T) : value;
}

/** A logo reference resolved for this slide: the organization's asset, OMIT when the organization has none, or the string as written. */
function substituteLogo(value: string, logos: LogoContext): unknown {
  if (logos.presentation === undefined || !logoReferencePattern.test(value)) return value;
  const reference = parseLogoName(value, logos.presentation);
  if (!reference || "error" in reference) return value;
  const result = resolveOrganizationLogo(logos.presentation, reference, { onDark: logos.darkBackground === true });
  if (result.ok) return clone(result.logo.source);
  return result.reason === "missing" ? OMIT : value;
}

function substitute(value: unknown, values: SlideVariableValues, root: boolean, logos: LogoContext = {}): unknown {
  if (typeof value === "string") {
    const logo = substituteLogo(value, logos);
    if (logo !== value) return logo;
    const result = substituteSlideTokens(value, values);
    return result.changed ? result.text : value;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const out: unknown[] = [];
    for (const entry of value) {
      const next = substitute(entry, values, false, logos);
      if (next !== entry) changed = true;
      if (next !== OMIT) out.push(next);
    }
    return changed ? out : value;
  }
  if (!isRecord(value)) return value;
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    let next = entry;
    if (skippedKeys.has(key)) next = entry;
    else if (root && key === "design" && isRecord(entry)) {
      // Header and footer are laid out by layoutFurniture, which marks each slide number as a live field and resolves
      // zone logo references; design.logo is an override resolveLogo reads as written.
      const design: Record<string, unknown> = {};
      let designChanged = false;
      for (const [designKey, designEntry] of Object.entries(entry)) {
        const designNext = designKey === "header" || designKey === "footer" || designKey === "logo" ? designEntry : substitute(designEntry, values, false, logos);
        if (designNext !== designEntry) designChanged = true;
        if (designNext !== OMIT) design[designKey] = designNext;
      }
      next = designChanged ? design : entry;
    } else next = substitute(entry, values, false, logos);
    if (next !== entry) changed = true;
    if (next !== OMIT) out[key] = next;
  }
  return changed ? out : value;
}

/**
 * A copy of `slide` with `{{slide.number}}`, `{{slide.section}}` and `{{deck.slideCount}}` substituted in every
 * string (titles, body text, runs, table cells, chart data, notes, code), with the walk and exclusions of
 * `resolveVariables`: `extensions` is never searched, an escaped `\{{slide.number}}` becomes the literal text
 * `{{slide.number}}`, and unknown tokens stay as written. `slide.section` reads the slide's own `section` (empty
 * text when it has none). The slide's own `design.header` and `design.footer` are left as written:
 * `layoutFurniture` substitutes header and footer text itself and marks each slide number as a live field.
 *
 * With `presentation` (RR-71) it also resolves the slide-scoped logo references, a whole string
 * `var:organization.logo[.<shape>]` or `var:organization.<id>.logo[.<shape>]` in any field (an image block, the slide
 * `image`), to the organization's asset for this slide's background (`darkBackground`, the host's luminance test:
 * `onDark` first, else `onLight`); a reference whose organization has no logo is omitted, like an unfilled optional
 * variable, and an unknown one stays as written (validation reports it). The slide's own `design.logo` is left for
 * `resolveLogo`, and zone images for `layoutFurniture`.
 *
 * Engines call it on each output slide after pagination, with the same `slideNumber`, `slideCount` and
 * `darkBackground` they pass to `composeSlide`, and compose and draw the result; `resolveSlideContext` returns it as
 * `slide`. Returns the input object itself when nothing changes; never mutates it.
 */
export function resolveSlideVariables<T>(slide: T, values: { slideNumber: number; slideCount?: number; presentation?: unknown; darkBackground?: boolean }): T {
  if (!isRecord(slide)) return slide;
  const full: SlideVariableValues = { slideNumber: values?.slideNumber, ...(values?.slideCount !== undefined ? { slideCount: values.slideCount } : {}), section: slide.section } as SlideVariableValues;
  checkValues(full);
  const logos: LogoContext = values.presentation !== undefined ? { presentation: values.presentation, darkBackground: values.darkBackground === true } : {};
  const text = JSON.stringify(slide);
  if (!quickCheck.test(text) && !(logos.presentation !== undefined && text.includes('"var:organization.'))) return slide;
  return substitute(slide, full, true, logos) as T;
}

/** True when any string of the document (outside `extensions`) carries an unescaped `{{name}}` token. */
export function usesSlideBuiltin(value: unknown, name: SlideScopedBuiltin): boolean {
  const pattern = new RegExp(String.raw`(?:^|[^\\])\{\{\s*${name.replace(".", String.raw`\.`)}\s*(?:\|[^{}]*)?\}\}`);
  const visit = (entry: unknown): boolean => {
    if (typeof entry === "string") return entry.includes("{{") && pattern.test(entry);
    if (Array.isArray(entry)) return entry.some(visit);
    if (!isRecord(entry)) return false;
    for (const [key, child] of Object.entries(entry)) if (!skippedKeys.has(key) && visit(child)) return true;
    return false;
  };
  return visit(value);
}
