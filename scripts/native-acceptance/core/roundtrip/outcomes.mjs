// NT-04b: what every exported object became in an application's own PowerPoint copy, and that answer written into a
// result.json. A port of the 0.36.0 Keynote round's rt_objects.py (objects matched by p:cNvPr@name; native / changed /
// picture / dropped; one phrase for how), generalized from Keynote to every target.
//
//   objectOutcomes(exported, resaved, { target }) -> { objects, slides, added }
//   mergeOutcomes(result, outcomes) -> result (the same object, changed in place)
//   countOutcomes(records, by = 'kind') -> { <kind>: { native, changed, picture, dropped } }
import { cutText, validateResult } from '../result/result.mjs';
import { allItems, inspectPptx, normalizeText as norm } from './inspect.mjs';

export const OUTCOME_NAMES = Object.freeze(['native', 'changed', 'picture', 'dropped']);

// What a file comparison cannot see but a round established for one application. Keynote keeps a live slide-number field
// in the copy's sldNum placeholder, so the files look the same; its scripting shows the field as U+FFFC inside an
// ordinary text item and the document's "slide numbers showing" stays false: not Keynote's own slide number.
const TARGET_RULES = {
  keynote: { keptSlideNumberField: 'live slide-number field kept, in an ordinary text item, not as the slide-number setting' },
};

