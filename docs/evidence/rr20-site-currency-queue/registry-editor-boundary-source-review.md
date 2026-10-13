# Registry/editor harness boundary: source trace

Read-only, no install/browser/API/log retrieval. Frozen replay `/private/tmp/rr20-final-runtime-replay` remains unchanged.

`opf/release-plan.json` pins registry editor verificationRef `ac25857cca8ce776dd23b5ca58b38a06af9d963f` and core `b3e306d005d3cd0563964d541a834a8a50469536`, packages editor/core0.19.0 and Gallery2. The candidate editor checkout is `b45f2ca1142ffb637e80858e346b6c6dd325bd85`.

The only difference in this harness versus the published editor ref is `test/json-editor-browser.mjs:76`: custom host layout `partner-detail` changes `areas:['title','body']` to `areas:[['title'],['body']]`. Registry mode imports the INSTALLED `@openpresentation/opf-editor/json-editor` and Gallery, not candidate editor runtime (`:12–21`); only the source test fixture/expectations come fromb45.

Candidate editor has no `opf.requiresUnreleasedCore` declaration. `opf/scripts/release-train.mjs:197–200` therefore returnsnull; `registry-sibling-gate.mjs:decideSiblingHarness` returnsrun immediately for declarednull. No skip is justified by current metadata, and no declaration should be invented merely to bypass this test.

## Actual picker path (published ac258 runtime)

- `src/json-options.js:getJsonFieldContext` calls editor `listCatalogRecords` and builds name/id/description options.
- `src/catalogs.js:listCatalogRecords` delegates to published core `catalogRecords`.
- Coreb3 `packages/javascript/src/catalog-refs.ts:98ff` validates catalog container shape/source/kind/maps, NOT each layout's areas. `catalogRecords:323ff` lists records through lookup; it does not call layout schema validation. The candidate extra layout therefore is not removed merely because its areas are incompatible with published composition.
- `src/json-options.js:describeOptions` DOES call `layoutRegionSummary`. Published `src/layout-templates.js:103–106` tries `layoutTemplate(record)`/`layoutStructure(record)`; unsupported array cells are caught and represented as the string `Invalid region template`, not thrown. This is a nonfatal summary mismatch.
- The browser test checks menu count/name/group/search and selects `partner-detail`. It does NOT assert its region summary or render that custom layout. `replaceFieldOption:104–114` validates only the JSON source document (not host catalog), edits one reference token, and undo returns the source. The custom record is host-only, not embedded in the document under validation.

**Conclusion:** the array-vs-string fixture is a real nonfatal description boundary, but source does NOT demonstrate a failed count/name/edit assertion. Withdraw it as a likely hosted cause; it must not motivate a speculative production fix. Most other registry checks deliberately use immutable published verificationRefs; this one source harness can still pass its tested name/id contract against the published editor.

## Smallest genuine reproduction after root's serialized registry setup

The exact replay currently has no registry-consumer. Once root supplies ordinary installed release-plan packages (no source aliases), use cwd `/private/tmp/rr20-final-runtime-replay/opf` and clear candidate Gallery only for this registry control:

1. Read installed core/editor/Gallery versions and realpaths; require published0.19/0.19/Gallery2 from the consumer.
2. A bounded Node probe using INSTALLED `@openpresentation/opf-editor/json-options` can call `getJsonFieldContext` for the harness's exact JSON layout token with host Gallery plus array `partner-detail`; assert option present, inspect its `regions` summary, and call `replaceFieldOption` to require exact one-token output. This separates a nonfatal summary from actual picker failure without rerunning unrelated browser scenarios.
3. If needed, the unchanged maintained actual browser command is:

```
node ../opf-editor/test/json-editor-browser.mjs artifacts/editor/json-editor-registry.json artifacts/npm/registry-consumer
```

Record actual exit; do not infer it from this trace. No network install was started here, no skip/alias/source patch is proposed, and no hosted failure cause is claimed.
