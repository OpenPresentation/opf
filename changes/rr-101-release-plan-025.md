---
type: changed
packages: []
---
Roll `release-plan.json`, the published consumer lock, the quickstart, CLI guide, compatibility matrix, README and live-editor install command to the registry's 0.25.0 set: core, renderer, PPTX and editor 0.25.0 with Gallery 5.0.0. The plan keeps CLI 0.24.1, the registry's latest, whose peer ranges conflict with the 0.25 libraries, so the registry scripts skip it (`release-plan-cli.mjs`) until CLI 0.25.0 is published; the docs install the 0.25 libraries without it.
The published-matrix helpers know the catalog contract of core 0.25 (generation 4, Gallery 5). The 0.24.2 published-control tooling bridge and the font-switch harness's Gallery 4 grid reader are removed: they only straddled the old plan.
The `@openpresentation/opf-render` and `@openpresentation/opf-pptx` development dependencies of core and the CLI move to 0.25.0, so core's and the CLI's tests and `opf doctor` run through the renderer and PPTX packages their peer ranges name.
