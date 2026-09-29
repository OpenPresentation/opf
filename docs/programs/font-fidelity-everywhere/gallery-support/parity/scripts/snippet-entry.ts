// Emits the exact gallery "OPF Config" documents for every pptx.gallery dimension using the gallery's own
// builders (union of dimension-audit A and B inputs). Bundled by gen-snippets.mjs.
import * as R from "@/lib/reference-data";
import * as S from "@/lib/opf-snippets";
import backgrounds from "@/data/backgrounds.json";
import imageTreatments from "@/data/image-treatments.json";
import headersFooters from "@/data/headers-footers.json";
import blocks from "@/data/blocks.json";
import layouts from "@/data/layouts.json";
import charts from "@/data/charts.json";
import sampleImage from "@/data/layout-example-image.json";

const withAssets = (doc: any) => ({ ...doc, assets: { ...(doc.assets ?? {}), hero: { src: sampleImage, alt: "hero" }, cover: { src: sampleImage, alt: "cover" }, logo: { src: sampleImage, alt: "logo" } } });

export function allSnippets() {
  const out: any[] = [];
  const add = (dimension: string, id: string, build: () => any, record: any, variant = "published") => {
    let snippet: any = null, error: string | null = null;
    try { const v = build(); snippet = typeof v === "string" ? JSON.parse(v) : v; } catch (e: any) { error = String(e?.message ?? e); }
    out.push({ dimension, id, variant, snippet, error, record: { id: record?.id ?? record?.slug ?? id, name: record?.name ?? record?.label ?? id } });
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
  for (const item of (backgrounds as any).items) {
    add("backgrounds", item.slug, () => S.buildOpfSnippet("backgrounds" as any, item.slug), item);
    add("backgrounds", item.slug, () => withAssets(JSON.parse(S.buildOpfSnippet("backgrounds" as any, item.slug))), item, "withAssets");
  }
  for (const item of (imageTreatments as any).items) {
    add("image-treatments", item.slug, () => S.buildImageTreatmentOpfSnippet(item), item);
    add("image-treatments", item.slug, () => withAssets(JSON.parse(S.buildImageTreatmentOpfSnippet(item))), item, "withAssets");
  }
  for (const item of (headersFooters as any).items) {
    add("headers-footers", item.slug, () => S.buildHeaderFooterOpfSnippet(item), item);
    add("headers-footers", item.slug, () => withAssets(JSON.parse(S.buildHeaderFooterOpfSnippet(item))), item, "withAssets");
  }
  for (const item of (blocks as any).items) add("blocks", item.slug, () => S.buildContentBlockOpfObject(item), item);
  for (const item of (layouts as any).items) add("layouts", item.id, () => S.buildOpfSnippet("layouts", item.id), item);
  for (const item of (charts as any).items) add("charts", item.id ?? item.slug, () => S.buildChartOpfSnippet(item), item);
  return out;
}