const inspected = (file) => (file && Array.isArray(file.slides) && file.slideSize ? file : inspectPptx(file));
const textOfTree = (item) => [item.textFull, ...(item.items ?? []).map(textOfTree)].filter(Boolean).join('\n');
const bulletSignature = (item) =>
  item.paragraphs.filter((paragraph) => paragraph.text.trim() !== '').map((paragraph) => [paragraph.bullet?.kind ?? null, paragraph.bullet?.char ?? paragraph.bullet?.type ?? null, paragraph.lvl]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const placeholderType = (item) => (item.placeholder ? (item.placeholder.type ?? 'body') : null);
const fieldsOf = (item) => (item?.paragraphs ?? []).flatMap((paragraph) => paragraph.fields);

function cropOf(item) {
  const crop = {};
  for (const [key, value] of Object.entries(item?.crop ?? {})) if (Math.trunc(Number(value))) crop[key] = Math.trunc(Number(value));
  return crop;
}
const describeCrop = (crop) => (Object.keys(crop).length === 0 ? 'none' : Object.entries(crop).map(([key, value]) => `${key} ${value}`).join(', '));
const describeTypes = (types) => types.map((type) => [type.type, type.grouping, type.barDir].filter(Boolean).join(' ')).join(', ') || 'none';

/** rt_objects.py compare_object: -> [outcome, how]. */
function compareObject(label, exported, copy) {
  if (!copy) return ['dropped', 'not in the copy'];
  if (copy.element === 'pic' && exported.element !== 'pic') return ['picture', 'became a picture'];
  const hows = [];
  if (exported.element === 'sp' && copy.element === 'grpSp') {
    const parts = (copy.items ?? []).map((part) => part.preset ?? part.element).join(', ');
    hows.push(exported.hasText ? `split into a group: the shape plus a separate text box (${parts})` : `drawn as a group of ${copy.items?.length ?? 0} parts (${parts})`);
  }
  if (exported.element === 'pic' && (copy.element === 'pic' || copy.element === 'grpSp')) {
    const picture = copy.element === 'pic' ? copy : ((copy.items ?? []).find((part) => part.element === 'pic') ?? {});
    const before = cropOf(exported);
    const after = cropOf(picture);
    if (Object.values(before).some((value) => value < 0)) {
      hows.push(`letterbox (negative a:srcRect) became a frame sized to the image${copy.element === 'grpSp' ? ', with a rectangle behind it in a group' : ''}`);
    } else if (!same(Object.keys(before).sort(), Object.keys(after).sort()) || Object.keys(before).some((key) => Math.abs(before[key] - after[key]) > 2)) {
      hows.push(`crop changed ${describeCrop(before)} -> ${describeCrop(after)}`);
    }
    if ((exported.preset ?? null) !== (picture.preset ?? null)) hows.push(`mask ${exported.preset} -> ${picture.preset}`);
  }
  if (exported.hasText || ['slide title', 'body text', 'other text', 'list items'].includes(label)) {
    if (norm(textOfTree(exported)) !== norm(textOfTree(copy))) hows.push('text differs');
    if (label === 'list items' && exported.paragraphs.length > 0 && copy.element === 'sp' && copy.paragraphs.length > 0) {
      const before = bulletSignature(exported);
      const after = bulletSignature(copy);
      if (!same(before, after)) hows.push(`bullets differ ${JSON.stringify(before.slice(0, 2))} -> ${JSON.stringify(after.slice(0, 2))}`);
    }
  }
  if (label === 'slide title' && placeholderType(exported) !== placeholderType(copy)) hows.push(`placeholder ${placeholderType(exported)} -> ${placeholderType(copy)}`);
  if (exported.element === 'sp' && copy.element === 'sp' && exported.preset !== copy.preset) hows.push(`geometry ${exported.preset} -> ${copy.preset}`);
  if (label === 'table') {
    if (exported.rows !== copy.rows || exported.columns !== copy.columns) hows.push(`rows x columns ${exported.rows}x${exported.columns} -> ${copy.rows}x${copy.columns}`);
    if (!same((exported.cells ?? []).flat().map(norm), (copy.cells ?? []).flat().map(norm))) hows.push('cell text differs');
    if ((exported.merges ?? []).length !== (copy.merges ?? []).length) hows.push(`merges ${(exported.merges ?? []).length} -> ${(copy.merges ?? []).length}`);
    if ((exported.firstRow ?? null) !== (copy.firstRow ?? null)) hows.push(`header-row flag ${exported.firstRow} -> ${copy.firstRow}`);
  }
  if (label === 'chart (native)') {
    const before = exported.chart ?? {};
    const after = copy.chart ?? {};
    const typesBefore = (before.types ?? []).map((type) => [type.type, type.grouping, type.barDir]);
    const typesAfter = (after.types ?? []).map((type) => [type.type, type.grouping, type.barDir]);
    if (!same(typesBefore, typesAfter)) hows.push(`chart type ${describeTypes(before.types ?? [])} -> ${describeTypes(after.types ?? [])}`);
    const points = (chart) => (chart.series ?? []).map((series) => series.points);
    if (!same(points(before), points(after))) hows.push(`series points ${JSON.stringify(points(before))} -> ${JSON.stringify(points(after))}`);
    if (!same((before.series ?? []).map((series) => series.name), (after.series ?? []).map((series) => series.name))) hows.push('series names differ');
    if ((before.legend == null) !== (after.legend == null)) hows.push(`legend ${before.legend ?? 'none'} -> ${after.legend ?? 'none'}`);
  }
  return hows.length > 0 ? ['changed', hows.join('; ')] : ['native', null];
}

const linkKind = (link) => (link.jump ? 'slide jump' : link.external ? 'web link' : link.action ? `action ${link.action}` : 'other');
const linkLabel = (link) => (link.jump ? 'link to a slide' : link.on === 'text' ? 'link on text' : link.on === 'cell' ? 'link on a cell' : 'link on a shape');

/** A copy's object for an exported name: the same name, else the first whose name ends with it (Keynote writes a picture's title before its name). */
function byName(copyItems, name) {
  if (!name) return null;
  const exact = copyItems.find((item) => item.name === name);
  return exact ?? copyItems.find((item) => item.name?.endsWith(name)) ?? null;
}

function record(fields, copyItem) {
  const entry = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== null));
  // The matched object of the copy, for mergeOutcomes; not written anywhere.
  Object.defineProperty(entry, 'copyItem', { value: copyItem ?? null, enumerable: false });
  return entry;
}

/**
 * Every exported object (and link, notes, hidden slide) against the application's copy. `exported` and `resaved` are paths,
 * bytes, or inspectPptx results. Returns:
 *   objects: [{ slide, kind, label, name, outcome, how?, why?, role?, on?, target?, text?, box?, element, copyName?, copyElement?, empty? }]
 *   slides:  [{ index, hidden?: { outcome, why? } }]  (a hidden slide kept hidden is native)
 *   added:   [{ slide, kind, label, name, element, box, parent? }]  what the copy has that the export did not: groups and
 *            parts the application made (parent names the group they are in); empty text boxes dropped are objects above
 *            with empty: true.
 */
