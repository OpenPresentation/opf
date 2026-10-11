# Open PR coverage against final0.19 qualification

Read-only audit2026-10-11. Inventory: `/private/tmp/opf-supervisor-20261010/inventory-current.json` (31 PRs). Snapshot is historical: PPTX245 merged, core602 queued; renderer233 is additional. No branches changed, no API calls or tests rerun.

Canonical heads: core `91a1c96df7b4bddf7144c71ea079220765b9360b` (37d source plus reviewed807 golden); renderer `8010a133f0ccded8d09bdd47a2ced2b6bb9d2031` (8c source plus reviewed807/498 goldens); PPTX `006e8a7df9c19e85b230a27f19794e5356cdac78`; editor `cef0bd18d53fe31df9a32cede3b1cec871f60f6d`; gallery `e0a7eee2dfe996e680b34a907cabfe41905e6d99`.

| Repo/PR | Exact snapshot head | Coverage |
|---|---|---|
| opf#550 | `d17a711256679480fa528f8c3d4ca29a9e2e7850` | MISSING required0.19 feature: no ancestry/patch; padNumber/checkOutputPattern/expandOutputPattern absent, both slide-file-names tests absent. |
| opf#557 | `b60c4786efb4fa67edcb760bab65279724536805` | Exact ancestor of canonical head; source/test delta integrated (prior reported validation, not a fresh test in this audit). |
| opf#577 | `fe9fe3fa2c3ad0130e271b73d9853f66e920c1d5` | Exact ancestor of canonical head; source/test delta integrated (prior reported validation, not a fresh test in this audit). |
| opf#584 | `46533d99838d05b514dafe4eaf1cf9cb6b232800` | Separate held evidence/tracker lane; assembler/tracker tests absent from qualification. Must integrate/recheck after held acceptance, not descoped. |
| opf#585 | `59bf7f7f3096248b38305772d91ef479a422b913` | Integrated adapted aggregate6d3d4e12: spec/reference/font-policy.json byte-identical; test only changed catalog import. Original PR ancestry absent; native evidence historical. |
| opf#592 | `e21c472d88057d9d90cfa507fe91b89063f3f29a` | Exact ancestor of canonical head; source/test delta integrated (prior reported validation, not a fresh test in this audit). |
| opf#593 | `13e1c4dc683eb5ad5eaa69b3d72e4fcf5e26b493` | Exact ancestor of canonical head; source/test delta integrated (prior reported validation, not a fresh test in this audit). |
| opf#594 | `539253839b5ca08960cdfd228f1a12e2ccf80448` | Exact ancestor of canonical head; source/test delta integrated (prior reported validation, not a fresh test in this audit). |
| opf#596 | `fa688e9780f9ba1d6b05c1e06b7004e06837b4ed` | Runtime/generator/test exact patch-id66c09d20→7c0bf9ef; final evidence fa688e97 not integrated. Golden91 includes reviewed corrected20. |
| opf#602 | `dc0fd5538776b289e53dc5f1ae50af6f904c88dd` | Separate queued records PR; its evidence notes and newer main tooling not in frozen qualification. Golden91 incorporated baseline itself, not this PR. |
| opf-render#198 | `bc81895e96c9068dfcea03533ecf36d236ee75b8` | Partial equivalent harness migration in f99c549; no removed API test imports. README still documents removed /catalog; registration docs/declaration/fragment remainder needs reconciliation. |
| opf-render#215 | `9fbddcb78dbebcb87355922ca92af7d26c24c48d` | Adapted2eaf8cf initial delta: src/svg.js/src/index.d.ts/test/layout-templates.mjs equal original0e5ecb4. Exact patch ids2153bd87→84c029ef,9fbddcb7→093fd623. |
| opf-render#217 | `01b0459546add78b5a69c5efce2cae2def98b376` | Separate held host-fixture lane; script-name-hosts files/registration absent. Rehearsal tested v1 separately; not integrated v2 and historical fallback assumptions need reviewed adaptation. |
| opf-render#219 | `ba9d3db4b2be5aab823af9fa43c8a25237422ea9` | Integrated adapted80fc8a0 plus exact b148dda9→495a156c. Later HB changes alter fallback corpus names; retained policy checks. Not original ancestry. |
| opf-render#222 | `eac8366a10dabd523847b853bde10812918a526c` | Exact patch ids b091ba04→3541c55a and eac8366a→bd3e4810. |
| opf-render#225 | `96d7debd4f0af13003be9c9c8b02faa18fb9450e` | Exact patch id96d7debd→e7c9ffac. |
| opf-render#227 | `b369d3660ba36d82b0607d6a8992af6603d7b1a2` | Exact own patch ids e664318b→f99c549,4b8a657d→6958a73,b369d366→f1f6a0d; predecessor215 as above. |
| opf-render#228 | `e7e0ca3b9b06bb86540988baf2a385f19cb19724` | Exact own patch id e7e0ca3b→0a04286; HB predecessor as above. |
| opf-render#229 | `33637275eaf472c7e82acd6b829a9e29aea6c8ce` | Exact patch id33637275→2377a136. |
| opf-render#230 | `012e448ba298a19ec79d690958f08d75e3893b26` | Exact patch id012e448b→8c651e66. |
| opf-pptx#229 | `be161d727bc8fbd01257de819920e6d1f6f88ffd` | Equivalent registration implemented in240: default-catalog helper imports gallery and no /catalog source/test/README references. Not original ancestry; registry dependency adoption still pending. |
| opf-pptx#240 | `006e8a7df9c19e85b230a27f19794e5356cdac78` | Exact ancestor of canonical head; source/test delta integrated (prior reported validation, not a fresh test in this audit). |
| opf-pptx#245 | `a8b83f6e430c4bd36d9a6610c5786f9131521f5d` | Separate18.1 release; supervisor reports merged. Candidate006 predates latest main release/npm11 metadata; integrate current main before final qualification. |
| opf-editor#148 | `5ba0e4ffb6205aa09a8f559e854fcee071440417` | Partial equivalent source/test migration in156; src declaration comments still name removed /catalog. Reconcile docs/declarations/fragment and real gallery2 dependency/lock. |
| opf-editor#155 | `6e11f2b37c1581692601edacd33bba76f7f420bb` | Separate held fixture lane; font-gate-script-names and fixture absent fromcef. Reviewed standalone does not prove final integration. |
| opf-editor#156 | `cef0bd18d53fe31df9a32cede3b1cec871f60f6d` | Exact ancestor of canonical head; source/test delta integrated (prior reported validation, not a fresh test in this audit). |
| gallery#5 | `e0a7eee2dfe996e680b34a907cabfe41905e6d99` | Exact ancestor of canonical head; source/test delta integrated (prior reported validation, not a fresh test in this audit). |
| pptx-gallery#125 | `7e0a6611abc22f2d89eb754bdcc24d7ecd09288a` | Separate held host fixture/site lane, not engine graph. Must preserve and rerun when integrating site126. |
| pptx-gallery#126 | `88c7119fb4727f4cd75c21e47a0a20ed3d1bf604` | Separate0.19 site candidate88c7119f; source review/local31-case replay; actual registry/artifact/bootstrap final pins pending. |
| openpresentation-site#103 | `ab0b0da532e553416a05d7164a331d994e312ef4` | Separate0.19 site candidateab0b0da5; local candidate integration only; registry locks/final package adoption pending. |
| pptx-dev#128 | `c83c995f8bdd04ae1fa7256ae0282a73ce65b16a` | Separate0.19 site candidatec83c995f; local candidate source/browser/build proof; actual registry locks/artifacts pending. |

