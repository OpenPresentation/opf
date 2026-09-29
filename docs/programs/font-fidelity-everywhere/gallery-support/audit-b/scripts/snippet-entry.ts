// Emits the exact gallery "OPF Config" snippets for dimension audit B, using pptx-gallery's own builders.
import * as R from "@/lib/reference-data";
import * as S from "@/lib/opf-snippets";
export function allSnippets() {
  const out: any[] = [];
  const add = (dimension: string, id: string, build: () => string, record: any) => {
    let snippet: any = null, error: string | null = null;
    try { snippet = JSON.parse(build()); } catch (e: any) { error = String(e?.message ?? e); }
    out.push({ dimension, id, snippet, error, record });
  };
  for (const p of R.colorPalettes) { const slug = R.getColorRouteSlug(p); add("color-schemes", slug, () => S.buildOpfSnippet("color-schemes", slug), p); }
  for (const f of R.fontSchemes) { const slug = R.getFontSchemeRouteSlug(f); add("font-schemes", slug, () => S.buildOpfSnippet("font-schemes", slug), f); }
  for (const f of R.legacyFontSchemes) { const slug = R.getFontSchemeRouteSlug(f); add("font-schemes-legacy", slug, () => S.buildOpfSnippet("font-schemes", slug), f); }
  for (const l of R.languageItems) add("languages", l.id, () => S.buildLanguageOpfSnippet(l as any), l);
  for (const t of R.themeItems) add("themes", R.getThemeRouteSlug(t), () => S.buildThemeOpfSnippet(t as any), t);
  for (const n of R.narrativeItems) add("narratives", (n as any).id, () => S.buildOpfSnippet("narratives", (n as any).id), n);
  for (const a of R.audienceItems) add("audiences", (a as any).id, () => S.buildAudienceOpfSnippet(a as any), a);
  for (const t of R.toneItems) add("tones", t.id, () => S.buildToneOpfSnippet(t), t);
  for (const s of R.socialPlatformItems) add("socials", s.id, () => S.buildSocialPlatformOpfSnippet(s), s);
  return out;
}
