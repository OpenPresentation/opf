import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

export type DesignOptionId =
  | "titleAlignment"
  | "contentAlignment"
  | "contentDirection"
  | "chartPrimary"
  | "listBullet"
  | "contentBox"
  | "imageFit"
  | "accentFont"
  | "logo"
  | "watermark";
export interface DesignOptionDescriptor {
  id: DesignOptionId;
  label: string;
  type: "enum" | "boolean" | "font" | "logo" | "watermark";
  /** Allowed values of an enum option. */
  values?: readonly string[];
  scopes: ("deck" | "slide")[];
  path: string;
}
export declare const DESIGN_OPTIONS: readonly DesignOptionDescriptor[];
/** The shapes an organization's logo can have (core's `LOGO_SHAPES`). */
export declare const LOGO_SHAPES: readonly ["full", "stacked", "icon", "wordmark"];
export type LogoShape = (typeof LOGO_SHAPES)[number];
/** The backgrounds a logo shape can be split by: one image for `both`, or one for `onLight` and one for `onDark` backgrounds. */
export declare const LOGO_BACKGROUNDS: readonly ["both", "onLight", "onDark"];
export type LogoBackground = (typeof LOGO_BACKGROUNDS)[number];
/** Every field a header or footer zone can hold. The logo is the zone's `image` (`var:organization.logo.icon`, see `insertZoneLogo`). */
export declare const ZONE_FIELDS: readonly ["text", "image", "date", "dateFormat", "socials"];
/** One entry of a zone's "Insert value" menu: the built-in variable `name`, its menu `label` and the `token` (`{{name}}`) that lands in the zone's `text`. */
export interface ZoneValue {
  readonly name: "slide.number" | "deck.slideCount" | "slide.section" | "organization.name" | "speaker.name" | "deck.name";
  readonly label: string;
  readonly token: string;
}
/** The values a zone's "Insert value" menu offers, in menu order: slide number, slide count, section, organization, speaker, deck name. */
export declare const ZONE_VALUES: readonly ZoneValue[];
/** Date format tokens (English names). */
export declare const DATE_FORMAT_TOKENS: readonly string[];
export declare const HEADER_FOOTER_ZONES: readonly ["left", "center", "right"];
export type HeaderFooterZone = (typeof HEADER_FOOTER_ZONES)[number];

export interface DesignOptionOptions {
  /** One slide instead of the deck. */
  slideIndex?: number;
  /** Deck scope: also remove slide-level values that would hide the change. */
  clearSlideOverrides?: boolean;
  /** Session change metadata (session forms only). */
  meta?: Record<string, unknown>;
}
export interface DesignWarning {
  code: "unresolved-logo" | "unresolved-content";
  path: string;
  message: string;
}
export interface PreparedDesignOption {
  option: string;
  scope: "deck" | "slide";
  slideIndex?: number;
  /** The header/footer zone an edit named. */
  zone?: string;
  presentation: unknown;
  patches: JsonPatchOperation[];
  changed: boolean;
  /** Slides whose own design hides a deck-level change. */
  shadowed: number[];
  /** Settings that need a logo or other content the document does not have. */
  warnings: DesignWarning[];
}
export interface DesignOptionChange extends Omit<EditorChange, "presentation" | "patches"> {
  presentation: unknown;
  patches: JsonPatchOperation[];
  option: string;
  scope: "deck" | "slide";
  slideIndex?: number;
  changed: boolean;
  shadowed: number[];
  warnings: DesignWarning[];
}