## Additional new feature and source fixes

Renderer233 `65e743dc2ea956f74df3516ced1758c4cb2bef18` is missing from8010: exact real-family loaded-face assertion/removal guard/served-byte evidence fixes232 harness;228 only registered families. Main+held strict391 and full111 suites reviewed separately. Include233 before final browser qualification; do not claim that prior8010 run contains its guards.

Schema follow-up frozen `0f2b30f33eaf1906ee05ec4d62f289f3a108d9c6` is reported by conversion agent atop91a1. It changes public/installed catalog schema assertion to2 and preserves actual smoke failure/success evidence. check:changed and smoke passed; full source suite still running at report time. It is not yet part canonical91 source proof.

Candidate-gallery CI staged graph is separately reviewed tooling, not a replacement for source qualification or original ^1 registry-installability. Current main changes597/598/599/600 and publish metadata must be composed explicitly without overwriting feature/golden work.

## Concrete completion order

1. Preserve91/8010 frozen controls. Start a new isolated core candidate from schema follow-up0f2b30f3 (already atop91), incorporate550 requested runtime/CLI/docs/fragments/tests; resolve any overlap in packed-files against candidate guards truthfully. Do not merge main before actual0.19 metadata/prerequisites.
2. Integrate latest reviewed main tooling/release metadata as needed and core584 held fixture/tracker changes after their own gate; retain already integrated585 policy and596 chart correction. Avoid reapplying duplicate runtime policy/correction.
3. Reconcile renderer198 and editor148 remaining public declarations/docs (removed /catalog), preserving implemented gallery2 harness behavior. Include renderer217/editor155 host fixtures and233 harness guards through separate reviewed integration; actual held patch releases and site125 retain their planned lanes rather than disappearing from0.19 acceptance.
4. Freeze complete new graph and rerun full core source, CLI source/packed/global/npmexec/installed peer/browser contracts using exact source/tar identities.550 must pass its own new core+CLI filename tests, in-memory/ZIP/fill/output-pattern rejection cases. Demonstrate807/498 strict golden bytes unchanged for filename-only changes; never regenerate solely to hide differences.
5. Rerun final engine/browser/OS/Node graph with held fixtures integrated; then actual gallery bootstrap pins must name the final reviewed merged core/render sources. Publish gallery2 first, reviewed real ^2 dependency/lock adoption/config removal next, stable prep after that. Sites126/103/128 require final real registry adoption/build/browser artifacts; site125 host evidence included.
6. Preserve602 records and approved promotion metadata; pinned807/498 acceptance is not native PPTX proof. Final Windows native gate, full strict release contracts and provenance remain required.

## Evidence method and limits

Read core release-readiness README and0.19-execution.md. T03 requires all requested features; T17/T25/T26/T27/T28/T29/T30/T31/T32/T34/T38 remain distinct. Ancestry used git merge-base --is-ancestor against exact heads. Stable patch-id mapping checked local nonmerge commits (last100 canonical commits; relevant feature composition within this range); source/tree comparisons used for adapted aggregates. `/private/tmp/rr20-patchmap.txt` retains mapping. Core550 comparison directly shows missing37-line helper block in packages/javascript/src/node/files.ts; original23-file delta includes two new test suites. Core585 policy file exact byte equality; test differs only v2 gallery import. Renderer215 initial source/test equality and final no-/catalog source/test scans verified. Renderer217/editor155 files absent. No inference that reviewed standalone tests equal an integrated run.
