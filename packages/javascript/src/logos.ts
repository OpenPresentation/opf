import { isRecord } from "./content-walk.js";

/**
 * Organization logos (RR-71, OPF 0.18): every logo lives on an organization, in up to four shapes, each optionally
 * split by the background it is drawn on. One resolution rule for every consumer: the cover and section logo, picture
 * bullets, and the slide-scoped built-in references `var:organization.logo[.<shape>]` and
 * `var:organization.<id>.logo[.<shape>]` in any image field (zone `image`, image blocks, slide `image`).
 * Pure: no I/O; colors are never inspected (the host's dark-background test picks `onDark`).
 * See docs/templates-and-variables.md and docs/design-resolution.md.
 */

/** The logo shapes an organization can provide, in picker order. */
export const LOGO_SHAPES = ["full", "stacked", "icon", "wordmark"] as const;
export type LogoShape = (typeof LOGO_SHAPES)[number];
/** Which value of a shape was drawn: `onLight` or `onDark` from a split shape, `default` for a single asset. */
export type LogoVariant = "onLight" | "onDark" | "default";

/** True for `full`, `stacked`, `icon` and `wordmark`. */
export function isLogoShape(value: unknown): value is LogoShape {
  return typeof value === "string" && (LOGO_SHAPES as readonly string[]).includes(value);
}

/** A parsed logo reference: whose logo (`organization` id, or the primary organization) and which shape, if named. */
export interface LogoReference {
  organization?: string;
  shape?: LogoShape;
}

/** A logo asset chosen by resolveLogo. */
export interface ResolvedLogo {
  /** The asset as authored (a string or an Asset object). */
  source: unknown;
  /** OPF path of the chosen value: `organization.logo`, `organization.1.logo.icon`, `organization.logo.full.onDark`. */
  path: string;
  /** The shape that was asked for (after a `design.logo` override); `path` shows the shape that supplied it. */
  shape: LogoShape;
  variant: LogoVariant;
  /** The canonical slide-scoped reference for this logo: `var:organization.logo`, `var:organization.beta.logo.icon`. */
  reference: string;
  /** The `design.logo` override that chose the organization or shape (`design.logo`, `slides.3.design.logo`), when one did. */
  designPath?: string;
}

export interface ResolveLogoOptions {
  /** The shape the consumer draws when no override names one; defaults to `full` (covers). Picture bullets ask for `icon`. */
  shape?: LogoShape;
  /** True on a dark background (host luminance test): `onDark` values first, then `onLight`. */
  onDark?: boolean;
  /** Index used in the `slides.N.design.logo` path of a slide-level override; defaults to 0. */
  slideIndex?: number;
  /** Resolve this reference (`var:organization.beta.logo.icon`, with or without `var:`) instead of the design.logo chain. */
  reference?: string;
}

const NAME_PATTERN = /^(?:var:)?(organization(?:\.[A-Za-z0-9_-]+){1,3})$/;

/**
 * Parse a built-in logo name (`organization.logo`, `organization.logo.icon`, `organization.beta.logo`,
 * `organization.beta.logo.wordmark`; `var:` optional). Returns null when the name is not a logo name at all, and
 * `{ error }` for a logo name with an unknown shape. A shape name wins over an organization whose id is `logo`.
 */
export function parseLogoName(name: string, presentation?: unknown): LogoReference | { error: string } | null {
  const match = NAME_PATTERN.exec(name);
  if (!match) return null;
  const parts = (match[1] as string).split(".");
  const shapes = LOGO_SHAPES.map((shape) => `'${shape}'`).join(", ");
  if (parts.length === 2) return parts[1] === "logo" ? {} : null;
  if (parts.length === 3) {
    if (parts[2] === "logo") return { organization: parts[1] as string };
    if (parts[1] !== "logo") return null;
    if (isLogoShape(parts[2])) return { shape: parts[2] };
    // `organization.logo.name` addresses an organization whose id is `logo`, when there is one.
    if (organizationIndex(presentation, "logo") >= 0) return null;
    return { error: `'${parts.join(".")}' is not a built-in variable: '${parts[2]}' is not a logo shape; the shapes are ${shapes}.` };
  }
  if (parts[2] !== "logo") return null;
  if (isLogoShape(parts[3])) return { organization: parts[1] as string, shape: parts[3] };
  return { error: `'${parts.join(".")}' is not a built-in variable: '${parts[3]}' is not a logo shape; the shapes are ${shapes}.` };
}

/** The canonical name of a logo reference: `organization.logo`, `organization.beta.logo.icon` (a full logo has no suffix). */
export function logoReferenceName(reference: LogoReference, shape: LogoShape | undefined = reference.shape): string {
  return `organization${reference.organization !== undefined ? `.${reference.organization}` : ""}.logo${shape && shape !== "full" ? `.${shape}` : ""}`;
}

function organizationIndex(presentation: unknown, id?: string): number {
  if (!isRecord(presentation)) return -1;
  const raw = presentation.organization;
  const list: unknown[] = Array.isArray(raw) ? raw : [raw];
  if (id !== undefined) return list.findIndex((entry) => isRecord(entry) && entry.id === id);
  const primary = list.findIndex((entry) => isRecord(entry) && entry.role === "primary");
  return primary >= 0 ? primary : list.findIndex((entry) => isRecord(entry));
}

const usable = (value: unknown): boolean => {
  const source = typeof value === "string" ? value : isRecord(value) ? value.src : undefined;
  return typeof source === "string" && source.trim().length > 0;
};
const isAsset = (value: unknown): boolean => typeof value === "string" || (isRecord(value) && "src" in value);

