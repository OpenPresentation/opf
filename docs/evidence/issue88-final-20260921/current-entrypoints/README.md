# Current-entrypoint documentation acceptance

Final public-export check: `installed-smoke.json` passed on Node 24.21.0 using the unchanged fresh registry consumer. Reproduce with:

```sh
fnm exec --using=24 node /private/tmp/opf-current-entrypoint-checks-20260921/installed-smoke.mjs /private/tmp/opf-registry-20260921/consumer > /private/tmp/opf-current-entrypoint-checks-20260921/installed-smoke.json
```

The verifier resolves all documented library entrypoints with Node's `import.meta.resolve` in an ESM evaluation whose cwd is the installed consumer, then imports those resolved public exports. This respects ESM-only import conditions in the core export map. Package manifests resolve through a consumer-rooted `createRequire`; the CLI executable comes from the resolved CLI manifest's `bin.opf`. Resolved real paths must stay inside the installed consumer. The report records the verifier and resolver-source hashes, the consumer package-lock hash, every resolved entrypoint and manifest hash, and the declared CLI bin/hash. No sibling source aliases or `NODE_OPTIONS` loaders are permitted.

It checks published canvas/schema exports; guarded block insertion/duplication/removal, semantic rich formatting and metadata preservation, undo/redo and stale-patch rejection; opaque table contrast/translucent fallback; CLI create/validate/version; six bundled skills, managed status and idempotent reinstall. It does not assert browser behavior, exact source-byte editing, native Office rendering, or general font compatibility.

`initial-dist-smoke.mjs` and `initial-dist-smoke.json` preserve the earlier preliminary direct-dist check. That preliminary run bypassed package export maps and is superseded by `installed-smoke.*` for public API availability evidence. `links.json` and `text-integrity.log` record source documentation checks; `pr-body.md` is the submitted PR description. No package tarball, runtime source or PR document changed during this stronger verification.

`audit-scope.md` records the exact 37 current entrypoint paths and the contextual disposition of retained older-version/availability hits. `audit-scope.py` reproduces the read-only scan; `audit-scope.json` records all file hashes, exact patterns, 121 matched line locations and exclusions at PR #98 commit `120a770041b3f7d3c04ced1ac87675ed0d18292b`.
