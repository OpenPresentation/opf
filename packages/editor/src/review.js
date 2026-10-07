// Review (RR-29, RR-55): the headless model behind the Review panel. The findings are core's: `validate(presentation)` runs the
// full check (format, references, policy, accessibility, layout and content) and returns `Finding`s with a rule id, severity,
// category, JSON Pointer path and optional `fixes`. A hosted reviewer (pptx.dev's AI review, a house style checker) returns the
// same shape through the panel's `review` hook, and `mergeFindingReports` puts both in one list keyed by `Finding.source`. This
// module turns a finding into something an editor can act on (the slide and the nearest existing path to select) and applies its
// suggested fixes through the session, so every fix is a validated, undoable JSON Patch edit like any other. Importing this
// module needs no DOM.
import { validationCategories } from "@openpresentation/opf";
import { OPFEditorError, getValueAtPath, hasValueAtPath, jsonPointerToOpfPath, opfPathToJsonPointer, splitOpfPath } from "./index.js";
import { assetIdOf, prepareAssetAlt } from "./assets.js";

function fail(code, message, details) {
  return new OPFEditorError(code, message, details);
}

const SEVERITIES = ["error", "warning", "info"];
const RANK = { error: 3, warning: 2, info: 1 };
export const reviewSeverities = Object.freeze([...SEVERITIES]);
/** Core's finding categories in the order a report lists them: format, references, policy, accessibility, layout, content. */
export const reviewCategories = validationCategories;
/** The `source` of a finding that names none: core's own checks (`Finding.source` defaults to `opf`). */
export const CORE_SOURCE = "opf";

const sourceOf = (finding) => finding?.source ?? CORE_SOURCE;

const countBySeverity = (findings) => {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const finding of findings) if (finding.severity in counts) counts[finding.severity] += 1;
  return counts;
};

/**
 * One report from core's and a hosted reviewer's. Findings are kept per `Finding.source`: a report replaces what an earlier one
 * said for the sources it carries, so the hook's findings (`pptx.dev/review`) sit beside core's (`opf`) and never overwrite them.
 * A hook finding that names no source gets `hookSource` (default `review`), so it cannot be mistaken for one of core's.
 * Returns `{ valid, findings, counts, sources }` (core's `FindingReport` plus the sources present).
 */
export function mergeFindingReports(core, hook, { hookSource = "review" } = {}) {
  const bySource = new Map();
  const add = (report, defaultSource) => {
    const fresh = new Map();
    for (const finding of report?.findings ?? []) {
      const source = finding.source ?? defaultSource;
      const entry = source === finding.source ? finding : { ...finding, source };
      if (!fresh.has(source)) fresh.set(source, []);
      fresh.get(source).push(entry);
    }
    for (const [source, list] of fresh) bySource.set(source, list);
  };
  add(core, CORE_SOURCE);
  add(hook, hookSource);
  const findings = [...bySource.values()].flat();
  const counts = countBySeverity(findings);
  return { valid: counts.error === 0, findings, counts, sources: [...bySource.keys()] };
}

/**
 * The review's findings: a report's `findings` with an `id` unique within the report, the slide index (or null for
 * the deck) and `dottedPath`, the OPF path to select.
 */
export function reviewFindings(report) {
  const seen = new Map();
  return (report?.findings ?? []).map((finding) => {
    const base = `${sourceOf(finding)}|${finding.ruleId}|${finding.path}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return {
      ...finding,
      id: count ? `${base}#${count}` : base,
      slide: Number.isInteger(finding.slide) ? finding.slide : slideOfPointer(finding.path),
      dottedPath: safeDotted(finding.path),
    };
  });
}

function slideOfPointer(pointer) {
  const match = /^\/slides\/(\d+)(?:\/|$)/.exec(pointer ?? "");
  return match ? Number(match[1]) : null;
}
function safeDotted(pointer) {
  try {
    return jsonPointerToOpfPath(pointer ?? "");
  } catch {
    return "";
  }
}

/** Counts by severity and the number of findings. */
export function countFindings(findings) {
  return { ...countBySeverity(findings), total: findings.length };
}

/** Findings at or above `minimum` severity (`info` keeps all), optionally only those of one slide (or the deck, `null`). */
export function filterFindings(findings, { minimum = "info", slide } = {}) {
  return findings.filter((finding) => RANK[finding.severity] >= RANK[minimum] && (slide === undefined || finding.slide === slide));
}

/** Findings in reading order: the deck first, then each slide; errors before warnings before notes; then by rule and path. */
export function sortFindings(findings) {
  return [...findings].sort((a, b) =>
    (a.slide ?? -1) - (b.slide ?? -1) || RANK[b.severity] - RANK[a.severity] || a.ruleId.localeCompare(b.ruleId) || a.path.localeCompare(b.path));
}

/**
 * Findings grouped by category, core's categories first in core's order, then any other category (a hosted reviewer's `narrative`,
 * ...) in the order it first appears. Each group is sorted as `sortFindings` does. Empty categories are left out.
 */
export function groupFindings(findings) {
  const groups = new Map(reviewCategories.map((category) => [category, []]));
  for (const finding of findings) {
    if (!groups.has(finding.category)) groups.set(finding.category, []);
    groups.get(finding.category).push(finding);
  }
  return [...groups].filter(([, list]) => list.length).map(([category, list]) => ({ category, findings: sortFindings(list) }));
}

/**
 * Where "go to" lands for a finding: the slide and the deepest existing path on the finding's way (a finding about
 * a missing field points at the field's parent). `path` is the OPF dotted path a host selects; `pointer` the JSON Pointer.
 */
