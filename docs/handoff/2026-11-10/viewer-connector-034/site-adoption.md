# Post-0.34 adoption: finite three-site rollout

Preparation only. Run these steps after the genuine **0.34.0** release exists; there is no 0.33.1 intermediate release. No site was edited, bumped, built or deployed in this handoff. Freeze the old future-stage branches and accepted 0.33 proofs; perform new adoption work on fresh branches.

## Source baseline observed in this audit

| Repository | Local source ref used | Actual current-source package facts |
| --- | --- | --- |
| openpresentation.org | `148cd51184d8d74617379eddf0c0f555d26fc113` | Six declared OPF dependencies, including MCP, are 0.33.0. Accepted current-production evidence is separate at `5610d72f6d9bfa20b1116729759fa20446ed6c82`. |
| pptx.gallery | `9d473688bfd806da43b863f9db69500635e60093` | Declared Gallery/core/render/PPTX dependencies are 0.33.0. Its maintained bump machinery also vendors the Editor and accepts the six-package site graph; MCP is not a Gallery consumer. |
| pptx.dev | `4fed16d3410b7a629baef7363c0a1ab949543eaa` | Core/Editor/PPTX/render are 0.32.1; Gallery is ^0.32.1. This source ref is not a claim of a newly qualified deployment. |

These are exact local Git-source observations, not a new network check of remote branch currency. Fetch each default afresh at execution time and record any successor. Org210 and Gallery178 already completed work are not reopened.

## 1. Establish release authority once

The coordinator completes outstanding native, golden, full-scope, cross-platform and release gates. Merge only exact reviewed heads with the maintained `pr-gate.mjs` policy; use the trusted Release workflow on main for 0.34.0. Verify all seven registry packages, their exact versions/integrities/gitHeads and release provenance against the immutable tag. A source-candidate consumer at sourceVersion 0.33 is not registry acceptance.

Confirm RR-107/A7 release assets `opf-0.34.0.mcpb` and `opf-0.34.0.mcpb.sha256` were produced and attached after registry verification. Verify the checksum against the actual downloaded bundle. Never reuse an old diagnostic bundle/hash, overwrite an existing inconsistent asset, remove this desktop deliverable, or publish from a worktree. The checksum and remote connector are separate distribution paths.

## 2. Prepare all three adoption PRs from fresh defaults

Use each repository's maintained command, after registry verification and after reading its current AGENTS/build rules:

```sh
pnpm opf:bump 0.34.0 --opf <OPF-checkout-containing-the-actual-v0.34.0-tag>
```

The explicit checkout must contain the real immutable release tag. Do not pass a staging branch as a release tag, invent command flags or versions, substitute an unpublished consumer, hand-edit generated snapshots, or bypass unknown-ID refusals. The automatic `bump-sites.yml` PRs may be used; reconcile existing PRs before creating duplicates. Do not auto-merge a minor bump as though it were a patch.

The site lanes can prepare in parallel, while local heavy builds use allocated shared slots:

