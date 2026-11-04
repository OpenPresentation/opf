import { applyJsonPatch, createValuePatch, splitOpfPath, opfPathToJsonPointer } from "./index.js";
import {preserveTextLineEndings} from './text-input.js';
import { firstErrorMessage, checkFormat } from "./checks.js";
export {preserveTextLineEndings} from './text-input.js';
/** Scalar fields and collection paths use JSON Pointer to preserve arbitrary object keys. */
export function getEditableFields(value, path) {
  const fields = [],
    arrays = [],
    root = splitOpfPath(path);
  const walk = (value, segments, labels) => {
    const path = opfPathToJsonPointer(segments),
      label = labels.join(" · ") || root.at(-1) || "Value";
    if (Array.isArray(value)) {
      arrays.push({ path, label, length: value.length });
      value.forEach((child, index) =>
        walk(
          child,
          [...segments, String(index)],
          [...labels, String(index + 1)],
        ),
      );
    } else if (value && typeof value === "object")
      for (const [key, child] of Object.entries(value))
        walk(child, [...segments, key], [...labels, key]);
    else
      fields.push({
        path,
        label,
        type: value === null ? "null" : typeof value,
        value,
      });
  };
  walk(value, root, []);
  return { fields, arrays };
}
export function parseCanvasValue(text, type, original) {
  if (type === "number") {
    if (!String(text).trim() || !Number.isFinite(Number(text)))
      throw new Error("Enter a finite number.");
    return Number(text);
  }
  if (type === "boolean") return text === true || text === "true";
  if (type === "null") {
    if (text === "null") return null;
    throw new Error("This field must be null.");
  }
  return type === 'string' && typeof original === 'string' ? preserveTextLineEndings(original,String(text)) : text;
}

export function createCanvasDraft(presentation, path, value) {
  const draft = applyJsonPatch(
    presentation,
    createValuePatch(presentation, path, value),
  );
  const validation = checkFormat(draft);
  if (!validation.valid)
    throw new Error(
      firstErrorMessage(validation, "This change is not valid OPF."),
    );
  return draft;
}

/** The progress states of a timeline event (`TimelineEvent.status`). */
export const TIMELINE_STATUS_CHOICES = Object.freeze(["done", "current", "planned"]);
/** The trends of a metric (`Metric.trend`); LH-123 edits them from the arrow drawn for the trend. */
export const METRIC_TREND_CHOICES = Object.freeze(["up", "down", "flat"]);
/** The fixed choices of a form field, or undefined for free text: an event's `status` inside a timeline payload, a metric's `trend`. */
export function fieldChoices(field) {
  const segments = splitOpfPath(field.path);
  if (segments.at(-1) === "trend" && segments.at(-2) === "metric") return METRIC_TREND_CHOICES;
  return segments.at(-1) === "status" && segments.at(-3) === "timeline"
    ? TIMELINE_STATUS_CHOICES
    : segments.at(-1) === "status" && segments.at(-3) === "events" && segments.at(-4) === "timeline"
      ? TIMELINE_STATUS_CHOICES
      : undefined;
}
/** Whether a form field holds Mermaid source (a diagram given as a string, or a diagram object's `source`). */
export function isDiagramSource(field) {
  const segments = splitOpfPath(field.path);
  return field.type === "string" && (segments.at(-1) === "diagram" || (segments.at(-1) === "source" && segments.at(-2) === "diagram"));
}
/**
 * A blank copy of `value`'s shape for the "Add" button: texts empty, numbers 0, booleans false, `type`, `mode` and
 * `language` kept. A timeline event's `status` is left out, so a new event starts with no status instead of a copy.
 */
export function emptyLike(value, key = "") {
  if (Array.isArray(value)) return value.map((child) => emptyLike(child));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([name]) => name !== "status")
        .map(([name, child]) => [name, emptyLike(child, name)]),
    );
  if (typeof value === "number") return 0;
  if (typeof value === "boolean") return false;
  return ["type", "mode", "language"].includes(key) ? value : "";
}
