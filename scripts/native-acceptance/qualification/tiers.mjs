// NT-05a: read the qualification manifest's run tiers and per-application expectations (README.md, "Tiers" and "Targets").
// The runner (`pnpm native <target> --tier ...`) asks which decks and variants a tier runs and what an application is
// expected to make of each feature's object; both come from manifest.json, so a run compares against data, not prose.
import { fileId } from '../core/result/result.mjs';

export const TIERS = Object.freeze(['smoke', 'release', 'full']);
/** Outcomes a target may expect: the shared result vocabulary plus "n/a" (the object does not apply to that application). */
export const NOT_APPLICABLE = 'n/a';

const variantsOf = (deck) => (deck.variants ?? [{ name: 'default' }]).map((variant) => variant.name);

function tierOf(manifest, tier) {
  if (!TIERS.includes(tier)) throw new Error(`unknown tier "${tier}": use ${TIERS.join(', ')}`);
  const entry = manifest.tiers?.[tier];
  if (!entry) throw new Error(`the manifest defines no tier "${tier}"`);
  return entry;
}

/**
 * The corpus decks a tier runs, in manifest order for "all" and in the tier's order otherwise: [{ deck, variants }].
 * A tier's `variants` is the rule ("default" or "all"); a smoke entry's own `variants` list overrides it.
 */
export function decksForTier(manifest, tier) {
  const entry = tierOf(manifest, tier);
  const decks = new Map(manifest.decks.map((deck) => [deck.id, deck]));
  const pick = (deck, named) => {
    const all = variantsOf(deck);
    const wanted = named ?? (entry.variants === 'all' ? all : ['default']);
    for (const name of wanted) if (!all.includes(name)) throw new Error(`tier ${tier}: deck ${deck.id} has no variant "${name}"`);
    return { deck: deck.id, variants: [...wanted] };
  };
  if (entry.decks === 'all') return manifest.decks.map((deck) => pick(deck));
  return entry.decks.map((item) => {
    const deck = decks.get(item.deck);
    if (!deck) throw new Error(`tier ${tier}: no deck "${item.deck}" in the manifest`);
    return pick(deck, item.variants);
  });
}

/** The named sources a tier adds beyond the corpus (manifest.sources says what each is; the runner resolves them). */
export function sourcesForTier(manifest, tier) {
  return [...(tierOf(manifest, tier).sources ?? [])];
}

/**
 * What one application is expected to make of each feature's object, per deck, variant and slide:
 * [{ file, deck, variant, slide, feature, outcome, kind?, known?, note? }], sorted by file and slide.
 * `slide` is null when the feature names no slides (it covers every slide of that file). A feature without a
 * `targets` entry for the application records no expectation and yields nothing.
 */
export function expectationsFor(manifest, target) {
  const out = [];
  for (const feature of manifest.features) {
    const expected = feature.targets?.[target];
    if (!expected) continue;
    const variant = feature.variant ?? 'default';
    for (const slide of feature.slides ?? [null]) {
      out.push({ file: fileId(feature.deck, variant), deck: feature.deck, variant, slide, feature: feature.id, ...expected });
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file) || (a.slide ?? 0) - (b.slide ?? 0) || a.feature.localeCompare(b.feature));
}
