// Design-level options (RR-06): the settings the All-properties workspace used to be the only
// place to edit. Each is one validated JSON Patch applied as one undoable transaction, at the deck
// by default or on one slide with `slideIndex`, exactly like the dimension switches. Every
// function has a `prepare…` form that returns the patch without touching a session, and a
// session form that commits it with `meta.source: "design-option"`.
import { getValueAtPath, opfPathToJsonPointer } from "./index.js";
import { checkedDocument, designPatches, fail, same } from "./edit-helpers.js";
import { checkFormat } from "./checks.js";

/** The `design.logo` variant slots of a LogoSet, in schema order. */
export const LOGO_VARIANTS = Object.freeze([
  "default",
  "light",
  "dark",
  "stacked",
  "stackedLight",
  "stackedDark",
  "icon",
  "iconLight",
  "iconDark",
  "wordmark",
  "wordmarkLight",
  "wordmarkDark",
]);
export const HEADER_FOOTER_ZONES = Object.freeze(["left", "center", "right"]);
// Flag fields of a header/footer zone: false is stored as "absent" (so is a `date` of false).
const ZONE_FLAGS = ["logo", "slideNumber", "organization", "speaker", "socials", "section"];
export const ZONE_FIELDS = Object.freeze(["logo", "text", "image", "slideNumber", "slideNumberFormat", "date", "dateFormat", "organization", "speaker", "socials", "section"]);
/** Date tokens a `dateFormat` understands (English names, independent of the host locale). */
export const DATE_FORMAT_TOKENS = Object.freeze(["yyyy", "yy", "MMMM", "MMM", "MM", "M", "dd", "d", "EEEE", "EEE"]);
const ISO_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

// Friendly validation of one zone field before the schema sees it.
function checkZoneField(key, value) {
  const bad = (message) => fail("invalid-design-value", message, { field: key, value });
  if (ZONE_FLAGS.includes(key) && typeof value !== "boolean") throw bad(`${key} is true or false.`);
  if (key === "text" && typeof value !== "string") throw bad("Text is a string.");
  if (key === "image" && typeof value !== "string" && !isObject(value)) throw bad("An image is a source, an asset reference or an asset object.");
  if (key === "slideNumberFormat" && (typeof value !== "string" || !value.includes("{current}"))) throw bad("The slide number format must contain {current}, for example Page {current} of {total}.");
  if (key === "date" && typeof value !== "boolean" && typeof value !== "string") throw bad("A date is true (the current date) or a fixed date.");
  if (key === "dateFormat" && (typeof value !== "string" || !value.trim())) throw bad(`A date format uses tokens such as ${DATE_FORMAT_TOKENS.join(", ")}.`);
}

const ENUMS = Object.freeze({
  titleAlignment: ["left", "center", "right"],
  contentAlignment: ["left", "center", "right"],
  contentDirection: ["horizontal", "vertical"],
  chartPrimary: ["none", "top", "bottom", "left", "right"],
  listBullet: ["character", "image"],
  imageFit: ["cover", "contain", "stretch"],
});

/**
 * Descriptors for every design option, in the order a panel shows them. `type` is "enum", "boolean",
 * "font", "asset", "logo", "watermark" or "organization-logo"; `scopes` says whether
 * the option applies to the deck, one slide, or both.
 */
