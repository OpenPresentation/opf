# CI/CD contract

Current operating authority, 2026-11-09. GitHub Actions owns validation, package releases, native Worker previews and production deployment. Cloudflare owns runtime, Preview/version/deployment identities and observability. Do not enable Workers Builds as a second automatic deployer. Implementation and observed rollout status are tracked in [the unified checklist](https://github.com/OpenPresentation/opf/issues/1139) and the [Cloudflare program](programs/cloudflare-hosting/burndown.md); this contract does not claim that pending workflows are merged or deployed.

The owner now authorizes agents to create deployments, use native `wrangler preview`, and remove the separate `pptx-dev-preview` Worker. This supersedes older no-deploy instructions for this work. New logins, DNS changes, account-plan purchases or visibility changes remain owner actions. Claude connector setup, local extension removal, LibreOffice promotion and D2 retain their separate owner decisions. Dated handoffs remain historical evidence; use this contract for current operation.

## Repositories and gates

| Repository | Event | Required evidence before mutation | Target |
| --- | --- | --- | --- |
| `OpenPresentation/opf` | PR / integration head | Existing scoped `verify`; required slow checks for the wave; generated trackers strictly current; reviewed pinned goldens and exact archives; native qualification | Reviewed squash to `main` |
| `OpenPresentation/opf` | Release dispatch on `main` | Successful exact-head `verify`; Release slow gate; dry run for this two-release program | Seven packages at one version through tag-triggered trusted npm publication |
| `Data-Advantage/openpresentation-site` | Same-repository open PR | Current full head, successful scoped CI and actual OpenNext/Worker packaging; native Preview; deployed browser/MCP/source checks | Preview under `openpresentation-site` |
| `Data-Advantage/pptx-gallery` | Same-repository open PR | Current full head, successful build/registry/Worker checks; native Preview; deployed gallery/API/source checks | Preview under `pptx-gallery` |
| `Data-Advantage/pptx-dev` | Same-repository open PR | Current full head, successful Application compatibility/Worker packaging; native Preview; anonymous and available development-instance auth checks | Preview under `pptx-dev` |
| Org and gallery | Successful current-default CI; manual retry | Exact current `main` CI, qualified merged-PR Preview association, production configuration and same-head artifact | Existing production Worker |
| Dev | Successful current-default CI; manual retry | Exact current `master` Application compatibility and Worker build, qualified merged-PR Preview, unchanged backend/Clerk preactivation and rollback checks | Existing production Worker and explicitly qualified backend |
| Each site | PR closed | Exact recorded account, base Worker, PR and Preview identity; explicitly owned temporary resources | Delete that native Preview; preserve shared storage and production |

Manual dispatch follows the same gates. It is a retry mechanism. Missing credentials, unsuccessful or unfinished required CI, stale heads, missing artifacts or missing qualification must not produce a successful rollout. Ordinary PR builds remain credential-free; forks do not receive deployment credentials.

The existing core `ci.yml`, `verify`, Release, trusted publisher and seven-package dependency order remain authoritative. Do not replace them with a custom orchestrator. After publication, verify registry identities/provenance, then update the three sites through generated bump PRs and real package consumers. See [release-process.md](release-process.md).

## Workflow and command names

Site `cf-native-preview.yml` owns hosted native Preview build/upload/qualification/cleanup. `cloudflare-deploy.yml` owns production. Existing site CI workflows retain their lint, type, unit, registry, browser and Worker-packaging roles; dev retains Application compatibility and its backend qualification.

- `cf:preview:local` means the local OpenNext/workerd server. It does not publish anything.
- `cf:preview:deploy` means the maintained hosted `wrangler preview` path using the project's exact locked Wrangler, version 4.135 or newer.
- Use the maintained workflow for hosted status/cleanup and production retries. Do not create another standalone preview Worker or an ambiguous command alias.

Production uploads are serialized per Worker. Superseded PR validation can be cancelled; do not cancel an active production upload. Use normal workflow/job dependencies and precise completion gates, rather than hand-written CI polling loops. Observe a batch with [pr-gate.mjs](../scripts/pr-gate.mjs).

## Source, artifacts and deployment identity

Bind every build to repository, full commit, Git tree, build configuration and public build inputs. Record a complete regular-file module/asset inventory and hashes. Reject extra, missing, changed, linked or escaping files. Do not run branch hooks in a credentialed upload step: use trusted default-branch tooling, the exact locked Wrangler and a hook-free, non-bundling config.

The build job has no Cloudflare deployment credentials. A separate trusted upload job revalidates source/head, artifact/config identity, account and exact target Worker before receiving its scoped token. Deployed tests need no Cloudflare upload credential. Runtime auth/backend qualification secrets belong only to the existing qualified runtime step, never arbitrary package build hooks; preserve dev's restrictive temporary-file handling and cleanup.

Create a GitHub deployment with full source identity, native Preview/version/deployment identifiers and URL. Upload alone is `in_progress`. Mark it successful only after the maintained deployed checks pass. Preserve failed tests and deployment IDs. PR-close cleanup marks a removed Preview inactive; its prior exact qualification remains historical evidence only when a trusted owned-close marker explains the inactive state and no later failure exists. An inactive deployment without prior success, with a different identity or with later failure cannot qualify production. Production must prove live source identity and its core user/API/MCP flow after upload.

A squash merge changes commit SHA. A qualified final-PR Preview can qualify its merged default-branch source only when the exact Git trees match and the merged-PR association and Preview receipt are verified. A different SHA alone does not require another Preview. A changed application tree or build input requires fresh qualification.

Production builds a fresh artifact for the exact successful default-branch commit and its production inputs, then reuses that identical artifact across production jobs. Do not promote a Preview bundle carrying different inlined variables or commit identity. Reuse identical artifacts only within the same source/configuration/runtime context; retain deliberate cross-platform, package-consumer, visual/native and production-variable checks.

During workflow bootstrap, a missing qualified Preview is an explicit production hold/failure. Install reviewed maintenance workflows, qualify the held release PRs through native Previews, and roll out only the qualified default head. Existing healthy production traffic is retained until then.

## Preview resources

Use Cloudflare's native `previews` configuration, with assets and compatibility settings at the top level and explicit Preview variables/data bindings. Review each site's binding policy in its own `docs/cloudflare.md`.

Org and gallery previews are public read-only product previews. Do not expose private data or production secrets. Org keeps a Preview-specific rate-limit namespace. Gallery Previews have no production R2 binding. Use only a fixed-origin public GET/HEAD media proxy with validated keys, an explicit header allowlist and redirects refused, or a genuinely isolated Preview bucket. Omit production analytics writes; production media behavior remains unchanged.

Do not copy `WORKER_SELF_REFERENCE` into a Preview when that service would call production. Prefer preview-local same-Worker calls where supported, or omit the binding only after proving the site's required flows work without it. Dev uses its explicitly qualified development Clerk/Convex configuration and separate Preview data. A reachable URL does not prove binding isolation or authentication.

The owner-requested legacy `pptx-dev-preview` Worker was removed on 2026-11-09 without force. The earlier coordinator-only condition to wait for a native replacement was superseded by the explicit removal request. Production `pptx-dev`, its four custom domains and shared `pptx-dev-user-preview` R2 bucket were verified unchanged; no R2 objects were accessed or mutated. The legacy Worker's three secret bindings were removed with it, without reading or transferring their values. The separate development-secret transfer and native replacement/auth/service qualification remain held. Preserve shared storage and historical evidence; do not recreate a standalone preview Worker.

## Credentials and settings inventory

Never put credential values in source, artifacts, command output or documentation. Do not extract browser cookies. Use existing authorized connections or GitHub environment/repository secrets.

| Scope | Names / mechanism | Owner and verification |
| --- | --- | --- |
| OPF Release | Existing `ECOSYSTEM_APP_PRIVATE_KEY` and configured App identity; trusted npm OIDC | Repository owner; exact publisher/registry proof after each release |
| Site upload | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Existing site environment/repository scopes; verify account/Worker before upload |
| Dev backend activation | `CONVEX_DEPLOY_KEY` | Existing coupled backend gate and rollback owner |
| Dev runtime qualification | `CLERK_SECRET_KEY`, `CONVEX_SERVICE_SECRET`, `AI_GATEWAY_API_KEY` where required | Existing qualified runtime step; no build-hook access |
| Public dev build inputs | Site-specific `NEXT_PUBLIC_*` values | Bind exact approved development/production targets to artifact identity |
| Cloudflare account | Data Advantage, `136efd25cc10afb20714b72b2eb41cf3` | Observed authenticated dashboard and connector, 2026-11-08 |

Record actual configured environments, secret availability, provider IDs and verification dates in site receipts; names in this table do not establish that a credential exists or that a rollout happened.

Core's active GitHub ruleset requires `verify`. The independent 2026-11-08 site audit received HTTP403 from active-rules endpoints with a GitHub plan limitation; legacy branch-protection queries returned no rules. Do not claim that the private sites have enforced branch protection from green workflows alone. Verify supported account settings before configuring protection. Do not buy a plan or change visibility silently. Workflow production gates remain mandatory regardless of this account limitation.

## Generated trackers, retries and rollback

Regenerate trackers with their maintained generators before the integration merge, and run their strict checks against the assembled source. A PR warning is not release readiness: retain the exact-source strict receipt so main cannot newly fail because an accepted wave waived drift. Never hand-edit tracker output, exact archive hashes or raster tolerances. Goldens use the pinned workflow only.

Retry the failed stage for the same immutable source after correcting its cause; if source/config changes, obtain new qualification. Use one batched maintained observer, not per-job REST polling. Keep every completed result pushed and update the unified checklist/handoff when state changes.

Rollback selects the last recorded healthy Worker version, then verifies live identity and smoke checks. A Worker rollback does not revert R2, Convex or database state. Dev must follow its existing coupled-backend rollback runbook. Routine rollback does not need DNS changes or a Vercel migration redesign.

## References

- [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub deployment controls](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)
- [GitHub Actions security](https://docs.github.com/en/actions/reference/security/secure-use)
- [Cloudflare native Previews](https://developers.cloudflare.com/workers/previews/)
- [Preview configuration](https://developers.cloudflare.com/workers/previews/configuration/)
- [Preview resources and isolation](https://developers.cloudflare.com/workers/previews/resources/)
- [Cloudflare with GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
