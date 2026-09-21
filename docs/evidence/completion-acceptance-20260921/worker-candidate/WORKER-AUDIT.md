# Monaco worker preparation candidate — static audit

The smallest candidate is to copy the two **already bundled startup assets** from the installed, lockfile-resolved Monaco 0.56.0 package during `prepare:opf-browser`, then construct same-origin module workers directly from those copied files. This removes the Turbopack worker bootstrap/module graph from the proposed startup path without adding another bundler or changing Monaco versions. It is a proposal only: no copy into product output, build, browser or production probe was performed.

The parent has identified five/three serialized bootstrap requests in prior evidence. This static audit did not reproduce those timings. One direct entry fetch per worker is a structural prediction for the candidate, not a measured latency or reliability result.

## Exact installed artifacts

| Installed package path | Bytes | Local gzip / Brotli estimates | Startup dependencies |
| --- | ---: | ---: | --- |
| `min/vs/assets/json.worker-CoJx_OPf.js` | 404,061 | 120,305 / 98,580 | No static imports, AMD loader, require or importScripts; one dormant dynamic import |
| `min/vs/assets/editor.worker-lj3bdIIn.js` | 272,787 | 82,340 / 67,572 | No static imports, AMD loader, require or importScripts; one dormant dynamic import |

Both are IIFEs ending in their `self.onmessage` initializer. Both can be parsed as JavaScript and are shipped as worker assets by this installed package. Their combined uncompressed size is 676,848 bytes. Compression estimates came from Node zlib, not HTTP responses. Exact full hashes, dependency AST expressions, license hashes and inspected source inputs are in `worker-inventory.json`.

Do **not** copy `min/vs/language/json/json.worker.js` (85,590 bytes) or `min/vs/editor/editor.worker.js` (253 bytes) as standalone files: they are AMD wrappers. The JSON wrapper depends on initialize/main/main/index chunks; the editor wrapper depends on initialize. The current ESM entrypoints also import further modules and are what the current `new URL(..., import.meta.url)` passes through Turbopack. Copying those stubs alone would break loading.

Installed package provenance: Monaco 0.56.0, vscode commit `f487add297079a02eb836810185b165e50cadabc`, Monaco commit `13f0c872dcf352815cc28d92dfff496c9839ea5c`. The package manifest allows `^0.56.0`; the frozen lock resolves 0.56.0. Asset filenames are internal build outputs, so future upgrades require guarded discovery and renewed review rather than permanent hard-coded hash filenames.

## Lazy dependencies and offline limits

Both bundled assets retain one dynamic import of the runtime-computed path for `@vscode/diff/dist/index.js`. Installed source `esm/vs/editor/common/diff/externalLinesDiffComputer.js` reaches it only through the `advanced-external` or `advanced-wasm` algorithms. `legacy` and normal `advanced` use bundled implementations. The installed default is `advanced`; no override to the two external modes exists in the current app sources. `@vscode/diff` is not resolvable from this installed app.

Consequently these assets have **no eager startup module dependencies**, but are not universally dependency-free. Do not delete or rewrite the dormant import or claim support for those external algorithms. The imported path resolver also expects `_VSCODE_FILE_ROOT`; absent that setting, it throws before fetching. Supporting external diff later needs its own explicit source/package/asset review, including WASM as applicable.

The JSON asset includes an optional schema-fetch service. Current `OpfEditor` sets `enableSchemaRequest:false` and supplies the local schema, so preserving that configuration is necessary to retain the present offline boundary. Same-origin workers still need their initial files available: this proposal reduces a startup chain, but does not create service-worker caching or guarantee a cold offline navigation. Existing offline-after-load workflows and worker re-creation after an idle/format switch require fresh acceptance.

## Minimal maintainable plan

1. Extend `scripts/prepare-opf-browser.mjs`, which already runs before `dev:frontend` and `build`, to resolve the installed package root from `require.resolve('monaco-editor')`; locate exactly one `json.worker-*.js` and one `editor.worker-*.js` under `min/vs/assets`. Fail clearly if discovery is missing or ambiguous; do not select the first glob silently. Preserve the existing font preparation unchanged.
2. Copy those bytes unmodified to a narrowly owned `public/monaco-workers/json.worker.js` and `editor.worker.js`, plus the installed `LICENSE` and `ThirdPartyNotices.txt`. Write a deterministic manifest with package version/commits, source relative paths, byte counts and SHA256. Validate real output location and copied hashes, as the existing font step does. Ignore only this generated worker directory in git. No new build dependency is necessary.
3. Keep `MonacoEnvironment.getWorker` and its existing label routing, but return `new Worker('/monaco-workers/json.worker.js', {type:'module'})` for JSON and the corresponding editor URL otherwise. Do not fetch a manifest at worker startup, introduce a blob/AMD loader, or fall back to a CDN. Current next.config has no basePath/assetPrefix; a later deployment-prefix change needs URL handling.
4. With these stable filenames, retain Next public-file revalidation (`Cache-Control: public, max-age=0`). Do not add immutable caching to stable URLs. Content-hashed URLs could be generated into the client build later if immutable caching is needed, but would need build/typecheck ordering and stale-deployment handling; they are not required for the smallest candidate. No Turbopack alias/plugin or function tracing addition is needed for plain public assets.
5. Preserve standalone deployment packaging: installed Next output docs state that `.next/standalone` does not automatically copy `public` or `.next/static`. Vercel adapter deployment and portable standalone packaging therefore need independent asset-presence checks. The current config deliberately enables standalone only outside Vercel.

After implementation, verify output hashes/licenses, JS MIME/status on the exact deployment, one startup asset request for each actual worker, real JSON diagnostics/completion, explicit Format Document and undo, normal editor/minimal diff work, YAML/JSON model changes, and offline-after-load behavior. Compare cold startup against the original request evidence without raising existing deadlines or retrying away failures. Those would be new acceptance results; none was run in this static audit.

## Notices and reproducibility

The package's MIT `LICENSE` is 1,098 bytes; `ThirdPartyNotices.txt` is 63,064 bytes and includes additional third-party notices. The minified worker assets themselves contain no copyright/license banner. Preserve both upstream notice files alongside the unchanged copies and reference their paths/hashes in the manifest. The audit does not strip notices, modify upstream code, obtain remote packages or add fonts.

Reproduce the AST dependency/size/hash inventory:

```sh
'/Users/michael/Library/Application Support/fnm/node-versions/v24.21.0/installation/bin/node' \
  /private/tmp/opf-completion-review-20260921/worker-audit.mjs \
  /private/tmp/opf-completion-fix-20260921/pptx-dev
```

Static references inspected: current `scripts/prepare-opf-browser.mjs`, `components/playground/opf-editor.tsx`, `next.config.ts`, package/lock metadata; installed Monaco asset wrappers, worker manager, `internal/common/workers.js`, `externalLinesDiffComputer.js`, `linesDiffComputers.js`, `diffEditor.js`, `amdX.js`, `base/common/network.js`; installed Next 16.3.5 docs `public-folder.md` and `output.md`. No network access or browser probe was needed.

This does not prove a fix for the original CRLF Author popup, production font readiness, rendering or source preservation. It does not close issue88, native Office, physical font compatibility, deterministic repair or geometry gates.