export const DESIGN_OPTIONS = Object.freeze([
  { id: "titleAlignment", label: "Title alignment", type: "enum", values: ENUMS.titleAlignment, scopes: ["deck", "slide"], path: "design.titleAlignment" },
  { id: "contentAlignment", label: "Content alignment", type: "enum", values: ENUMS.contentAlignment, scopes: ["deck", "slide"], path: "design.contentAlignment" },
  { id: "contentDirection", label: "Content direction", type: "enum", values: ENUMS.contentDirection, scopes: ["deck", "slide"], path: "design.contentDirection" },
  { id: "chartPrimary", label: "Primary chart position", type: "enum", values: ENUMS.chartPrimary, scopes: ["deck", "slide"], path: "design.chartPrimary" },
  { id: "listBullet", label: "List bullets", type: "enum", values: ENUMS.listBullet, scopes: ["deck", "slide"], path: "design.listBullet" },
  { id: "contentBox", label: "Content box", type: "boolean", scopes: ["deck", "slide"], path: "design.contentBox" },
  { id: "imageFit", label: "Image fit", type: "enum", values: ENUMS.imageFit, scopes: ["deck", "slide"], path: "design.imageFit" },
  { id: "accentFont", label: "Accent font", type: "font", scopes: ["deck", "slide"], path: "design.fontScheme.accent" },
  { id: "logo", label: "Logo", type: "logo", scopes: ["deck", "slide"], path: "design.logo" },
  { id: "organizationLogo", label: "Organization logo", type: "organization-logo", scopes: ["deck"], path: "organization.logo" },
  { id: "watermark", label: "Watermark", type: "watermark", scopes: ["deck", "slide"], path: "design.watermark" },
]);
const BY_ID = Object.fromEntries(DESIGN_OPTIONS.map((option) => [option.id, option]));

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function scopeOf(presentation, option, options) {
  const index = options.slideIndex;
  if (index === undefined) return { scope: "deck", base: [] };
  if (!BY_ID[option]?.scopes.includes("slide")) throw fail("invalid-scope", `${BY_ID[option]?.label ?? option} applies to the whole presentation, not one slide.`, { option });
  if (!Number.isInteger(index) || !presentation.slides?.[index]) throw fail("slide-index-out-of-range", "Choose an existing slide for this option.", { slideIndex: index });
  return { scope: "slide", base: ["slides", String(index)], slideIndex: index };
}

function ownDesign(presentation, base) {
  const design = getValueAtPath(presentation, base.length ? [...base, "design"] : ["design"]);
  return isObject(design) ? design : {};
}

function primaryOrganization(presentation) {
  const list = Array.isArray(presentation.organization) ? presentation.organization : presentation.organization ? [presentation.organization] : [];
  return list.find((entry) => entry?.role === "primary") ?? list[0];
}

function firstSpeaker(presentation) {
  const list = Array.isArray(presentation.speaker) ? presentation.speaker : presentation.speaker ? [presentation.speaker] : [];
  return list[0];
}

/** Whether a logo resolves for the slide: slide design, then deck design, then the primary organization. */
export function hasResolvableLogo(presentation, slideIndex) {
  return Boolean(presentation.slides?.[slideIndex]?.design?.logo ?? presentation.design?.logo ?? primaryOrganization(presentation)?.logo);
}

/**
 * Plain-language warnings for settings that need a logo the document does not have: a header or
 * footer zone with `logo: true`, or picture bullets. The renderers fall back to a glyph or report
 * unresolved content; the editor surfaces it before export.
 */
export function designWarnings(presentation, slideIndex = 0) {
  const slide = presentation.slides?.[slideIndex];
  const design = { ...presentation.design, ...slide?.design };
  const warnings = [];
  const hasLogo = hasResolvableLogo(presentation, slideIndex);
  for (const which of ["header", "footer"])
    for (const zone of HEADER_FOOTER_ZONES)
      if (!hasLogo && isObject(design[which]) && design[which][zone]?.logo === true)
        warnings.push({ code: "unresolved-logo", path: `design.${which}.${zone}.logo`, message: `The ${which} ${zone} zone shows the logo, but no logo is set. Add a logo or an organization logo.` });
  const organization = primaryOrganization(presentation);
  for (const which of ["header", "footer"])
    for (const zone of HEADER_FOOTER_ZONES) {
      const item = isObject(design[which]) ? design[which][zone] : undefined;
      if (item?.organization === true && !organization)
        warnings.push({ code: "unresolved-content", path: `design.${which}.${zone}.organization`, message: `The ${which} ${zone} zone shows the organization, but the presentation has none.` });
      if (item?.speaker === true && !firstSpeaker(presentation)?.name)
        warnings.push({ code: "unresolved-content", path: `design.${which}.${zone}.speaker`, message: `The ${which} ${zone} zone shows the speaker, but the presentation has no named speaker.` });
      if (item?.socials === true && !organization?.socials)
        warnings.push({ code: "unresolved-content", path: `design.${which}.${zone}.socials`, message: `The ${which} ${zone} zone shows social profiles, but the organization has none.` });
    }
  if (!hasLogo && design.listBullet === "image")
    warnings.push({ code: "unresolved-logo", path: "design.listBullet", message: "Picture bullets use the logo, but no logo is set, so lists draw the character bullet. Add a logo or an organization logo." });
  return warnings;
}

