# Study: bundle `jsonc-parser` into the core's build

A study of an engine request received on 2026-11-27: make `@openpresentation/opf` publish a `dist` that does not import `jsonc-parser`
at run time. No spec, schema or API change. Studied on the 0.37.0 release candidate (`main` at 4554407c9) in a scratch copy; nothing was
pushed to `main`. Everything marked *(measured)* was run in that copy; *(reported)* comes from the requesting site's own notes.

**Verdict: worth doing, small, and it works. It belongs in 0.37.1, not 0.37.0**: the real release run of 0.37.0 started on 2026-11-27 at
15:23 UTC, before the study finished.

## The problem, confirmed

- `jsonc-parser` 3.3.1 (still the latest version; no `exports` map) has `main: lib/umd/main.js` and `module: lib/esm/main.js`. Its UMD
  build loads its parts with `require("./impl/format")` through a parameter, which a bundler cannot follow.
- A consumer that bundles the core with esbuild for `platform: "node"` reads `main`. **The bundle step succeeds and the bundle throws when
  it loads** *(measured)*: `Dynamic require of "./impl/format" is not supported`, for the `validator` entry, the `source` entry and the
  package root alike.
- 14 of the core's 34 built entries load the import statically, the root, `validator`, `deck`, `patch`, `markdown`, `yaml` and `convert`
  among them, so nearly every server use of the core is affected.
