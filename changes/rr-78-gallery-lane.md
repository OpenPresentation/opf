---
type: changed
packages: []
---
RR-78: the default catalog's npm package `@openpresentation/gallery` is released from its own repository, [OpenPresentation/gallery](https://github.com/OpenPresentation/gallery), by its `gallery-publish.yml` (`vX.Y.Z` tags, npm trusted publishing), on its own version line outside the lockstep train. `release-train.mjs` lists it in `INDEPENDENT_PACKAGES` (`verify gallery@X.Y.Z` checks a release); `release-plan.json` records it under `independentPackages`. The pixel-stability rule (a minor or patch release keeps every existing record's drawing and id) runs in that repository. This repository keeps its `spec/catalogs` snapshot for `@openpresentation/opf/catalog` until core depends on the package in OPF 0.19.
