// Design-level options (RR-06): the settings the All-properties workspace used to be the only
// place to edit. Each is one validated JSON Patch applied as one undoable transaction, at the deck
// by default or on one slide with `slideIndex`, exactly like the dimension switches. Every
// function has a `prepare…` form that returns the patch without touching a session, and a
// session form that commits it with `meta.source: "design-option"`.
import { getValueAtPath, opfPathToJsonPointer } from "./index.js";
import { checkedDocument, designPatches, fail, same } from "./edit-helpers.js";
import { LOGO_SHAPES, listBuiltinVariables } from "@openpresentation/opf";
import { resolveLogo } from "@openpresentation/opf/composition";
import { checkFormat } from "./checks.js";

// RR-71 (OPF 0.18): logos live on the organization. `organization.logo` is one image for every shape, or up to four shapes
// (full, stacked, icon, wordmark), each one image or an { onLight, onDark } pair. They are placed with whole-field
// `var:organization(.<id>)?.logo(.<shape>)?` references: in a header or footer zone's `image`, and in `design.logo`, which
// picks the organization and shape that covers, sections and picture bullets draw (or `false` for none).
export { LOGO_SHAPES };
/** The backgrounds a logo shape can be split by: one image for both, or one for light and one for dark backgrounds. */
export const LOGO_BACKGROUNDS = Object.freeze(["both", "onLight", "onDark"]);
export const HEADER_FOOTER_ZONES = Object.freeze(["left", "center", "right"]);
// Flag fields of a header/footer zone: false is stored as "absent" (so is a `date` of false).
const ZONE_FLAGS = ["socials"];
export const ZONE_FIELDS = Object.freeze(["text", "image", "date", "dateFormat", "socials"]);
// FA-31, RR-71: generated values are `{{ }}` variables inside a zone's `text` and the logo is the zone's `image`. The keys 0.16 and 0.17 had for them are gone; say what to write instead.
const REMOVED_ZONE_FIELDS = Object.freeze({
  logo: "Use Insert logo (insertZoneLogo): the zone's image is var:organization.logo.icon.",
  organization: "Write {{organization.name}} in the text.",
  speaker: "Write {{speaker.name}} in the text.",
  section: "Write {{slide.section}} in the text.",
  slideNumber: "Write {{slide.number}} in the text.",
  slideNumberFormat: "Write {{slide.number}} and {{deck.slideCount}} in the text.",
});
/**
 * The values the "Insert value" menu of a header or footer zone offers, in menu order. `token` is what lands in the zone's `text`.
 * `{{slide.number}}`, `{{deck.slideCount}}` and `{{slide.section}}` vary per slide; the others come from the deck's own fields.
 */
export const ZONE_VALUES = Object.freeze(
  [
    { name: "slide.number", label: "Slide number" },
    { name: "deck.slideCount", label: "Slide count" },
    { name: "slide.section", label: "Section" },
    { name: "organization.name", label: "Organization" },
    { name: "speaker.name", label: "Speaker" },
    { name: "deck.name", label: "Deck name" },
  ].map((entry) => Object.freeze({ ...entry, token: `{{${entry.name}}}` })),
);
/** Date tokens a `dateFormat` understands (English names, independent of the host locale). */
export const DATE_FORMAT_TOKENS = Object.freeze(["yyyy", "yy", "MMMM", "MMM", "MM", "M", "dd", "d", "EEEE", "EEE"]);
const ISO_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

