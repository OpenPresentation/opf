// Hex resolution for OPF ColorRef / TextRun.color export. Mirrors opf validator
// semantics (packages/javascript/src/validator.ts) until core exports resolveColorRef().

const schemeSlots = new Set([
  "accent1", "accent2", "accent3", "accent4", "accent5", "accent6",
  "dark1", "dark2", "light1", "light2", "hyperlink", "followedHyperlink",
]);

const variableIdPattern = /^[a-z][a-z0-9-]*$/;
const hexPattern = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function expandShorthand(hex) {
  const raw = hex.replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(raw)) return raw.split("").map((char) => char + char).join("");
  return raw;
}

/** Resolve document variables to hex strings for export. */
export function resolveVariableColors(variables) {
  if (!isPlainObject(variables)) return {};
  const resolved = {};
  for (const [id, entry] of Object.entries(variables)) {
    if (typeof entry === "string") resolved[id] = entry;
    else if (isPlainObject(entry) && entry.type === "color" && typeof entry.value === "string") {
      resolved[id] = entry.value;
    }
  }
  return resolved;
}

function schemeHex(scheme, slot) {
  const value = scheme?.[slot];
  return typeof value === "string" && value.startsWith("#") ? value : undefined;
}

function roleHex(name, ctx) {
  const scheme = ctx.colorScheme ?? {};
  switch (name) {
    case "background":
      return ctx.colors?.background ? `#${ctx.colors.background}` : schemeHex(scheme, "background");
    case "surface":
      return ctx.colors?.surface ? `#${ctx.colors.surface}` : schemeHex(scheme, "surface");
    case "text":
      return ctx.colors?.text ? `#${ctx.colors.text}` : schemeHex(scheme, "text");
    case "textSecondary":
      return ctx.colors?.mutedText ? `#${ctx.colors.mutedText}` : schemeHex(scheme, "textSecondary");
    case "primary":
      return schemeHex(scheme, "primary") ?? (ctx.colors?.accent ? `#${ctx.colors.accent}` : undefined);
    case "secondary":
      return schemeHex(scheme, "secondary") ?? schemeHex(scheme, "accent2");
    case "accent":
      return schemeHex(scheme, "accent") ?? (ctx.colors?.accent ? `#${ctx.colors.accent}` : undefined);
    default:
      return undefined;
  }
}

/**
 * Resolve a ColorRef or TextRun.color string to a #RRGGBB or #RRGGBBAA value.
 * Unrecognized values return undefined so callers can apply the theme fallback.
 */
export function resolveColorRefValue(entry, ctx) {
  if (entry === undefined || entry === null || entry === "") return undefined;
  if (typeof entry !== "string") return undefined;
  const trimmed = entry.trim();
  if (hexPattern.test(trimmed)) return `#${expandShorthand(trimmed).toUpperCase()}`;

  if (trimmed.startsWith("var:")) {
    const id = trimmed.slice("var:".length);
    if (!variableIdPattern.test(id)) return undefined;
    const variable = ctx.variables?.[id];
    if (typeof variable === "string" && hexPattern.test(variable)) {
      return `#${expandShorthand(variable).toUpperCase()}`;
    }
    return undefined;
  }

  const scheme = ctx.colorScheme ?? {};
  const fromScheme = schemeHex(scheme, trimmed);
  if (fromScheme) return `#${expandShorthand(fromScheme).toUpperCase()}`;

  if (schemeSlots.has(trimmed)) {
    const slot = schemeHex(scheme, trimmed);
    if (slot) return `#${expandShorthand(slot).toUpperCase()}`;
  }

  const fromRole = roleHex(trimmed, ctx);
  if (fromRole) return `#${expandShorthand(fromRole).toUpperCase()}`;

  return undefined;
}

export function colorContext(context, fallback) {
  return {
    colorScheme: context.colorScheme,
    colors: context.colors,
    variables: context.variables ?? {},
    fallback: fallback ?? context.colors?.text ?? "000000",
  };
}

/** PptxGenJS export color: six or eight uppercase hex digits without '#'. */
export function resolveExportColor(entry, ctx) {
  const fallback = ctx.fallback ?? ctx.colors?.text ?? "000000";
  const resolved = resolveColorRefValue(entry, ctx);
  const raw = expandShorthand((resolved ?? `#${fallback.replace(/^#/, "")}`).replace(/^#/, ""));
  if (/^[0-9A-F]{6}([0-9A-F]{2})?$/i.test(raw)) return raw.toUpperCase();
  return fallback.replace(/^#/, "").toUpperCase().slice(0, 6);
}

export function exportColorAlpha(entry, ctx) {
  const raw = resolveExportColor(entry, ctx);
  return raw.length === 8 ? (1 - parseInt(raw.slice(6), 16) / 255) * 100 : 0;
}
