// Review (RR-29): the headless model behind the Review panel. It runs core's design and accessibility audit
// (`auditPresentation`) over the session's document, turns a finding into something an editor can act on (the
// slide and the nearest existing path to select) and applies its suggested fixes through the session, so every
// fix is a validated, undoable JSON Patch edit like any other. Importing this module needs no DOM.
// Core is read from the namespace so an older core still loads this module; the audit then throws "audit-unavailable".
import * as core from "@openpresentation/opf";
import { OPFEditorError, getValueAtPath, hasValueAtPath, jsonPointerToOpfPath, opfPathToJsonPointer, splitOpfPath } from "./index.js";
import { assetIdOf, prepareAssetAlt } from "./assets.js";

/** True when the installed core ships the audit (`@openpresentation/opf` after 0.11.4). */
export function auditAvailable() {
  return typeof core.auditPresentation === "function";
}

function fail(code, message, details) {
  return new OPFEditorError(code, message, details);
}

const SEVERITIES = ["error", "warning", "info"];
const RANK = { error: 3, warning: 2, info: 1 };
export const reviewSeverities = Object.freeze([...SEVERITIES]);

/**
 * Audit a document. `options` are core's `AuditOptions` (severity per rule, `ignore`, thresholds, `textMeasurement`, ...);
 * pass `options.audit` to use another audit function. Returns core's report.
 */
export function runAudit(document, options = {}) {
  const { audit = core.auditPresentation, ...auditOptions } = options;
  if (typeof audit !== "function") {
    throw fail("audit-unavailable", "The review needs a core release that ships the audit (@openpresentation/opf after 0.11.4).");
  }
  return audit(document, auditOptions);
}

/**
 * The review's findings: core's diagnostics with an `id` unique within the report, the slide index (or null for
 * the deck) and `dottedPath`, the OPF path to select. Sorted by slide, then severity (errors first), then rule.
 */
export function reviewFindings(report) {
  const seen = new Map();
  return (report?.diagnostics ?? []).map((diagnostic) => {
    const base = `${diagnostic.ruleId}|${diagnostic.path}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return {
      ...diagnostic,
      id: count ? `${base}#${count}` : base,
      slide: Number.isInteger(diagnostic.slide) ? diagnostic.slide : slideOfPointer(diagnostic.path),
      dottedPath: safeDotted(diagnostic.path),
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
  const counts = { error: 0, warning: 0, info: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  return { ...counts, total: findings.length };
}

/** Findings at or above `minimum` severity (`info` keeps all), optionally only those of one slide (or the deck, `null`). */
export function filterFindings(findings, { minimum = "info", slide } = {}) {
  return findings.filter((finding) => RANK[finding.severity] >= RANK[minimum] && (slide === undefined || finding.slide === slide));
}

/**
 * Where "go to" lands for a finding: the slide and the deepest existing path on the finding's way (a finding about
 * a missing field points at the field's parent). `path` is the OPF dotted path a host selects; `pointer` the JSON Pointer.
 */
export function findingTarget(document, finding) {
  const segments = splitOpfPath(finding.path ?? "");
  let length = segments.length;
  while (length > 0 && !hasValueAtPath(document, segments.slice(0, length))) length -= 1;
  const kept = segments.slice(0, length);
  const slide = kept[0] === "slides" && /^\d+$/.test(kept[1] ?? "") ? Number(kept[1]) : null;
  return { slide, path: kept.join("."), pointer: opfPathToJsonPointer(kept), exact: length === segments.length };
}

const PATCH_OPS = new Set(["add", "replace", "remove"]);
const MAX_FIX_OPERATIONS = 4;

function checkPatch(document, operations) {
  if (!Array.isArray(operations) || !operations.length || operations.length > MAX_FIX_OPERATIONS) {
    throw fail("invalid-fix", `A review fix changes one to ${MAX_FIX_OPERATIONS} fields.`);
  }
  for (const operation of operations) {
    if (!operation || !PATCH_OPS.has(operation.op) || typeof operation.path !== "string" || !operation.path.startsWith("/") || operation.path === "/") {
      throw fail("invalid-fix", "A review fix may add, replace or remove a field below the document root.", { operation });
    }
    // The finding is stale when the field it was about has since changed: refuse instead of guessing.
    if ((operation.op === "replace" || operation.op === "remove") && !hasValueAtPath(document, operation.path)) {
      throw fail("stale-finding", "The slide has changed since this finding was made. The review has been refreshed; apply the fix again if it still shows.", { operation });
    }
  }
}

/**
 * Apply one `patch` fix of a finding as a single undoable session change (validated: a fix that would make the
 * document invalid is rejected). Returns the session's change.
 */
export function applyReviewFix(editor, finding, fix, meta = {}) {
  if (!editor || typeof editor.applyPatch !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
  if (!fix || fix.kind !== "patch") throw fail("invalid-fix", "Only patch fixes can be applied; a focus fix asks the author to type something.");
  checkPatch(editor.document, fix.patch);
  return editor.applyPatch(fix.patch, { ...meta, source: meta.source ?? "review", ruleId: finding?.ruleId, fix: fix.id, rejectInvalid: true });
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** The patch operations that give the asset value at `pointer` alt text (`""` marks it decorative), or `null` when it already has exactly this alt. */
export function altTextPatch(document, pointer, text) {
  const value = getValueAtPath(document, pointer);
  if (value === undefined) throw fail("stale-finding", "The picture this finding is about no longer exists.", { pointer });
  const alt = String(text ?? "");
  const id = assetIdOf(value);
  const entry = id === undefined ? undefined : getValueAtPath(document, ["assets", id]);
  // A picture that points into the assets registry gets its alt text there, so every use of the asset has it.
  if (id !== undefined && entry !== undefined) {
    // prepareAssetAlt treats "" as "remove the alt"; an empty alt here is the decorative choice and must stay in the document.
    if (alt !== "") return prepareAssetAlt(document, id, alt).patches;
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
  const patch = altTextPatch(editor.document, pointer, alt);
  if (!patch) return { changed: false, document: editor.document };
  return { changed: true, ...editor.applyPatch(patch, { ...meta, source: meta.source ?? "review-alt", pointer, rejectInvalid: true }) };
}

/** Mark a picture decorative (empty alt text), an explicit choice, as one undoable change. */
export function markDecorative(editor, pointer, meta = {}) {
  const patch = altTextPatch(editor.document, pointer, "");
  if (!patch) return { changed: false, document: editor.document };
  return { changed: true, ...editor.applyPatch(patch, { ...meta, source: meta.source ?? "review-decorative", pointer, rejectInvalid: true }) };
}

/** The alt text a picture has now (own or through the assets registry), for pre-filling the field. */
export function currentAltText(document, pointer) {
  const value = getValueAtPath(document, pointer);
  if (isObject(value) && typeof value.alt === "string") return value.alt;
  const id = assetIdOf(value);
  const entry = id === undefined ? undefined : getValueAtPath(document, ["assets", id]);
  return isObject(entry) && typeof entry.alt === "string" ? entry.alt : "";
}
