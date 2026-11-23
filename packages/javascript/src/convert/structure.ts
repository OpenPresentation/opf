// Slide structure conversions: wrap blocks in a group, unwrap a group, place blocks in the cells of the slide's
// grid and back, and move an image between the content and the slide's design (background or
// watermark). They work on one slide object with paths relative to it and return the new slide; the host
// turns the difference into a patch. Pure; every result is validated as OPF. Internal module.
import { cellBlocks, cellsInReadingOrder, gridCellSpan, isGridCell } from "../grid-cells.js";
import { CONTENT_KEYS, type ConversionReport, type Json, Loss, type Obj, assertValidOutput, clone, contentKeysOf, isRecord, refuse, report } from "./shared.js";
/** Image sources the background string shorthand accepts (opf.schema.json ImageSource). */
const IMAGE_SOURCE = /^(asset:|https:\/\/|data:|\.\/|\.\.\/)/;

/** A path inside one slide: `["blocks", 1]` is its second block, `["blocks", 1, "blocks", 0]` the first block of that group, `[]` the slide itself. */
export type SlidePath = (string | number)[];

export interface StructureChange extends ConversionReport {
  /** The slide after the change. */
  slide: Obj;
  changed: boolean;
  /** Where the affected block now is (the new group, the first unwrapped child, the moved image block). */
  path?: SlidePath;
}

/** The blocks of a slide placed in the cells of its grid, in reading order of their cells (source order within a cell); empty when it places none. */
export function blocksInCellOrder(slide: Obj): Obj[] {
  const placed = cellBlocks(slide);
  if (!placed) return [];
  return cellsInReadingOrder(placed).flatMap((cell) => placed.filter((entry) => entry.cell === cell).map((entry) => entry.block));
}
/** A block without its cell (`region`). */
export function withoutCell(block: Obj): Obj {
  const { region: _region, ...rest } = block;
  return rest;
}

function at(slide: Obj, path: SlidePath): Json {
  let value: Json = slide;
  for (const part of path) value = value?.[part];
  return value;
}

/** Expand a payload that holds its content inline (`{ text, image }`) into an explicit `blocks` array, in place. */
function explicitBlocks(owner: Obj): Obj[] {
  if (Array.isArray(owner.blocks)) return owner.blocks;
  const keys = contentKeysOf(owner);
  const blocks = keys.map((key) => ({ ...(keys.length === 1 && owner.type ? { type: owner.type } : {}), [key]: owner[key] }));
  for (const key of [...CONTENT_KEYS, "type"]) delete owner[key];
  owner.blocks = blocks;
  return blocks;
}

function ownerAt(slide: Obj, path: SlidePath, what: string): Obj {
  const owner = path.length ? at(slide, path) : slide;
  if (!isRecord(owner)) throw refuse(`There is no ${what} at that location.`, { path });
  return owner;
}

const finish = (slide: Obj, loss: Loss, path?: SlidePath): StructureChange => {
  assertValidOutput(slide, "slide");
  return { slide, changed: true, ...(path ? { path } : {}), ...report(loss.list) };
};

// --- group and ungroup -------------------------------------------------------------------------

/**
 * Wrap the blocks at `indices` of a container (the slide by default, or a group or region group named by
 * `container`) in a new group placed where the first of them was. The blocks keep their order; the group
 * takes the optional `composition`. Nothing is lost.
 */
export function wrapBlocks(slide: unknown, indices: number[], options: { container?: SlidePath; composition?: Obj } = {}): StructureChange {
  const next = clone(slide as Obj);
  const container = options.container ?? [];
  const owner = ownerAt(next, container, "container");
  if (!Array.isArray(owner.blocks) && container.length && contentKeysOf(owner).length < 2) throw refuse("This content is a single payload, not a list of blocks. There is nothing to group it with.");
  const blocks = explicitBlocks(owner);
  const selected = [...new Set(indices)].sort((a, b) => a - b);
  if (!selected.length || selected.some((index) => !Number.isInteger(index) || index < 0 || index >= blocks.length)) throw refuse("Choose blocks that exist in this container.", { indices });
  const group: Obj = { blocks: selected.map((index) => blocks[index]!), ...(options.composition ? { composition: clone(options.composition) } : {}) };
  const first = selected[0]!;
  const rest = new Set(selected.slice(1));
  owner.blocks = blocks.flatMap((block, index) => (index === first ? [group] : rest.has(index) ? [] : [block]));
  return finish(next, new Loss(), [...container, "blocks", first]);
}

