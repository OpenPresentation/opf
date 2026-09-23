/**
 * Last-resort font scheme id, shared with core pagination, opf-render and opf-pptx
 * (`DEFAULT_FONT_SCHEME` in `@openpresentation/opf`). It applies only when neither the
 * slide, the deck nor the resolved theme names a font scheme, so the editor measures and
 * freezes the same fonts that preview and PowerPoint export use.
 * Kept local until the published core exports the constant; a test asserts they agree.
 */
export const DEFAULT_FONT_SCHEME = "aptos";

/**
 * Resolve a font-scheme reference by the shared rule (`resolveFontSchemeReference` in
 * `@openpresentation/opf`). An id that matches no record yields one
 * `unresolved-font-scheme` diagnostic and uses the DEFAULT_FONT_SCHEME record as the base,
 * with sibling overrides on top. Kept local until a published core exports the function;
 * a test compares both whenever the installed core has it.
 */
export function resolveFontSchemeReference(reference, lookup, path = "design.fontScheme") {
  const overrides = reference && typeof reference === "object" && !Array.isArray(reference) ? reference : undefined;
  const id = typeof reference === "string" ? reference : typeof overrides?.id === "string" ? overrides.id : undefined;
  const found = id === undefined ? undefined : lookup(id);
  const base = found ?? lookup(DEFAULT_FONT_SCHEME) ?? {};
  const scheme = overrides ? { ...base, ...overrides } : { ...base };
  if (id === undefined || found !== undefined) return { scheme };
  return { scheme, diagnostic: { code: "unresolved-font-scheme", path, id, fallback: DEFAULT_FONT_SCHEME, message: `Font scheme '${id}' is not in the inline or bundled catalogs; using the default font scheme '${DEFAULT_FONT_SCHEME}'.` } };
}
