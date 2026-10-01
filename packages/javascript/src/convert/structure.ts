// Slide structure conversions: wrap blocks in a group, unwrap a group, move content between `blocks` and the
// named regions, and move an image between the content and the slide's design (slide image, background,
// watermark). They work on one slide object with paths relative to it and return the new slide; the host
// turns the difference into a patch. Pure; every result is validated as OPF. Internal module.
import { promotedRegionKeys } from "../content-walk.js";
import { CONTENT_KEYS, type ConversionReport, type Json, Loss, type Obj, assertValidOutput, clone, contentKeysOf, isRecord, refuse, report } from "./shared.js";

/** A path inside one slide: `["blocks", 1]` is its second block, `["left"]` the payload of its `left` region, `[]` the slide itself. */
export type SlidePath = (string | number)[];

export interface StructureChange extends ConversionReport {
  /** The slide after the change. */
  slide: Obj;
  changed: boolean;
  /** Where the affected block now is (the new group, the first unwrapped child, the moved image block). */
  path?: SlidePath;
}

const REGION_KEYS = new Set<string>(promotedRegionKeys);
export const isRegionKey = (key: string): boolean => REGION_KEYS.has(key);
export const regionKeysOf = (slide: Obj): string[] => Object.keys(slide).filter(isRegionKey);

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
  if (path.length < 2 || path.at(-2) !== "blocks" || typeof index !== "number") throw refuse("Only a group that sits inside a list of blocks can be unwrapped. Convert the regions to blocks first.", { path });
  const parent = at(next, path.slice(0, -2));
  const loss = new Loss();
  if (group.composition) loss.note("group arrangement (composition)");
  if (group.id !== undefined) loss.note("group id");
  if (group.extensions !== undefined) loss.note("group extensions");
  parent.blocks.splice(index, 1, ...group.blocks);
  return finish(next, loss, [...path.slice(0, -1), index]);
}

// --- blocks and regions ------------------------------------------------------------------------

const ROWS = ["top", "middle", "bottom"];
const COLUMNS = ["left", "center", "right"];
/** The grid cells a region key covers: `left+center` is the whole left and center columns, `top:left` one cell. */
function cellsOf(key: string): Set<string> {
  const [first = "", second] = key.split(":");
  const parts = (text: string): string[] => text.split("+");
  let rows = ROWS;
  let columns = COLUMNS;
  if (second !== undefined) {
    rows = parts(first);
    columns = parts(second);
  } else if (ROWS.includes(parts(first)[0]!)) rows = parts(first);
  else columns = parts(first);
  return new Set(rows.flatMap((row) => columns.map((column) => `${row}:${column}`)));
}
const overlaps = (a: string, b: string): boolean => {
  const other = cellsOf(b);
  return [...cellsOf(a)].some((cell) => other.has(cell));
};
/** Regions in reading order: top row first, then left to right, by the first cell each covers. */
export function sortRegionKeys(keys: string[]): string[] {
  const rank = (key: string): [number, number] => {
    const cells = [...cellsOf(key)].map((cell) => cell.split(":") as [string, string]);
    return [Math.min(...cells.map(([row]) => ROWS.indexOf(row))), Math.min(...cells.map(([, column]) => COLUMNS.indexOf(column)))];
  };
  return [...keys].sort((a, b) => {
    const [ar, ac] = rank(a);
    const [br, bc] = rank(b);
    return ar - br || ac - bc || keys.indexOf(a) - keys.indexOf(b);
  });
}

/**
 * Move every block of a slide into its own named region. `regions[i]` is the region key of block i (`left`,
 * `right`, `top:left`, ...); every block needs a distinct region and the regions may not overlap, because a
 * slide cannot hold both `blocks` and regions. Nothing is lost.
 */
