const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const SCHEME_SLOTS = new Set([
  "accent1", "accent2", "accent3", "accent4", "accent5", "accent6",
  "dark1", "dark2", "light1", "light2", "hyperlink", "followedHyperlink",
]);

const ROLE_KEYS = new Set([
  "primary", "secondary", "accent", "background", "surface", "text", "textSecondary",
]);

/** Whether a toolbar-authored text color matches documented ColorRef / TextRun forms. */
export function isAuthoringColorRef(value) {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value !== "string") return false;
  const ref = value.trim();
  if (ref.startsWith("#")) return HEX.test(ref);
  if (ref.startsWith("var:")) return /^var:[a-z][a-z0-9-]*$/.test(ref);
  return SCHEME_SLOTS.has(ref) || ROLE_KEYS.has(ref);
}
