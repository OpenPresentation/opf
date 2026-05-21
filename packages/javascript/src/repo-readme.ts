// The raw README.md from the OpenPresentation/opf repo at the version pinned
// by this release.
//
// Source-of-truth: ../../../README.md. The build step inlines the markdown
// into this module so consumers can render the upstream README without doing
// any filesystem or network work at runtime.
//
// The package's own README.md (npm landing page) is a separate file — this
// export is intended for sites that want to mirror the canonical upstream
// README.

import { repoReadmeRaw } from "./generated/repo-readme.js";

/** Raw markdown of the upstream OpenPresentation/opf README at this release. */
export const repoReadme: string = repoReadmeRaw;
