// Export ColorRef through published core resolveColorRef(). Keep 8-digit hex
// alpha locally: normalizeHexColor() strips the AA byte, which PptxGenJS needs.

import { resolveColorRef as resolveCoreColorRef } from "@openpresentation/opf";

const UNRESOLVED = "";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function withHash(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function expandShorthand(hex) {
  const raw = hex.replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(raw)) return raw.split("").map((char) => char + char).join("");
  return raw;
}

/** Literal #RGB / #RRGGBB / #RRGGBBAA, including pptx-internal hex without '#'. */
function literalExportHex(entry) {
  if (typeof entry !== "string") return undefined;
  const hashed = withHash(entry.trim());
  if (!hashed) return undefined;
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hashed)) {
    return `#${expandShorthand(hashed).toUpperCase()}`;
  }
  return undefined;
}

/** Pass document variables through; core accepts hex shorthand or `{ type: "color", value }`. */
export function resolveVariableColors(variables) {
  return isPlainObject(variables) ? variables : {};
}

function coreRoles(ctx) {
  const colors = ctx.colors ?? {};
  return {
    background: withHash(colors.background),
    surface: withHash(colors.surface),
    text: withHash(colors.text),
    textSecondary: withHash(colors.mutedText),
    accent: withHash(colors.accent),
  };
}

function coreOptions(ctx, fallback = UNRESOLVED) {
  return {
    colorScheme: ctx.colorScheme ?? {},
    roles: coreRoles(ctx),
    variables: ctx.variables ?? {},
    fallback,
  };
}

/**
 * Resolve a ColorRef or TextRun.color string to a #RRGGBB or #RRGGBBAA value.
 * Unrecognized values return undefined so callers can apply the theme fallback.
 */
export function resolveColorRefValue(entry, ctx) {
  if (entry === undefined || entry === null || entry === "") return undefined;
  if (typeof entry !== "string") return undefined;
  const trimmed = entry.trim();
  const literal = literalExportHex(trimmed);
  if (literal) return literal;
  const resolved = resolveCoreColorRef(trimmed, coreOptions(ctx, UNRESOLVED));
  return resolved || undefined;
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
  const hex = resolved ?? withHash(fallback) ?? "#000000";
  const raw = expandShorthand(hex.replace(/^#/, ""));
  if (/^[0-9A-F]{6}([0-9A-F]{2})?$/i.test(raw)) return raw.toUpperCase();
  return fallback.replace(/^#/, "").toUpperCase().slice(0, 6);
}

export function exportColorAlpha(entry, ctx) {
  const raw = resolveExportColor(entry, ctx);
  return raw.length === 8 ? (1 - parseInt(raw.slice(6), 16) / 255) * 100 : 0;
}
