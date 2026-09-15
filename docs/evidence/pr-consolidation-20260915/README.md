# Shared header/footer PR consolidation — September 15, 2026

The four furniture PRs were integrated with the current published package
branches rather than restoring their older release manifests or test setup.
The new release fixes, registry acceptance checks and reviewed furniture
baseline are retained together. `furniture-runtime-heads.json` identifies the
integration commits used by each PR's coordinated CI.

Local verification uses Node 24.21.0 and the pinned package managers. The
retained logs cover complete library typecheck/validation/test suites, the
805-slide raster regression, core tests/types, ecosystem/layout/pagination/
rich-text/font suites, fresh candidate tarballs and 81 CLI checks. These are
candidate packages; no new registry publication is claimed.

Fresh installed packages pass eight general browser suites, seven JSON editor
workflows and sixteen header/footer workflows covering source editing,
generated metadata, empty fields, undo/redo, export and controlled semantic
reimport. The actual consumer lock and browser input hashes are retained.
All forty field masks, the displaced-text negative control and four complete
views are byte-identical to the earlier reviewed acceptance. Wide and portrait
local views were inspected again; the portrait's large-floor organization
wrapping is retained, not hidden by shrinking its text.

The project owner requested a separate
[PowerPoint acceptance roadmap](../../plans/powerpoint-acceptance.md). Native
Office recovery, images, tabs, font identity, provenance save/reopen and
notes-master ordering are open compatibility work, not claims established by
these portable tests. Prepared shaping remains a separate stack with an
unresolved native-browser variable-font metric comparison.

The dependency review separately merged passing maintenance PRs after refreshing
their bases, retained Node 24, and fixed actual Zod migration and lockfile
conflicts. `dependency-merge-results.json` is an intermediate operation log;
subsequent PR state and deployment acceptance must be read from GitHub.
