# Cloudflare hosting: burndown

Goal, invariants, owner decisions and resume protocol: [README.md](README.md).
Related: [release readiness burndown](../release-readiness/burndown.md) (RR-49, RR-14).

Status values: `todo`, `in-progress`, `review` (PR open), `done` (merged and evidence linked), `descoped` (owner
decision, issue linked). Dates are UTC. One row per item, the six columns below, a status from the list.

Numbering (2026-10-05): the item IDs follow the work as it was executed, in the order the sites went live: CF-01
openpresentation.org, CF-02 pptx.gallery, CF-03 pptx.dev, then CI/CD, tests and decommission. They replace the
2026-10-04 plan (CF-01 to CF-19: owner phase 0, per-site build and go-live items, the pptx.dev blockers CF-07 to
CF-16, CF-17 CI/CD, CF-18 docs, CF-19 decommission). That plan's content was delivered inside CF-01 to CF-03 (each
site's `docs/cloudflare.md` records the findings and measurements) or is carried by CF-04 to CF-08 below; its owner
decisions are in the README.

## Now

The work queue: one row per open item, saying who works on it, what blocks it and the next action. Update the row
whenever an item changes hands or state, and delete it when the item closes. Last updated 2026-10-05 (b).

| ID | Owner | Working on | Blocked by | Next action |
| --- | --- | --- | --- | --- |
| CF-04 | owner (secrets); supervisor | deploy-on-main workflows are merged ([openpresentation-site#77](https://github.com/Data-Advantage/openpresentation-site/pull/77), [pptx-gallery#97](https://github.com/Data-Advantage/pptx-gallery/pull/97)) and skip until the secrets exist; the production checks run after the deploy | owner: `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit and Account Settings: Read) and `CLOUDFLARE_ACCOUNT_ID` as Actions secrets in both repositories | the owner adds the secrets; the supervisor then verifies a deploy-on-main run and the production checks |
| CF-05 | agent (pptx-dev) | signed-in end-to-end test with `@clerk/testing` against the Clerk development instance (a pptx-dev pull request is to come) | owner: a Clerk test user and the Actions secrets for it | open the pull request; the owner provides the test user and secrets |
| CF-06 | none | pptx.dev deploy-on-master workflow (same shape as CF-04); the Worker is deployed by hand today | CF-04 shape settled; owner secrets | write the workflow once CF-04 has run green |
| CF-07 | supervisor | apex static-asset redirect on openpresentation.org: Workers serve static files (for example `/llms.txt`) on the apex before the Worker runs, so they are not redirected to `www` | none (the token cannot manage zone Redirect Rules) | add a zone Redirect Rule (needs a token with Zone Rulesets / Single Redirect) or `run_worker_first` in `wrangler.jsonc` |
| CF-08 | owner (go-ahead); supervisor | Vercel retirement | a stable period on Cloudflare and the owner's go-ahead; the RR-49 descope decision (README, Open decisions) | after the go-ahead: the `*.pptx.dev` wildcard record, the Vercel projects and domains, `@vercel/analytics`, `vercel.json`, the ignore-build scripts, the RR-49 Vercel gating and docs |

## Items

| ID | Item | Repos | Depends | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| CF-00 | Program opened: README (goal, scope, definition of done, invariants, owner decisions) and this burndown, linked from AGENTS.md | opf | none | done | [opf#342](https://github.com/OpenPresentation/opf/pull/342) merged (`c5d4f9e`) |
| CF-01 | openpresentation.org on a Cloudflare Worker: OpenNext build, `docs/cloudflare.md`, cutover and redeploy from main | openpresentation-site | CF-00 | done | [openpresentation-site#74](https://github.com/Data-Advantage/openpresentation-site/pull/74) merged (`e6496bb`). Cut over 2026-10-05 ~07:40 UTC with zero downtime (Worker routes for `www` and the apex, both records proxied); live: apex 308 to `www` with path and query, `/schema/opf/v1` 200 with CORS, e2e 44 of 46 on the live site (the 2 other checks assert "no non-localhost requests" and are local-only by design). Redeployed from main (`1af19ff`, Worker version `80e9d13b`). Rollback: `proxied=false` on both records and delete the two routes |
| CF-02 | pptx.gallery on a Cloudflare Worker: about 1,900 prerendered routes, `/api/og`, content negotiation with `Vary: Accept`, cutover and redeploy from main | pptx-gallery | CF-01 | done | [pptx-gallery#95](https://github.com/Data-Advantage/pptx-gallery/pull/95) merged. Cut over 2026-10-05 ~07:55 UTC (routes for `www` and the apex, both records proxied); workers.dev e2e 90 of 91 (the other is the editor-autosave localhost check, by design); live: apex 308 to `www`, pages, editor, registry, og and `llms.txt` 200, JSON negotiation with `Vary: Accept`. Redeployed from main (`4b8ab62`, version `165eedf4`). Rollback: `proxied=false` on both records and delete the two routes |
| CF-03 | pptx.dev on a Cloudflare Worker: OpenNext spike and platform couplings (parse store in Convex, precompiled Ajv, prerender cache), multi-host routing, secrets, cutover | pptx-dev | CF-01 | done | [pptx-dev#88](https://github.com/Data-Advantage/pptx-dev/pull/88) to [pptx-dev#91](https://github.com/Data-Advantage/pptx-dev/pull/91) merged. Cut over 2026-10-05 ~18:08 UTC (owner-approved) on the Clerk development instance and a dev Convex deployment (owner decision 2026-10-05, no production users yet): Worker custom domains `www`, apex, `api.` and `mcp.`; the `*.pptx.dev` wildcard is still on Vercel; zone HSTS two years (no subdomains, no preload) and Always Use HTTPS; Worker secrets set by the owner (`AI_GATEWAY_API_KEY`, `CLERK_SECRET_KEY`, `CONVEX_SERVICE_SECRET`); Worker version `b362a9e3` from `fd8e501`. Verified: health commit `fd8e501`, apex 308 with path and query, `POST /mcp` on the apex 308, api, openapi and the MCP card 200. Signed-in flows untested until CF-05. Rollback: delete the four Worker custom domains and recreate the four A records from the DNS backup (`dns-pptx.dev-pre-cutover-20261005.json`, held by the supervisor outside the repository); the Vercel project still holds the domains (warm rollback) |
| CF-04 | Deploy-on-main workflows for openpresentation-site and pptx-gallery (deploy the Worker, then run the production checks) | openpresentation-site, pptx-gallery | CF-01, CF-02 | in-progress | merged: [openpresentation-site#77](https://github.com/Data-Advantage/openpresentation-site/pull/77), [pptx-gallery#97](https://github.com/Data-Advantage/pptx-gallery/pull/97); they skip until the owner adds `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Done when a deploy-on-main run and the production checks pass on GitHub |
| CF-05 | pptx.dev signed-in end-to-end test with `@clerk/testing` (sign-in, session cookies, protected routes on the Workers runtime) | pptx-dev | CF-03 | in-progress | pull request to come; needs the owner's Clerk test user and secrets. Clerk test emails use `+clerk_test` with the code 424242 |
| CF-06 | pptx.dev deploy-on-master workflow (its default branch is `master`) | pptx-dev | CF-03, CF-04 | todo | |
| CF-07 | openpresentation.org apex static-asset redirect: files served from Workers static assets on the apex (for example `/llms.txt`) redirect to `www` | openpresentation-site | CF-01 | todo | |
| CF-08 | Retire Vercel after a stable period and the owner's go-ahead: the `*.pptx.dev` wildcard record, the Vercel projects and domains, `@vercel/analytics`, `vercel.json`, the ignore-build scripts, the RR-49 Vercel gating (preview `deployment_status` checks, the bypass secret) and the Vercel references in the docs; reconcile RR-49 and RR-14 in the RR burndown | all three sites, opf | CF-04 to CF-07 | todo | |

## Acceptance criteria

- **CF-00.** `README.md` and `burndown.md` exist, AGENTS.md links the program in one line, a changelog fragment is
  added.
- **CF-01 to CF-03.** The Worker answers on its canonical hosts; the existing end-to-end suite and the curl checks
  (redirects, headers, `/schema/*`, `/mcp` for pptx.dev) pass against the production hostnames; no public contract
  changed; the rollback is written down and the Vercel project still exists and deploys.
- **CF-04.** A push to `main` deploys the Worker from GitHub Actions and the production checks run against the
  deployed site; without the secrets the workflow skips and says why.
- **CF-05.** A signed-in test (sign-in, session, a protected route) passes against the Workers runtime on the Clerk
  development instance, with the Clerk test user held as Actions secrets.
- **CF-06.** The same as CF-04 for pptx.dev.
- **CF-07.** `https://openpresentation.org/llms.txt` answers 308 to `https://www.openpresentation.org/llms.txt`, and
  `/schema/*` on the apex keeps its CORS headers.
- **CF-08.** No site references Vercel in code, configuration or docs; the projects are deleted by the owner; the RR
  burndown rows for RR-49 and RR-14 are reconciled by the supervisor.

## Progress log

Append-only. One dated line per state change.

- 2026-10-04: Program opened (CF-00). Direction from the owner (2026-10-03): move pptx.gallery, openpresentation.org
  and pptx.dev from Vercel to Cloudflare. Facts: all three zones are in the Cloudflare account "Data Advantage"
  (`136efd25cc10afb20714b72b2eb41cf3`; pptx.dev's zone has a different name-server pair, to be confirmed); `www` records
  CNAME to Vercel; no OPF Worker exists yet; the `wrangler` login on the owner's Mac is another company's account and is
  not used.
- 2026-10-04: CF-01 in review ([openpresentation-site#74](https://github.com/Data-Advantage/openpresentation-site/pull/74)). Local Workers runtime (workerd): e2e 46/46; Worker 29.1
  MiB of 64 MiB; 14,225 static assets of 20,000 Free; largest asset 23.95 MiB of 25 MiB. Findings: OpenNext matched the
  apex host regex against `www` and looped the canonical host (fixed by anchoring); static files bypass the Worker, so
  `headers()` rules are generated into `_headers` and apex static files need a zone Redirect Rule; `wrangler dev` on
  macOS fails above about 10,000 asset files (`pnpm cf:preview:local`). Nothing was deployed.
- 2026-10-05: CF-01 and CF-02 are cut over (openpresentation.org ~07:40 UTC, pptx.gallery ~07:55 UTC) with zero downtime
  (Worker routes plus proxied records; rollback is `proxied=false`). [openpresentation-site#74](https://github.com/Data-Advantage/openpresentation-site/pull/74)
  and [pptx-gallery#95](https://github.com/Data-Advantage/pptx-gallery/pull/95) are merged and both Workers are redeployed
  from main.
- 2026-10-05: CF-03: pptx.dev [pptx-dev#88](https://github.com/Data-Advantage/pptx-dev/pull/88) to [pptx-dev#91](https://github.com/Data-Advantage/pptx-dev/pull/91)
  merged; owner decision: use the Clerk development instance and a dev Convex deployment for now (no production users
  yet); the owner set the Worker secrets; the supervisor deployed Worker `b362a9e3` from `fd8e501`.
- 2026-10-05 ~18:08 UTC: CF-03 cutover (owner-approved): Worker custom domains for `www`, the apex, `api.` and `mcp.`; the
  four A records (apex and `www`) were deleted after a backup; the `*.pptx.dev` wildcard is still on Vercel; zone HSTS two
  years and Always Use HTTPS. Verified: health commit `fd8e501`, apex 308 with path and query, `POST /mcp` 308, api, openapi
  and the MCP card 200. Rollback: detach the four domains and restore the four A records from the backup.
- 2026-10-05: CF-04 deploy-on-main workflows merged ([openpresentation-site#77](https://github.com/Data-Advantage/openpresentation-site/pull/77),
  [pptx-gallery#97](https://github.com/Data-Advantage/pptx-gallery/pull/97)); they skip until the owner adds
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. CF-05 (signed-in e2e with `@clerk/testing`) is in progress.
- 2026-10-05: The item IDs were renumbered to follow the work as executed (see the note under the status values); the
  2026-10-04 plan rows CF-01 to CF-19 are superseded. All three sites now serve production from Cloudflare, so RR-49's
  Vercel preview pieces no longer cover production; the descope proposal is under Open decisions in the RR README.
