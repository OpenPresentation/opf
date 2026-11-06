// SH-05: what the importer settles about the shapes it read, once the document's own colors can be resolved and the content form is
// rebuilt: the values that are only the theme style's (the fill, line, shadow and text color a style gives, which the exporter writes out
// explicitly) go back to absent, and the overlay shapes and connectors are assembled into `slide.shapes` in the order they were drawn.
import {isShapeBlock, shapeStyleLook, shapeTextColor} from '@openpresentation/opf/composition';
import {EFFECT_DEFAULTS} from './effects.js';
import {REGION_KEYS, ROOT_PAYLOAD_FIELDS} from './content-topology.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const REGION_KEY_SET = new Set(REGION_KEYS);
const isGroup = block => object(block) && (block.type === 'group' || (block.type === undefined && Array.isArray(block.blocks)));
const hex6 = value => typeof value === 'string' && /^#[0-9a-f]{6}/i.test(value) ? value.slice(0, 7).toUpperCase() : undefined;
const isColor = value => typeof value === 'string' || (object(value) && value.color !== undefined && value.gradient === undefined && value.pattern === undefined);

/** The shape blocks of a slide, in content order (regions by name, then blocks and groups depth first). */
function* shapeBlocks(slide) {
  const walk = function* (block) {
    if (!object(block)) return;
    if (isGroup(block)) { for (const child of Array.isArray(block.blocks) ? block.blocks : []) yield* walk(child); return; }
    if (block.image === undefined && isShapeBlock(block)) yield block;
  };
  const regions = Object.keys(slide).filter(key => REGION_KEY_SET.has(key) && object(slide[key])).sort();
  if (regions.length) { for (const key of regions) yield* walk(slide[key]); return; }
  if (Array.isArray(slide.blocks)) for (const block of slide.blocks) yield* walk(block);
}

const near = (a, b, tolerance = 0.01) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tolerance;

// Runs of a shape's text without what composition draws by itself: the text color a reading shape gets, and the intense style's bold.
function settleText(shape, same, resolve, style, look) {
  if (shape.text === undefined || !Array.isArray(shape.text)) return;
  const fill = shape.fill ?? look.fill;
  const middle = stops => stops[Math.floor((stops.length - 1) / 2)]?.color;
  const backdrop = fill === 'none' ? undefined : isColor(fill) ? fill : fill?.gradient ? middle(fill.gradient.stops) : fill?.pattern ? fill.pattern.backgroundColor ?? 'background' : undefined;
  const background = hex6(resolve('background')), text = hex6(resolve('text')), preferred = hex6(resolve(look.text));
  const under = backdrop === undefined ? background : hex6(resolve(backdrop));

  const expected = under && preferred && text && background ? shapeTextColor(under, preferred, text, background)?.toUpperCase() : undefined;
  const runs = shape.text.map(run => {
    if (!object(run)) return run;
    const next = {...run};
    if (expected && typeof next.color === 'string' && next.color.length <= 7 && hex6(resolve(next.color)) === expected) delete next.color;
    if (style === 'intense' && next.bold === true) delete next.bold;
    return Object.keys(next).length === 1 && typeof next.text === 'string' ? next.text : next;
  });
  shape.text = runs.every(run => typeof run === 'string') ? runs.join('') : runs;
}

/** Remove what a theme style gives from one shape (an overlay shape or a shape block), and its effects' defaults. */
function settleShape(shape, resolve) {
  const style = shape.style ?? 'moderate';
  const look = shapeStyleLook(style);
  const same = (a, b) => { const x = resolve(a), y = resolve(b); return x !== undefined && y !== undefined && x.toUpperCase() === y.toUpperCase(); };
  // The fill.
  if (shape.fill === 'none') { if (look.fill === 'none') delete shape.fill; }
  else if (isColor(shape.fill) && look.fill !== 'none' && same(shape.fill, look.fill)) delete shape.fill;
  // The line.
  const stroke = shape.stroke;
  if (stroke === 'none') { if (!look.stroke) delete shape.stroke; }
  else if (object(stroke)) {
    const color = look.stroke?.color ?? (style === 'none' ? 'text' : {color: 'accent1', darken: 0.5}), width = look.stroke?.width ?? 4 / 3;
    if (stroke.color !== undefined && !stroke.gradient && same(stroke.color, color)) delete stroke.color;
    if (near(stroke.width, width, 0.02)) delete stroke.width;
    if (look.stroke && !Object.keys(stroke).length) delete shape.stroke;
  }
  // The effects: the intense style's own soft shadow, and each default value.
  if (style === 'intense' && shape.shadow === 'soft') delete shape.shadow;
  for (const key of ['shadow', 'innerShadow', 'glow', 'reflection']) {
    const value = shape[key], defaults = EFFECT_DEFAULTS[key];
    if (!object(value) || !defaults) continue;
    for (const [name, standard] of Object.entries(defaults)) {
      if (value[name] === undefined) continue;
      if (name === 'color' ? same(value.color, standard) : near(value[name], standard, 0.01)) delete value[name];
    }
    if (key === 'shadow' && value.size === 1) delete value.size;
  }
  settleText(shape, same, resolve, style, look);
}