function shadowed(presentation, keys) {
  return (presentation.slides ?? []).flatMap((slide, index) => (keys.some((key) => slide?.design?.[key] !== undefined) ? [index] : []));
}

function finish(presentation, patches, extra) {
  const before = checkFormat(presentation);
  const next = checkedDocument(presentation, patches, before);
  const slideIndex = extra.slideIndex;
  return {
    ...extra,
    presentation: structuredClone(next),
    patches,
    changed: patches.length > 0,
    warnings: designWarnings(next, slideIndex ?? 0),
  };
}

// --- per-option value rules ---------------------------------------------------------------------

function mergedWatermark(existing, value) {
  if (value === null || value === false) return value;
  if (typeof value === "string") return value;
  if (!isObject(value)) throw fail("invalid-design-value", "A watermark is false, an image source, { src, opacity } or { text, opacity }.", { value });
  const base = typeof existing === "string" ? { src: existing } : isObject(existing) ? { ...existing } : {};
  const merged = { ...base };
  for (const [key, entry] of Object.entries(value)) {
    if (entry === null || entry === undefined) delete merged[key];
    else merged[key] = entry;
  }
  // FA-13: a watermark is an image (src) or a text stamp (text), never both: the field set last replaces the other.
  if (value.text !== undefined && value.text !== null && value.src === undefined) delete merged.src;
  else if (value.src !== undefined && value.src !== null && value.text === undefined) delete merged.text;
  if (merged.text !== undefined && (typeof merged.text !== "string" || !merged.text.trim())) throw fail("invalid-design-value", "Watermark text is a non-empty string.", { value });
  if (merged.opacity !== undefined && (typeof merged.opacity !== "number" || merged.opacity < 0 || merged.opacity > 1))
    throw fail("invalid-design-value", "Watermark opacity is a number from 0 to 1.", { value });
  if (merged.src === undefined && merged.text === undefined && Object.keys(merged).length) throw fail("invalid-design-value", "Choose the watermark image before setting its opacity (or give it text instead).", { value });
  if (Object.keys(merged).length === 1 && typeof merged.src === "string") return merged.src;
  if (!Object.keys(merged).length) return null;
  if (merged.opacity === undefined) throw fail("invalid-design-value", "Set an opacity from 0 to 1 for the watermark.", { value });
  return merged;
}

function fontSchemeWithAccent(presentation, base, family) {
  // The slide's own font scheme, else the deck's: an object form is kept with its overrides.
  const own = ownDesign(presentation, base).fontScheme;
  const inherited = base.length ? presentation.design?.fontScheme : undefined;
  const source = own !== undefined ? own : inherited;
  const object = typeof source === "string" ? { id: source } : isObject(source) ? structuredClone(source) : {};
  if (family === null) {
    delete object.accent;
  } else {
    if (typeof family !== "string" || !family.trim()) throw fail("invalid-design-value", "Accent font is a non-empty family name, or null to clear it.", { value: family });
    object.accent = family.trim();
  }
  const keys = Object.keys(object);
  if (!keys.length) return null;
  if (keys.length === 1 && keys[0] === "id") return object.id;
  return object;
}

function logoSetOf(existing) {
  if (existing === undefined) return {};
  if (typeof existing === "string" || (isObject(existing) && Object.hasOwn(existing, "src"))) return { default: existing };
  return isObject(existing) ? { ...existing } : {};
}
function collapseLogo(set) {
  const keys = Object.keys(set);
  if (!keys.length) return null;
  if (keys.length === 1 && keys[0] === "default") return set.default;
  return set;
}

