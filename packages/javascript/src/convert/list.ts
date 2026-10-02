// List editing that is not a content-type change: promote and demote items (nesting levels) and switch
// between the `items` and `bullets` forms. Pure; the result is validated as OPF. Internal module.
import { type ConversionReport, type Json, Loss, type Obj, assertValidOwner, clone, isRecord, plainOf, refuse, report } from "./shared.js";

const listKey = (payload: Obj): "items" | "bullets" => {
  const keys = (["items", "bullets"] as const).filter((key) => Array.isArray(payload?.[key]));
  if (!isRecord(payload) || keys.length !== 1) throw refuse("Choose a payload that holds one list (items or bullets).");
  return keys[0]!;
};
const levelOf = (item: Json): number => (isRecord(item) ? (item.level ?? 0) : 0);

function withLevel(item: Json, level: number): Json {
  if (!isRecord(item)) return level > 0 ? { text: item, level } : item;
  const next: Obj = { ...item };
  if (level > 0) next.level = level;
  else delete next.level;
  // Level 0 is the default: an object that only carries its text goes back to the plain form.
  return Object.keys(next).length === 1 && next.text !== undefined ? next.text : next;
}

export interface ListLevelOptions {
  /** Move the items nested under each selected item with it (default true), so a subtree keeps its shape. */
  withChildren?: boolean;
}
export interface ListLevelChange extends ConversionReport {
  /** The list payload with the new levels. */
  payload: Obj;
  /** False when nothing could move; `reason` says why. */
  changed: boolean;
  reason?: string;
  /** The nesting level of every item after the change. */
  levels: number[];
}

/**
 * Raise (`delta` > 0, "demote", Tab) or lower (`delta` < 0, "promote", Shift+Tab) the nesting level of the
 * items at `indices`. A level never exceeds one more than the item before it and never goes below 0, so the
 * outline stays valid; the first item cannot be nested. Items under a selected item move with it unless
 * `withChildren` is false. Nothing in the text changes, so the change is lossless.
 */
export function shiftListLevels(payload: unknown, indices: number[], delta: number, options: ListLevelOptions = {}): ListLevelChange {
  const key = listKey(payload as Obj);
  const items = (payload as Obj)[key] as Json[];
  if (!Number.isInteger(delta) || delta === 0) throw refuse("Choose a level change of one or more steps in or out.");
  const selected = [...new Set(indices)].sort((a, b) => a - b);
  if (!selected.length || selected.some((index) => !Number.isInteger(index) || index < 0 || index >= items.length)) throw refuse("Choose items that exist in the list.", { indices });
  const original = items.map(levelOf);
  const levels = [...original];
  const moved = new Set<number>();
  const withChildren = options.withChildren !== false;
  for (const index of selected) {
    if (moved.has(index)) continue;
    const previous = index > 0 ? levels[index - 1]! : -1;
    const wanted = Math.max(0, original[index]! + delta);
    const level = Math.min(wanted, previous + 1);
    const applied = level - levels[index]!;
    moved.add(index);
    if (applied === 0) continue;
    levels[index] = level;
    if (withChildren) {
      for (let next = index + 1; next < items.length && original[next]! > original[index]!; next++) {
        levels[next] = Math.max(0, levels[next]! + applied);
        moved.add(next);
      }
    }
  }
  const changed = levels.some((level, index) => level !== original[index]);
  if (!changed) {
    const reason = delta > 0 ? (selected[0] === 0 ? "The first item cannot be nested under another item." : "An item can be nested only one level below the item above it.") : "These items are already at the top level.";
    return { payload: clone(payload as Obj), changed: false, reason, levels, ...report([]) };
  }
  const next = clone(payload as Obj);
  next[key] = items.map((item, index) => (levels[index] === original[index] ? clone(item) : withLevel(clone(item), levels[index]!)));
  assertValidOwner(next);
  return { payload: next, changed: true, levels, ...report([]) };
}
/** Nest the items one level deeper (the Tab key in a list). See `shiftListLevels`. */
export const demoteListItems = (payload: unknown, indices: number[], options?: ListLevelOptions): ListLevelChange => shiftListLevels(payload, indices, 1, options);
/** Move the items one level up (Shift+Tab). See `shiftListLevels`. */
export const promoteListItems = (payload: unknown, indices: number[], options?: ListLevelOptions): ListLevelChange => shiftListLevels(payload, indices, -1, options);

export interface ListFormChange extends ConversionReport {
  payload: Obj;
  changed: boolean;
}
/**
 * Switch a list between the `items` form (ListItem: text, description, level) and the `bullets` form
 * (BulletItem: text and level, which infers a text slide). Item descriptions have no place in bullets and are
 * reported as lost.
 */
export function convertListForm(payload: unknown, to: "items" | "bullets"): ListFormChange {
  const key = listKey(payload as Obj);
  if (key === to) return { payload: clone(payload as Obj), changed: false, ...report([]) };
  const loss = new Loss();
  const items = ((payload as Obj)[key] as Json[]).map((item) => {
    if (to === "bullets" && isRecord(item) && item.description !== undefined && plainOf(item.description) !== "") {
      loss.note("list item descriptions");
      const { description: _dropped, ...rest } = item;
      return clone(withLevel(rest, rest.level ?? 0));
    }
    return clone(item);
  });
  const next: Obj = {};
  for (const [name, value] of Object.entries(payload as Obj)) {
    if (name === key) next[to] = items;
    else next[name] = clone(value);
  }
  if ((payload as Obj).type === "text" || (payload as Obj).type === "list") next.type = to === "bullets" ? "text" : "list";
  assertValidOwner(next);
  return { payload: next, changed: true, ...report(loss.list) };
}
