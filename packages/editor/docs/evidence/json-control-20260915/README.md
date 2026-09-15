# Reusable JSON control checkpoint — September 15, 2026

Implementation: `b3368e6`. This is an unreleased candidate built from editor main, independent of the furniture and font-shaping branches. It extracts the public website's JSON control and contextual-choice logic into optional package entrypoints. No website appearance or production dependency was changed.

## Passing checks

- Node 24.21.0: source-preservation and contextual-option regressions, syntax checks, package metadata checks and imports without a DOM.
- Seven offline Chromium workflows from the checkout using registry dependencies, then the same seven from a clean installed tarball. Both reports retain browser versions, verifier/bundle hashes, zero page errors and zero requests.
- Real keyboard/pointer behavior covers nested indentation, quote/bracket pairing, bullets/commas, mixed source endings, native undo after an unrelated external edit, schema/catalog menus, filtering, exact token replacement, stale menus, search, formatting and disposal/remount.
- The clipboard case dispatches a browser ClipboardEvent containing observed plain text; it does not claim an OS clipboard or real IME workflow.
- All 37 installed runtime/type files and the package manifest match this candidate. The README was subsequently expanded; the runtime audit says so. The installed graph uses registry dependencies without sibling runtime links. No new package version was published.
- Registry audit: zero known vulnerabilities, 24 verified package signatures, one verified attestation. Public declarations pass strict TypeScript 5.9.3 compilation from the installed consumer using the retained fixture.
- Full `npm test` passes after the repository's existing `link-ecosystem.mjs --packages-only` setup. That coordinated run used core `89ba5a8`, renderer `dcd77ea`, and PPTX `1363a65`; source acceptance does not establish registry predecessor compatibility for unrelated editor features.

## Retained limits and failures

The full editor suite against registry predecessors still fails `test/layout.mjs:51` because those packages lack the existing unreleased `frameBox` behavior. Its complete failed log is retained alongside the passing coordinated log. Focused JSON checks pass with registry dependencies; no existing layout test was weakened or skipped to claim a full-package pass.

During development, a duplicate-key test initially selected an unavailable fixture option and hit the unavailable-choice guard; the corrected fixture selects its loaded option and verifies the duplicate-key rejection. The first browser attempt timed out opening the options dialog because its generated IDs depended on `crypto.randomUUID` in a nonsecure context. The menu now uses document-unique IDs without a secure-context dependency, and the corrected complete workflows pass. An initial npm pack attempt could not write the sandboxed npm cache; packaging succeeded with an isolated temporary cache, without changing global ownership or permissions.

Host applications still own authoritative drafts, OPF validation, last-valid preview, session history and persistence. These tests do not establish renderer/native-PowerPoint fidelity, package publication, or production adoption. CI runs the browser suite from both checkout and the coordinated installed consumer.

## Reproduce

Use Node 24 and the checked-in lockfile. Run `npm run test:json`, then `npm run test:json-browser -- report.json`. For an already installed consumer, append its absolute directory after the report path; the verifier rejects runtime imports outside that consumer's node_modules. Use the existing coordinated linking/packaging tooling for the full editor suite. `manifest.json` records both compressed and original-byte hashes for every retained report.