// --- design option ----------------------------------------------------------------------------

/**
 * Compute the patch that sets one design option, without touching any session. `value === null`
 * removes the option at that scope so it is inherited again. The object-valued `watermark` merges the
 * fields you pass into the existing object; a `null` field removes it.
 * Options: `slideIndex` (one slide instead of the deck), `clearSlideOverrides` (deck scope: also
 * remove slide-level values that hide it) and `index` (organizationLogo with several
 * organizations).
 */
export function prepareDesignOption(presentation, option, value, options = {}) {
  const descriptor = BY_ID[option];
  if (!descriptor) throw fail("unknown-design-option", `Unknown design option: ${option}. Use one of ${DESIGN_OPTIONS.map((entry) => entry.id).join(", ")}.`, { option });
  if (!isObject(presentation)) throw fail("invalid-input", "Design options need an OPF document object.");
  if (value === undefined) throw fail("invalid-design-value", "Pass a value, or null to remove the option.", { option });
  const { scope, base, slideIndex } = scopeOf(presentation, option, options);
  let patches = [];
  let keys = [];

  if (descriptor.type === "organization-logo") {
    const organization = presentation.organization;
    const index = options.index ?? 0;
    const owner = Array.isArray(organization) ? organization[index] : organization;
    if (!isObject(owner)) throw fail("missing-owner", "Add an organization to the document before setting its logo.", { option });
    const path = Array.isArray(organization) ? ["organization", String(index), "logo"] : ["organization", "logo"];
    const present = Object.hasOwn(owner, "logo");
    if (value === null) patches = present ? [{ op: "remove", path: opfPathToJsonPointer(path) }] : [];
    else if (!present) patches = [{ op: "add", path: opfPathToJsonPointer(path), value: structuredClone(value) }];
    else if (!same(owner.logo, value)) patches = [{ op: "replace", path: opfPathToJsonPointer(path), value: structuredClone(value) }];
  } else {
    let entries;
    if (descriptor.type === "enum") {
      if (value !== null && !ENUMS[option].includes(value)) throw fail("invalid-design-value", `${descriptor.label} is one of ${ENUMS[option].join(", ")}.`, { option, value });
      entries = { [option]: value };
    } else if (descriptor.type === "boolean") {
      if (value !== null && typeof value !== "boolean") throw fail("invalid-design-value", `${descriptor.label} is true or false.`, { option, value });
      entries = { [option]: value };
    } else if (descriptor.type === "font") {
      entries = { fontScheme: fontSchemeWithAccent(presentation, base, value) };
    } else if (descriptor.type === "logo") {
      if (value !== null && typeof value !== "string" && !isObject(value)) throw fail("invalid-design-value", "A logo is an image source, an asset object or a set of logo variants.", { option });
      entries = { logo: value };
    } else {
      const existing = ownDesign(presentation, base).watermark;
      entries = { watermark: mergedWatermark(existing, value) };
    }
    keys = Object.keys(entries);
    patches = designPatches(presentation, base, entries);
  }

  let shadowedSlides = [];
  if (scope === "deck" && keys.length) {
    shadowedSlides = shadowed(presentation, keys);
    if (options.clearSlideOverrides) {
      for (const index of shadowedSlides)
        for (const key of keys)
          if (presentation.slides[index].design?.[key] !== undefined) patches.push({ op: "remove", path: opfPathToJsonPointer(["slides", String(index), "design", key]) });
      shadowedSlides = [];
    }
  }
  return finish(presentation, patches, { option, scope, ...(slideIndex !== undefined ? { slideIndex } : {}), shadowed: shadowedSlides });
}