export function blocksToRegions(slide: unknown, regions: string[]): StructureChange {
  const next = clone(slide as Obj);
  if (regionKeysOf(next).length) throw refuse("This slide already uses named regions.");
  const blocks = explicitBlocks(next);
  if (!blocks.length) throw refuse("This slide has no blocks to place.");
  if (regions.length !== blocks.length) throw refuse(`Name a region for each of the ${blocks.length} blocks.`, { blocks: blocks.length, regions: regions.length });
  regions.forEach((key, index) => {
    if (!isRegionKey(key)) throw refuse(`"${key}" is not a region (for example left, right, top:left, center+right).`, { region: key });
    const clash = regions.findIndex((other, otherIndex) => otherIndex < index && overlaps(other, key));
    if (clash >= 0) throw refuse(`Region "${key}" overlaps region "${regions[clash]}". Each block needs its own part of the slide.`, { region: key });
  });
  delete next.blocks;
  regions.forEach((key, index) => {
    next[key] = blocks[index];
  });
  return finish(next, new Loss(), [regions[0]!]);
}

/**
 * Turn the named regions of a slide into ordinary blocks, in reading order (top to bottom, left to right).
 * The position each region gave its content cannot be kept and is reported.
 */
export function regionsToBlocks(slide: unknown): StructureChange {
  const next = clone(slide as Obj);
  const keys = sortRegionKeys(regionKeysOf(next));
  if (!keys.length) throw refuse("This slide has no named regions.");
  const blocks = keys.map((key) => next[key]);
  for (const key of keys) delete next[key];
  next.blocks = blocks;
  const loss = new Loss();
  loss.note("region placement");
  return finish(next, loss, ["blocks", 0]);
}

/** Move the content of region `from` to region `to`, or swap the two when `to` is taken and `swap` is true. */
export function moveRegion(slide: unknown, from: string, to: string, options: { swap?: boolean } = {}): StructureChange {
  const next = clone(slide as Obj);
  if (!isRegionKey(from) || next[from] === undefined) throw refuse(`This slide has no "${from}" region.`, { region: from });
  if (!isRegionKey(to)) throw refuse(`"${to}" is not a region (for example left, right, top:left, center+right).`, { region: to });
  if (from === to) return { slide: next, changed: false, path: [from], ...report([]) };
  const occupied = next[to] !== undefined;
  if (occupied && !options.swap) throw refuse(`The "${to}" region already has content. Choose to swap the two regions instead.`, { region: to });
  const others = regionKeysOf(next).filter((key) => key !== from && key !== (options.swap ? to : undefined));
  const clash = others.find((key) => overlaps(key, to) && key !== to);
  if (clash) throw refuse(`Region "${to}" overlaps region "${clash}".`, { region: to });
  const entries = Object.entries(next).map(([key, value]): [string, Json] => (key === from ? [to, value] : options.swap && key === to ? [from, value] : [key, value]));
  const rebuilt = Object.fromEntries(entries);
  if (!occupied) rebuilt[to] = next[from];
  return finish(rebuilt, new Loss(), [to]);
}

// --- images between content and design ---------------------------------------------------------

/** The design slot an image can move to or from. */
export type ImageTarget = "slideImage" | "background" | "watermark";
const IMAGE_POSITIONS = ["background", "top", "bottom", "left", "right"] as const;
export interface PromoteImageOptions {
  /** Slide image: where it sits (default `right`, an image band beside the content). Ignored for background and watermark. */
  position?: (typeof IMAGE_POSITIONS)[number];
  /** Watermark: opacity from 0 to 1 (default 0.1). */
  opacity?: number;
  /** Replace the slide's existing design value for this slot instead of refusing. */
  replace?: boolean;
}

function imageAsset(payload: Json): Obj {
  if (!isRecord(payload)) throw refuse("Choose an image block.");
  const keys = Object.keys(payload).filter((key) => key !== "id" && key !== "extensions" && key !== "type");
  if (keys.length !== 1 || keys[0] !== "image") throw refuse("Choose a block that holds only an image.");
  return isRecord(payload.image) ? payload.image : { src: payload.image };
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
  if (path.length === 1 && isRegionKey(String(path[0]))) {
    delete slide[path[0]!];
    return;
  }
  throw refuse("Choose an image block of this slide.", { path });
}

/**
 * Move the image block at `path` out of the content and into the slide's design as its slide image,
 * background or watermark. The block is removed (and any group it leaves empty). Alt text, titles and other
 * asset details a design slot cannot hold are reported. Refuses when the slide already sets that slot,
 * unless `replace` is true.
 */