/**
 * Replace the group at `path` (a group inside a `blocks` array) by its blocks. The group's own `composition`,
 * `id` and `extensions` cannot be kept and are reported.
 */
export function unwrapGroup(slide: unknown, path: SlidePath): StructureChange {
  const next = clone(slide as Obj);
  const group = at(next, path);
  if (!isRecord(group) || !Array.isArray(group.blocks)) throw refuse("Choose a group to unwrap.", { path });
  const index = path.at(-1);
  if (path.length < 2 || path.at(-2) !== "blocks" || typeof index !== "number") throw refuse("Only a group that sits inside a list of blocks can be unwrapped.", { path });
  const parent = at(next, path.slice(0, -2));
  const loss = new Loss();
  if (group.composition) loss.note("group arrangement (composition)");
  if (group.id !== undefined) loss.note("group id");
  if (group.extensions !== undefined) loss.note("group extensions");
  parent.blocks.splice(index, 1, ...group.blocks);
  return finish(next, loss, [...path.slice(0, -1), index]);
}

// --- blocks and regions ------------------------------------------------------------------------

const overlaps = (a: string, b: string): boolean => {
  const left = gridCellSpan(a), right = gridCellSpan(b);
  return !!left && !!right && left.rows.some((row) => right.rows.includes(row)) && left.columns.some((column) => right.columns.includes(column));
};
const notACell = (cell: string) => refuse(`"${cell}" is not a cell of the slide's grid (for example start, end, top:start, center+end).`, { region: cell });

/**
 * Place every block of a slide in a cell of its grid: `regions[i]` is the cell of block i (`start`, `end`, `top:start`, ...), written
 * as its `region`. Blocks may share a cell (they stack in it); two different cells may not overlap. A slide with a layout has no grid
 * of cells (its blocks go to the layout's regions). Nothing is lost.
 */
export function blocksToRegions(slide: unknown, regions: string[]): StructureChange {
  const next = clone(slide as Obj);
  if (next.layout !== undefined) throw refuse("This slide has a layout: its blocks go to the layout's regions. Remove the layout to place blocks in cells.");
  if (cellBlocks(next)) throw refuse("This slide already places its blocks in cells.");
  const blocks = explicitBlocks(next);
  if (!blocks.length) throw refuse("This slide has no blocks to place.");
  if (regions.length !== blocks.length) throw refuse(`Name a cell for each of the ${blocks.length} blocks.`, { blocks: blocks.length, regions: regions.length });
  regions.forEach((cell, index) => {
    if (!isGridCell(cell)) throw notACell(cell);
    const clash = regions.findIndex((other, otherIndex) => otherIndex < index && other !== cell && overlaps(other, cell));
    if (clash >= 0) throw refuse(`Cell "${cell}" overlaps cell "${regions[clash]}". Blocks share a cell only when they name the same one.`, { region: cell });
  });
  next.blocks = blocks.map((block, index) => ({ ...(block.id !== undefined ? { id: block.id } : {}), region: regions[index], ...withoutCell(block) }));
  return finish(next, new Loss(), ["blocks", 0]);
}

/**
 * Take the blocks of a slide out of the cells of its grid: they stay its blocks, in reading order of their cells (top to bottom, start
 * to end; source order within a cell), without `region`. The position each cell gave its blocks cannot be kept and is reported.
 */
export function regionsToBlocks(slide: unknown): StructureChange {
  const next = clone(slide as Obj);
  const ordered = blocksInCellOrder(next);
  if (!ordered.length) throw refuse("This slide places no blocks in cells.");
  next.blocks = ordered.map(withoutCell);
  const loss = new Loss();
  loss.note("cell placement");
  return finish(next, loss, ["blocks", 0]);
}