function apply(editor, prepared, meta = {}) {
  const { presentation, patches, ...summary } = prepared;
  void presentation;
  if (!prepared.changed) return { ...summary, presentation: editor.presentation, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(patches, { ...meta, source: meta.source ?? "design-option", option: prepared.option, scope: prepared.scope });
  return { ...change, ...summary };
}
function checkEditor(editor) {
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function")
    throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
}

/** Set one design option as a single undoable transaction. See {@link prepareDesignOption}. */
export function setDesignOption(editor, option, value, options = {}) {
  checkEditor(editor);
  const { meta, ...rest } = options;
  return apply(editor, prepareDesignOption(editor.presentation, option, value, rest), meta);
}

/**
 * Read one design option for a panel: `{ value, scope, inherited }` where `scope` is "slide" when the
 * slide's own design sets it, "deck" when the deck does, and "default" when neither does.
 * `accentFont` reads the family name; `organizationLogo` reads the organization.
 */
export function getDesignOption(presentation, option, options = {}) {
  const descriptor = BY_ID[option];
  if (!descriptor) throw fail("unknown-design-option", `Unknown design option: ${option}.`, { option });
  if (descriptor.type === "organization-logo") {
    const organization = presentation.organization;
    const owner = Array.isArray(organization) ? organization[options.index ?? 0] : organization;
    return { value: owner?.logo, scope: owner?.logo === undefined ? "default" : "deck", inherited: false };
  }
  const key = descriptor.type === "font" ? "fontScheme" : option;
  const pick = (design) => {
    const value = design?.[key];
    return descriptor.type === "font" ? (isObject(value) ? value.accent : undefined) : value;
  };
  const slideValue = options.slideIndex === undefined ? undefined : pick(presentation.slides?.[options.slideIndex]?.design);
  if (slideValue !== undefined) return { value: slideValue, scope: "slide", inherited: false };
  const deckValue = pick(presentation.design);
  if (deckValue !== undefined) return { value: deckValue, scope: "deck", inherited: options.slideIndex !== undefined };
  return { value: undefined, scope: "default", inherited: false };
}

// --- logo variants ----------------------------------------------------------------------------

/**
 * Compute the patch that sets (a source, asset reference or Asset object) or clears (`null`) one logo
 * variant of `design.logo`. A single default logo stays a bare source; adding a second variant turns
 * it into a LogoSet, and clearing back to the default collapses it again.
 */
export function prepareLogoVariant(presentation, variant, source, options = {}) {
  if (!LOGO_VARIANTS.includes(variant)) throw fail("invalid-design-value", `Logo variant is one of ${LOGO_VARIANTS.join(", ")}.`, { variant });
  if (source !== null && typeof source !== "string" && !isObject(source)) throw fail("invalid-design-value", "A logo variant is an image source, an asset object, or null to clear it.", { variant });
  if (typeof source === "string" && !source.trim()) throw fail("invalid-design-value", "Enter an image source or asset reference, or clear the variant.", { variant });
  const { scope, base, slideIndex } = scopeOf(presentation, "logo", options);
  const set = logoSetOf(ownDesign(presentation, base).logo);
  if (source === null) delete set[variant];
  else set[variant] = typeof source === "string" ? source.trim() : source;
  const patches = designPatches(presentation, base, { logo: collapseLogo(set) });
  return finish(presentation, patches, { option: "logo", variant, scope, ...(slideIndex !== undefined ? { slideIndex } : {}), shadowed: [] });
}
/** Set or clear one logo variant as a single undoable transaction. */
export function setLogoVariant(editor, variant, source, options = {}) {
  checkEditor(editor);
  const { meta, ...rest } = options;
  return apply(editor, prepareLogoVariant(editor.presentation, variant, source, rest), meta);
}
/** The variants `design.logo` sets at a scope: `{ variant: source }`, a bare logo reported as `default`. */
export function readLogoVariants(presentation, options = {}) {
  const own = options.slideIndex === undefined ? presentation.design?.logo : presentation.slides?.[options.slideIndex]?.design?.logo;
  return logoSetOf(own);
}

// --- header and footer zones ------------------------------------------------------------------

/**
 * Compute the patch that edits one header or footer zone. `fields` merges into the zone (logo, text,
 * image, slideNumber, slideNumberFormat, date, dateFormat, organization, speaker, socials, section); `null`,
 * `false` for a flag, or an empty string removes a field. A zone left empty is removed, then an empty
 * header or footer, so a slide never carries `{}`. A slide's own header or footer replaces the deck's
 * whole one, so the first edit on a slide that has none of its own starts from a copy of the deck's
 * (the other zones stay); a slide emptied that way hides the furniture (`false`) instead of
 * inheriting it again. Setting a field on a suppressed (`false`) header replaces the suppression.
 * `logo: true` reports a warning when no logo resolves.
 */
export function prepareHeaderFooterZone(presentation, which, zone, fields, options = {}) {
  if (!["header", "footer"].includes(which)) throw fail("invalid-design-value", "Choose header or footer.", { which });
  if (!HEADER_FOOTER_ZONES.includes(zone)) throw fail("invalid-design-value", `Zone is one of ${HEADER_FOOTER_ZONES.join(", ")}.`, { zone });
  if (!isObject(fields)) throw fail("invalid-design-value", "Pass the zone fields to change.", { fields });
  const unknown = Object.keys(fields).filter((key) => !ZONE_FIELDS.includes(key));
  if (unknown.length) throw fail("invalid-design-value", `Unknown header/footer field: ${unknown[0]}.`, { fields });
  const { scope, base, slideIndex } = scopeOf(presentation, "logo", options);
  const own = ownDesign(presentation, base)[which];
  const inherited = base.length ? presentation.design?.[which] : undefined;
  const current = own !== undefined ? own : inherited;
  const container = isObject(current) ? structuredClone(current) : {};
  const item = isObject(container[zone]) ? container[zone] : {};
  for (const [key, entry] of Object.entries(fields)) {
    const removes = entry === null || entry === undefined || ((ZONE_FLAGS.includes(key) || key === "date") && entry === false) || entry === "";
    if (removes) delete item[key];
    else {
      checkZoneField(key, entry);
      item[key] = entry;
    }
  }
  // A fixed date with a format must be an ISO date (the schema's rule); say so before the generic error.
  if (typeof item.date === "string" && item.dateFormat && !ISO_DATE.test(item.date)) throw fail("invalid-design-value", "A fixed date with a date format must be written YYYY-MM-DD, for example 2026-10-01.", { field: "date", value: item.date });
  if (Object.keys(item).length) container[zone] = item;
  else delete container[zone];
  let next = Object.keys(container).length ? container : null;
  // Emptied: a deck value that would show through again is hidden explicitly; a suppressed header stays suppressed.
  if (next === null && (own === false || isObject(inherited))) next = false;
  const patches = designPatches(presentation, base, { [which]: next });
  return finish(presentation, patches, { option: which, zone, scope, ...(slideIndex !== undefined ? { slideIndex } : {}), shadowed: [] });
}
/** Edit one header or footer zone as a single undoable transaction. */
export function setHeaderFooterZone(editor, which, zone, fields, options = {}) {
  checkEditor(editor);
  const { meta, ...rest } = options;
  return apply(editor, prepareHeaderFooterZone(editor.presentation, which, zone, fields, rest), meta);
}
/**
 * One header or footer zone's fields as they apply at a scope: the slide's own header (or footer) when it
 * has one, else the deck's (`{}` when absent or suppressed). `headerFooterState` says which.
 */
export function readHeaderFooterZone(presentation, which, zone, options = {}) {
  const own = options.slideIndex === undefined ? undefined : presentation.slides?.[options.slideIndex]?.design?.[which];
  const effective = own !== undefined ? own : presentation.design?.[which];
  return isObject(effective) && isObject(effective[zone]) ? structuredClone(effective[zone]) : {};
}
/** `{ own, inherited, hidden }` for a header or footer at a scope: whether the scope sets it itself, shows the deck's, or hides it with `false`. */
export function headerFooterState(presentation, which, options = {}) {
  const own = options.slideIndex === undefined ? presentation.design?.[which] : presentation.slides?.[options.slideIndex]?.design?.[which];
  const inherited = options.slideIndex !== undefined && own === undefined && presentation.design?.[which] !== undefined;
  return { own: own !== undefined, inherited, hidden: (own !== undefined ? own : options.slideIndex !== undefined ? presentation.design?.[which] : undefined) === false };
}