export function objectOutcomes(exported, resaved, { target } = {}) {
  const before = inspected(exported);
  const after = inspected(resaved);
  const rules = TARGET_RULES[target] ?? {};
  const objects = [];
  const slides = [];
  const added = [];
  const count = Math.min(before.slides.length, after.slides.length);
  for (let position = 0; position < before.slides.length; position += 1) {
    const slide = before.slides[position];
    const copySlide = position < count ? after.slides[position] : null;
    const index = slide.index;
    const copyItems = copySlide ? [...allItems(copySlide.items)] : [];
    const matched = new Set();
    for (const item of allItems(slide.items)) {
      const copy = byName(copyItems, item.name);
      if (copy) matched.add(copy);
      let outcome;
      let how;
      if (item.label === 'empty text box') [outcome, how] = copy ? ['native', null] : ['dropped', 'empty text box (a blank line); nothing visible lost'];
      else [outcome, how] = compareObject(item.label, item, copy);
      if (item.kind === 'footer') {
        const fields = fieldsOf(item);
        const copyFields = fieldsOf(copy);
        if (fields.length > 0 && same(fields, copyFields)) {
          if (rules.keptSlideNumberField && outcome === 'native') [outcome, how] = ['changed', rules.keptSlideNumberField];
        } else if (fields.length > 0 && copy && copyFields.length === 0) {
          const copyText = norm(textOfTree(copy));
          [outcome, how] = copyText === '' ? ['dropped', 'field gone, placeholder left empty'] : ['changed', `field became typed text "${cutText(copyText).slice(0, 40)}"`];
        }
      }
      objects.push(
        record(
          {
            slide: index,
            kind: item.kind,
            label: item.label,
            name: item.name,
            outcome,
            how: outcome === 'changed' ? how : undefined,
            why: outcome === 'changed' ? undefined : (how ?? undefined),
            role: item.role,
            text: item.text,
            box: item.box,
            element: item.frame ? `graphicFrame ${item.frame}` : item.element,
            copyName: copy?.name,
            copyElement: copy ? (copy.frame ? `graphicFrame ${copy.frame}` : copy.element) : undefined,
            empty: item.label === 'empty text box' ? true : undefined,
          },
          copy,
        ),
      );
    }
    // Links: matched by what carries them (shape, text run, cell), its name and, for text, the linked words.
    const copyLinks = copySlide?.links ?? [];
    for (const link of slide.links) {
      let candidates = copyLinks.filter((other) => other.on === link.on && other.name === link.name);
      if (candidates.length === 0) candidates = copyLinks.filter((other) => other.on === link.on && other.name && link.name && other.name.endsWith(link.name));
      const match = candidates.find((other) => link.on === 'shape' || norm(other.text) === norm(link.text)) ?? null;
      let outcome = 'native';
      let how = null;
      if (!match) {
        const elsewhere = copyLinks.find((other) => other.name === link.name);
        outcome = 'dropped';
        how = `no link on the ${link.on} of "${link.name}" in the copy${elsewhere ? ` (found on the ${elsewhere.on} instead)` : ''}`;
      } else if (linkKind(link) !== linkKind(match)) [outcome, how] = ['changed', `${linkKind(link)} -> ${linkKind(match)}`];
      else if (link.target !== match.target) [outcome, how] = ['changed', `target ${link.target} -> ${match.target}`];
      objects.push(
        record({
          slide: index,
          kind: 'link',
          label: linkLabel(link),
          name: link.name,
          outcome,
          how: outcome === 'changed' ? how : undefined,
          why: outcome === 'changed' ? undefined : (how ?? undefined),
          on: link.on,
          target: link.target ?? undefined,
          text: link.text ? cutText(link.text) : undefined,
          element: 'link',
        }),
      );
    }
    if (slide.notes) {
      const copyNotes = copySlide?.notes ?? null;
      const outcome = norm(slide.notes) === norm(copyNotes) ? 'native' : norm(copyNotes) === '' ? 'dropped' : 'changed';
      objects.push(record({ slide: index, kind: 'notes', label: 'presenter notes', outcome, how: outcome === 'changed' ? 'notes text differs' : undefined, text: cutText(slide.notes), element: 'notes' }));
    }
    const slideEntry = { index };
    if (slide.hidden) slideEntry.hidden = copySlide?.hidden ? { outcome: 'native' } : { outcome: 'dropped', why: copySlide ? 'the copy shows the slide' : 'the copy has no such slide' };
    slides.push(slideEntry);
    // What the copy has that the export did not. A part inside a group that is itself new is covered by its group.
    const walk = (items, parent, parentNew) => {
      for (const item of items) {
        const isNew = !matched.has(item);
        if (isNew && !parentNew) added.push({ slide: index, kind: item.kind, label: item.label, name: item.name, element: item.element, box: item.box, ...(parent ? { parent: parent.name } : {}) });
        if (item.items) walk(item.items, item, isNew || parentNew);
      }
    };
    if (copySlide) walk(copySlide.items, null, false);
  }
  const outcomes = { objects, slides, added, slideCount: [before.slides.length, after.slides.length] };
  Object.defineProperty(outcomes, 'copy', { value: after, enumerable: false });
  return outcomes;
}

