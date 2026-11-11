# RR-105 parser/ZIP metadata identities — SOURCE ONLY

2026-11-11: separate fresh-main worktree normally aligned with root
`453bd351fc12403bc93aa71da7dcf893a9860989`. The failed Windows225
create-envelope attempt remains preserved: it stopped before envelope creation
with ERR_PACKAGE_PATH_NOT_EXPORTED for xml-naming, not an Office action or a
library build failure. Existing producers, controllers and all prior leaves and
failure paths remain unchanged.

The collector previously required a CommonJS entry for every declared dependency
before reading its metadata. Installed fast-xml-builder1.3.1 declares
xml-naming0.3.0, whose root exports only an import condition. That entrypoint
precondition is unnecessary for a collector that hashes whole installed
packages without activating their code.

The approved repair uses official synchronous Node24 `findPackageJSON` for the
PPTX anchor and every dependency edge. Each edge is located relative to the
actual declaring package's canonical manifest, not a global resolver or the
collector's root. Metadata must have the exact declared package name, be a
bounded regular nonalias file, and belong to its canonical package directory.
The existing deterministic whole-package walk, canonical directory dedup,
sorted declared dependencies and 32-package/1500-file/4MiB-file/64MiB-total
limits remain unchanged. All export maps and nonexported package files remain
hashed. Symlink files/subdirectories still refuse; no global/NODE_PATH or donor
fallback, implementation import, child resolver, extra execArgv, experimental
flag, dependency pin or public package change is introduced.

This API retrieves metadata; it does not select or authorize an executable
exports entry. Runtime loading/entry permission remains separate. There is no
fallback path around an export restriction. Node's documented API returns the
root manifest for a bare package specifier and accepts the containing module as
its base. Its default metadata resolver does not use custom loader hooks. The
native bootstrap already requires pinned Node24; no new Node setting is needed.
Primary references:

- [Official Node24 metadata API](https://r2.nodejs.org/docs/latest-v24.x/api/module.html#modulefindpackagejsonspecifier-base).
- [Node24 implementation inspected, not called as an internal API](https://raw.githubusercontent.com/nodejs/node/v24.11.0/lib/internal/modules/package_json_reader.js).

The new maintained pure test copies the actual collector and its identity helper
into owned synthetic installed-package trees. Entry implementations throw/write
a sentinel if run. The real collector is exercised for import-only/CJS/dual
exports without exported metadata, full-file hashes, nested versions and cycles,
missing local dependencies despite a foreign NODE_PATH candidate, wrong names,
internal aliases, entry/nonexported/export-map tampering and every existing size/
count bound. No injected resolver or simulated traversal is used. These fixtures
never constitute genuine source, installed-consumer or native authority.

At this source checkpoint no syntax/fixture test, real metadata inventory,
install, build, mapper, Windows or Office action has run. After source review,
one bounded fixture suite and real current installed metadata-only inventory are
planned, followed by root's coordinated native/doc source gate. Complete library
equality, pre-Node source/library checks, default admission, 60s managed limits,
bounded observer and native activation authority remain unchanged.

## Actual bounded local qualification

The approved single lightweight batch passes all three children in 2.715 seconds
summed child time: own offline frozen install 2.246s, actual collector fixture
suite 7/7 with zero skips in 0.409s, and default real metadata-only inventory in
0.059s. No product build was needed. The fixture implementation sentinels remain
absent; import-only, ownership, tamper, alias and all four exact budget controls
pass without importing library implementations.

The real own normally installed graph contains nine packages, 136 files and
2,732,897 bytes, including xml-naming0.3.0, fast-xml-builder1.3.1,
fast-xml-parser5.12.0 and fflate0.8.3. Every recorded file hash/size and each
declared dependency edge is checked. The inventory SHA256 is
`c215b285efc0b43e63ee3dd6d22d0c88d31f64e69cee3cfce0878a9a8f6f5451`.
Actual pinned Node24.21 ran with empty execArgv; source/protected pins match
before/after and no dependency/lock change occurred. This is current local
metadata qualification, not a fresh Windows envelope or native result.

[Compact receipt](rr105-library-metadata-identities-receipt.json) binds exact
source/log/inventory hashes. Original full inventory and raw logs remain local
under `/tmp/opf-library-identities-focus01`; failed225 envelope inputs remain
unchanged on Windows. Root's required integrated source gate and a new actual
Windows controller remain owed. No retry, package build, mapper, process query
or Office action followed the bounded batch.
