---
type: fixed
packages: [cli]
---
FA-08: deck-named CLI output files strip control characters with `\p{Cc}` (lint-clean; also DEL and C1 controls) instead of a `\u0000-\u001f` range. The published-packages matrix runs the font-switch harness and fixture of the published core's release tag, so an unreleased catalog shape in the checkout does not fail it.