export function findingTarget(presentation, finding) {
  const segments = splitOpfPath(finding.path ?? "");
  let length = segments.length;
  while (length > 0 && !hasValueAtPath(presentation, segments.slice(0, length))) length -= 1;
  const kept = segments.slice(0, length);
  const slide = kept[0] === "slides" && /^\d+$/.test(kept[1] ?? "") ? Number(kept[1]) : null;
  return { slide, path: kept.join("."), pointer: opfPathToJsonPointer(kept), exact: length === segments.length };
}

const PATCH_OPS = new Set(["add", "replace", "remove", "move", "copy", "test"]);
const MAX_FIX_OPERATIONS = 20;
const STALE = "The slide has changed since this finding was made. The review has been refreshed; apply the fix again if it still shows.";

function checkPatch(presentation, operations) {
  if (!Array.isArray(operations) || !operations.length || operations.length > MAX_FIX_OPERATIONS) {
    throw fail("invalid-fix", `A review fix changes one to ${MAX_FIX_OPERATIONS} fields.`);
  }
  for (const operation of operations) {
    if (!operation || !PATCH_OPS.has(operation.op) || typeof operation.path !== "string" || !operation.path.startsWith("/") || operation.path === "/") {
      throw fail("invalid-fix", "A review fix may change a field below the document root.", { operation });
    }
    // The finding is stale when the field it was about has since changed: refuse instead of guessing.
    if ((operation.op === "replace" || operation.op === "remove") && !hasValueAtPath(presentation, operation.path)) throw fail("stale-finding", STALE, { operation });
    if ((operation.op === "move" || operation.op === "copy") && (typeof operation.from !== "string" || !hasValueAtPath(presentation, operation.from))) throw fail("stale-finding", STALE, { operation });
  }
}

/**
 * Apply one `patch` fix of a finding (core's `FindingFix`: `title`, `patch`; a fix with no `kind` is a patch fix) as a single
 * undoable session change, validated: a fix that would make the document invalid is rejected. Returns the session's change.
 */
export function applyReviewFix(editor, finding, fix, meta = {}) {
  if (!editor || typeof editor.applyPatch !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
  if (!fix || (fix.kind ?? "patch") !== "patch") throw fail("invalid-fix", "Only patch fixes can be applied; a focus fix asks the author to type something.");
  checkPatch(editor.presentation, fix.patch);
  return editor.applyPatch(fix.patch, { ...meta, source: meta.source ?? "review", ruleId: finding?.ruleId, fix: fix.id, rejectInvalid: true });
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** The patch operations that give the asset value at `pointer` alt text (`""` marks it decorative), or `null` when it already has exactly this alt. */
export function altTextPatch(presentation, pointer, text) {
  const value = getValueAtPath(presentation, pointer);
  if (value === undefined) throw fail("stale-finding", "The picture this finding is about no longer exists.", { pointer });
  const alt = String(text ?? "");
  const id = assetIdOf(value);
  const entry = id === undefined ? undefined : getValueAtPath(presentation, ["assets", id]);
  // A picture that points into the assets registry gets its alt text there, so every use of the asset has it.
  if (id !== undefined && entry !== undefined) {
    // prepareAssetAlt treats "" as "remove the alt"; an empty alt here is the decorative choice and must stay in the document.
    if (alt !== "") return prepareAssetAlt(presentation, id, alt).patches;
    if (isObject(entry)) {
      if (entry.alt === "") return null;
      return [{ op: Object.hasOwn(entry, "alt") ? "replace" : "add", path: opfPathToJsonPointer(["assets", id, "alt"]), value: "" }];
    }
    return [{ op: "replace", path: opfPathToJsonPointer(["assets", id]), value: { src: entry, alt: "" } }];
  }
  if (typeof value === "string") return [{ op: "replace", path: pointer, value: { src: value, alt } }];
  if (isObject(value)) {
    if (value.alt === alt) return null;
    return [{ op: Object.hasOwn(value, "alt") ? "replace" : "add", path: `${pointer}/alt`, value: alt }];
  }
  throw fail("invalid-alt-target", "Alt text can be set on an image, video or logo.", { pointer });
}

/** Set a picture's alt text (typed by the author) as one undoable change. Empty text is refused: use `markDecorative`. */
export function setReviewAltText(editor, pointer, text, meta = {}) {
  const alt = String(text ?? "").trim();
  if (!alt) throw fail("empty-alt-text", "Write what the picture shows, or mark it decorative.", { pointer });
  const patch = altTextPatch(editor.presentation, pointer, alt);
  if (!patch) return { changed: false, presentation: editor.presentation };
  return { changed: true, ...editor.applyPatch(patch, { ...meta, source: meta.source ?? "review-alt", pointer, rejectInvalid: true }) };
}

/** Mark a picture decorative (empty alt text), an explicit choice, as one undoable change. */
export function markDecorative(editor, pointer, meta = {}) {
  const patch = altTextPatch(editor.presentation, pointer, "");
  if (!patch) return { changed: false, presentation: editor.presentation };
  return { changed: true, ...editor.applyPatch(patch, { ...meta, source: meta.source ?? "review-decorative", pointer, rejectInvalid: true }) };
}

/** The alt text a picture has now (own or through the assets registry), for pre-filling the field. */
export function currentAltText(presentation, pointer) {
  const value = getValueAtPath(presentation, pointer);
  if (isObject(value) && typeof value.alt === "string") return value.alt;
  const id = assetIdOf(value);
  const entry = id === undefined ? undefined : getValueAtPath(presentation, ["assets", id]);
  return isObject(entry) && typeof entry.alt === "string" ? entry.alt : "";
}
