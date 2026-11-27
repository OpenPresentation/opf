// NT-12: what the native-test corpus covers (the report) and the four rules that keep it honest (the check).
//   (a) known places   every known record with places has one that the release tier runs;
//   (b) schema         every schema location is on a corpus slide or allowlisted with a reason;
//   (c) earned place   every corpus deck shows a unit no other corpus deck shows, or a known record or a feature names it;
//   (d) time budget    each tier's modeled application time is within its budget.
// The lists the rules read are beside this file (pending-known-places.json, dominated-decks.json, budgets.json); the
// schema allowlist is scripts/format-coverage-allowlist.json, shared with check:format-coverage.
import path from 'node:path';
import { sameExport } from '../classify/classify.mjs';
import { filesForTier, HERE, kindOf, readJson, ROOT, TIERS, tierSize, unitsOfFile } from './units.mjs';

export const PENDING_FILE = path.join(HERE, 'pending-known-places.json');
export const DOMINATED_FILE = path.join(HERE, 'dominated-decks.json');
export const BUDGETS_FILE = path.join(HERE, 'budgets.json');
export const ALLOWLIST_FILE = path.join(ROOT, 'scripts/format-coverage-allowlist.json');

/** Units that say what a deck contains; features and known records name a deck rather than add content to it. */
export const CONTENT_KINDS = Object.freeze(['schema', 'script', 'variant']);
const relative = (file) => path.relative(ROOT, file).split(path.sep).join('/');

/** Modeled seconds for one application: perFile x files + perSlide x slides (budgets.json `models`). */
export const modeledSeconds = (model, files, slides) => model.perFile * files + model.perSlide * slides;

// ---------------------------------------------------------------------------------------------------- analysis

/** unit -> Set of "deck#slide" (a file-level unit is on every slide of its file; variants of a deck share slides). */
export function slidesByUnit(files) {
  const out = new Map();
  const add = (unit, place) => {
    if (!out.has(unit)) out.set(unit, new Set());
    out.get(unit).add(place);
  };
  for (const file of files) {
    file.slideUnits.forEach((units, index) => {
      const place = `${file.deck}#${index + 1}`;
      for (const unit of units) add(unit, place);
      for (const unit of file.fileUnits) add(unit, place);
    });
    if (file.slideCount === 0) for (const unit of file.fileUnits) add(unit, `${file.deck}#0`);
  }
  return out;
}

/** deck -> Set of its units (all its files), restricted to `kinds` when given. */
export function unitsByDeck(files, kinds) {
  const out = new Map();
  for (const file of files) {
    if (!out.has(file.deck)) out.set(file.deck, new Set());
    const set = out.get(file.deck);
    for (const unit of unitsOfFile(file)) if (!kinds || kinds.includes(kindOf(unit))) set.add(unit);
  }
  return out;
}

/** The decks among `files` that show no unit of `kinds` that no other of these decks shows, sorted. */
export function dominatedDecks(files, kinds = CONTENT_KINDS) {
  const byDeck = unitsByDeck(files, kinds);
  const owners = new Map();
  for (const units of byDeck.values()) for (const unit of units) owners.set(unit, (owners.get(unit) ?? 0) + 1);
  return [...byDeck].filter(([, units]) => ![...units].some((unit) => owners.get(unit) === 1)).map(([deck]) => deck).sort();
}

/** Why a deck may stay without a unit of its own: the known records and features that name it. */
export function namedBy(inputs, deck) {
  const known = Object.entries(inputs.known).flatMap(([application, records]) =>
    records.filter((record) => (record.where ?? []).some((place) => place.deck === deck)).map((record) => `known:${application}:${record.id}`),
  );
  const features = inputs.manifest.features.filter((feature) => feature.deck === deck && Object.keys(feature.targets ?? {}).length > 0).map((feature) => `feature:${feature.id}`);
  return [...known, ...features];
}

/** Every unit that exists: schema locations from the schema, features from the manifest, known ids with places, and the scripts and variants the corpus shows. */
export function universe(units, inputs) {
  const all = new Set([...units.locations.keys()].map((location) => `schema:${location}`));
  for (const feature of inputs.manifest.features) all.add(`feature:${feature.id}`);
  for (const [application, records] of Object.entries(inputs.known)) for (const record of records) if (record.where?.length) all.add(`known:${application}:${record.id}`);
  for (const file of units.files) for (const unit of unitsOfFile(file)) all.add(unit);
  return all;
}