/** Settle the shape blocks and the overlay shapes of every slide (`slide.shapes` as assembled). `resolveFor(slide)` gives `resolve(ref)`: the color a ColorRef is in the slide. */
export function restoreShapes(imported, resolveFor) {
  for (const slide of imported.slides) {
    const resolve = resolveFor(slide, imported.slides.indexOf(slide));
    for (const block of shapeBlocks(slide)) settleShape(block, resolve);
    for (const entry of slide.shapes ?? []) {
      if (!object(entry)) continue;
      if (entry.connector) {
        const stroke = entry.stroke;
        if (object(stroke)) {
          const own = resolve(stroke.color), standard = resolve('text');
          if (stroke.color !== undefined && !stroke.gradient && own !== undefined && standard !== undefined && own.toUpperCase() === standard.toUpperCase()) delete stroke.color;
          if (near(stroke.width, 2, 0.02)) delete stroke.width;
          if (stroke.join === 'round') delete stroke.join;
          if (!Object.keys(stroke).length) delete entry.stroke;
        }
      } else settleShape(entry, resolve);
    }
  }
}

const slug = name => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'shape';
const MAX_OVERLAYS = 1000;
const MAX_ID = 256;
const clone = value => JSON.parse(JSON.stringify(value));

/**
 * The record an exported slide stores for its overlay: `[[index, {id?, at?}]]`, one row per entry of `slide.shapes` that has an id (a connector
 * names its ends by it) or is placed against a block (`at`: the native shape holds only the frame it was composed at). No words, only names
 * and numbers; undefined when no entry has either.
 */
export function overlayRecord(slide) {
  const rows = [];
  (Array.isArray(slide?.shapes) ? slide.shapes : []).forEach((entry, index) => {
    if (!object(entry)) return;
    const row = {};
    if (typeof entry.id === 'string' && entry.id.length <= MAX_ID) row.id = entry.id;
    if (object(entry.at) && typeof entry.at.block === 'string' && entry.at.block.length <= MAX_ID) row.at = clone(entry.at);
    // A connector's sites are the pair that face each other unless it names them: which of the two it named.
    if (object(entry.connector) && (entry.connector.fromSite === undefined || entry.connector.toSite === undefined)) row.sites = [entry.connector.fromSite === undefined ? 0 : 1, entry.connector.toSite === undefined ? 0 : 1];
    if (Object.keys(row).length) rows.push([index, row]);
  });
  return rows.length && rows.length <= MAX_OVERLAYS ? rows : undefined;
}

/** Throws when `value` is not a well-formed overlay record (untrusted input). Returns it otherwise. */
export function validateOverlayRecord(value) {
  if (!Array.isArray(value) || !value.length || value.length > MAX_OVERLAYS) throw Error('Invalid overlay record.');
  let previous = -1;
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== 2 || !Number.isSafeInteger(row[0]) || row[0] <= previous || !object(row[1]) || !Object.keys(row[1]).length) throw Error('Invalid overlay record row.');
    previous = row[0];
    const {id, at, sites, ...rest} = row[1];
    if (sites !== undefined && (!Array.isArray(sites) || sites.length !== 2 || !sites.every(site => site === 0 || site === 1))) throw Error('Invalid overlay connector sites.');
    if (Object.keys(rest).length || (id !== undefined && (typeof id !== 'string' || !id || id.length > MAX_ID))) throw Error('Invalid overlay record entry.');
    if (at !== undefined && (!object(at) || typeof at.block !== 'string' || !at.block || at.block.length > MAX_ID || !['top', 'bottom', 'start', 'end', 'center'].includes(at.edge)
      || Object.keys(at).some(key => !['block', 'edge', 'offset', 'width', 'height'].includes(key)) || ['offset', 'width', 'height'].some(key => at[key] !== undefined && !Number.isFinite(at[key])))) throw Error('Invalid overlay anchor.');
  }
  return value;
}

/** The ids a slide's blocks, groups and overlay shapes already use. */
function usedIds(slide) {
  const ids = new Set();
  const walk = block => {
    if (!object(block)) return;
    if (typeof block.id === 'string') ids.add(block.id);
    if (Array.isArray(block.blocks)) block.blocks.forEach(walk);
  };
  for (const key of Object.keys(slide)) if (key === 'blocks' || REGION_KEY_SET.has(key)) (Array.isArray(slide[key]) ? slide[key] : [slide[key]]).forEach(walk);
  for (const entry of slide.shapes ?? []) if (typeof entry?.id === 'string') ids.add(entry.id);
  return ids;
}

// The block (or group) a native shape's name points at in the rebuilt slide: `OPF shape slides.0.blocks.1.shape` and `OPF card slides.0.blocks.1.text`
// name a block's item, whose block is the path before the field.
const PAYLOAD_SEGMENTS = new Set([...ROOT_PAYLOAD_FIELDS, 'shape', 'path']);
function blockAtName(slide, name) {
  const match = /^OPF (?:shape|card) slides\.\d+\.((?:[A-Za-z0-9+:_-]+\.)*[A-Za-z0-9+:_-]+)$/.exec(name);
  if (!match) return undefined;
  let node = slide;
  for (const segment of match[1].split('.')) {
    if (PAYLOAD_SEGMENTS.has(segment) && node !== slide && !Array.isArray(node)) break;
    const next = Array.isArray(node) ? node[Number(segment)] : node?.[segment];
    if (!object(next) && !Array.isArray(next)) break;
    node = next;
  }
  return object(node) && node !== slide && !Array.isArray(node) ? node : undefined;
}

