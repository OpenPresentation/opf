# Program: Cloudflare hosting (CF)

Status: **active** (opened 2026-10-04). Tracker: [burndown.md](burndown.md).
This is the single source of truth for moving the three sites from Vercel to Cloudflare. Agents and people
resuming work start here, not from chat history or local scratch files.

## Goal

The owner's direction (2026-10-03), restated:

> Host pptx.gallery, openpresentation.org and pptx.dev on Cloudflare instead of Vercel, without downtime and
> without changing what the sites publish.

Sites in scope (the libraries and packages are not hosted and do not change):

- [openpresentation-site](https://github.com/Data-Advantage/openpresentation-site): openpresentation.org. The pilot (CF-01).
- [pptx-gallery](https://github.com/Data-Advantage/pptx-gallery): pptx.gallery (CF-05, CF-06).
- [pptx-dev](https://github.com/Data-Advantage/pptx-dev): pptx.dev, api.pptx.dev and mcp.pptx.dev. The hard one (CF-07 to CF-16).

Target: Next.js on Cloudflare Workers through OpenNext (`@opennextjs/cloudflare`), static assets on Workers static
assets, secrets as Worker secrets, DNS on the Cloudflare zones the domains already use. Vercel keeps serving each site
until that site's cutover is verified.

## Definition of done

Every burndown item is `done` or `descoped` with its evidence or issue linked, and specifically:

1. **Each site is served by a Cloudflare Worker** on its canonical hosts, and its existing end-to-end suite passes
   against the Cloudflare deployment (the suites are not edited to pass).
2. **No public contract changed**: `www` canonical hosts and the apex redirects, `api.` and `mcp.` hosts, `/schema/*`,
   `/mcp`, the SDK base URLs, the response headers (CORS and nosniff on the agent resources), the sitemap, robots and
   `llms*.txt`.
3. **Previews and CI are replaced**: a preview URL per pull request, a smoke check against it, and the production
   checks against the Cloudflare deployment, in place of the RR-49 Vercel pieces (CF-17).
4. **Rollback was rehearsed**: for each site, pointing DNS back at Vercel restored service while the Vercel project
   still existed.
5. **Vercel is decommissioned** only after a stable period and with the owner's go-ahead (CF-19): projects, domains,
   the Vercel analytics package, `vercel.json`, the ignore-build scripts and the Vercel gating docs.

## Invariants

- **No downtime.** Cut over one hostname at a time, behind a rehearsed rollback. Vercel keeps deploying `main` until
  CF-19.
- **Rollback is a DNS change**: point the records back at Vercel. Nothing is deleted on the Vercel side before CF-19.
- **Keep the public contracts** listed under Definition of done, including the canonical `www` hosts and the
  `api.pptx.dev` / `mcp.pptx.dev` hosts, `/schema/*`, `/mcp` and the SDK base URLs.
- **No public support, parity, progress or release-readiness status on any site** (no badges, legends, panels, API
  fields or `llms.txt` lines). Tracking stays in this repository.
- **Secrets only as Worker secrets** (or build variables for public `NEXT_PUBLIC_*` values). Never commit a secret;
  never put one in `wrangler.jsonc`.
- **Fonts are bundled, never hotlinked**, with permissive licenses only; `pnpm check:font-hotlinks` keeps passing in
  every site build. The Workers per-file limit (25 MiB) is a font constraint: the largest bundled face is within
  1.05 MiB of it.
- **Agents do not deploy, log in, or change DNS, Cloudflare or Vercel settings.** The owner (or the supervisor with the
  owner's go-ahead per site) does. Agents build locally and run `wrangler dev` / `opennextjs-cloudflare preview` on
  localhost only. The `wrangler` login on the owner's Mac belongs to a different company's account and is never used;
  OPF deploys go to the "Data Advantage" account (`136efd25cc10afb20714b72b2eb41cf3`).
- **No network or model calls in the libraries**; AI lives only in pptx.dev.
- Keep source, packed, registry and deployed claims separate.

## Owner decisions needed

Nothing past the pilot is blocked on code; these are the owner's calls (tracked as CF-02 and CF-03):

1. **Cloudflare account and plan.** Use the "Data Advantage" account (it holds the three zones) and decide whether to
   buy Workers Paid. The pilot fits the Free limits today (Worker 29.1 MiB of 64 MiB, 14,225 of 20,000 static assets),
   but pptx.gallery has about 1,900 prerendered routes and pptx.dev is large and CPU-bound; Paid is recommended for
   CPU time, request volume and headroom. Note pptx.dev's zone sits on a different name-server pair than the other two:
   confirm it is the same account.
2. **Analytics replacement.** Recommended: Cloudflare Web Analytics (page views; no custom events). Vercel Analytics
   `track()` events (TrackedLink on openpresentation.org, the pptx.gallery proxy) have no equivalent there; decide
   whether they are needed.
3. **pptx.dev AI provider.** Recommended: `@ai-sdk/anthropic` behind Cloudflare AI Gateway, replacing the Vercel AI
   Gateway model strings and the `VERCEL_OIDC_TOKEN` fallback. The Claude Sonnet 5.5 model choice (RR-14) is unchanged.
4. **Preview protection.** Cloudflare Access on preview URLs (private, like Vercel's SSO protection) or public previews.
   Public previews are simpler for CI smoke checks; none of the three sites holds private content, but pptx.dev
   previews need the Clerk and Convex preview environments.
5. **Workers Builds Git integration.** Let Cloudflare build from GitHub (needs the Cloudflare GitHub app on the
   Data-Advantage organisation) or deploy from GitHub Actions with an API token secret. Workers Builds gives a preview
   URL per branch with no Actions minutes.

## What the pilot found (CF-01, openpresentation.org)

Recorded here because they apply to the other two sites:

- OpenNext tests a `has: host` redirect value as an unanchored RegExp, so a bare `openpresentation.org` also matched
  `www.openpresentation.org` and looped the canonical host. Anchor host matchers (`^openpresentation\.org$`).
  pptx.dev's `api.` / `mcp.` host rewrites need the same care.
- Workers serves static assets before the Worker runs: `next.config` `headers()` do not reach static files and apex
  redirects do not apply to them. The pilot generates `_headers` from `headers()`; the apex redirect for static files is
  a zone Redirect Rule.
- `wrangler dev` on macOS fails with `spawn EBADF` above about 10,000 asset files (bisected: 7,573 serve, 11,661 do
  not). It is a local-only limit; the pilot ships `pnpm cf:preview:local`. `agent-docs/docs/evidence` is 86 % of the
  asset count.
- Since 2026-09-04 Workers limits only the uncompressed bundle (64 MiB, Free and Paid); the old 3 MB / 10 MB gzip
  limits are gone. Static assets: 20,000 files Free, 100,000 Paid, 25 MiB per file.
- `@opennextjs/cloudflare` 1.20.x needs `next >=16.3.8`: openpresentation-site moved from 16.3.6.

## Relation to the release-readiness program

Once CF-* lands, these RR items become obsolete or change (the RR burndown is not edited here; the supervisor
reconciles it when a CF item closes):

- **RR-49** (Vercel Ignored Build Step, `deployment_status` preview and production workflows, `vercel-gating.md`) is
  replaced by CF-17, and [opf#299](https://github.com/OpenPresentation/opf/issues/299) (the owner's Vercel settings for
  it) becomes obsolete.
- **RR-14**'s gateway step (the owner configuring the Vercel AI Gateway for "Understand this deck") changes to the
  Cloudflare AI Gateway and the provider SDK (CF-12).
- The sites' `vercel.json`, `@vercel/analytics`, `VERCEL_*` heuristics and the Vercel references in each site's docs go
  in CF-18 / CF-19.

## Naming

- Branches: `codex/cf-<nn>-<slug>` (for example `codex/cf-01-opennext-pilot`).
- PR titles start with the item ID: `CF-<nn>: ...`.
- Statuses: `todo`, `in-progress`, `review` (PR open), `done` (merged and evidence linked), `descoped` (owner decision,
  issue linked).
- Item IDs are not in phase order: CF-01 is the pilot, CF-02 and CF-03 are the owner's phase 0.

## Resume protocol

Any session resuming this program:

1. Read this file and [burndown.md](burndown.md). The progress log at the end is the latest state; the Now table says
   who works on what and what blocks it.
2. `git fetch` every repository in scope and work only from fresh `origin/main` worktrees (never switch or clean the
   owner's checkouts). pptx-dev's default branch is `master`.
3. List open program PRs: `gh api repos/<owner>/<repo>/pulls` (REST) and reconcile any drift into the burndown.
4. Pick the lowest-numbered `todo` item whose dependencies are `done` and that is not an owner item. Branch
   `codex/cf-<nn>-<slug>`; start the PR title with `CF-<nn>: `.
5. An item is `done` only when its acceptance criteria hold and its evidence is linked. Items that need a deploy,
   a DNS change, a secret or a Cloudflare setting are the owner's (or the supervisor's with the owner's go-ahead): the
   agent prepares the exact steps in the repository's `docs/cloudflare.md` and stops.
6. When an item changes state, update its row and append one dated line to the progress log.

## Related

- Pilot runbook and owner steps: `docs/cloudflare.md` in openpresentation-site.
- [Release readiness](../release-readiness/README.md) (RR-49, RR-14) and its [CI/CD study](../release-readiness/ci-cd.md).
- [Font files: bundling and licenses](../font-fidelity-everywhere/font-licensing.md#font-files-bundling-and-licenses).
