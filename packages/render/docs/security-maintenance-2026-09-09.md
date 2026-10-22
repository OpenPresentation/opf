# Dependency maintenance — September 9, 2026 UTC

The existing npm lockfile has no known audit advisories. Frozen installs and the complete standalone tests pass on Windows Node 20 and 24, including the unchanged 126-deck/805-slide raster baseline. Package metadata and syntax checks pass. This maintenance change does not alter package versions, runtime source or published renderer 0.5.0.

Dependabot now checks weekly on Monday at 09:00 America/Los_Angeles, groups minor/patch updates, separates security groups and limits routine npm/action PR counts to three/two. Major updates remain individual reviews; no advisory or version is ignored. Security updates are not held until the routine weekly schedule.

CI and publication use the reviewed immutable checkout 7.0.1 and setup-node 7.0.0 commits, disable persisted checkout credentials and run unfiltered npm audit. Main-branch and PR verification remain; the obsolete development-branch push trigger is removed to avoid duplicate checks and notices when that branch has a PR. Publication still requires its existing tag/version gate and tests; no release is triggered by this change. Final CI and review must pass before merging.
