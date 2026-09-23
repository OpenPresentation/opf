/**
 * Last-resort font scheme id, shared with core pagination, opf-render and opf-pptx
 * (`DEFAULT_FONT_SCHEME` in `@openpresentation/opf`). It applies only when neither the
 * slide, the deck nor the resolved theme names a font scheme, so the editor measures and
 * freezes the same fonts that preview and PowerPoint export use.
 * Kept local until the published core exports the constant; a test asserts they agree.
 */
export const DEFAULT_FONT_SCHEME = "aptos";
