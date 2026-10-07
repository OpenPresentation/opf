import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

export type DesignOptionId =
  | "titleAlignment"
  | "contentAlignment"
  | "contentDirection"
  | "chartPrimary"
  | "listBullet"
  | "contentBox"
  | "accentFont"
  | "logo"
  | "organizationLogo"
  | "watermark"
  | "slideImage";
export interface DesignOptionDescriptor {
  id: DesignOptionId;
  label: string;
  type: "enum" | "boolean" | "font" | "logo" | "organization-logo" | "watermark" | "slide-image";
  /** Allowed values of an enum option. */
  values?: readonly string[];
  scopes: ("deck" | "slide")[];
  path: string;
}
export declare const DESIGN_OPTIONS: readonly DesignOptionDescriptor[];
export declare const LOGO_VARIANTS: readonly ["default", "light", "dark", "stacked", "stackedLight", "stackedDark", "icon", "iconLight", "iconDark", "wordmark", "wordmarkLight", "wordmarkDark"];
export type LogoVariant = (typeof LOGO_VARIANTS)[number];
/** Every field a header or footer zone can hold. */
export declare const ZONE_FIELDS: readonly ["logo", "text", "image", "slideNumber", "slideNumberFormat", "date", "dateFormat", "organization", "speaker", "socials", "section"];
/** Date format tokens (English names). */
export declare const DATE_FORMAT_TOKENS: readonly string[];
export declare const HEADER_FOOTER_ZONES: readonly ["left", "center", "right"];
export type HeaderFooterZone = (typeof HEADER_FOOTER_ZONES)[number];

export interface DesignOptionOptions {
  /** One slide instead of the deck. Not allowed for organizationLogo. */
  slideIndex?: number;
  /** Deck scope: also remove slide-level values that would hide the change. */
  clearSlideOverrides?: boolean;
  /** organizationLogo with several organizations (default 0). */
  index?: number;
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
  /** The logo variant or header/footer zone an edit named. */
  variant?: string;
  zone?: string;
  document: unknown;
  patches: JsonPatchOperation[];
  changed: boolean;
  /** Slides whose own design hides a deck-level change. */
  shadowed: number[];
  /** Settings that need a logo the document does not have. */
  warnings: DesignWarning[];
}
export interface DesignOptionChange extends Omit<EditorChange, "document" | "patches"> {
  document: unknown;
  patches: JsonPatchOperation[];
  option: string;
  scope: "deck" | "slide";
  slideIndex?: number;
  changed: boolean;
  shadowed: number[];
  warnings: DesignWarning[];
}

/** Compute the patch for one option. `null` removes it at that scope; object options (watermark, slideImage) merge the fields passed. */
export declare function prepareDesignOption(document: unknown, option: DesignOptionId, value: unknown, options?: DesignOptionOptions): PreparedDesignOption;
/** Set one option as a single undoable transaction. */
export declare function setDesignOption(editor: EditorSession, option: DesignOptionId, value: unknown, options?: DesignOptionOptions): DesignOptionChange;
/** `{ value, scope, inherited }`; scope is "slide", "deck" or "default". */
export declare function getDesignOption(document: unknown, option: DesignOptionId, options?: Pick<DesignOptionOptions, "slideIndex" | "index">): { value: unknown; scope: "slide" | "deck" | "default"; inherited: boolean };
export declare function prepareLogoVariant(document: unknown, variant: LogoVariant, source: string | Record<string, unknown> | null, options?: DesignOptionOptions): PreparedDesignOption;
/** Set or clear one `design.logo` variant; a lone default stays a bare source. */
export declare function setLogoVariant(editor: EditorSession, variant: LogoVariant, source: string | Record<string, unknown> | null, options?: DesignOptionOptions): DesignOptionChange;
/** The variants `design.logo` sets at a scope (a bare logo is reported as `default`). */
export declare function readLogoVariants(document: unknown, options?: Pick<DesignOptionOptions, "slideIndex">): Partial<Record<LogoVariant, unknown>>;
export interface HeaderFooterZoneFields {
  logo?: boolean | null;
  text?: string | null;
  image?: string | Record<string, unknown> | null;
  slideNumber?: boolean | null;
  slideNumberFormat?: string | null;
  date?: boolean | string | null;
  dateFormat?: string | null;
  organization?: boolean | null;
  /** The first speaker's name and title ("Ada Lovelace, CTO"). */
  speaker?: boolean | null;
  socials?: boolean | null;
  section?: boolean | null;
}
export declare function prepareHeaderFooterZone(document: unknown, which: "header" | "footer", zone: HeaderFooterZone, fields: HeaderFooterZoneFields, options?: DesignOptionOptions): PreparedDesignOption;
/** Merge fields into one header or footer zone; null, false (flags) or "" remove a field, an empty zone and header are removed. A slide's own header replaces the deck's whole one, so the first edit on a slide starts from a copy of the deck's and keeps its other zones. */
export declare function setHeaderFooterZone(editor: EditorSession, which: "header" | "footer", zone: HeaderFooterZone, fields: HeaderFooterZoneFields, options?: DesignOptionOptions): DesignOptionChange;
/** One zone's fields as they apply at a scope: the slide's own header or footer when it has one, else the deck's. */
export declare function readHeaderFooterZone(document: unknown, which: "header" | "footer", zone: HeaderFooterZone, options?: Pick<DesignOptionOptions, "slideIndex">): HeaderFooterZoneFields;
/** Whether the scope sets the header or footer itself (`own`), shows the deck's (`inherited`) or hides it with `false` (`hidden`). */
export declare function headerFooterState(document: unknown, which: "header" | "footer", options?: Pick<DesignOptionOptions, "slideIndex">): { own: boolean; inherited: boolean; hidden: boolean };
/** Whether a logo resolves for the slide: slide design, deck design, then the primary organization. */
export declare function hasResolvableLogo(document: unknown, slideIndex: number): boolean;
/** Settings that need content the document does not have: a logo (zones with `logo: true`, picture bullets), an organization or its social profiles, or a named speaker, for zones that show them. */
export declare function designWarnings(document: unknown, slideIndex?: number): DesignWarning[];
