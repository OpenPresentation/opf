import { isRecord } from "./content-walk.js";

/**
 * The deck's speakers and organizations as records, in document order (the
 * root `speaker` and `organization` fields are an object or an array). Shared by
 * built-in variables and generated header/footer fields so they pick the same
 * entries. Internal module: not part of the package exports.
 */
function recordsOf(value: unknown): Record<string, unknown>[] {
  return (Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]).filter(isRecord);
}

export function speakersOf(presentation: unknown): Record<string, unknown>[] {
  return isRecord(presentation) ? recordsOf(presentation.speaker) : [];
}

export function organizationsOf(presentation: unknown): Record<string, unknown>[] {
  return isRecord(presentation) ? recordsOf(presentation.organization) : [];
}

/** The first speaker, or undefined. */
export function primarySpeaker(presentation: unknown): Record<string, unknown> | undefined {
  return speakersOf(presentation)[0];
}

/** The organization with `role: 'primary'`, else the first one (the rule composition uses for the deck logo and furniture). */
export function primaryOrganization(presentation: unknown): Record<string, unknown> | undefined {
  const organizations = organizationsOf(presentation);
  return organizations.find((item) => item.role === "primary") ?? organizations[0];
}