- The Cloudflare adapter for Next.js bundles a server exactly this way (`platform: "node"`, ESM, `conditions: ["workerd"]`) and offers no
  setting for main fields or aliases *(read in the adapter's source, version 1.20.13)*.
- The repository already works around the same thing in three places (`scripts/build-gallery-snapshot.test.mjs`,
  `packages/integration/test/icon-sets-bundle.test.mjs`, the parity `gen-snippets.mjs`), and the gallery site in two build scripts. Each
  sets `mainFields: ["module", "main"]`, which is the option the adapter does not expose.

## The change, as tried

Three files, five lines *(measured)*:

1. `packages/javascript/tsup.config.ts`: add `/^jsonc-parser$/` to `noExternal`, beside the two ajv entries.
2. `packages/javascript/package.json`: move `jsonc-parser` from `dependencies` to `devDependencies`.
3. The lockfile.

**The request's second step is not needed.** It asks for `esbuildOptions(options) { options.mainFields = ["module", "main"] }`, saying
tsup's neutral platform has no main fields. tsup 9.0.0, which the repository uses, already sets `["browser", "module", "main"]` for every
platform but Node, and the build resolved `lib/esm/main.js` without the option *(measured)*. Leave it out: it adds configuration and
removes `browser` from the list for anything else that is ever bundled.

## What it does *(measured)*

| | Before (candidate) | After |
| --- | --- | --- |
| Built files that import `jsonc-parser` | `dist/source.js` and the validator chunk | none, in `.js` and in `.d.ts` |
| A consumer's Node bundle of `validator`, `source` and the root, with the adapter's settings | throws at load | all three load and run |
| Root entry and everything it loads | 3,318,797 B, gzip 831,680 B | 3,349,413 B, gzip 837,418 B (+30.6 KB, +5.7 KB gzip) |
| `validator` entry and everything it loads | 2,879,472 B, gzip 712,187 B | 2,910,088 B, gzip 717,936 B (the same +30.6 KB, +5.7 KB) |
| `composition` and the other 19 entries that never used it | unchanged | unchanged |
| An application that bundles the core and also imports `jsonc-parser` itself (the editor does), minified | 1,742,462 B, gzip 573,574 B | 1,753,537 B, gzip 577,262 B (+11.1 KB, +3.7 KB gzip) |

- Only the parser, the scanner and the string interning of `jsonc-parser` are bundled (tree shaking drops its formatter and editor), so
  an installation gets smaller overall: the package no longer installs `jsonc-parser` beside it.
- `scripts/check-browser-safe.mjs` passes (32 entries; the root resolves to the browser build for browser, worker, edge-light and default,
  and to the Node build for Node). `test/workerd.test.mjs` passes, 3 of 3.
- Core's test suite: 5,143 tests, 5,130 pass and 1 is skipped. The 12 that fail need the built renderer and PowerPoint packages, which the scratch copy
  did not build; they fail the same way on the unchanged build. **Not run**: the other packages' suites, the size budgets of the editor,
  the renderer and the MCP server, the packed installs and the registry consumers. The release dry run covers them.

## What the value is *(reported, not reproduced)*

The requesting site keeps the core, the PowerPoint package and the renderer inside its framework's route chunks because the core cannot
be external. Its notes of 2026-11-26 give the trial with the core external: the Worker script goes from 29,785,278 to 23,914,721 bytes
(5.9 MB less, 20%), and the first health response from 1,171 to 1,310 ms down to 966 to 1,055 ms. The same notes list work that stays
on the site's side: with the core external the `workerd` condition selects the lazy diagram engine, and the framework's file tracing
must be told about the diagram library's files. So the release unblocks the gain; it does not deliver it by itself.

Beyond that site: any server that bundles the core with esbuild for Node meets this, with a failure that shows only at run time, and the
five workarounds above can go.

## Corrections to the request's acceptance

1. **The run-time check needs the adapter's settings.** A bare esbuild bundle (`platform: "node"`, ESM) of the `source` entry or the root
   still throws after the change, for another reason: `yaml`'s Node build is CommonJS and calls `require("process")` and
   `require("buffer")`, so the bundle throws `Dynamic require of "process" is not supported` *(measured)*. The adapter gives its bundle a
   working `require` for Node builtins. The check must do the same and use `conditions: ["workerd"]`; `engine-jsonc-bundle-check.mjs`
   in this folder does, and passes on the changed build.
2. **"No file imports `jsonc-parser`" must match statements, not the name.** The bundled chunk keeps esbuild's path comments
   (`// ../../node_modules/.pnpm/jsonc-parser@3.3.1/...`), which a plain text search finds.
3. **Add the license notice.** `jsonc-parser` is MIT; once its code is inside `dist`, the package should carry its copyright notice. The
   core has no third-party notices file today, although it already bundles two ajv helpers; the gallery package has a
   `THIRD-PARTY-NOTICES.md` to copy from. One small file, listing `jsonc-parser` and the ajv helpers.
4. **Budgets.** Every entry that reaches the validator grows by 30.6 KB (5.7 KB gzipped), and bundles that also hold the editor grow by
   about 11 KB minified. Budgets with little headroom (the MCP viewer's floor, the editor's bundle) are measured and reported by the
   builder, not edited.
5. **The editor is out of scope and stays as it is.** It imports `jsonc-parser` in twelve source files and is a browser package; a
   browser bundler reads the `module` build and is not affected.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| The consumer sets main fields or an alias | The adapter exposes neither. |
| The consumer patches `jsonc-parser`'s `package.json` (`pnpm patch`, adding `exports`) | Works for one consumer and has to be repeated by every other one; a patched dependency in a deployed site is harder to keep than five lines in the core. |
| Wait for an `exports` map upstream | 3.3.1 is still the latest; its ES module build uses extensionless imports, so upstream cannot simply add one. |
| Replace `jsonc-parser` in the core | Far larger, and changes the behaviour of source location. |

## Release

- 0.37.0: not possible without cancelling the release run in flight (started 2026-11-27 15:23 UTC), then a new candidate and another dry
  run with every slow check.
- **0.37.1**: a patch. It changes no schema, export or behaviour, the request itself allows a patch, and the three sites merge a patch
  bump by themselves. The requesting site then makes the core external in its own pull request.
- The changelog fragment: type `changed` (packaging), core only: the core's build includes the part of `jsonc-parser` it uses and no
  longer depends on the package; a server bundle made with esbuild for Node now loads.