/** Shapes tried for a requested shape: itself, then `full`, then the first defined of `wordmark`, `stacked`, `icon`. */
function shapeChain(shape: LogoShape): LogoShape[] {
  const chain: LogoShape[] = [shape, "full", "wordmark", "stacked", "icon"];
  return chain.filter((entry, index) => chain.indexOf(entry) === index);
}

/** Pick one asset from an `Organization.logo` value for a shape and background. */
export function pickOrganizationLogo(logo: unknown, shape: LogoShape, onDark: boolean, root: string): { source: unknown; path: string; variant: LogoVariant } | null {
  if (logo === undefined || logo === null) return null;
  if (isAsset(logo)) return usable(logo) ? { source: logo, path: `${root}.logo`, variant: "default" } : null;
  if (!isRecord(logo)) return null;
  const tones: ("onLight" | "onDark")[] = onDark ? ["onDark", "onLight"] : ["onLight", "onDark"];
  for (const candidate of shapeChain(shape)) {
    const entry = logo[candidate];
    if (entry === undefined || entry === null) continue;
    if (isAsset(entry)) {
      if (usable(entry)) return { source: entry, path: `${root}.logo.${candidate}`, variant: "default" };
      continue;
    }
    if (!isRecord(entry)) continue;
    for (const tone of tones) if (usable(entry[tone])) return { source: entry[tone], path: `${root}.logo.${candidate}.${tone}`, variant: tone };
  }
  return null;
}

export type OrganizationLogoResult =
  | { ok: true; logo: ResolvedLogo }
  | { ok: false; reason: "unknown" | "missing"; message: string };

/**
 * Resolve a logo reference against the deck's organizations. `unknown`: the reference names no organization (an
 * unknown id); `missing`: the organization exists (or there is none to be primary) but has no usable logo.
 */
export function resolveOrganizationLogo(presentation: unknown, reference: LogoReference, options: { shape?: LogoShape; onDark?: boolean } = {}): OrganizationLogoResult {
  const shape = reference.shape ?? options.shape ?? "full";
  const name = logoReferenceName(reference, shape);
  const index = organizationIndex(presentation, reference.organization);
  if (index < 0) {
    if (reference.organization !== undefined) return { ok: false, reason: "unknown", message: `'${name}' names no organization with id '${reference.organization}'.` };
    return { ok: false, reason: "missing", message: `'${name}' has no value: the deck has no organization with a logo.` };
  }
  const deck = presentation as Record<string, unknown>;
  const root = Array.isArray(deck.organization) ? `organization.${index}` : "organization";
  const organization = (Array.isArray(deck.organization) ? deck.organization[index] : deck.organization) as Record<string, unknown>;
  const picked = pickOrganizationLogo(organization.logo, shape, options.onDark === true, root);
  if (!picked) return { ok: false, reason: "missing", message: `'${name}' has no value: ${root} has no logo.` };
  return { ok: true, logo: { ...picked, shape, reference: `var:${name}` } };
}

/**
 * Resolve the logo a slide should draw, the same way in every engine (OPF 0.18, RR-71). Logos live on the
 * organization (`Organization.logo`: one asset, or `{ full, stacked, icon, wordmark }`, each an asset or
 * `{ onLight, onDark }`). Which one:
 *
 * 1. `options.reference`, when given (`var:organization.beta.logo.icon`);
 * 2. else the slide's `design.logo`, then the deck's: `false` draws no logo, and a logo reference
 *    (`var:organization.beta.logo`, `var:organization.logo.wordmark`) picks the organization and, when it names one,
 *    the shape (a named shape wins over `options.shape`);
 * 3. else the primary organization (`role: 'primary'`, else the first).
 *
 * The shape is `options.shape` (default `full`) unless the reference names one; a missing shape falls back to `full`,
 * and `full` to the first defined of `wordmark`, `stacked`, `icon`. Within a shape, `onDark` is preferred on a dark
 * background and `onLight` otherwise, and a missing one uses the other. Returns null when no logo resolves (including
 * an override that names an organization without a logo: the override never falls back to another organization).
 */
export function resolveLogo(presentation: unknown, slide: unknown, options: ResolveLogoOptions = {}): ResolvedLogo | null {
  if (options.shape !== undefined && !isLogoShape(options.shape)) throw new RangeError("Logo shape must be full, stacked, icon or wordmark.");
  const onDark = options.onDark === true;
  const resolve = (reference: LogoReference, designPath?: string): ResolvedLogo | null => {
    const result = resolveOrganizationLogo(presentation, reference, { ...(options.shape ? { shape: options.shape } : {}), onDark });
    if (!result.ok) return null;
    return designPath ? { ...result.logo, designPath } : result.logo;
  };
  if (options.reference !== undefined) {
    const parsed = typeof options.reference === "string" ? parseLogoName(options.reference, presentation) : null;
    if (!parsed || "error" in parsed) throw new RangeError(`'${String(options.reference)}' is not a logo reference such as 'var:organization.logo.icon'.`);
    return resolve(parsed);
  }
  const slideIndex = Number.isSafeInteger(options.slideIndex) && (options.slideIndex as number) >= 0 ? (options.slideIndex as number) : 0;
  const levels: [unknown, string][] = [
    [isRecord(slide) && isRecord(slide.design) ? slide.design.logo : undefined, `slides.${slideIndex}.design.logo`],
    [isRecord(presentation) && isRecord(presentation.design) ? presentation.design.logo : undefined, "design.logo"],
  ];
  for (const [value, path] of levels) {
    if (value === false) return null;
    if (typeof value !== "string") continue;
    const parsed = parseLogoName(value, presentation);
    if (!parsed || "error" in parsed || !value.startsWith("var:")) continue;
    return resolve(parsed, path);
  }
  return resolve({});
}
