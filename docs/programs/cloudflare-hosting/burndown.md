# Cloudflare hosting: burndown

Goal, invariants, owner decisions and resume protocol: [README.md](README.md).
Related: [release readiness burndown](../release-readiness/burndown.md) (RR-49, RR-14).

Status values: `todo`, `in-progress`, `review` (PR open), `done` (merged and evidence linked), `descoped` (owner
decision, issue linked). Dates are UTC. One row per item, the six columns below, a status from the list. Phases:
0 owner setup, 1 openpresentation.org pilot, 2 pptx.gallery, 3 pptx.dev, 4 CI/CD, docs and decommission.

## Now

The work queue: one row per open item, saying who works on it, what blocks it and the next action. Update the row
whenever an item changes hands or state, and delete it when the item closes. Last updated 2026-10-04.

| ID | Owner | Working on | Blocked by | Next action |
| --- | --- | --- | --- | --- |
| CF-00 | supervisor | this program's README and burndown ([opf#342](https://github.com/OpenPresentation/opf/pull/342)) | none | review and merge |
| CF-01 | supervisor | [openpresentation-site#74](https://github.com/Data-Advantage/openpresentation-site/pull/74) (`codex/cf-01-opennext-pilot`): builds and runs on the Workers runtime on localhost, e2e 46/46 | none | review and merge; then the owner's workers.dev deploy (CF-04) |
| CF-02 | owner | Cloudflare account ("Data Advantage") and Workers plan | owner decision | decide Free or Paid; confirm the pptx.dev zone is in the same account |
| CF-03 | owner | analytics, AI provider, preview protection, Workers Builds | owner decision | answer the five decisions in the README |
| CF-07 | none | pptx.dev spike | CF-02 | first deploy-free spike: OpenNext build and bundle size of pptx.dev on a branch |

## Items

| ID | Item | Repos | Depends | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| CF-00 | Program opened: README (goal, scope, definition of done, invariants, owner decisions) and this burndown, linked from AGENTS.md | opf | none | review | [opf#342](https://github.com/OpenPresentation/opf/pull/342) |
| CF-01 | Phase 1. openpresentation.org builds for Cloudflare Workers with OpenNext, Vercel unchanged: `cf:build`, `cf:preview:local`, redirect and headers verified on workerd, pluggable analytics, `docs/cloudflare.md`, non-blocking CI job | openpresentation-site | none | review | [openpresentation-site#74](https://github.com/Data-Advantage/openpresentation-site/pull/74). Measured 2026-10-04: Worker 29.1 MiB uncompressed (6.0 MiB gzip; wrangler dry run in CI) of 64 MiB; 14,225 static assets of 20,000 Free / 100,000 Paid; largest 23.95 MiB of 25 MiB; Playwright e2e 46/46 on the Workers runtime (localhost) and 46/46 on `next start`; `pnpm test` and `pnpm audit` clean. Not deployed. |
| CF-02 | Phase 0. Owner: Cloudflare account and plan. Use "Data Advantage" (`136efd25cc10afb20714b72b2eb41cf3`); decide Workers Free or Paid; confirm the pptx.dev zone (different name-server pair) is in the same account; an API token (Workers Scripts: Edit) for CI or Workers Builds | none (owner) | none | todo | |
| CF-03 | Phase 0. Owner decisions: analytics replacement, pptx.dev AI provider, preview protection, Workers Builds Git integration (README, "Owner decisions needed") | none (owner) | none | todo | |
| CF-04 | Phase 1. openpresentation.org go-live: deploy the Worker to its workers.dev URL, run the e2e suite and curl checks against it, attach `www` and the apex (route on the proxied record or custom domain), zone Redirect Rule apex to www except `/schema/*`, rehearse rollback | openpresentation-site | CF-01, CF-02, CF-03 | todo | |
| CF-05 | Phase 2. pptx.gallery builds for Workers with OpenNext: about 1,923 prerendered routes, `/api/og` (`next/og`, CDN cached), `proxy.ts` (Vercel analytics `track()` via `waitUntil`; replace or drop), `Accept: application/json` content-negotiation rewrites with `Vary: Accept`, `next/font/google` (build needs network; bundle pinned files), about 67 MB build-time fonts and the 25 MiB per-file limit, headers; full e2e and production checks on the Workers runtime | pptx-gallery | CF-01 | todo | |
| CF-06 | Phase 2. pptx.gallery go-live and rollback rehearsal (same shape as CF-04); `www.pptx.gallery` canonical, apex redirect | pptx-gallery | CF-05, CF-02, CF-03 | todo | |
| CF-07 | Phase 3. pptx.dev spike: can the app run on Workers at all. OpenNext build, bundle size, `nodejs_compat` coverage, the list of blockers (CF-08 to CF-15) with measured numbers; go / no-go to the owner | pptx-dev | CF-01 | todo | |
| CF-08 | Phase 3. Native `@resvg/resvg-js` (via opf-render, `serverExternalPackages`) replaced by `@resvg/resvg-wasm` or moved off the Worker; output identical to the Node renderer on the existing fixtures | pptx-dev | CF-07 | todo | |
| CF-09 | Phase 3. Bundle size: pptxgenjs, jszip, the OPF toolkit, the AI SDK, MCP SDK and Clerk against the 64 MiB uncompressed Worker limit and the 1 s startup limit; split routes or Workers if needed (service bindings) | pptx-dev | CF-07 | todo | |
| CF-10 | Phase 3. `proxy.ts`: `clerkMiddleware`, the MCP rewrite and Vercel `track()` on Workers (Node middleware is experimental in OpenNext); Clerk DNS records (`clerk.`, `accounts.`) stay as they are | pptx-dev | CF-07 | todo | |
| CF-11 | Phase 3. Parse store: the in-memory `lib/parser/store.ts` does not survive across Worker isolates; move to Durable Objects, KV or R2 with the same API and TTL | pptx-dev | CF-07 | todo | |
| CF-12 | Phase 3. AI provider: `@ai-sdk/anthropic` behind Cloudflare AI Gateway replaces the Vercel AI Gateway model strings, the `VERCEL_OIDC_TOKEN` fallback and the `VERCEL` / `VERCEL_ENV` heuristics in `ai-refine-planner.ts` and `messages/route.ts`; RR-14 "Understand this deck" works with the same flags and allowlist | pptx-dev | CF-03, CF-07 | todo | |
| CF-13 | Phase 3. Build and Convex: `convex deploy --cmd 'pnpm run build'` with `CONVEX_DEPLOY_KEY` in Workers Builds or CI; map the environment (`AI_GATEWAY_API_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) to Worker secrets and build variables; check whether production needs `CONVEX_SERVICE_SECRET` / `CLERK_JWT_ISSUER_DOMAIN` (not in the Vercel environment); health route stops reading `VERCEL_GIT_COMMIT_SHA` | pptx-dev | CF-07 | todo | |
| CF-14 | Phase 3. Multi-host routing: `www`, apex (308 to www), `api.` and `mcp.` reach one Worker with the Host header preserved; anchored host matchers; routes and custom domains per hostname | pptx-dev | CF-07 | todo | |
| CF-15 | Phase 3. Streaming limits: long SSE agent streams against Worker CPU and wall-time limits, subrequest limits and the AI Gateway timeout; the MCP `/mcp` transport | pptx-dev | CF-07, CF-12 | todo | |
| CF-16 | Phase 3. pptx.dev go-live and rollback rehearsal (hostname by hostname: `www`, `api.`, `mcp.`, apex), Clerk production instance and Convex production deployment unchanged | pptx-dev | CF-08 to CF-15, CF-02, CF-03 | todo | |
| CF-17 | Phase 4. CI/CD replacement of the RR-49 Vercel pieces in the three sites: preview URL per pull request (Workers Builds or an Actions deploy of a preview version), the smoke check against it, the production checks against the Cloudflare deployment, build skipping for docs-only commits (path filters); retire `vercel-ignore-build.mjs`, `preview-smoke` `deployment_status` wiring and [opf#299](https://github.com/OpenPresentation/opf/issues/299) | pptx-gallery, openpresentation-site, pptx-dev | CF-04, CF-06, CF-16 | todo | |
| CF-18 | Phase 4. Docs: each site's `docs/cloudflare.md` becomes the hosting doc; AGENTS.md and release docs (`docs/release-process.md`) name Cloudflare; this program's findings folded into the contributor docs | opf, pptx-gallery, openpresentation-site, pptx-dev | CF-17 | todo | |
| CF-19 | Phase 4. Decommission Vercel after a stable period and the owner's go-ahead: remove the Vercel projects and domains, `@vercel/analytics`, `vercel.json`, `VERCEL_*` code paths and the Vercel gating docs; reconcile RR-49 and RR-14 in the RR burndown | all three sites | CF-18 | todo | |

## Acceptance criteria

- **CF-00.** `README.md` and `burndown.md` exist, AGENTS.md links the program in one line, a changelog fragment is
  added, and the RR burndown is untouched.
- **CF-01.** The site builds with `pnpm cf:build` and runs on the Workers runtime on localhost; the existing
  Playwright suite passes unchanged against it; the apex redirect (except `/schema/*`) and the CORS / nosniff headers
  hold, including on static files; analytics is pluggable and off unless configured; `pnpm build` and the Vercel
  deployment are unchanged and green; the Worker size and asset limits are measured; `docs/cloudflare.md` lists the
  owner steps and the rollback. No deploy, route or DNS change is made.
- **CF-02, CF-03.** The owner's answers are recorded in the README (a dated line each).
- **CF-04, CF-06, CF-16.** The Worker answers on its canonical hosts; the e2e suite and the curl checks (redirects,
  headers, `/schema/*`, `/mcp` for pptx.dev) pass against the production hostnames; rollback to Vercel was rehearsed
  and timed; the Vercel project still exists and deploys.
- **CF-05.** pptx.gallery's e2e suite and production checks pass on the Workers runtime; every gallery route and the
  `/api/og` images match Vercel's output; no font is hotlinked and no asset exceeds 25 MiB; the content-negotiation
  rewrites keep `Vary: Accept`.
- **CF-07.** A written go / no-go with the measured bundle size, startup time and the status of each blocker.
- **CF-08.** Rendering through the Worker is byte-identical (or within the renderer's existing tolerance, not relaxed)
  to the Node build on the existing fixtures.
- **CF-09.** The deployed Worker is under 64 MiB uncompressed and starts within 1 s; the largest routes are
  measured.
- **CF-10.** Sign-in, session cookies, the MCP rewrite and protected routes work on the Workers runtime against the
  Clerk development instance.
- **CF-11.** A parse created in one request is readable from another request that lands on a different isolate, until
  its TTL.
- **CF-12.** An AI request goes through Cloudflare AI Gateway with the Anthropic provider; no `VERCEL_*` branch remains
  in the AI code; the RR-14 flags behave as before.
- **CF-13.** A production build from CI or Workers Builds deploys Convex and the Worker; every secret is a Worker secret.
- **CF-14.** `https://api.pptx.dev`, `https://mcp.pptx.dev`, `https://www.pptx.dev` and the apex route to the same
  Worker and behave as they do on Vercel.
- **CF-15.** A long agent run streams to completion on Workers; limits and the chosen settings are documented.
- **CF-17.** Previews, smoke and production checks run against Cloudflare for the three sites; the Vercel-specific
  workflows are removed; RR-49 is marked obsolete in the RR burndown by the supervisor.
- **CF-19.** No site references Vercel in code, configuration or docs; the projects are deleted by the owner.

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