const countByKind = (set) => {
  const out = {};
  for (const unit of set) out[kindOf(unit)] = (out[kindOf(unit)] ?? 0) + 1;
  return out;
};

/** The figures of the report (pure: the caller reads the inputs and the lists). */
export function analyze(units, inputs, budgets) {
  const all = universe(units, inputs);
  const totals = countByKind(all);
  const tiers = {};
  for (const tier of TIERS) {
    const files = filesForTier(units, inputs.manifest, tier);
    const covered = new Set(files.flatMap((file) => [...unitsOfFile(file)]));
    const size = tierSize(units, inputs, tier);
    const time = {};
    for (const [application, model] of Object.entries(budgets.models)) {
      const seconds = modeledSeconds(model, size.files, size.slides);
      time[application] = { minutes: seconds / 60, budgetMinutes: budgets.budgets[application]?.[tier] ?? null };
    }
    tiers[tier] = {
      covered: countByKind(covered),
      corpusFiles: files.length,
      corpusSlides: files.reduce((sum, file) => sum + file.slideCount, 0),
      size,
      time,
      dominated: dominatedDecks(files),
    };
  }
  const bySlide = slidesByUnit(units.files);
  const single = [...bySlide].filter(([, places]) => places.size === 1).map(([unit, places]) => ({ unit, place: [...places][0] }));
  single.sort((a, b) => a.place.localeCompare(b.place, 'en', { numeric: true }) || a.unit.localeCompare(b.unit));
  const shown = new Set([...bySlide.keys()]);
  const allowlist = readJson(ALLOWLIST_FILE).entries ?? [];
  const allowed = new Map(allowlist.map((entry) => [entry.location, entry.reason]));
  const gaps = [...units.locations.keys()].filter((location) => !shown.has(`schema:${location}`)).map((location) => ({ location, kind: units.locations.get(location), reason: allowed.get(location) ?? null }));
  const dominated = dominatedDecks(units.files).map((deck) => ({ deck, namedBy: namedBy(inputs, deck) }));
  return { totals, tiers, single, gaps, dominated };
}

// ---------------------------------------------------------------------------------------------------- rules

/** (a) Known records with places, none of which the release tier runs: [{ application, id, places }]. */
export function knownWithoutReleasePlace(units, inputs, tier = 'release') {
  const runs = filesForTier(units, inputs.manifest, tier);
  const out = [];
  for (const [application, records] of Object.entries(inputs.known)) {
    for (const record of records) {
      const places = record.where ?? [];
      if (places.length === 0) continue; // scoped or not located: no slide to run
      const ok = places.some((place) => {
        const file = runs.find((candidate) => candidate.deck === place.deck && sameExport(place.variant, candidate.variant));
        return file !== undefined && Number.isInteger(place.slide) && place.slide >= 1 && place.slide <= file.slideCount;
      });
      if (!ok) out.push({ application, id: record.id, places });
    }
  }
  return out;
}

const describePlace = (place) => `${place.deck}${place.variant ? `~${place.variant}` : ''} slide ${place.slide}`;

export function checkKnownPlaces(units, inputs, pending) {
  const problems = [];
  const failing = knownWithoutReleasePlace(units, inputs);
  const listed = new Map((pending.records ?? []).map((entry) => [`${entry.application}:${entry.id}`, entry]));
  for (const entry of pending.records ?? []) if (!entry.reason?.trim()) problems.push(`${relative(PENDING_FILE)}: ${entry.id} needs a reason`);
  const failingKeys = new Set(failing.map((item) => `${item.application}:${item.id}`));
  for (const item of failing) {
    if (listed.has(`${item.application}:${item.id}`)) continue;
    problems.push(
      `known/${item.application}.json ${item.id}: no place the release tier runs (${item.places.map(describePlace).join('; ')}). Add the deck to qualification/manifest.json, fix the slide number, or add a place that the corpus has.`,
    );
  }
  for (const [key, entry] of listed) {
    if (!failingKeys.has(key)) problems.push(`${relative(PENDING_FILE)}: ${entry.id} (${entry.application}) now has a place the release tier runs, or no longer exists: remove it from the list.`);
  }
  return { failing, problems };
}

