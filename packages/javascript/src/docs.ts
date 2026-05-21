// Bundled OPF documentation pages.
//
// Source-of-truth: ../../../docs/*.md (top-level only — `BACKLOG.md` and the
// `docs/migrations/`, `docs/plans/` subdirectories are intentionally excluded
// for now). The build step inlines the raw markdown into this module so
// consumers can render or link to the docs without filesystem access.

import { docsRaw } from "./generated/docs.js";
import type { DocRecord } from "./generated/docs.js";

export type { DocRecord };

/** Every documentation page shipped with this release, sorted by slug. */
export const docs: readonly DocRecord[] = docsRaw;

/** Look up a documentation page by slug (the filename without `.md`). */
export function getDoc(slug: string): DocRecord | undefined {
  return docsRaw.find((doc) => doc.slug === slug);
}