// The block a native shape or picture became (`key`: `sp:N` or `pic:N`, the importer's own): the flat block that read it, and where the rebuilt
// content put that block (`paths`: flat index to path), or the flat block itself when the content was not rebuilt.
function blockAtKey(slide, context, key, paths) {
  const flat = key === undefined ? -1 : (context?.signalSources?.blocks ?? []).findIndex(block => block.sources?.includes(key));
  if (flat < 0) return undefined;
  if (!paths) return object(slide.blocks?.[flat]) && !isGroup(slide.blocks[flat]) ? slide.blocks[flat] : undefined;
  const path = paths.get(flat);
  if (typeof path !== 'string') return undefined;
  let node = slide;
  for (const segment of path.split('.')) node = Array.isArray(node) ? node[Number(segment)] : node?.[segment];
  return object(node) && !isGroup(node) ? node : undefined;
}

/**
 * Put the overlay shapes and connectors a slide's native shapes were into `slide.shapes`, in the order they were drawn. A connector whose
 * two ends are connected to shapes the importer knows (overlay shapes, or blocks of the rebuilt content, found by the exported names) is a
 * connector bound to them by id; a connector with a free end is a line shape. `contexts[i].shapeImport` is the state importNativeShape kept,
 * `restored[i]` whether the slide's content form was rebuilt from the stored record (the names of exported shapes then point at the blocks),
 * and `records[i]` the stored overlay record (ids and anchors) while the slide's native structure is as it was exported.
 */
export function assembleOverlayShapes(imported, contexts, restored, records = [], contentPaths = []) {
  imported.slides.forEach((slide, index) => {
    const state = contexts[index]?.shapeImport;
    if (!state || (!state.overlays.length && !state.connectors.length)) return;
    const taken = usedIds(slide);
    const unique = name => { let id = slug(name), n = 1; while (taken.has(id)) id = `${slug(name)}-${++n}`; taken.add(id); return id; };
    const rows = new Map(records[index] ?? []);
    // The stored ids come first, so a generated one never takes a stored one's name.
    for (const item of [...state.overlays, ...state.connectors]) {
      const row = item.index !== undefined ? rows.get(item.index) : undefined;
      if (row?.id !== undefined && !taken.has(row.id)) { taken.add(row.id); item.id = row.id; }
    }
    const overlays = new Map(state.overlays.map(overlay => [overlay.nativeId, overlay]));
    const endOf = nativeId => {
      const overlay = overlays.get(nativeId);
      if (overlay) { overlay.entry.id ??= overlay.id ?? unique(overlay.name); return overlay.entry.id; }
      const name = state.names.get(nativeId);
      const block = (restored[index] && name ? blockAtName(slide, name) : undefined) ?? blockAtKey(slide, contexts[index], state.keys.get(nativeId), contentPaths[index]);
      if (block) { block.id ??= unique(name?.replace(/^OPF \w+ slides\.\d+\./, '') ?? 'block'); return block.id; }
      return undefined;
    };
    const entries = [];
    for (const overlay of state.overlays) {
      const row = overlay.index !== undefined ? rows.get(overlay.index) : undefined;
      const entry = overlay.entry;
      if (overlay.id !== undefined) entry.id = overlay.id;
      // An anchor returns only where the block it names is there: the native frame is where composition put the shape.
      if (row?.at !== undefined && taken.has(row.at.block)) { delete entry.x; delete entry.y; delete entry.width; delete entry.height; entry.at = clone(row.at); }
      entries.push({z: overlay.z, entry});
    }
    for (const connector of state.connectors) {
      const {read, free} = connector;
      const from = read.from && endOf(read.from.id), to = read.to && endOf(read.to.id);
      if (from && to && read.route && from !== to) {
        const {stroke, alt, decorative, hidden} = read.shape.fields;
        const row = connector.index !== undefined ? rows.get(connector.index) : undefined;
        entries.push({z: connector.z, entry: {...(connector.id !== undefined ? {id: connector.id} : {}), connector: {from, to, ...(read.route !== 'straight' ? {route: read.route} : {}),
          ...(row?.sites?.[0] === 0 ? {} : {fromSite: read.from.site}), ...(row?.sites?.[1] === 0 ? {} : {toSite: read.to.site})},
          ...(stroke !== undefined ? {stroke} : {}), ...(alt !== undefined ? {alt} : {}), ...(decorative ? {decorative} : {}), ...(hidden ? {hidden} : {})}});
      } else entries.push({z: connector.z, entry: connector.id !== undefined ? {id: connector.id, ...free} : free});
    }
    entries.sort((a, b) => a.z - b.z);
    slide.shapes = entries.map(item => item.entry);
  });
}
