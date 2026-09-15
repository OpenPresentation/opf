# JSON control release checks

The reusable JSON control is merged in PR19. Publication must verify the source browser workflows and the actual installed tarball's public JSON entrypoint. The trusted release workflow now runs the source JSON browser suite. `npm run test:packed` adds both JSON model suites and seven offline installed browser workflows, and byte-checks all shipped files after that browser run.

The installed test retains `artifacts/packed-json-browser-node24.json` and `artifacts/packed-json-consumer-node24.json` before continuing the existing whole-package checks. These reports establish JSON-control behavior only. They do not turn a later failure into release acceptance; every existing gate must still pass and the overall command must exit successfully.

As of September 15, npm still publishes editor 0.6.0, core 0.9.0 and renderer/PPTX 0.7.0. The current editor's other merged features require newer coordinated core/renderer APIs. Its full suite with the registry predecessors fails the `frameBox` assertion in `test/layout.mjs`; that failure is retained in PR19 evidence. Coordinate dependency versions and full installed-package acceptance before tagging a new release. This change does not alter versions or runtime source and does not publish a package. The next release requires Node 24; existing npm versions remain immutable.

[Current verification evidence](evidence/json-release-checks-20260915/README.md) retains the passing source/installed JSON checks and the complete renewed package failure. The installed report byte-matches all 39 shipped files with actual registry predecessors; it does not replace the overall command result.