// Friendly validation of one zone field before the schema sees it.
function checkZoneField(key, value) {
  const bad = (message) => fail("invalid-design-value", message, { field: key, value });
  if (ZONE_FLAGS.includes(key) && typeof value !== "boolean") throw bad(`${key} is true or false.`);
  if (key === "text" && typeof value !== "string") throw bad("Text is a string.");
  if (key === "image" && typeof value !== "string" && !isObject(value)) throw bad("An image is a source, an asset reference or an asset object.");
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
 * "font", "logo" (`design.logo`: a logo reference or false) or "watermark"; `scopes` says whether
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

// --- logo references ----------------------------------------------------------------------------

const LOGO_REFERENCE = /^var:organization(?:\.([A-Za-z0-9_-]+))?\.logo(?:\.(full|stacked|icon|wordmark))?$/;
/**
 * Parse a logo reference (`var:organization.logo`, `var:organization.logo.icon`, `var:organization.beta.logo.wordmark`) into
 * `{ organization?, shape? }` (the organization id, and the shape when the reference names one), or null for anything else.
 */
export function parseLogoReference(text) {
  const match = typeof text === "string" ? LOGO_REFERENCE.exec(text) : null;
  if (!match) return null;
  return { ...(match[1] !== undefined ? { organization: match[1] } : {}), ...(match[2] !== undefined ? { shape: match[2] } : {}) };
}
/**
 * The `var:` reference for an organization's logo: `organization` is the organization's id (omit it for the primary
 * organization) and `shape` one of `LOGO_SHAPES` (omit it to leave the shape to where the logo is drawn).
 */
export function logoReference({ organization, shape } = {}) {
  if (organization !== undefined && !(typeof organization === "string" && /^[A-Za-z0-9_-]+$/.test(organization)))
    throw fail("invalid-design-value", "An organization is addressed by its id (letters, digits, - and _).", { organization });
  if (shape !== undefined && !LOGO_SHAPES.includes(shape)) throw fail("invalid-design-value", `Logo shape is one of ${LOGO_SHAPES.join(", ")}.`, { shape });
  return `var:organization${organization !== undefined ? `.${organization}` : ""}.logo${shape !== undefined ? `.${shape}` : ""}`;
}

/**
 * The deck's organizations as a panel lists them: `{ index, id, name, primary, hasLogo }`. `id` is what a `var:` reference
 * addresses (an organization without one is only reachable as the primary organization); `primary` marks the organization
 * the unset logo and `var:organization.logo` mean (`role: "primary"`, else the first).
 */
export function listOrganizations(presentation) {
  const raw = presentation?.organization;
  const entries = Array.isArray(raw) ? raw : isObject(raw) ? [raw] : [];
  const explicit = entries.findIndex((entry) => isObject(entry) && entry.role === "primary");
  const primary = explicit >= 0 ? explicit : entries.findIndex(isObject);
  return entries.flatMap((entry, index) =>
    isObject(entry)
      ? [{ index, ...(typeof entry.id === "string" ? { id: entry.id } : {}), ...(typeof entry.name === "string" ? { name: entry.name } : {}), primary: index === primary, hasLogo: entry.logo !== undefined }]
      : [],
  );
}

/** Whether a logo resolves for the slide: its `design.logo`, then the deck's, then the primary organization's (`shape`: the shape asked for, default full). */
export function hasResolvableLogo(presentation, slideIndex, { shape } = {}) {
  try {
    return resolveLogo(presentation, presentation.slides?.[slideIndex], { slideIndex, ...(shape ? { shape } : {}) }) !== null;
  } catch {
    return false;
  }
}

/** The variable names a zone's `text` uses (`{{name}}` and `{{name|format}}`); a token with a backslash before it is literal text. */
function zoneTextVariables(text) {
  const names = [];
  for (const match of text.matchAll(/(\\?)\{\{\s*([A-Za-z0-9_.-]+)\s*(?:\|[^{}]*)?\}\}/g)) if (!match[1]) names.push(match[2]);
  return names;
}

function logoResolves(presentation, slide, slideIndex, options) {
  try {
    return resolveLogo(presentation, slide, { slideIndex, ...options }) !== null;
  } catch {
    return false;
  }
}
function describeLogoReference(presentation, text) {
  const parsed = parseLogoReference(text);
  const organizations = listOrganizations(presentation);
  const owner = parsed?.organization !== undefined ? organizations.find((entry) => entry.id === parsed.organization) : organizations.find((entry) => entry.primary);
  const who = parsed?.organization !== undefined ? (owner?.name ?? `organization ${parsed.organization}`) : "the primary organization";
  return `the ${parsed?.shape ?? "full"} logo of ${who}`;
}

/**
 * Plain-language warnings for settings that need content the document does not have: a logo (a header or footer zone whose
 * `image` is a logo reference, `design.logo` naming an organization, picture bullets) that no organization provides, the
 * organization's social profiles, or a value a zone's `text` asks for with a variable (`{{organization.name}}` without an
 * organization, `{{slide.section}}` on a slide without a section).
 * The renderers fall back to a glyph or report unresolved content; the editor surfaces it before export.
 */
export function designWarnings(presentation, slideIndex = 0) {
  const slide = presentation.slides?.[slideIndex];
  const design = { ...presentation.design, ...slide?.design };
  const warnings = [];
  // RR-71: a zone's image that is a logo reference needs the organization to have that logo; an override that names an organization never falls back to another.
  for (const which of ["header", "footer"])
    for (const zone of HEADER_FOOTER_ZONES) {
      const image = isObject(design[which]) ? design[which][zone]?.image : undefined;
      if (parseLogoReference(image) && !logoResolves(presentation, slide, slideIndex, { reference: image }))
        warnings.push({ code: "unresolved-logo", path: `design.${which}.${zone}.image`, message: `The ${which} ${zone} zone shows ${describeLogoReference(presentation, image)}, but it has no logo. Add the organization's logo.` });
    }
  if (typeof design.logo === "string" && !logoResolves(presentation, slide, slideIndex, {}))
    warnings.push({ code: "unresolved-logo", path: slide?.design?.logo !== undefined ? `slides.${slideIndex}.design.logo` : "design.logo", message: `The logo setting points at ${describeLogoReference(presentation, design.logo)}, but it has no logo, so covers and sections draw none. Add the organization's logo.` });
  const organization = primaryOrganization(presentation);
  let builtins;
  for (const which of ["header", "footer"])
    for (const zone of HEADER_FOOTER_ZONES) {
      const item = isObject(design[which]) ? design[which][zone] : undefined;
      if (item?.socials === true && !organization?.socials)
        warnings.push({ code: "unresolved-content", path: `design.${which}.${zone}.socials`, message: `The ${which} ${zone} zone shows social profiles, but the organization has none.` });
      // FA-31: a value the zone's text asks for and the document cannot give (the core validator reports the same as variable-builtin-missing).
      const path = `design.${which}.${zone}.text`;
      for (const name of new Set(typeof item?.text === "string" ? zoneTextVariables(item.text) : [])) {
        if (name === "slide.section") {
          if (!(typeof slide?.section === "string" && slide.section !== ""))
            warnings.push({ code: "unresolved-content", path, message: `The ${which} ${zone} zone shows {{slide.section}}, but this slide has no section.` });
          continue;
        }
        builtins ??= listBuiltinVariables(presentation);
        const entry = builtins.find((candidate) => candidate.name === name);
        if (entry?.scope === "deck" && !entry.available)
          warnings.push({ code: "unresolved-content", path, message: `The ${which} ${zone} zone shows {{${name}}}, but the presentation has no value for it.` });
      }
    }
  if (design.listBullet === "image" && !logoResolves(presentation, slide, slideIndex, { shape: "icon" }))
    warnings.push({ code: "unresolved-logo", path: "design.listBullet", message: "Picture bullets use the organization's icon logo, but no logo resolves, so lists draw the character bullet. Add an organization logo." });
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

// --- design option ----------------------------------------------------------------------------

/**
 * The value `design.logo` takes for a choice: `null` (unset), `false`, a `var:` logo reference, or `{ organization?, shape? }`
 * (an organization id and shape, written as the reference). A reference to an organization the deck does not have is refused.
 */
function checkedLogoChoice(presentation, value) {
  if (value === null || value === false) return value;
  const reference = isObject(value) ? logoReference(value) : value;
  const parsed = parseLogoReference(reference);
  if (!parsed) throw fail("invalid-design-value", "The logo is null (the primary organization's), false (none) or a reference such as var:organization.logo.icon or var:organization.beta.logo.", { option: "logo", value });
  if (parsed.organization !== undefined && !listOrganizations(presentation).some((entry) => entry.id === parsed.organization))
    throw fail("unknown-organization", `The presentation has no organization with the id '${parsed.organization}'.`, { organization: parsed.organization });
  return reference;
}

/**
 * Compute the patch that sets one design option, without touching any session. `value === null`
 * removes the option at that scope so it is inherited again. The object-valued `watermark` merges the
 * fields you pass into the existing object; a `null` field removes it.
 * Options: `slideIndex` (one slide instead of the deck) and `clearSlideOverrides` (deck scope: also
 * remove slide-level values that hide it). The `logo` option is `design.logo`: `null` (the primary organization's logo),
 * `false` (no logo), a reference such as `"var:organization.beta.logo.icon"`, or `{ organization?, shape? }` for one.
 */
export function prepareDesignOption(presentation, option, value, options = {}) {
  const descriptor = BY_ID[option];
  if (!descriptor) throw fail("unknown-design-option", `Unknown design option: ${option}. Use one of ${DESIGN_OPTIONS.map((entry) => entry.id).join(", ")}.`, { option });
  if (!isObject(presentation)) throw fail("invalid-input", "Design options need an OPF document object.");
  if (value === undefined) throw fail("invalid-design-value", "Pass a value, or null to remove the option.", { option });
  const { scope, base, slideIndex } = scopeOf(presentation, option, options);
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
    entries = { logo: checkedLogoChoice(presentation, value) };
  } else {
    const existing = ownDesign(presentation, base).watermark;
    entries = { watermark: mergedWatermark(existing, value) };
  }
  const keys = Object.keys(entries);
  const patches = designPatches(presentation, base, entries);

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
 * `accentFont` reads the family name; `logo` reads `design.logo` (a reference, or false).
 */
export function getDesignOption(presentation, option, options = {}) {
  const descriptor = BY_ID[option];
  if (!descriptor) throw fail("unknown-design-option", `Unknown design option: ${option}.`, { option });
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

// --- organization logo ------------------------------------------------------------------------

const isAsset = (value) => (typeof value === "string" && value.trim() !== "") || (isObject(value) && typeof value.src === "string");
const isToneSplit = (value) => isObject(value) && !Object.hasOwn(value, "src");

/** The organization an edit or a read addresses: its index, or its id; omitted, the primary organization. Returns the list entry. */
function organizationTarget(presentation, organization, option = "organization") {
  const list = listOrganizations(presentation);
  if (!list.length) throw fail("missing-owner", "Add an organization to the document before setting its logo.", { option });
  if (organization === undefined || organization === null) return list.find((entry) => entry.primary) ?? list[0];
  const found = typeof organization === "number" ? list.find((entry) => entry.index === organization) : list.find((entry) => entry.id === organization);
  if (!found) throw fail("unknown-organization", `The presentation has no organization ${typeof organization === "number" ? `at index ${organization}` : `with the id '${organization}'`}.`, { organization });
  return found;
}

/** A shape's value when it is edited for one background (or both); null clears. */
function editedShape(current, background, source) {
  if (background === "both") return source === null ? undefined : source;
  // A plain image is both backgrounds: editing one background keeps the other as it was.
  const tones = isAsset(current) ? { onLight: current, onDark: current } : isToneSplit(current) ? { ...current } : {};
  if (source === null) delete tones[background];
  else tones[background] = source;
  return Object.keys(tones).length ? tones : undefined;
}

/**
 * Compute the patch that sets (an image source, asset reference or Asset object) or clears (`null`) the organization's logo.
 * `shape` is `"all"` (one image for every shape: `organization.logo` becomes that image) or one of `LOGO_SHAPES`. `options.background`
 * is `"both"` (default: one image for the shape), `"onLight"` or `"onDark"` (the image for light or dark backgrounds only; the
 * other keeps what the shape had). A bare logo is the full logo for every shape, so setting one shape keeps it as `full`; a lone
 * plain `full` collapses back to the bare image. `options.organization` is the organization's index or id (default: the primary one).
 */
export function prepareOrganizationLogo(presentation, shape, source, options = {}) {
  if (!isObject(presentation)) throw fail("invalid-input", "Organization logos need an OPF document object.");
  if (shape !== "all" && !LOGO_SHAPES.includes(shape)) throw fail("invalid-design-value", `Logo shape is all or one of ${LOGO_SHAPES.join(", ")}.`, { shape });
  const background = options.background ?? "both";
  if (!LOGO_BACKGROUNDS.includes(background)) throw fail("invalid-design-value", `Logo background is one of ${LOGO_BACKGROUNDS.join(", ")}.`, { background });
  if (shape === "all" && background !== "both") throw fail("invalid-design-value", "One image for every shape has no light or dark variant. Choose a shape to set one.", { shape, background });
  if (source !== null && !isAsset(source)) throw fail("invalid-design-value", "A logo is an image source, an asset reference, an Asset object, or null to clear it.", { shape });
  const clean = typeof source === "string" ? source.trim() : source;
  const target = organizationTarget(presentation, options.organization, "organizationLogo");
  const owner = Array.isArray(presentation.organization) ? presentation.organization[target.index] : presentation.organization;
  const existing = owner.logo;
  let logo;
  if (shape === "all") logo = clean === null ? undefined : clean;
  else {
    const shapes = existing === undefined ? {} : isAsset(existing) ? { full: existing } : structuredClone(existing);
    const next = editedShape(shapes[shape], background, clean);
    if (next === undefined) delete shapes[shape];
    else shapes[shape] = next;
    const keys = Object.keys(shapes);
    logo = !keys.length ? undefined : keys.length === 1 && keys[0] === "full" && isAsset(shapes.full) ? shapes.full : shapes;
  }
  const path = opfPathToJsonPointer(Array.isArray(presentation.organization) ? ["organization", String(target.index), "logo"] : ["organization", "logo"]);
  const present = Object.hasOwn(owner, "logo");
  let patches = [];
  if (logo === undefined) patches = present ? [{ op: "remove", path }] : [];
  else if (!present) patches = [{ op: "add", path, value: structuredClone(logo) }];
  else if (!same(existing, logo)) patches = [{ op: "replace", path, value: structuredClone(logo) }];
  return finish(presentation, patches, { option: "organizationLogo", shape, background, organization: target.index, scope: "deck", shadowed: [] });
}
/** Set or clear the organization's logo (see {@link prepareOrganizationLogo}) as a single undoable transaction. */
export function setOrganizationLogo(editor, shape, source, options = {}) {
  checkEditor(editor);
  const { meta, ...rest } = options;
  return apply(editor, prepareOrganizationLogo(editor.presentation, shape, source, rest), meta);
}
/**
 * An organization's logo as a panel shows it: `{ organization, all, shapes }`. `organization` is its list entry (`listOrganizations`),
 * `all` the bare image when one image serves every shape, and `shapes` the shapes the logo sets, each `{ both }` (one image) or
 * `{ onLight?, onDark? }`. `null` when the deck has no organization.
 */
export function readOrganizationLogo(presentation, options = {}) {
  if (!listOrganizations(presentation).length) return null;
  const target = organizationTarget(presentation, options.organization);
  const owner = Array.isArray(presentation.organization) ? presentation.organization[target.index] : presentation.organization;
  const logo = owner.logo;
  const shapes = {};
  if (isToneSplit(logo))
    for (const shape of LOGO_SHAPES) {
      const value = logo[shape];
      if (isAsset(value)) shapes[shape] = { both: value };
      else if (isObject(value)) shapes[shape] = { ...(value.onLight !== undefined ? { onLight: value.onLight } : {}), ...(value.onDark !== undefined ? { onDark: value.onDark } : {}) };
    }
  return { organization: target, ...(isAsset(logo) ? { all: logo } : {}), shapes };
}

/**
 * The `design.logo` choice at a scope as a panel shows it: `{ mode, organization?, shape?, value, scope, inherited }`. `mode` is
 * "primary" (unset), "none" (`false`), "reference" (a `var:` reference to an organization and/or shape) or "custom" (any other value,
 * for example one left over from an older document). `organization` is the id the reference names (absent for the primary one).
 */
export function readLogoChoice(presentation, options = {}) {
  const option = getDesignOption(presentation, "logo", options);
  const { value } = option;
  if (value === undefined) return { mode: "primary", ...option };
  if (value === false) return { mode: "none", ...option };
  const parsed = parseLogoReference(value);
  return parsed ? { mode: "reference", ...parsed, ...option } : { mode: "custom", ...option };
}

// --- header and footer zones ------------------------------------------------------------------

/**
 * Compute the patch that edits one header or footer zone. `fields` merges into the zone (text,
 * image, date, dateFormat, socials); `null`, `false` for a flag, or an empty string removes a field.
 * Generated values (slide number, slide count, section, organization, speaker, deck name) are `{{ }}`
 * variables in `text` (`ZONE_VALUES`, `insertZoneValue`); the logo is the zone's `image`, a `var:organization.logo.icon`
 * reference (`insertZoneLogo`). A zone left empty is removed, then an empty
 * header or footer, so a slide never carries `{}`. A slide's own header or footer replaces the deck's
 * whole one, so the first edit on a slide that has none of its own starts from a copy of the deck's
 * (the other zones stay); a slide emptied that way hides the furniture (`false`) instead of
 * inheriting it again. Setting a field on a suppressed (`false`) header replaces the suppression.
 * An `image` that is a logo reference reports a warning when the organization has no logo.
 */
export function prepareHeaderFooterZone(presentation, which, zone, fields, options = {}) {
  if (!["header", "footer"].includes(which)) throw fail("invalid-design-value", "Choose header or footer.", { which });
  if (!HEADER_FOOTER_ZONES.includes(zone)) throw fail("invalid-design-value", `Zone is one of ${HEADER_FOOTER_ZONES.join(", ")}.`, { zone });
  if (!isObject(fields)) throw fail("invalid-design-value", "Pass the zone fields to change.", { fields });
  const unknown = Object.keys(fields).filter((key) => !ZONE_FIELDS.includes(key));
  if (unknown.length) throw fail("invalid-design-value", `Unknown header/footer field: ${unknown[0]}.${Object.hasOwn(REMOVED_ZONE_FIELDS, unknown[0]) ? ` ${REMOVED_ZONE_FIELDS[unknown[0]]}` : ""}`, { fields });
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
 * Compute the patch that inserts a value's token (`ZONE_VALUES`, for example `slide.number` for `{{slide.number}}`) into a zone's
 * `text` at UTF-16 offsets `start` and `end` (a selection is replaced; default: the end of the text). The text is the one the scope
 * shows (the slide's own zone, else the deck's), or `options.text` when a panel holds edits it has not committed yet.
 */
export function prepareZoneValue(presentation, which, zone, name, options = {}) {
  const value = ZONE_VALUES.find((entry) => entry.name === name);
  if (!value) throw fail("invalid-design-value", `Insert one of ${ZONE_VALUES.map((entry) => entry.name).join(", ")}.`, { value: name });
  const { start, end, text: typed, ...rest } = options;
  if (typed !== undefined && typeof typed !== "string") throw fail("invalid-design-value", "Text is a string.", { text: typed });
  const current = typed ?? readHeaderFooterZone(presentation, which, zone, rest).text;
  const text = typeof current === "string" ? current : "";
  const from = start === undefined ? text.length : start;
  const to = end === undefined ? from : end;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to > text.length) throw fail("invalid-selection", "The selection is outside the text.", { start: from, end: to });
  return prepareHeaderFooterZone(presentation, which, zone, { text: `${text.slice(0, from)}${value.token}${text.slice(to)}` }, rest);
}
/**
 * Compute the patch that makes a zone show an organization's logo: its `image` becomes the reference
 * `var:organization.logo.<shape>` (or `var:organization.<id>.logo.<shape>` with `options.organization`, an organization id).
 * `options.shape` is one of `LOGO_SHAPES` (default `icon`, the mark that fits a zone); `full` is written as plain `var:organization.logo`.
 * It replaces an image the zone had. Which image is drawn (light or dark artwork) follows each slide's background.
 */
export function prepareZoneLogo(presentation, which, zone, options = {}) {
  const { shape = "icon", organization, ...rest } = options;
  if (!LOGO_SHAPES.includes(shape)) throw fail("invalid-design-value", `Logo shape is one of ${LOGO_SHAPES.join(", ")}.`, { shape });
  if (organization !== undefined && !listOrganizations(presentation).some((entry) => entry.id === organization))
    throw fail("unknown-organization", `The presentation has no organization with the id '${organization}'.`, { organization });
  const reference = logoReference({ ...(organization !== undefined ? { organization } : {}), ...(shape !== "full" ? { shape } : {}) });
  return prepareHeaderFooterZone(presentation, which, zone, { image: reference }, rest);
}
/** Make a zone show an organization's logo as a single undoable transaction. See {@link prepareZoneLogo}. */
export function insertZoneLogo(editor, which, zone, options = {}) {
  checkEditor(editor);
  const { meta, ...rest } = options;
  return apply(editor, prepareZoneLogo(editor.presentation, which, zone, rest), meta);
}
/** Insert a value's token into one zone's `text` as a single undoable transaction. */
export function insertZoneValue(editor, which, zone, name, options = {}) {
  checkEditor(editor);
  const { meta, ...rest } = options;
  return apply(editor, prepareZoneValue(editor.presentation, which, zone, name, rest), meta);
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
