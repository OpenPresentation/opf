# Site-side workflows for the OPF bump pull requests (MR-52, D19)

Drafts, not installed. `bump-sites.yml` in this repository opens a "bump to vX.Y.Z" pull request in each of the three site repositories
after a stable release and labels it `auto-merge` (a patch bump) or `needs-review` (a minor or major bump). It never merges one. The sites
are private repositories in a Free-plan organization, so they have no ruleset, no required check and no auto-merge: **each site's own CI
merges an `auto-merge` bump after its build and smoke checks passed, with the GitHub App's token** (decision D19). These files are that
merge, one per site. MR-52 installs them (a pull request per site, no deploy) after the App exists.

| Site (repository, default branch) | Files to copy to `.github/workflows/` | Required checks |
| --- | --- | --- |
| `Data-Advantage/openpresentation-site` (`main`) | `openpresentation-site/opf-bump-merge.yml` | `site` (the job of `site-ci.yml`) |
| `Data-Advantage/pptx-gallery` (`main`) | `pptx-gallery/opf-bump-merge.yml` and `pptx-gallery/build-and-smoke.yml` | `build-and-smoke` (new; pptx-gallery has no pull request CI for an arbitrary change) |
| `Data-Advantage/pptx-dev` (`master`) | `pptx-dev/opf-bump-merge.yml` | `verify (ubuntu-latest)` (application-ci.yml) and `build` (cloudflare-build.yml) |

## What `opf-bump-merge.yml` does

It runs on `workflow_run` when the site's pull request CI completes (so it executes the default branch's copy and no code from the bump
branch) and merges only if every condition holds; otherwise it stops with a notice and the pull request stays open:

1. the completed run succeeded, was a `pull_request` run, and its branch is a `bot/opf-v*` branch of this repository (no fork);
2. an open pull request exists for that branch, its head is the commit that run tested, it targets the default branch and is titled
   `bump to vX.Y.Z`;
3. it carries the label `auto-merge` and not `needs-review`;
4. it changes only manifests, the lockfile and the files a site mirrors its pins in (`ALLOWED_FILES`);
5. every check in `REQUIRED_CHECKS` is `success` for the head commit (the last completion decides: an earlier one finds a check pending);
6. then `gh pr merge --squash --delete-branch --match-head-commit <sha>` with the App's token, so the merge is a push by the App and starts
   the site's push and deploy workflows (a merge with `GITHUB_TOKEN` starts none).

The deploy path is the site's own and unchanged; nothing here deploys, logs in to a host or touches DNS.

## Install notes (owner steps O4 and O8 first)

1. **The App** (`docs/programs/monorepo/owner-steps.md`, O4 and O8): installed on the three site repositories with Contents and Pull
   requests read and write, and the secrets `ECOSYSTEM_APP_ID` and `ECOSYSTEM_APP_PRIVATE_KEY` set in each site repository. Two things to
   confirm on the first dry run: `bump-sites.yml` creates the labels `auto-merge` and `needs-review` in each site (if GitHub answers 403
   for the label call, add Issues: write to the App, or create the two labels by hand), and the App can merge (it has no branch protection
   to get past).
2. **Copy the files** by one pull request per site (MR-52). Each file's header says where it goes. Check the workflow names in `workflows:`
   and the check names in `REQUIRED_CHECKS` against the site's CI on the day: a renamed job or workflow silently never merges (it fails
   closed). If MR-52 renames a site's job to `build-and-smoke`, change the two names together.
3. **pptx-gallery's vendored editor.** `public/opf-editor` is a bundle built by core's `pnpm prepare:gallery:registry` from a sibling
   `opf-editor` checkout and `release-plan.json`; neither exists after the move, and the script has not been made monorepo-aware yet. So
   `bump-sites.yml` bumps the pins in pptx-gallery but cannot refresh the bundle: `verify:published-editor` in `build-and-smoke` fails,
   the bump stays open, and a person or agent refreshes the bundle on the bump branch (MR-52 follow-up: build it from `packages/editor/examples`
   at the release tag, then add the step to `bump-sites.yml` or to a pptx-gallery workflow it triggers). The first bump (0.25 to 0.26, and the
   gallery package from 5.0.0 to 0.26.0) is a `major` bump and needs review anyway.
4. **Rollback.** Delete the workflow files from the sites (and disable `bump-sites.yml`); the labels and pull requests are harmless.
5. **Dry run before the first release:** Actions, **Bump sites**, **Run workflow** in OpenPresentation/opf with an already published
   version (dry-run is true by default: the edits and the lockfile diff are shown in the job summary and nothing is pushed), then once
   with `dry-run` false for one site (`sites` input) on a patch version to see a pull request opened, checked and merged.