/** (b) Schema locations no corpus slide shows and no allowlist entry explains; and allowlist entries that are wrong. */
export function checkSchema(units, analysis) {
  const problems = [];
  for (const gap of analysis.gaps) {
    if (gap.reason === null) problems.push(`schema location ${gap.location} (${gap.kind}) is on no corpus slide: add a slide that uses it to a coverage deck (qualification/decks/coverage-*.opf.json), or an entry with a reason to ${relative(ALLOWLIST_FILE)} when no deck can show it.`);
  }
  const gapSet = new Set(analysis.gaps.map((gap) => gap.location));
  for (const entry of readJson(ALLOWLIST_FILE).entries ?? []) {
    if (!units.locations.has(entry.location)) problems.push(`${relative(ALLOWLIST_FILE)} names ${entry.location}, which the schema does not have: remove the entry.`);
    else if (!gapSet.has(entry.location)) problems.push(`${relative(ALLOWLIST_FILE)} names ${entry.location}, which a corpus deck now shows: remove the entry.`);
    if (!entry.reason?.trim()) problems.push(`${relative(ALLOWLIST_FILE)}: ${entry.location} needs a reason.`);
  }
  return { gaps: analysis.gaps.length, problems };
}

/** (c) Decks that earn no place: no unit of their own, named by no known record or feature, and not on the list. */
export function checkDominated(units, inputs, list) {
  const problems = [];
  const listed = new Map((list.decks ?? []).map((entry) => [entry.deck, entry]));
  const unearned = dominatedDecks(units.files).filter((deck) => namedBy(inputs, deck).length === 0);
  for (const deck of unearned) {
    if (listed.has(deck)) continue;
    problems.push(
      `corpus deck ${deck} shows no schema location, script or variant that another corpus deck lacks, and no known record or manifest feature names it: give it a slide that shows something new, name it in a feature, or remove it from qualification/manifest.json.`,
    );
  }
  const unearnedSet = new Set(unearned);
  for (const [deck, entry] of listed) {
    if (!entry.reason?.trim()) problems.push(`${relative(DOMINATED_FILE)}: ${deck} needs a reason`);
    if (!units.decks.has(deck)) problems.push(`${relative(DOMINATED_FILE)} names ${deck}, which the manifest does not have: remove it.`);
    else if (!unearnedSet.has(deck)) problems.push(`${relative(DOMINATED_FILE)} names ${deck}, which now earns its place: remove it from the list.`);
  }
  return { unearned, problems };
}

/** (d) Tiers whose modeled time is over budget, and budgets without a model. */
export function checkBudgets(analysis, budgets) {
  const problems = [];
  for (const [application, perTier] of Object.entries(budgets.budgets)) {
    if (!budgets.models[application]) {
      problems.push(`${relative(BUDGETS_FILE)}: ${application} has budgets but no time model.`);
      continue;
    }
    for (const [tier, budgetMinutes] of Object.entries(perTier)) {
      const figures = analysis.tiers[tier];
      if (!figures) {
        problems.push(`${relative(BUDGETS_FILE)}: no tier "${tier}" (use ${TIERS.join(', ')}).`);
        continue;
      }
      const { minutes } = figures.time[application];
      if (minutes > budgetMinutes) {
        problems.push(
          `${application} ${tier}: ${figures.size.files} files, ${figures.size.slides} slides, ${minutes.toFixed(1)} modeled minutes, over the budget of ${budgetMinutes}. Move decks to a later tier, merge decks that show the same units, or raise the budget in ${relative(BUDGETS_FILE)} with a reason.`,
        );
      }
    }
  }
  return { problems };
}

/** Runs the four rules: { rules: { known, schema, dominated, budgets }, problems: [string] }. */
export function runChecks(units, inputs, lists) {
  const analysis = analyze(units, inputs, lists.budgets);
  const rules = {
    known: checkKnownPlaces(units, inputs, lists.pending),
    schema: checkSchema(units, analysis),
    dominated: checkDominated(units, inputs, lists.dominated),
    budgets: checkBudgets(analysis, lists.budgets),
  };
  return { analysis, rules, problems: Object.values(rules).flatMap((rule) => rule.problems) };
}

export const readLists = () => ({ pending: readJson(PENDING_FILE), dominated: readJson(DOMINATED_FILE), budgets: readJson(BUDGETS_FILE) });
