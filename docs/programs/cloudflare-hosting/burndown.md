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
whenever an item changes hands or state, and delete it when the item closes. Last updated 2026-10-06.

| ID | Owner | Working on | Blocked by | Next action |
| --- | --- | --- | --- | --- |
| CF-04 | owner (secrets); supervisor | deploy-on-main workflows are merged ([openpresentation-site#77](https://github.com/Data-Advantage/openpresentation-site/pull/77), [pptx-gallery#97](https://github.com/Data-Advantage/pptx-gallery/pull/97)) and skip until the secrets exist; the production checks run after the deploy; the Worker deploys are still done by hand, and the runs on main end at the gate (two were cancelled during the 2026-10-05 GitHub Actions incident) | owner: `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit and Account Settings: Read) and `CLOUDFLARE_ACCOUNT_ID` as Actions secrets in both repositories | the owner adds the secrets; the supervisor then verifies a deploy-on-main run and the production checks |
| CF-05 | supervisor (first run) | the signed-in end-to-end suite is merged ([pptx-dev#98](https://github.com/Data-Advantage/pptx-dev/pull/98), `eed596b`): `tests/signed-in/`, `pnpm test:e2e:signed-in`, the `e2e-signed-in.yml` workflow (dispatch, daily schedule, and called after a deploy by the pptx.dev deploy workflow); it skips without its secrets and with non-development Clerk keys, and was never run against a live environment (the Clerk `<APIKeys />` selectors may need adjusting after the first run) | owner: a Clerk test user (an address with `+clerk_test`, code 424242) on the development instance, and the Actions secrets `E2E_CLERK_USER_EMAIL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | the owner creates the user and secrets; the supervisor runs "Signed-in e2e" once and fixes selector drift; then close CF-05 |
| CF-06 | supervisor (first run) | the pptx.dev deploy workflow is merged ([pptx-dev#100](https://github.com/Data-Advantage/pptx-dev/pull/100), `3dcb647`, `cloudflare-deploy.yml`): push to master and dispatch, the gate succeeds with a notice while `CLOUDFLARE_API_TOKEN` is unset (the runs on master end at the gate and are green), Convex target `dev` by default (`CONVEX_TARGET`), a smoke on `www.pptx.dev/api/v1/health` commit, the apex 308 and `api.pptx.dev`, then the signed-in e2e; the Worker is still deployed by hand (live commit `5b989a4`) | owner: the Actions secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CONVEX_DEPLOY_KEY` (a dev key) and the variables `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CONVEX_URL` (optional `CONVEX_TARGET`, `NEXT_PUBLIC_BASE_URL`, the four `NEXT_PUBLIC_CLERK_*_URL`) | the owner adds them; the supervisor runs "Cloudflare deploy" once from master and reads the smoke output; then close CF-06 |
| CF-08 | owner (go-ahead); supervisor | Vercel retirement | a stable period on Cloudflare and the owner's go-ahead; the RR-49 descope decision (README, Open decisions) | after the go-ahead: the `*.pptx.dev` wildcard record, the Vercel projects and domains, `@vercel/analytics`, `vercel.json`, the ignore-build scripts, the RR-49 Vercel gating and docs |

## Items

| ID | Item | Repos | Depends | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| CF-00 | Program opened: README (goal, scope, definition of done, invariants, owner decisions) and this burndown, linked from AGENTS.md | opf | none | done | [opf#342](https://github.com/OpenPresentation/opf/pull/342) merged (`c5d4f9e`) |
| CF-01 | openpresentation.org on a Cloudflare Worker: OpenNext build, `docs/cloudflare.md`, cutover and redeploy from main | openpresentation-site | CF-00 | done | [openpresentation-site#74](https://github.com/Data-Advantage/openpresentation-site/pull/74) merged (`e6496bb`). Cut over 2026-10-05 ~07:40 UTC with zero downtime (Worker routes for `www` and the apex, both records proxied); live: apex 308 to `www` with path and query, `/schema/opf/v1` 200 with CORS, e2e 44 of 46 on the live site (the 2 other checks assert "no non-localhost requests" and are local-only by design). Redeployed from main (`1af19ff`, Worker version `80e9d13b`). Rollback: `proxied=false` on both records and delete the two routes |
| CF-02 | pptx.gallery on a Cloudflare Worker: about 1,900 prerendered routes, `/api/og`, content negotiation with `Vary: Accept`, cutover and redeploy from main | pptx-gallery | CF-01 | done | [pptx-gallery#95](https://github.com/Data-Advantage/pptx-gallery/pull/95) merged. Cut over 2026-10-05 ~07:55 UTC (routes for `www` and the apex, both records proxied); workers.dev e2e 90 of 91 (the other is the editor-autosave localhost check, by design); live: apex 308 to `www`, pages, editor, registry, og and `llms.txt` 200, JSON negotiation with `Vary: Accept`. Redeployed from main (`4b8ab62`, version `165eedf4`). Rollback: `proxied=false` on both records and delete the two routes |
| CF-03 | pptx.dev on a Cloudflare Worker: OpenNext spike and platform couplings (parse store in Convex, precompiled Ajv, prerender cache), multi-host routing, secrets, cutover | pptx-dev | CF-01 | done | [pptx-dev#88](https://github.com/Data-Advantage/pptx-dev/pull/88) to [pptx-dev#91](https://github.com/Data-Advantage/pptx-dev/pull/91) merged. Cut over 2026-10-05 ~18:08 UTC (owner-approved) on the Clerk development instance and a dev Convex deployment (owner decision 2026-10-05, no production users yet): Worker custom domains `www`, apex, `api.` and `mcp.`; the `*.pptx.dev` wildcard is still on Vercel; zone HSTS two years (no subdomains, no preload) and Always Use HTTPS; Worker secrets set by the owner (`AI_GATEWAY_API_KEY`, `CLERK_SECRET_KEY`, `CONVEX_SERVICE_SECRET`); Worker version `b362a9e3` from `fd8e501`. Verified: health commit `fd8e501`, apex 308 with path and query, `POST /mcp` on the apex 308, api, openapi and the MCP card 200. Signed-in flows untested until CF-05. Rollback: delete the four Worker custom domains and recreate the four A records from the DNS backup (`dns-pptx.dev-pre-cutover-20261005.json`, held by the supervisor outside the repository); the Vercel project still holds the domains (warm rollback) |
| CF-04 | Deploy-on-main workflows for openpresentation-site and pptx-gallery (deploy the Worker, then run the production checks) | openpresentation-site, pptx-gallery | CF-01, CF-02 | in-progress | merged: [openpresentation-site#77](https://github.com/Data-Advantage/openpresentation-site/pull/77), [pptx-gallery#97](https://github.com/Data-Advantage/pptx-gallery/pull/97); they skip until the owner adds `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Done when a deploy-on-main run and the production checks pass on GitHub |
| CF-05 | pptx.dev signed-in end-to-end test with `@clerk/testing` (sign-in, session cookies, protected routes on the Workers runtime) | pptx-dev | CF-03 | in-progress | suite and workflow merged ([pptx-dev#98](https://github.com/Data-Advantage/pptx-dev/pull/98), `eed596b`; not run: it needs the owner's Clerk test user and secrets; Clerk test emails use `+clerk_test` with the code 424242). Done when a run passes against the Workers runtime on the Clerk development instance |
| CF-06 | pptx.dev deploy-on-master workflow (its default branch is `master`) | pptx-dev | CF-03, CF-04 | in-progress | merged: [pptx-dev#100](https://github.com/Data-Advantage/pptx-dev/pull/100) (`3dcb647`); it stops at its gate until the owner adds `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `CONVEX_DEPLOY_KEY` (and the `NEXT_PUBLIC_*` variables). Done when a deploy-from-master run and its smoke pass on GitHub |
| CF-07 | openpresentation.org apex static-asset redirect: files served from Workers static assets on the apex (for example `/llms.txt`) redirect to `www` | openpresentation-site | CF-01 | done | [openpresentation-site#79](https://github.com/Data-Advantage/openpresentation-site/pull/79) merged (`3a2729c`), done in the repository without zone permissions: `assets.run_worker_first: true` with a wrapper Worker (`cloudflare/worker.mjs`) that answers an apex request, `/schema/*` excepted, with a 308 to `www` (path and query kept) and serves `www` assets from `env.ASSETS`; tradeoff recorded in `docs/cloudflare.md` (every asset request is a Worker request). Verified live 2026-10-06 07:16 UTC (curl): `https://openpresentation.org/llms.txt?x=1` 308 to `https://www.openpresentation.org/llms.txt?x=1`, `https://www.openpresentation.org/llms.txt` 200, `https://openpresentation.org/schema/opf/v1` 200 with `access-control-allow-origin: *` |
| CF-08 | Retire Vercel after a stable period and the owner's go-ahead: the `*.pptx.dev` wildcard record, the Vercel projects and domains, `@vercel/analytics`, `vercel.json`, the ignore-build scripts, the RR-49 Vercel gating (preview `deployment_status` checks, the bypass secret) and the Vercel references in the docs; reconcile RR-49 and RR-14 in the RR burndown | all three sites, opf | CF-04 to CF-07 | todo | |
| CF-09 | pptx-gallery media on R2: the 52 chart preview images (PNG and SVG), hotlinked from STORYD's Xano backend, are served from the R2 bucket `pptx-gallery-web` through `/media` on the gallery Worker | pptx-gallery | CF-02 | done | [pptx-gallery#102](https://github.com/Data-Advantage/pptx-gallery/pull/102) merged (`ee478e4`): content-addressed keys, `media/manifest.json` as the source of truth, `/media/*` answered by the Worker before OpenNext with the stored content type, `ETag` and 304, `immutable` caching, `nosniff`, a CSP on SVG, 404 for missing keys and no listing; `pnpm check:media-urls` fails on any Xano host in `data/`, `public/` or the build. Live 2026-10-06: `https://www.pptx.gallery/media/chart-previews/column.7db7b4c44249.svg` 200 `image/svg+xml` with the CSP and immutable cache, and `/api/charts.json` points the previews at `www.pptx.gallery/media/...`. The bucket and the 52 objects had to exist before the merge (a deploy with a binding to a missing bucket fails) |
| CF-10 | Self-hosted site fonts: no site build depends on `next/font/google` or any font CDN | pptx-gallery, pptx-dev, openpresentation-site | CF-02, CF-03 | done | [pptx-gallery#101](https://github.com/Data-Advantage/pptx-gallery/pull/101) (`4126fe1`; the gallery build on main had broken inside `next/font/google` for Fraunces and JetBrains Mono) and [pptx-dev#106](https://github.com/Data-Advantage/pptx-dev/pull/106) (`5b989a4`): `next/font/local` with the `@fontsource-variable` woff2 files pinned by SHA-256 in `data/site-fonts.json`, each family's upstream `OFL.txt` committed, and a test that fails on any `next/font/google` import, an unrecorded font file, a changed hash or a license outside OFL-1.1, Apache-2.0, MIT and UFL-1.0; openpresentation-site already used `next/font/local`. Live 2026-10-06: the home pages of pptx.gallery, pptx.dev and openpresentation.org reference no Google Fonts host |

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
- **CF-09.** No file in the repository or the build names the Xano host; the chart preview URLs in `/api/charts.json` resolve on the gallery's own `/media` and serve the stored bytes with their content type and cache headers.
- **CF-10.** No site build downloads a font at build time; each bundled face has a recorded SHA-256 and an allowed license.

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
- 2026-10-05 (evening): pptx-gallery media and fonts: [pptx-gallery#100](https://github.com/Data-Advantage/pptx-gallery/pull/100) removes the STORYD CTAs and the private repo link (owner decision 2026-10-05; revert `8725770` restores them), [pptx-gallery#102](https://github.com/Data-Advantage/pptx-gallery/pull/102) serves the chart preview images from R2 (CF-09; the owner rotated the leaked R2 token), [pptx-gallery#101](https://github.com/Data-Advantage/pptx-gallery/pull/101) and [pptx-dev#106](https://github.com/Data-Advantage/pptx-dev/pull/106) self-host the site fonts (CF-10). pptx.dev: the Worker has the `DECKS` R2 binding (`pptx-dev-user`) for the hosted services SVC-01 to SVC-04 ([pptx-dev#101](https://github.com/Data-Advantage/pptx-dev/pull/101), [pptx-dev#105](https://github.com/Data-Advantage/pptx-dev/pull/105)); [pptx-dev#99](https://github.com/Data-Advantage/pptx-dev/pull/99) blanked the R2 credentials in `.env.example`.
- 2026-10-05 (evening): CF-06 workflow merged ([pptx-dev#100](https://github.com/Data-Advantage/pptx-dev/pull/100), `3dcb647`) and CF-05 suite merged ([pptx-dev#98](https://github.com/Data-Advantage/pptx-dev/pull/98), `eed596b`); both wait for the owner's secrets and the Clerk test user. CF-07 was merged in the morning as [openpresentation-site#79](https://github.com/Data-Advantage/openpresentation-site/pull/79).
- 2026-10-06: CF-07 done on a live check (apex `/llms.txt?x=1` answers 308 to `www` with the query, `www` answers 200, `/schema/opf/v1` on the apex keeps `access-control-allow-origin: *`). CF-09 and CF-10 added and done (live: `/media` 200 with immutable cache and a CSP on SVG, no Google Fonts host on the three home pages). CF-04, CF-05 and CF-06 stay in-progress until the owner adds the Actions secrets and the Clerk test user and the supervisor runs each workflow once; CF-08 waits for a stable period and the owner's go-ahead.
