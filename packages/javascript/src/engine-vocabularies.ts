import { engineDefaultsSource, engineVocabulariesSource } from './generated/engine-data.js';

/**
 * Engine defaults and engine vocabularies (OPF 0.15, FA-20/21). Small tables of values every engine must know to
 * draw, compiled from spec/reference/engine-defaults.json and spec/reference/engine-vocabularies.json. None of
 * this is catalog data: a document never references these records, and no catalog lookup reaches them.
 */

type Rec = Readonly<Record<string, unknown>>;

/** The drawing fields of the theme engines use when a document names none, or its theme resolves nowhere. */
export const ENGINE_DEFAULT_THEME: Rec = engineDefaultsSource.theme;
/** The twelve slots engines use when neither the design nor the theme names a resolvable colour scheme. */
export const ENGINE_DEFAULT_COLOR_SCHEME: Rec = engineDefaultsSource.colorScheme;
/** The font pair engines use when neither the design nor the theme names a resolvable font scheme. */
export const ENGINE_DEFAULT_FONT_SCHEME: Rec = engineDefaultsSource.fontScheme;
/** Chart types in the order an engine offers them when it must pick one. */
export const ENGINE_DEFAULT_CHART_TYPES: readonly string[] = engineDefaultsSource.chartTypes;

/** Every `chart.type` value: an engine vocabulary, validated directly. */
export const CHART_TYPES: readonly string[] = engineVocabulariesSource.chartTypes;

/** How an engine links a handle on one social platform. */
export interface SocialPlatformVocabulary {
  readonly baseUrl?: string;
  /** URL of a person's profile, with `{handle}` standing for the handle. */
  readonly profileUrlPattern?: string;
  /** URL of an organization's page, when the platform has a separate one. */
  readonly companyUrlPattern?: string;
  /** Prefix a handle is written with (`@` on X). */
  readonly handlePrefix?: string;
}
/** The keys of `Organization.socials` and `Speaker.socials`: an engine vocabulary, validated directly. */
export const SOCIAL_PLATFORMS: Readonly<Record<string, SocialPlatformVocabulary>> = engineVocabulariesSource.socialPlatforms;

/** What engines know about one language tag. */
export interface LanguageVocabulary {
  /** BCP-47 tag, canonically cased. */
  readonly tag: string;
  /** ISO 15924 script. */
  readonly script: string;
  readonly direction: 'ltr' | 'rtl';
  /** Curated OOXML culture tag (`ja-JP` for `ja`). */
  readonly ooxmlLang: string;
  /** Default script fonts (major/minor) per target application. */
  readonly fonts: {
    readonly powerpoint: { readonly major: string; readonly minor: string };
    readonly google: { readonly major: string; readonly minor: string };
  };
}
/** The language tags engines know the script, direction, OOXML tag and default script fonts of. */
export const LANGUAGES: readonly LanguageVocabulary[] = engineVocabulariesSource.languages as readonly LanguageVocabulary[];
