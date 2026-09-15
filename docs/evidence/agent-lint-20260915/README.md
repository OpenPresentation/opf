# Contextual OPF lint candidate — September 15, 2026

This evidence covers the main-based lint API and CLI in PR81. The manifest identifies the exact implementation commit and hashes every retained log. Node 24.21.0 and pinned pnpm 10.33.2 were used on macOS arm64. Package-manager signature verification was enabled; sandboxed launcher attempts could not reach the registry, and the network-enabled invocation verified the pinned version normally.

- Full core suite: 512 tests passed, including 11 focused lint cases. Separate composition, pagination, data, rich-text, and list checks passed.
- CLI: 11 Node tests and 80 command checks passed; the same 80 command checks also passed against a fresh offline global installation of the packed CLI. The npx-style offline installation passed.
- Fresh packed core: 522 tarball entries checked; 14 exports compiled under TypeScript 5.9/7 with NodeNext/Bundler and published renderer/editor/PPTX consumers. Root/focused lint imports, exact source ranges, loaded catalogs, duplicate keys, and contracts passed with fetch disabled.
- Typecheck, build, text/spec integrity, 126 examples, dependency audit, and the breaking-change gate passed. Repository lint exited successfully with 114 existing warnings and 230 informational diagnostics; the new lint source/model tests have no lint errors or warnings.

Lint checks source syntax, complete schema constraints, local document/catalog context, asset registry references, and explicit host contracts. It does not fetch resources, change source bytes, interpret imported metadata as policy, measure layout, load fonts, or certify renderer/native fidelity. API tests also cover BOM/mixed newlines, duplicate escaped keys, invalid configuration and catalog overrides, nested resource references, and cycles.

These are local candidate packages using the checkout's existing version fields, not newly published npm versions. The checks do not establish acceptance of the separate shared-furniture/font branches. Native compatibility gates remain unchanged. GitHub CI is tracked on PR81; local logs alone do not claim its outcome.
