# RR-81: import catalog defaults

Documentation/declarations-only follow-up on PR240 head `006e8a7df9c19e85b230a27f19794e5356cdac78`. Runtime, versions, dependencies, locks, tests and archive baselines are unchanged. ToPptxOptions retains its embedded-only default.

Source distinguishes two defaults: `src/index.js:566` resolves foreign layout mappings with `options.catalogs ?? [gallery]`; theme recovery in `catalogRecords` at line2006 and its reference lookup at line2028 use `catalogs ?? []`. Omitted import catalogs therefore select installed gallery only for foreign layout mapping. Theme/colour recovery requires explicit registration; omitted catalogs and explicit `[]` yield inline colours and no inferred theme (stored provenance references remain separate).

Validated locally with Node24.21.0, own offline frozen npm install, and explicit linked core3e8/renderd572/gallerye0 candidates. These are source checks, not registry/native acceptance:

```sh
npm run build
npm run typecheck
node test/theme-colors.mjs
node test/template-layouts.mjs
node test/template-layout-review.mjs
npm run validate
```

All passed: syntax272 files, theme14 schemes/4 themes including omitted registration, template13 contracts/28 layouts, foreign-layout review omitted versus empty catalogs, package metadata. Logs retained at `/private/tmp/rr81-import-docs-{checks,layout-review,final-types,final-build}.log`. No full-suite claim is made for this prose-only delta.