export function promoteImage(slide: unknown, path: SlidePath, to: ImageTarget, options: PromoteImageOptions = {}): StructureChange {
  const next = clone(slide as Obj);
  const holder = path.length ? at(next, path) : contentKeysOf(next).join() === "image" && !Array.isArray(next.blocks) ? { image: next.image } : undefined;
  const asset = imageAsset(holder);
  if (typeof asset.src !== "string" || asset.src === "") throw refuse("This image has no source.");
  const design: Obj = isRecord(next.design) ? next.design : {};
  if (design[to] !== undefined && design[to] !== false && !options.replace) throw refuse(`This slide already sets its ${to === "slideImage" ? "slide image" : to}. Choose to replace it, or remove it first.`, { slot: to });
  const loss = new Loss();
  const extras = ["title", "description", "mediaType", "format"].filter((key) => asset[key] !== undefined);
  const position = options.position ?? "right";
  if (!IMAGE_POSITIONS.includes(position)) throw refuse(`Choose a position: ${IMAGE_POSITIONS.join(", ")}.`, { position });
  const alt = typeof asset.alt === "string" && asset.alt !== "" ? asset.alt : undefined;
  if (to === "slideImage") {
    design.slideImage = { src: asset.src, position, ...(alt ? { alt } : {}) };
    if (extras.length) loss.note(`image ${extras.join(", ")}`);
  } else if (to === "background") {
    design.background = { type: "image", image: { src: asset.src, fit: "cover" } };
    if (alt) loss.note("image alt text");
    if (extras.length) loss.note(`image ${extras.join(", ")}`);
  } else {
    const opacity = options.opacity ?? 0.1;
    if (typeof opacity !== "number" || !(opacity >= 0 && opacity <= 1)) throw refuse("Watermark opacity must be between 0 and 1.", { opacity });
    design.watermark = { src: asset.src, opacity };
    if (alt) loss.note("image alt text");
    if (extras.length) loss.note(`image ${extras.join(", ")}`);
  }
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
 * Move a slide's slide image, background image or watermark back into its content as an image block, added
 * after the existing blocks (or at `index`, or in the free region named by `region` on a slide that uses
 * regions). Placement, framing, fit and opacity cannot be kept by a block and are reported.
 */
export function demoteImage(slide: unknown, from: ImageTarget, options: { index?: number; region?: string } = {}): StructureChange {
  const next = clone(slide as Obj);
  const design = next.design;
  const value = isRecord(design) ? design[from] : undefined;
  if (value === undefined || value === false) throw refuse(`This slide does not set its own ${from === "slideImage" ? "slide image" : from}.`, { slot: from });
  const loss = new Loss();
  let asset: Obj;
  if (from === "slideImage") {
    if (typeof value === "string") asset = { src: value };
    else if (isRecord(value) && "position" in value) {
      if (typeof value.src !== "string") throw refuse("This slide image only configures placement; it has no image of its own.");
      asset = { src: value.src, ...(value.alt ? { alt: value.alt } : {}) };
      loss.note("image position and framing");
    } else asset = clone(value);
  } else if (from === "background") {
    if (!isRecord(value) || value.type !== "image" || typeof value.image?.src !== "string") throw refuse("This slide's background is not an image.");
    asset = { src: value.image.src };
    if (value.opacity !== undefined || (value.image.fit !== undefined && value.image.fit !== "cover")) loss.note("background fit and opacity");
  } else {
    if (typeof value === "string") asset = { src: value };
    else if (isRecord(value) && typeof value.src === "string") {
      const { opacity, ...rest } = value;
      asset = rest;
      if (opacity !== undefined) loss.note("watermark opacity");
    } else throw refuse("This watermark has no image of its own.");
  }
  const block: Obj = { image: Object.keys(asset).length === 1 ? asset.src : asset };
  delete design[from];
  if (!Object.keys(design).length) delete next.design;
  const regions = regionKeysOf(next);
  let path: SlidePath;
  if (regions.length) {
    if (!options.region || !isRegionKey(options.region) || regions.some((key) => overlaps(key, options.region!))) throw refuse("This slide places its content in regions. Choose a free region for the image.", { region: options.region });
    next[options.region] = block;
    path = [options.region];
  } else if (Array.isArray(next.blocks) || contentKeysOf(next).length) {
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
