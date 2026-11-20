# Mobile playground readiness: failure-only evidence

SOURCE ONLY; new diagnostics UNRUN. Base `6093a4d7d1a5bd38a0bcc573243068f41ffb3bda`.

FullCI sourcee210 Windows editor job130893933038 failed after a60-second visible-preview wait in `playground.open`, called from the existing state loop. The original log does not identify engine, width or state. Page/console errors accumulate in `problems`, whose assertion is reached only after the entire test succeeds. No product, asset, platform, contention or timeout cause is established. Original `/tmp/opf-e210-final-ci01/job-130893933038.log` is retained.

The existing playground-open failure path now records its engine/version, width/height, exact existing state and failed phase, plus capped page/console errors, failed/HTTP-error assets and pending requests with received status where available. After an original failure only, one read-only DOM snapshot captures readyState, status text, preview/SVG bounds/display/visibility, font status and viewport under a separate3-second diagnostic limit. The observed DOM is post-failure evidence, not proof of its state at the original deadline.

At most8fresh reports,128rows per buffer,2048-character strings and8192-character original stacks are written under the existing CI-uploaded `packages/editor/artifacts/mobile-touch-failures/` directory. Reports use fresh owned directories and exclusive writes. Diagnostic read/write errors are reported separately; the original error object is rethrown. No screenshot, trace, storage/cookie/headers/body capture or success-path artifact is added.

Every original engine/viewport/state/action/assertion, all three60-second readiness waits, existing default navigation limits, animation waits and parallel Promise.all flow remain unchanged. Existing global problem assertion remains strict; no quarantine, skip, serialization, retry, timeout increase, production or build change. This is diagnostic tooling, not a Windows fix or a successful browser qualification.

The maintained browser roster runs `node test/mobile-touch-browser.mjs` as browser:mobile-touch through scripts/quarantine.mjs. A future local check must first run the maintained fresh `pnpm --filter @openpresentation/opf-editor run build:playground` against its own coherent built packages, then the complete existing file with normal engines/state selection. Mac results cannot prove the unknown Windows cause closed; next Windows failure must retain the new JSON through the existing editor artifact upload. No execution performed in this source checkpoint.
