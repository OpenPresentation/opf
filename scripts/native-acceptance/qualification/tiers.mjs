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
 * The decks a tier runs: [{ deck, variants }]. A tier's `variants` is the rule ("default" or "all"); an entry's own
 * `variants` list overrides it. `decks: "all"` is the corpus: every deck of `decks` without a `group`, in manifest order;
 * a list names decks in the tier's order. Then the tier's `sources` that are deck groups (sourceDecks) add their decks:
 * a source named by a string adds every deck of its group, `{ source, decks: [{ deck, variants? }] }` only those.
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
  const named = (item) => {
    const deck = decks.get(item.deck);
    if (!deck) throw new Error(`tier ${tier}: no deck "${item.deck}" in the manifest`);
    return pick(deck, item.variants);
  };
  const out = entry.decks === 'all' ? manifest.decks.filter((deck) => !deck.group).map((deck) => pick(deck)) : entry.decks.map(named);
  for (const item of entry.sources ?? []) {
    const source = sourceName(item);
    const group = sourceDecks(manifest, source);
    if (group.length === 0) continue;
    const items = typeof item === 'string' ? group.map((deck) => ({ deck: deck.id })) : item.decks;
    for (const one of items) {
      if (!group.some((deck) => deck.id === one.deck)) throw new Error(`tier ${tier}: deck ${one.deck} is not a deck of the source ${source}`);
      if (!out.some((picked) => picked.deck === one.deck)) out.push(named(one));
    }
  }
  return out;
}

const sourceName = (item) => (typeof item === 'string' ? item : item.source);

/** The named sources a tier adds beyond the corpus (manifest.sources says what each is): their names. */
export function sourcesForTier(manifest, tier) {
  return (tierOf(manifest, tier).sources ?? []).map(sourceName);
}

/**
 * The manifest decks a named source stands for: the decks whose `group` is that name, in manifest order (gallery-layouts and
 * languages). Empty for a source the runner resolves otherwise (native-fragments) or not at all yet (examples).
 */
export function sourceDecks(manifest, source) {
  return manifest.decks.filter((deck) => deck.group === source);
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