/** Move the blocks of cell `from` to cell `to`, or swap the two cells' blocks when `to` is taken and `swap` is true. */
export function moveRegion(slide: unknown, from: string, to: string, options: { swap?: boolean } = {}): StructureChange {
  const next = clone(slide as Obj);
  const placed = cellBlocks(next) ?? [];
  const first = placed.find((entry) => entry.cell === from);
  if (!first) throw refuse(`This slide has no block in the "${from}" cell.`, { region: from });
  if (!isGridCell(to)) throw notACell(to);
  if (from === to) return { slide: next, changed: false, path: ["blocks", first.index], ...report([]) };
  const occupied = placed.some((entry) => entry.cell === to);
  if (occupied && !options.swap) throw refuse(`The "${to}" cell already has blocks. Choose to swap the two cells instead.`, { region: to });
  const clash = placed.find((entry) => entry.cell !== from && entry.cell !== to && overlaps(entry.cell, to));
  if (clash) throw refuse(`Cell "${to}" overlaps cell "${clash.cell}".`, { region: to });
  for (const entry of placed) {
    if (entry.cell === from) next.blocks[entry.index].region = to;
    else if (options.swap && entry.cell === to) next.blocks[entry.index].region = from;
  }
  return finish(next, new Loss(), ["blocks", first.index]);
}

// --- images between content and design ---------------------------------------------------------

/** The design slot an image can move to or from. Placing an image beside the content is not a move: set the block's `placement`. */
export type ImageTarget = "background" | "watermark";
export interface PromoteImageOptions {
  /** Watermark: opacity from 0 to 1 (default 0.1). */
  opacity?: number;
  /** Replace the slide's existing design value for this slot instead of refusing. */
  replace?: boolean;
}

/** Image block keys a background keeps (FA-22): the rest of the treatment vocabulary has no place on a background. */
const BACKGROUND_KEYS = ["fit", "focus", "opacity", "overlay"] as const;
const TREATMENT_KEYS = ["fit", "focus", "aspectRatio", "shape", "adjust", "stroke", "opacity", "recolor", "overlay", "placement", "portrait"] as const;

function imageBlock(payload: Json): { asset: Obj; treatments: Obj } {
  if (!isRecord(payload)) throw refuse("Choose an image block.");
  const keys = Object.keys(payload).filter((key) => key !== "id" && key !== "extensions" && key !== "type" && key !== "region" && !(TREATMENT_KEYS as readonly string[]).includes(key));
  if (keys.length !== 1 || keys[0] !== "image") throw refuse("Choose a block that holds only an image.");
  const treatments = Object.fromEntries(TREATMENT_KEYS.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]));
  return { asset: isRecord(payload.image) ? payload.image : { src: payload.image }, treatments };
}

/** Remove the payload at `path` from a slide, dropping any group or `blocks` array it leaves empty. */
function removePayload(slide: Obj, path: SlidePath): void {
  if (!path.length) {
    for (const key of [...CONTENT_KEYS, "type"]) delete slide[key];
    return;
  }
  const index = path.at(-1);
  if (typeof index === "number" && path.at(-2) === "blocks") {
    const owner = at(slide, path.slice(0, -2));
    owner.blocks.splice(index, 1);
    if (owner.blocks.length) return;
    if (path.length === 2) delete slide.blocks;
    else removePayload(slide, path.slice(0, -2));
    return;
  }
  throw refuse("Choose an image block of this slide.", { path });
}

/**
 * Move the image block at `path` out of the content and into the slide's design as its background or
 * watermark. The block is removed (and any group it leaves empty). A background keeps the alt text and the
 * block's fit, focus, opacity and overlay; asset details and treatments a design slot cannot hold are reported.
 * Refuses when the slide already sets that slot, unless `replace` is true.
 */
