// Run colours named by a reference (RR-08).
//
// A TextRun colour may be a ColorRef: a `var:` variable, a colour-scheme slot ('accent2') or a role ('primary'). The
// export resolves it (or writes the theme slot that holds the same colour) and PowerPoint has no field for the name, so
// import used to return only the resolved hex. Two sources can name the reference again, and both are gated by the
// imported document's own colour resolution: a name is restored only while it still resolves to the run's current colour,
// so a colour edited in PowerPoint keeps its edited value and nothing is invented.
//
// 1. Provenance (full mode): OPF_SLIDE_V1 `colors` = {n, at: [[slot, reference], ...]}. The slots are the text runs of the
//    slide's content in a fixed order (slideRunSlots: text runs, list item and description runs; regions by name, then
//    blocks and groups in order, or the root payload). `n` is how many slots the authored slide had; the record is used only
//    when the imported slide has exactly that many, so a run can never be matched to another. It holds reference names
//    only, never words.
// 2. A slide with no OPF record (plain PPTX): a run painted with a bare a:schemeClr (no colour transform) names that
//    theme slot ('accent2', 'dark1', 'hyperlink'), restored when the document's colour scheme holds that exact colour for
//    the slot. The exporter writes schemeClr only where the theme holds the colour, so this is the same convention.

import {ROOT_PAYLOAD_FIELDS, REGION_KEYS} from './content-topology.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const REGION_KEY_SET = new Set(REGION_KEYS);
const isGroup = block => object(block) && (block.type === 'group' || (block.type === undefined && Array.isArray(block.blocks)));
export const MAX_COLOR_SLOTS = 100000;

// A reference name: the schema's ColorRef forms other than a hex literal.
const REFERENCE = /^(?:var:[a-z][a-z0-9-]*|accent[1-6]|dark[12]|light[12]|hyperlink|followedHyperlink|primary|secondary|accent|background|surface|text|textSecondary)$/;
export const isColorReference = value => typeof value === 'string' && REFERENCE.test(value);

/** The payload objects of a slide in the fixed traversal order: regions (by name), else blocks (groups depth first), else the slide's root payload. */
function* leaves(slide) {
  const walk = function* (block) {
    if (!object(block)) return;
    if (isGroup(block)) { for (const child of Array.isArray(block.blocks) ? block.blocks : []) yield* walk(child); return; }
    yield block;
  };
  const regions = Object.keys(slide).filter(key => REGION_KEY_SET.has(key) && object(slide[key])).sort();
  if (regions.length) { for (const key of regions) yield* walk(slide[key]); return; }
  if (Array.isArray(slide.blocks)) { for (const block of slide.blocks) yield* walk(block); return; }
  yield slide;
}

/** The text runs of the slide's text and list payloads, in order: an object (a run) or null (a plain string). */
export function slideRunSlots(slide) {
  const slots = [];
  const runs = value => {
    if (Array.isArray(value)) for (const run of value) slots.push(object(run) ? run : null);
    else if (typeof value === 'string') slots.push(null);
  };
  for (const leaf of leaves(slide)) {
    for (const field of ROOT_PAYLOAD_FIELDS) {
      const value = leaf[field];
      if (field === 'text') { if (Array.isArray(value)) runs(value); }
      else if ((field === 'items' || field === 'bullets') && Array.isArray(value)) {
        for (const item of value) {
          if (Array.isArray(item) || typeof item === 'string') runs(item);
          else if (object(item)) { runs(item.text); runs(item.description); }
        }
      }
    }
  }
  return slots;
}

/** The record stored for an authored slide, or undefined when no run names a reference. */
export function runColorRecord(slide) {
  const slots = slideRunSlots(slide);
  if (slots.length > MAX_COLOR_SLOTS) return undefined;
  const at = [];
  slots.forEach((run, index) => { if (run && isColorReference(run.color)) at.push([index, run.color]); });
  return at.length ? {n: slots.length, at} : undefined;
}

/** Throws when `value` is not a well-formed colours record. */
export function validateRunColors(value) {
  if (!object(value) || !Number.isSafeInteger(value.n) || value.n < 1 || value.n > MAX_COLOR_SLOTS || !Array.isArray(value.at) || !value.at.length || value.at.length > value.n) throw Error('Invalid run colours record.');
  let previous = -1;
  for (const entry of value.at) {
    if (!Array.isArray(entry) || entry.length !== 2 || !Number.isSafeInteger(entry[0]) || entry[0] <= previous || entry[0] >= value.n || !isColorReference(entry[1])) throw Error('Invalid run colour entry.');
    previous = entry[0];
  }
  return value;
}

function* markedRuns(value) {
  if (Array.isArray(value)) { for (const item of value) yield* markedRuns(item); return; }
  if (!object(value)) return;
  if (Object.hasOwn(value, '_opfScheme')) yield value;
  for (const item of Object.values(value)) if (item !== null && typeof item === 'object') yield* markedRuns(item);
}

/**
 * Restore run colour references on `slides` (the imported document's slides). `info[i]` is
 * {record, structure, content}: the stored OPF_SLIDE_V1 value, whether the slide's arrangement matches it and whether its
 * content structure was restored from it, or undefined for an untagged slide. `resolve(slide, name)` returns the '#RRGGBB'
 * the name resolves to in the document (or undefined). Every transient `_opfScheme` marker is removed.
 */
export function restoreRunColors(slides, info, resolve, report) {
  slides.forEach((slide, index) => {
    const tag = info[index];
    const marked = [...markedRuns(slide)];
    const restoreName = (run, name) => {
      const hex = typeof run.color === 'string' && /^#[0-9a-f]{6}$/i.test(run.color) ? run.color.toUpperCase() : undefined;
      if (hex && resolve(slide, name)?.toUpperCase() === hex) run.color = name;
    };
    if (tag?.record?.colors) {
      const {n, at} = tag.record.colors;
      // When the content form was not restored its own diagnostic says why, and the slots cannot be aligned.
      if (tag.structure && tag.content) {
        const slots = slideRunSlots(slide);
        if (slots.length !== n) report({code: 'color-reference-changed', path: `slides.${index}`, message: `The slide's text runs no longer match the stored colour references (${slots.length} runs now, ${n} at export), so the named run colours of slides.${index} (variables, scheme slots and roles) were not restored; the runs keep their resolved colours.`});
        else for (const [slot, name] of at) if (slots[slot]) restoreName(slots[slot], name);
      }
    } else if (!tag?.record) {
      for (const run of marked) if (typeof run._opfScheme === 'string') restoreName(run, run._opfScheme);
    }
    for (const run of marked) delete run._opfScheme;
  });
}
