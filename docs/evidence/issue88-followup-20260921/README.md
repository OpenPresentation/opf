# Issue88 follow-up acceptance — 21 September 2026

This checkpoint follows merged core PR93 (`937047f`), which corrected the current package matrix and quickstart. All three post-merge gates passed: [OPF CI](https://github.com/OpenPresentation/opf/actions/runs/35603210406), [macOS/Windows CLI](https://github.com/OpenPresentation/opf/actions/runs/35603210498), and [coordinated installed-package/browser acceptance](https://github.com/OpenPresentation/opf/actions/runs/35603210412). The npm train remains core 0.11.0, CLI/renderer 0.9.0, PPTX 0.9.1 and editor 0.8.0 on Node 24.

## App implementation and acceptance

[pptx-dev PR45](https://github.com/Data-Advantage/pptx-dev/pull/45), head `375348b0a78f74249e18cbfa46999c72c8d82602`, fixes all-slide Inspector editing and preserves exact authored JSON tokens/history. It cancels stale drafts, recovers from render errors on the same slide, keeps font notes accessible, and retains source through offline export/reimport. Its [immutable evidence](https://github.com/Data-Advantage/pptx-dev/tree/375348b0a78f74249e18cbfa46999c72c8d82602/docs/evidence/issue88-inspector-20260921) includes fresh frozen installs, 622 unit tests, 17 browser workflows, build/typecheck/audit and SDK/CLI checks, screenshots and hashes. The independent code review and visual review found no remaining actionable issue in that scope.

`author-production.log` records the formerly inconclusive Author test passing on canonical `www.pptx.dev`: verified cursor, built-in/document/loaded-catalog choices, exact apply/undo/redo and retained rich content/metadata. Browser-local fixtures need no account or model call.

`app-pr45.json` records Linux success and Windows failure on four exact clipboard string assertions. `app-windows-initial-failure.log` retains the failure for diagnosis; the app remains unmerged. This is a timestamped snapshot, not a final merge claim. `app-preview.json` binds the Vercel preview to the tested head. Protected preview inspection still redirected to SSO; automatic approval review rejected storing a temporary access URL, and no credential file was written. Local browser acceptance and exact-head platform CI remain distinct from canonical production verification after merge. Follow PR45 and [issue88](https://github.com/OpenPresentation/opf/issues/88) for those final receipts.

## Public documentation

Site43 (`ffe3fca`) and gallery35 (`78d2ac1`) are merged and verified on canonical production; their post-merge GitHub checks also passed. The repeated CLI pin now uses 0.9.0 and gallery ColorRef/bundle guidance describes the shipped train. `public/` contains bounded browser/source-audit summaries, deployment metadata and reviewed screenshots. Full page bodies, private access data and the full legacy gallery index are omitted; their hashes and observed text are recorded in the browser summaries.

The follow-up audit found that the website's documentation source snapshot was independent of its current npm pins. Its public quickstart/matrix and raw README still reflected the old train. It also exposed present-tense unpublished claims in data import, rich text and composition guides; this docs change corrects them against installed current APIs. It preserves real general-repair/Auto-arrange, native Office, font and glyph-coverage limitations.

Gallery36 is merged as `f17e9ae5869669d5fbac3720f285652d0c37551c` and its canonical `/docs` to `/editor` flow passes; the website snapshot/exporter follow-up must pin an accepted current core commit. The exporter correction preserves all 10,797 raw files and hashes while making machine-readable prose text-only: the same source's full guide shrinks from 321,605,007 to 1,209,184 bytes, with complete Markdown guides, skills, schema/example and evidence links. See the exporter report for scope; those candidate output measurements do not by themselves establish deployment.

## Gates retained

Keep issue88 open until its remaining PR, docs, canonical browser and deployment checks are accepted. Do not infer the broad goal is complete from this checkpoint. Native Office issue87 and renderer issue24's unchanged 0.1px tolerance remain separate; no `p:hf`, restricted font, geometry draft, golden change or package publication is introduced. The five geometry drafts stay together and unmerged. The ColorRef fixture move and named-color canvas/PPTX theme follow-ups remain later work.