export function promoteImage(slide: unknown, path: SlidePath, to: ImageTarget, options: PromoteImageOptions = {}): StructureChange {
  const next = clone(slide as Obj);
  const holder = path.length ? at(next, path) : contentKeysOf(next).join() === "image" && !Array.isArray(next.blocks) ? { image: next.image } : undefined;
  if (to !== "background" && to !== "watermark") throw refuse("Choose background or watermark.", { slot: to });
  const { asset, treatments } = imageBlock(holder);
  if (typeof asset.src !== "string" || asset.src === "") throw refuse("This image has no source.");
  const design: Obj = isRecord(next.design) ? next.design : {};
  if (design[to] !== undefined && design[to] !== false && !options.replace) throw refuse(`This slide already sets its ${to}. Choose to replace it, or remove it first.`, { slot: to });
  const loss = new Loss();
  const extras = ["title", "description", "mediaType", "format", "callouts"].filter((key) => asset[key] !== undefined);
  const alt = typeof asset.alt === "string" && asset.alt !== "" ? asset.alt : undefined;
  const kept = to === "background" ? BACKGROUND_KEYS.filter((key) => treatments[key] !== undefined) : [];
  const dropped = Object.keys(treatments).filter((key) => !(kept as readonly string[]).includes(key));
  if (to === "background") {
    design.background = { type: "image", src: asset.src, ...(alt ? { alt } : {}), ...Object.fromEntries(kept.map((key) => [key, treatments[key]])) };
  } else {
    const opacity = options.opacity ?? 0.1;
    if (typeof opacity !== "number" || !(opacity >= 0 && opacity <= 1)) throw refuse("Watermark opacity must be between 0 and 1.", { opacity });
    design.watermark = { src: asset.src, opacity };
    if (alt) loss.note("image alt text");
  }
  if (extras.length) loss.note(`image ${extras.join(", ")}`);
  if (dropped.length) loss.note(`image ${dropped.join(", ")}`);
  if (path.length) {
    const payload = at(next, path);
    if (payload.id !== undefined) loss.note("block id");
    if (payload.extensions !== undefined) loss.note("block extensions");
  }
  next.design = design;
  removePayload(next, path);
  return finish(next, loss);
}

/**
 * Move a slide's background image or watermark back into its content as an image block, added after the
 * existing blocks (or at `index`, or in the free cell named by `region` on a slide that places its blocks in cells). A
 * background's alt text, fit, focus, opacity and overlay move onto the block; a tile fit and a watermark's
 * opacity cannot be kept and are reported.
 */
export function demoteImage(slide: unknown, from: ImageTarget, options: { index?: number; region?: string } = {}): StructureChange {
  const next = clone(slide as Obj);
  const design = next.design;
  if (from !== "background" && from !== "watermark") throw refuse("Choose background or watermark.", { slot: from });
  const value = isRecord(design) ? design[from] : undefined;
  if (value === undefined || value === false) throw refuse(`This slide does not set its own ${from}.`, { slot: from });
  const loss = new Loss();
  let asset: Obj;
  let treatments: Obj = {};
  if (from === "background") {
    const picture = typeof value === "string" && IMAGE_SOURCE.test(value) ? { type: "image", src: value } : value;
    if (!isRecord(picture) || picture.type !== "image" || typeof picture.src !== "string") throw refuse("This slide's background is not an image.");
    asset = { src: picture.src, ...(typeof picture.alt === "string" ? { alt: picture.alt } : {}) };
    treatments = Object.fromEntries(BACKGROUND_KEYS.filter((key) => picture[key] !== undefined && !(key === "fit" && picture.fit === "tile")).map((key) => [key, picture[key]]));
    if (picture.fit === "tile") loss.note("background tile fit");
  } else {
    if (typeof value === "string") asset = { src: value };
    else if (isRecord(value) && typeof value.src === "string") {
      const { opacity, ...rest } = value;
      asset = rest;
      if (opacity !== undefined) loss.note("watermark opacity");
    } else throw refuse("This watermark has no image of its own.");
  }
  const block: Obj = { image: Object.keys(asset).length === 1 ? asset.src : asset, ...treatments };
  delete design[from];
  if (!Object.keys(design).length) delete next.design;
  const placed = cellBlocks(next);
  let path: SlidePath;
  if (placed) {
    if (!options.region || !isGridCell(options.region) || placed.some((entry) => overlaps(entry.cell, options.region!))) throw refuse("This slide places its blocks in cells. Choose a free cell for the image.", { region: options.region });
    next.blocks.push({ region: options.region, ...block });
    path = ["blocks", next.blocks.length - 1];
  } else if (Array.isArray(next.blocks) || contentKeysOf(next).length || Object.keys(treatments).length) {
    const blocks = explicitBlocks(next);
    const index = options.index ?? blocks.length;
    if (!Number.isInteger(index) || index < 0 || index > blocks.length) throw refuse("The position is outside the slide's blocks.", { index });
    blocks.splice(index, 0, block);
    path = ["blocks", index];
  } else {
    next.image = block.image;
    path = [];
  }
  return finish(next, loss, path);
}