/** Kind (or label) by outcome. Records are objectOutcomes().objects, or a result's objects (their members counted). */
export function countOutcomes(records, by = 'kind') {
  const table = {};
  const add = (key, outcome) => {
    table[key] ??= { native: 0, changed: 0, picture: 0, dropped: 0, unknown: 0 };
    table[key][outcome ?? 'unknown'] += 1;
  };
  const visit = (entries) => {
    for (const entry of entries) {
      add(entry[by] ?? entry.kind, entry.outcome);
      if (Array.isArray(entry.objects)) visit(entry.objects);
    }
  };
  visit(records);
  return table;
}

// ---- merging into a result.json

// Which elements of the copy a probe's object of a kind can be (Keynote draws lines as shapes, so a connector may be an sp).
const ELEMENTS_OF_KIND = {
  picture: ['pic'],
  table: ['graphicFrame'],
  chart: ['graphicFrame'],
  group: ['grpSp', 'graphicFrame'],
  connector: ['cxnSp', 'sp'],
  title: ['sp'],
  body: ['sp'],
  text: ['sp'],
  list: ['sp'],
  footer: ['sp'],
  shape: ['sp', 'cxnSp'],
};
const compatible = (object, item) => !ELEMENTS_OF_KIND[object.kind] || ELEMENTS_OF_KIND[object.kind].includes(item.element);
const ORIGIN_TOLERANCE = 3;
const originClose = (a, b) => Array.isArray(a) && Array.isArray(b) && Math.abs(a[0] - b[0]) <= ORIGIN_TOLERANCE && Math.abs(a[1] - b[1]) <= ORIGIN_TOLERANCE;
const sizeClose = (a, b) => Array.isArray(a) && Array.isArray(b) && [2, 3].every((i) => Math.abs(a[i] - b[i]) <= Math.max(ORIGIN_TOLERANCE, 0.05 * Math.max(a[i], b[i])));

/**
 * Pairs a probe's objects with the copy's items at one level of the tree. How sure each pair is:
 *   "name"          the probe reported the object's name and the copy has it
 *   "order-and-box" same place in the z-order (both lists the same length) and the same box
 *   "order"         same place in the z-order, a different box (the 0.36.0 round's alignment)
 *   "box"           the lists differ in length; the only item of a fitting kind at the same origin
 */
function align(objects, items, pairs) {
  const free = new Set(items);
  const open = [];
  for (const object of objects) {
    const item = object.name ? items.find((candidate) => free.has(candidate) && candidate.name && (candidate.name === object.name || candidate.name.endsWith(object.name))) : null;
    if (item) {
      free.delete(item);
      pairs.set(object, { item, match: 'name' });
    } else open.push(object);
  }
  const rest = items.filter((item) => free.has(item));
  if (open.length === rest.length) {
    open.forEach((object, position) => {
      const item = rest[position];
      if (!compatible(object, item)) return;
      free.delete(item);
      pairs.set(object, { item, match: originClose(object.box, item.box) && sizeClose(object.box, item.box) ? 'order-and-box' : 'order' });
    });
  }
  for (const object of open) {
    if (pairs.has(object)) continue;
    const near = [...free].filter((item) => compatible(object, item) && originClose(object.box, item.box));
    const best = near.length > 1 ? near.filter((item) => sizeClose(object.box, item.box)) : near;
    if (best.length === 1) {
      free.delete(best[0]);
      pairs.set(object, { item: best[0], match: 'box' });
    }
  }
  for (const [object, { item }] of pairs) if (object.kind === 'group' && Array.isArray(object.objects) && item.items && objects.includes(object)) align(object.objects, item.items, pairs);
}

