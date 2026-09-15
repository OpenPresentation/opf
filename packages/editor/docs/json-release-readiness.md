# JSON control release checks

The reusable JSON control is merged in PR19. Publication must verify the source browser workflows and the actual installed tarball's public JSON entrypoint. The trusted release workflow now runs the source JSON browser suite. `npm run test:packed` adds both JSON model suites and seven offline installed browser workflows, and byte-checks all shipped files after that browser run.

The installed test retains `artifacts/packed-json-browser-node24.json` and `artifacts/packed-json-consumer-node24.json` before continuing the existing whole-package checks. These reports establish JSON-control behavior only. They do not turn a later failure into release acceptance; every existing gate must still pass and the overall command must exit successfully.

At the earlier September 15 checkpoint, the tested registry predecessors were editor 0.6.0, core 0.9.0 and renderer/PPTX 0.7.0. The current editor's other merged features require newer coordinated core/renderer APIs. Its full suite with the registry predecessors fails the `frameBox` assertion in `test/layout.mjs`; that failure is retained in PR19 evidence. Coordinate dependency versions and full installed-package acceptance before tagging a new release. This change does not alter versions or runtime source and does not publish a package. The next release requires Node 24; existing npm versions remain immutable.

[Earlier verification evidence](evidence/json-release-checks-20260915/README.md) retains the passing source/installed JSON checks and the complete renewed package failure. The installed report byte-matches all 39 shipped files with actual registry predecessors; it does not replace the overall command result.

## Editor 0.7.0 release candidate

Core 0.10.0 and renderer/PPTX 0.8.0 are now published. Clean installation and the complete editor 0.7.0 packed/source checks pass against those registry dependencies, including all seven offline JSON workflows and the later full-package gates. [The new release checkpoint](evidence/release-0.7.0/README.md) records this acceptance. CI and publication of editor 0.7.0 remain required before hosts adopt its new exports.

## Layout discovery

The JSON layout picker pins the current layout, then groups available records by
exact placeholder types and counts, compatible text/subtitle slots, different
counts of those types, other layouts, and unspecified placeholders. Names sort
alphabetically with numeric ordering inside each group. The Similar filter shows
the current layout plus exact/compatible alternatives; search always covers all
available layouts. Matching describes declared placeholders, not rendering or
content-fit guarantees. Unknown placeholder definitions are never assumed to match.

Record resolution remains document > host-supplied > standard for the same ID.
The stable `source` API values remain `Document catalog`, `Loaded catalog`, and
`Built-in catalog`; `sourceLabel` and `sourceDescription` provide the clearer UI
labels `In this document`, `Provided by app`, and `Standard OPF`. External gallery
or catalog URLs are not automatically loaded. The website carries the same option
logic locally until a published editor package can replace its existing adapter.