| Lane / original item | Existing preparation | Concrete completion and acceptance |
| --- | --- | --- |
| Org G1 | Frozen `codex/sh-13-org-034-diagram-docs`, `df0f8c08880e74f1183680a854e7ffbe3e3c1422` | Normally reconcile reviewed diagram/SmartArt prose with current Org148 and actual 0.34 schemas/catalogs. The bump owns dependency/lock updates, starters, release history, docs/schema/skills snapshots and homepage manifests; retain frozen old-version schemas. Review generated differences against the actual release. |
| Org G2 | `content/learn/charts-and-evidence.md` is still Git blob `a3e927e604ae8be91d4e3dfbd147a413ff9a2b39` in both the G1 stage and Org148 | This lesson is genuinely unfinished relative to the new chart contract. Update the full lesson for accepted LH-175/176/182/93/110 semantics, including explicit references and no title-inferred bands. Run maintained `pnpm prepare:learn`, review its actual rendered examples and test the lesson. Do not label old prose current merely because the file exists. |
| Gallery H1 | Browser stage `1abdb788d4e49ebc7a0074fb32bde260d96d0600`; layout-metadata stage `2179efb61efed90afed87291a04a36b271a09b3f` | Reconcile current Gallery9d, genuine package bump and frozen stages. The maintained bump regenerates catalog/layout previews, chart/diagram previews, fonts and licenses, vendored Editor/spec and release-example provenance. Check actual release IDs, not hardcoded historical counts. |
| Gallery H2 | Frozen diagram stage `6be00c2b0a46bff9849848d39b8b625e2bfb8928` | Reconcile DOT/PlantUML samples, syntax values, editable diagram/SmartArt guidance and actual diagram previews. Preserve package-owned records; no writes to the archived Gallery repository. |
| Gallery H3 | Frozen `codex/lh-034-layout-pages`, `49ed48d24c77cc535cadab2107bc93e979c66b50` | This stage already adds inverted-pyramid, org-chart, hierarchy and venn and covers its 40 candidate IDs. Its guidance also covers duration and image callouts without inventing layout aliases. Compare the final 0.34 installed ID set to all display metadata; implement any further real additions, require exact set equality and inspect category/zone/use guidance. Historical published-0.33 unknown-ID RED is not a future build pass. |
| DEV I1 | Frozen `codex/cf-17-dev034-diagram-docs`, `79029e6f04af88a87f3bcb20940f202354684722` | Reconcile current master4fed with diagram guide, DOT/PlantUML/SmartArt, generated guide SVGs and llms route. The bump owns actual package/lock/ref-layer pins and tag commit. Preserve existing trusted preview and signing/auth gates. |
| All three I2 | Review only if the actual PPTX default/contract changed | Audit every named surface from the original inventory: Org get-started/first-deck/developer-starters; Gallery docs; DEV OPF/opf-toolkit. Default measured text is editable per line. Optional native paragraph wrapping and representation/font limits stay explicit. Make only proven necessary copy changes; absence of a default change is not a native-fidelity acceptance claim. |

The frozen H3 README and `candidate-layouts.json` are the authority for what its staging actually covers; the four additions were missing from published 0.33, not missing from that completed stage. Reconcile against the final release instead of repeating those edits or assuming the candidate set stayed fixed.

## 3. Build and qualify each exact adoption head

Read the current workflow selection and run the repository's maintained checks plus its normal site build against the exact candidate. Preserve terminal logs, source/lock/package/font/input inventory and generated provenance. Do not substitute only document existence, a 0.33 build or another branch's preview for the owner's every-site-build requirement.

Require actual exact-head Native Preview context, build, upload and qualification receipts. A context-only success or skipped job is not a preview build. Preserve the first failure, diagnose it and authorize a causal next action; do not apply the attachment's blanket rerun advice. Bind small receipt ZIPs by their real size/hash and source/config/inventory identity before independent review of the immutable URL. Review real desktop/mobile images, source interactions, console/CSP, assets/privacy and the feature changed by the adoption.

DEV's standalone old preview retirement at4fed does not remove the trusted current preview route. Clerk/Convex/Cloudflare/provider secrets and actual owner-authenticated flows remain separate gates. Never install a connector, retrieve secrets, log in, change DNS or invent a preview acceptance while a required owner setting is absent. DEV204's existing owner-dependent status is preserved.

## 4. Merge and bind production; then qualify the connector

After independent preview/source review, the coordinator runs the one maintained exact-head/all-check merge gate per batch. Deployment proceeds through the maintained site workflow. Collect actual canonical receipt/inventory/config and provider current-version projection; bind the deployed app bytes, package versions and source separately from the preview.

For Org, initialize must report the actual new MCP release, inventory must match its published source, and `ui://opf/deck` must contain the new viewer. Measure the actual serialized JSON-RPC resource against the unchanged default SDK frame guard, not raw HTML alone. Run the 11 viewer scenarios and source/Export capability/error checks in [coverage.md](coverage.md), then the actual Claude client saves/context workflow and new listing screenshots. Current Org148 owner2/MCP6/privacy9 evidence remains accepted for its stated 0.33 facet, not for the future deployment.

For Gallery, inspect new layout and diagram pages plus regenerated chart/font/Editor assets. For DEV, inspect the new guide and public playground; authenticated owner/secret flows cannot be inferred from a public page. Save exact capture/response/trace identities on evidence-only branches and retain original failed attempts.

## 5. Close the original artifacts and owner work

Complete the original E3 second before/after refresh using the actual 0.34 release only after E1 private-source availability and supervisor review. Do not replace its input with public synthetic material and claim the original task complete. Keep the `.mcpb`/versioned-checksum requirement above as well.

The owner confirms the listing's legal/support/log-retention fields, captures real-client screenshots and submits the remote connector. Report directory acceptance and Desktop installation as external results only when observed. No new public support badge is authorized by this checklist.