const ROUND_TRIP_KINDS = new Set(['list', 'footer']);

function addedObject(entry) {
  const object = { kind: entry.kind, outcome: entry.outcome };
  if (entry.how) object.how = entry.how;
  if (entry.name) object.name = entry.name;
  if (entry.box) object.box = entry.box;
  if (entry.text) object.text = entry.text;
  if (entry.role) object.role = entry.role;
  if (entry.on) object.on = entry.on;
  if (entry.target) object.target = entry.target;
  const details = { source: 'round trip', label: entry.label };
  if (entry.why) details.why = entry.why;
  if (entry.empty) details.empty = true;
  object.details = details;
  return object;
}

/**
 * Writes objectOutcomes into a result.json's slides (in place) and returns the result. The probe's objects get an outcome
 * and the exported name where they can be paired with the copy (by name, else by z-order and box: see align above; how
 * sure the pair is goes into details.match). An object that cannot be paired keeps outcome null (details.match "none").
 * A paired text object that the export wrote as a list or a footer takes that kind. Objects the probe cannot see are
 * added: links, lists and footers not paired, every dropped object, and the notes when the probe had none. When the
 * result has no slides (no probe and no render), slides are made from the copy. Throws when the result no longer validates.
 */
export function mergeOutcomes(result, outcomes) {
  const copy = outcomes.copy;
  if (result.slides.length === 0 && copy) {
    result.slides = copy.slides.map((slide) => ({ index: slide.index, hidden: slide.hidden, layout: slide.layout, picture: null, notes: slide.notes, objects: [] }));
  }
  for (const slide of result.slides) {
    const records = outcomes.objects.filter((entry) => entry.slide === slide.index);
    const byCopyItem = new Map();
    for (const entry of records) if (entry.copyItem && entry.kind !== 'link' && !byCopyItem.has(entry.copyItem)) byCopyItem.set(entry.copyItem, entry);
    const merged = new Set();
    const copySlide = copy?.slides[slide.index - 1];
    const probed = slide.objects.filter((object) => object.kind !== 'notes');
    const pairs = new Map();
    if (copySlide) align(probed, copySlide.items, pairs);
    const visit = (objects) => {
      for (const object of objects) {
        if (object.kind === 'notes') continue;
        const pair = pairs.get(object);
        const entry = pair ? byCopyItem.get(pair.item) : undefined;
        const details = { ...(object.details ?? {}), match: pair ? pair.match : 'none' };
        if (entry) {
          merged.add(entry);
          object.outcome = entry.outcome;
          if (entry.outcome === 'changed' && entry.how) object.how = entry.how;
          else delete object.how;
          if (entry.name) object.name = entry.name;
          if (ROUND_TRIP_KINDS.has(entry.kind) && ['text', 'body', 'title', 'shape'].includes(object.kind)) {
            object.kind = entry.kind;
            if (entry.role) object.role = entry.role;
          }
          details.label = entry.label;
        } else if (pair) {
          details.inExport = false;
        }
        object.details = details;
        if (Array.isArray(object.objects)) visit(object.objects);
      }
    };
    visit(slide.objects);
    for (const entry of records) {
      if (merged.has(entry)) continue;
      if (entry.kind === 'notes') {
        const notes = slide.objects.find((object) => object.kind === 'notes');
        if (notes) {
          notes.outcome = entry.outcome;
          if (entry.how) notes.how = entry.how;
        } else slide.objects.push(addedObject(entry));
        continue;
      }
      if (entry.kind === 'link' || ROUND_TRIP_KINDS.has(entry.kind) || entry.outcome === 'dropped') slide.objects.push(addedObject(entry));
    }
  }
  const { ok, errors } = validateResult(result);
  if (!ok) throw new Error(`mergeOutcomes: the result no longer validates: ${errors.join('; ')}`);
  return result;
}