/** Compute the patch for one option. `null` removes it at that scope; the watermark object merges the fields passed. `imageFit` is the default fit of image blocks (cover, contain, stretch). */
export declare function prepareDesignOption(presentation: unknown, option: DesignOptionId, value: unknown, options?: DesignOptionOptions): PreparedDesignOption;
/** Set one option as a single undoable transaction. */
export declare function setDesignOption(editor: EditorSession, option: DesignOptionId, value: unknown, options?: DesignOptionOptions): DesignOptionChange;
/** `{ value, scope, inherited }`; scope is "slide", "deck" or "default". */
export declare function getDesignOption(presentation: unknown, option: DesignOptionId, options?: Pick<DesignOptionOptions, "slideIndex">): { value: unknown; scope: "slide" | "deck" | "default"; inherited: boolean };
/** A parsed `var:organization(.<id>)?.logo(.<shape>)?` reference: the organization's id (absent: the primary organization) and the shape when the reference names one. */
export interface LogoReference {
  organization?: string;
  shape?: LogoShape;
}
/** Parse a logo reference, or null for any other string. */
export declare function parseLogoReference(text: unknown): LogoReference | null;
/** Write a logo reference: `logoReference({ organization: "beta", shape: "icon" })` is `"var:organization.beta.logo.icon"`. */
export declare function logoReference(reference?: LogoReference): string;
/** What `design.logo` takes: `null` (unset: the primary organization's logo), `false` (no logo), a reference, or the organization and shape to write as one. */
export type LogoChoice = null | false | string | LogoReference;
export interface OrganizationEntry {
  index: number;
  /** What a `var:` reference addresses; an organization without one is only reachable as the primary organization. */
  id?: string;
  name?: string;
  /** The organization the unset logo and `var:organization.logo` mean (`role: "primary"`, else the first). */
  primary: boolean;
  hasLogo: boolean;
}
/** The deck's organizations (a single organization object is a list of one). */
export declare function listOrganizations(presentation: unknown): OrganizationEntry[];
export interface OrganizationLogoOptions extends Omit<DesignOptionOptions, "slideIndex" | "clearSlideOverrides"> {
  /** The organization's index or id (default: the primary organization). */
  organization?: number | string;
  /** `both` (default): one image for the shape. `onLight` or `onDark`: the image for that background only. Not with shape `all`. */
  background?: LogoBackground;
}
/** Compute the patch that sets or clears (`null`) the organization's logo: `all` is one image for every shape, otherwise one shape (for one background or both). */
export declare function prepareOrganizationLogo(presentation: unknown, shape: "all" | LogoShape, source: string | Record<string, unknown> | null, options?: Omit<OrganizationLogoOptions, "meta">): PreparedDesignOption & { shape: "all" | LogoShape; background: LogoBackground; organization: number };
/** Set or clear the organization's logo as a single undoable transaction. */
export declare function setOrganizationLogo(editor: EditorSession, shape: "all" | LogoShape, source: string | Record<string, unknown> | null, options?: OrganizationLogoOptions): DesignOptionChange;
export interface OrganizationLogoState {
  organization: OrganizationEntry;
  /** The bare image when one image serves every shape. */
  all?: unknown;
  /** The shapes the logo sets: `{ both }` for one image, or `{ onLight?, onDark? }`. */
  shapes: Partial<Record<LogoShape, { both?: unknown; onLight?: unknown; onDark?: unknown }>>;
}
/** An organization's logo as a panel shows it; null when the deck has no organization. */
export declare function readOrganizationLogo(presentation: unknown, options?: Pick<OrganizationLogoOptions, "organization">): OrganizationLogoState | null;
export interface LogoChoiceState {
  /** "primary" (unset), "none" (false), "reference" (a logo reference) or "custom" (any other value). */
  mode: "primary" | "none" | "reference" | "custom";
  organization?: string;
  shape?: LogoShape;
  value: unknown;
  scope: "slide" | "deck" | "default";
  inherited: boolean;
}
/** The `design.logo` choice at a scope. */
export declare function readLogoChoice(presentation: unknown, options?: Pick<DesignOptionOptions, "slideIndex">): LogoChoiceState;
export interface HeaderFooterZoneFields {
  text?: string | null;
  image?: string | Record<string, unknown> | null;
  date?: boolean | string | null;
  dateFormat?: string | null;
  socials?: boolean | null;
}
export declare function prepareHeaderFooterZone(presentation: unknown, which: "header" | "footer", zone: HeaderFooterZone, fields: HeaderFooterZoneFields, options?: DesignOptionOptions): PreparedDesignOption;
/** Merge fields into one header or footer zone; null, false (flags) or "" remove a field, an empty zone and header are removed. Generated values are `{{ }}` variables in `text` (`ZONE_VALUES`). A slide's own header replaces the deck's whole one, so the first edit on a slide starts from a copy of the deck's and keeps its other zones. */
export declare function setHeaderFooterZone(editor: EditorSession, which: "header" | "footer", zone: HeaderFooterZone, fields: HeaderFooterZoneFields, options?: DesignOptionOptions): DesignOptionChange;
export interface ZoneValueOptions extends DesignOptionOptions {
  /** UTF-16 offsets into the zone's text; a selection is replaced. Default: the end. */
  start?: number;
  end?: number;
  /** The text the offsets refer to, when it is not the document's yet (a text box with uncommitted typing). Default: the zone's text at the scope. */
  text?: string;
}
/** The patch that inserts a value's token (`ZONE_VALUES` name, for example `slide.number`) into a zone's `text`, at `start` and `end` (default: the end). */
export declare function prepareZoneValue(presentation: unknown, which: "header" | "footer", zone: HeaderFooterZone, name: ZoneValue["name"], options?: ZoneValueOptions): PreparedDesignOption;
/** Insert a value's token into one zone's `text` as a single undoable transaction. */
export declare function insertZoneValue(editor: EditorSession, which: "header" | "footer", zone: HeaderFooterZone, name: ZoneValue["name"], options?: ZoneValueOptions): DesignOptionChange;
export interface ZoneLogoOptions extends DesignOptionOptions {
  /** The shape to show (default `icon`). */
  shape?: LogoShape;
  /** The organization's id (default: the primary organization). */
  organization?: string;
}
/** The patch that makes a zone show an organization's logo: its `image` becomes `var:organization.logo.<shape>` (`var:organization.<id>.logo.<shape>` for a named organization). */
export declare function prepareZoneLogo(presentation: unknown, which: "header" | "footer", zone: HeaderFooterZone, options?: ZoneLogoOptions): PreparedDesignOption;
/** Make a zone show an organization's logo as a single undoable transaction. */
export declare function insertZoneLogo(editor: EditorSession, which: "header" | "footer", zone: HeaderFooterZone, options?: ZoneLogoOptions): DesignOptionChange;
/** One zone's fields as they apply at a scope: the slide's own header or footer when it has one, else the deck's. */
export declare function readHeaderFooterZone(presentation: unknown, which: "header" | "footer", zone: HeaderFooterZone, options?: Pick<DesignOptionOptions, "slideIndex">): HeaderFooterZoneFields;
/** Whether the scope sets the header or footer itself (`own`), shows the deck's (`inherited`) or hides it with `false` (`hidden`). */
export declare function headerFooterState(presentation: unknown, which: "header" | "footer", options?: Pick<DesignOptionOptions, "slideIndex">): { own: boolean; inherited: boolean; hidden: boolean };
/** Whether a logo resolves for the slide: its `design.logo`, then the deck's, then the primary organization's (`shape`: the shape asked for, default full). */
export declare function hasResolvableLogo(presentation: unknown, slideIndex: number, options?: { shape?: LogoShape }): boolean;
/** Settings that need content the document does not have: a logo (a zone image or `design.logo` that names a logo no organization has, picture bullets), the organization's social profiles, or a value a zone's `text` asks for (`{{organization.name}}` without an organization, `{{slide.section}}` on a slide without a section). */
export declare function designWarnings(presentation: unknown, slideIndex?: number): DesignWarning[];
